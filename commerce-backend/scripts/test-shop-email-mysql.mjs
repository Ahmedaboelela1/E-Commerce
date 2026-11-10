import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {once} from 'node:events';
import net from 'node:net';
import mysql from 'mysql2/promise';
import {smtpCapture} from './testing/smtp-capture.mjs';

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(check,message,timeout=60000){const end=Date.now()+timeout;while(Date.now()<end){const result=await check();if(result)return result;await delay(200);}throw Error(message);}
async function freePort(){const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));return port;}
function tokenFromMail(message){const raw=message.raw.replace(/=\r\n/g,'').replace(/=3D/g,'=');const match=raw.match(/https:\/\/shop\.example\.invalid\/en\/(?:verify|reset-password)\?token=([^\s<"']+)/);assert.ok(match,'message contains the storefront token link');return new URL('https://shop.example.invalid/en/verify?token='+match[1]).searchParams.get('token');}

test('real Vendure verification/reset emails use the durable SQL queue across restart and SMTP retry',{
    skip:!process.env.VENDURE_EMAIL_TEST_PORT,timeout:180000,
},async t=>{
    const database='vendure_email_ci';
    const control=await mysql.createConnection({host:'127.0.0.1',port:Number(process.env.VENDURE_EMAIL_TEST_PORT),user:'root',password:'ci-vendure-test-password'});
    await control.query('CREATE DATABASE IF NOT EXISTS '+database);
    const [[tables]]=await control.query('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=?',[database]);
    assert.equal(Number(tables.n),0,'use an empty disposable database');
    const smtp=await smtpCapture({rejectFirst:true}),port=await freePort();
    let child,logs='';
    async function stop(){if(child&&child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}child=undefined;}
    t.after(async()=>{await stop();await smtp.close();await control.query('DROP DATABASE '+database);await control.end();});
    const env={...process.env,APP_ENV:'dev',DB_HOST:'127.0.0.1',DB_PORT:process.env.VENDURE_EMAIL_TEST_PORT,
        DB_NAME:database,DB_USERNAME:'root',DB_PASSWORD:'ci-vendure-test-password',PORT:String(port),
        SUPERADMIN_USERNAME:'email-ci@example.invalid',SUPERADMIN_PASSWORD:'synthetic-ci-admin-password-12345678',
        COOKIE_SECRET:'synthetic-ci-cookie-secret-at-least-32-characters',HOSTINGER_INITIALIZE_COUNTRIES:'YES_NEW_EMPTY_DATABASE',
        ASSET_UPLOAD_DIR:'/tmp/skillverse-email-ci-assets-'+port,EMAIL_ENABLED:'true',SMTP_HOST:'127.0.0.1',SMTP_PORT:String(smtp.port),
        SMTP_SECURE:'false',SMTP_USER:'ahmed@skillverse-global.com',SMTP_PASSWORD:'synthetic-ci-email-password',
        EMAIL_FROM_ADDRESS:'info@skillverse-global.com',EMAIL_ADMIN_TO:'ops@example.invalid',
        STOREFRONT_PUBLIC_URL:'https://shop.example.invalid',BACKEND_PUBLIC_URL:'https://api.example.invalid'};
    let channelToken='';
    async function query(query,variables={},auth='',admin=false){
        const response=await fetch(`http://127.0.0.1:${port}/${admin?'admin-api':'shop-api'}`,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{}),...(channelToken?{'vendure-token':channelToken}:{})},body:JSON.stringify({query,variables})});
        const result=await response.json();assert.ok(!result.errors,JSON.stringify(result.errors));return {data:result.data,token:response.headers.get('vendure-auth-token')};
    }
    async function start(jobs){child=spawn(process.execPath,['dist/index.js'],{cwd:process.cwd(),env:{...env,RUN_JOBS_IN_SERVER:String(jobs)},stdio:['ignore','pipe','pipe']});
        child.stdout.on('data',chunk=>{logs+=chunk;});child.stderr.on('data',chunk=>{logs+=chunk;});
        await waitFor(async()=>{if(child.exitCode!==null)throw Error('Isolated Vendure failed to boot: '+logs.slice(-2500));try{return (await query('{ activeChannel { code } }')).data.activeChannel;}catch{return false;}},'Shop API did not start');
    }
    await start(false);
    // All fixture provisioning is confined to this disposable loopback database.
    await promisify(execFile)(process.execPath,['scripts/provision-egypt.mjs'],{env:{...env,
        ADMIN_API_URL:`http://localhost:${port}/admin-api`,EGYPT_SELLER_LEGAL_NAME:'Isolated CI fixture seller',
        PROVISION_APPLY:'YES_I_APPROVE_EGYPT_SETUP',EGYPT_AGENT_ADMIN_EMAIL:''}});
    const signedAdmin=await query('mutation($username:String!,$password:String!){login(username:$username,password:$password){__typename ... on CurrentUser{id}}}',{username:env.SUPERADMIN_USERNAME,password:env.SUPERADMIN_PASSWORD},'',true);
    assert.equal(signedAdmin.data.login.__typename,'CurrentUser');const adminToken=signedAdmin.token;assert.ok(adminToken);
    const setup=await query('{channels{items{id code token}} stockLocations{items{id name}} zones{items{id name}}}',{},adminToken,true);
    channelToken=setup.data.channels.items.find(c=>c.code==='skillverse-eg').token;
    const stock=setup.data.stockLocations.items.find(s=>s.name==='Egypt — Local Agent Warehouse');
    const tax=await query('mutation{createTaxCategory(input:{name:"CI test tax category",isDefault:true}){id}}',{},adminToken,true);
    await query('mutation($input:CreateTaxRateInput!){createTaxRate(input:$input){id}}',{input:{name:'CI zero tax',enabled:true,value:0,categoryId:tax.data.createTaxCategory.id,zoneId:setup.data.zones.items.find(z=>z.name==='Egypt').id}},adminToken,true);
    const product=await query('mutation($input:CreateProductInput!){createProduct(input:$input){id}}',{input:{enabled:true,translations:[{languageCode:'en',name:'CI robot',slug:'ci-robot',description:'Isolated test product'}]}},adminToken,true);
    const variant=await query('mutation($input:[CreateProductVariantInput!]!){createProductVariants(input:$input){id}}',{input:[{productId:product.data.createProduct.id,sku:'CI-ROBOT',price:10000,taxCategoryId:tax.data.createTaxCategory.id,trackInventory:'TRUE',stockLevels:[{stockLocationId:stock.id,stockOnHand:5}],translations:[{languageCode:'en',name:'CI robot'}]}]},adminToken,true);
    const shipping=await query('mutation($input:CreateShippingMethodInput!){createShippingMethod(input:$input){id}}',{input:{code:'ci-cairo-delivery',fulfillmentHandler:'manual-fulfillment',checker:{code:'egypt-governorate',arguments:[{name:'governorate',value:'cairo'}]},calculator:{code:'default-shipping-calculator',arguments:[{name:'rate',value:'11500'},{name:'includesTax',value:'include'},{name:'taxRate',value:'0'}]},translations:[{languageCode:'en',name:'CI Cairo delivery',description:'Test fixture only'}]}},adminToken,true);
    const alexShipping=await query('mutation($input:CreateShippingMethodInput!){createShippingMethod(input:$input){id}}',{input:{code:'ci-alex-delivery',fulfillmentHandler:'manual-fulfillment',checker:{code:'egypt-governorate',arguments:[{name:'governorate',value:'alexandria'}]},calculator:{code:'default-shipping-calculator',arguments:[{name:'rate',value:'17500'},{name:'includesTax',value:'include'},{name:'taxRate',value:'0'}]},translations:[{languageCode:'en',name:'CI Alexandria delivery',description:'Synthetic rate, not a production price'}]}},adminToken,true);
    await query('mutation($input:CreatePaymentMethodInput!){createPaymentMethod(input:$input){id}}',{input:{code:'cash-on-delivery',enabled:true,handler:{code:'cash-on-delivery',arguments:[]},translations:[{languageCode:'en',name:'CI COD',description:'Test fixture only'}]}},adminToken,true);
    await query('mutation($input:CreatePaymentMethodInput!){createPaymentMethod(input:$input){id}}',{input:{code:'bank-transfer',enabled:true,handler:{code:'bank-transfer',arguments:[]},translations:[{languageCode:'en',name:'CI InstaPay / Bank Transfer',description:'CI beneficiary / bank details — test fixture only'}]}},adminToken,true);

    const signup=await query('mutation($input:RegisterCustomerInput!){ registerCustomerAccount(input:$input){ __typename ... on Success{success} ... on ErrorResult{message} } }',{input:{emailAddress:'customer@example.invalid',password:'customer-ci-password-12345',firstName:'CI',lastName:'Customer',phoneNumber:'01012345678'}});
    assert.equal(signup.data.registerCustomerAccount.__typename,'Success');
    await waitFor(async()=>{const [[row]]=await control.query('SELECT COUNT(*) AS n FROM '+database+'.job_record WHERE queueName=?',['send-email']);return Number(row.n)>0;},'Verification email was not queued');
    assert.equal(smtp.messages.length,0,'stopped workers must not send mail');
    await stop();await start(true);
    await waitFor(()=>smtp.messages.length===1,'Persisted email did not survive restart and SMTP retry',90000);
    assert.match(smtp.messages[0].raw,/From:.*info@skillverse-global.com/);
    assert.match(smtp.messages[0].recipients.join(','),/customer@example.invalid/);
    const token=tokenFromMail(smtp.messages[0]);
    const verifyMutation='mutation($token:String!){ verifyCustomerAccount(token:$token){ __typename ... on CurrentUser{id identifier} ... on ErrorResult{message} } }';
    const verified=await query(verifyMutation,{token});assert.equal(verified.data.verifyCustomerAccount.__typename,'CurrentUser');
    const repeated=await query(verifyMutation,{token});assert.notEqual(repeated.data.verifyCustomerAccount.__typename,'CurrentUser','verification token is single use');
    const login=await query('mutation{login(username:"customer@example.invalid",password:"customer-ci-password-12345"){__typename ... on CurrentUser{id}}}');assert.equal(login.data.login.__typename,'CurrentUser');
    await query('mutation{ requestPasswordReset(emailAddress:"customer@example.invalid"){__typename ... on Success{success}} }');
    await waitFor(()=>smtp.messages.length===2,'Reset password email was not delivered');
    const resetToken=tokenFromMail(smtp.messages[1]);
    const reset=await query('mutation($token:String!){resetPassword(token:$token,password:"changed-customer-password-12345"){__typename ... on CurrentUser{id} ... on ErrorResult{message}}}',{token:resetToken});
    assert.equal(reset.data.resetPassword.__typename,'CurrentUser');
    const after=await query('mutation{login(username:"customer@example.invalid",password:"changed-customer-password-12345"){__typename ... on CurrentUser{id}}}');assert.equal(after.data.login.__typename,'CurrentUser');
    assert.equal(smtp.messages.length,2,'account emails must not be copied to the administrator');
    const customerToken=after.token;assert.ok(customerToken);
    const added=await query('mutation($id:ID!){addItemToOrder(productVariantId:$id,quantity:1){__typename ... on Order{id code} ... on ErrorResult{message}}}',{id:variant.data.createProductVariants[0].id},customerToken);
    assert.equal(added.data.addItemToOrder.__typename,'Order',JSON.stringify(added.data));const order=added.data.addItemToOrder;
    const addressed=await query('mutation($input:CreateAddressInput!){setOrderShippingAddress(input:$input){__typename ... on ErrorResult{message}}}',{input:{fullName:'CI Customer',streetLine1:'CI test street',city:'Cairo',province:'Cairo',countryCode:'EG',phoneNumber:'01012345678'}},customerToken);assert.equal(addressed.data.setOrderShippingAddress.__typename,'Order');
    const eligible=await query('{eligibleShippingMethods{id priceWithTax}}',{},customerToken);
    assert.deepEqual(eligible.data.eligibleShippingMethods.map(m=>[m.id,m.priceWithTax]),[[shipping.data.createShippingMethod.id,11500]]);
    const wrongGovernorate=await query('mutation($id:ID!){setOrderShippingMethod(shippingMethodId:[$id]){__typename ... on ErrorResult{message}}}',{id:alexShipping.data.createShippingMethod.id},customerToken);
    assert.notEqual(wrongGovernorate.data.setOrderShippingMethod.__typename,'Order','a crafted request must not choose another governorate rate');
    const delivery=await query('mutation($id:ID!){setOrderShippingMethod(shippingMethodId:[$id]){__typename ... on ErrorResult{message}}}',{id:shipping.data.createShippingMethod.id},customerToken);assert.equal(delivery.data.setOrderShippingMethod.__typename,'Order');
    const transitioned=await query('mutation{transitionOrderToState(state:"ArrangingPayment"){__typename ... on ErrorResult{message}}}',{},customerToken);assert.equal(transitioned.data.transitionOrderToState.__typename,'Order',JSON.stringify(transitioned.data));
    const placed=await query('mutation{addPaymentToOrder(input:{method:"cash-on-delivery",metadata:{}}){__typename ... on Order{state payments{id state method}} ... on ErrorResult{message}}}',{},customerToken);
    assert.equal(placed.data.addPaymentToOrder.__typename,'Order',JSON.stringify(placed.data));assert.equal(placed.data.addPaymentToOrder.state,'PaymentAuthorized');
    assert.equal(placed.data.addPaymentToOrder.payments[0].state,'Authorized');
    await waitFor(()=>smtp.messages.length===4,'COD customer/admin emails were not delivered');
    const orderMail=smtp.messages.slice(2);assert.ok(orderMail.some(m=>m.recipients.join(',').includes('customer@example.invalid')));assert.ok(orderMail.some(m=>m.recipients.join(',').includes('ops@example.invalid')));
    for(const message of orderMail)assert.match(message.raw,/From:.*info@skillverse-global.com/);
    const note=await query('mutation($input:AddNoteToOrderInput!){addNoteToOrder(input:$input){id}}',{input:{id:order.id,note:'Phone confirmed — isolated test; shipment is arranged manually.',isPublic:false}},adminToken,true);assert.equal(note.data.addNoteToOrder.id,order.id);
    const inspected=await query('query($id:ID!){order(id:$id){state payments{id state} fulfillments{id}}}',{id:order.id},adminToken,true);
    assert.equal(inspected.data.order.state,'PaymentAuthorized');assert.equal(inspected.data.order.payments[0].state,'Authorized');assert.equal(inspected.data.order.fulfillments.length,0,'email or a phone-call note must never auto-ship or collect money');
    const settled=await query('mutation($id:ID!){settlePayment(id:$id){__typename ... on Payment{state} ... on ErrorResult{message}}}',{id:inspected.data.order.payments[0].id},adminToken,true);assert.equal(settled.data.settlePayment.state,'Settled');
    await waitFor(async()=>{const [[n]]=await control.query('SELECT COUNT(*) AS n FROM '+database+'.job_record WHERE queueName=? AND state<>?',['send-email','COMPLETED']);return Number(n.n)===0;},'Emails did not finish');
    assert.equal(smtp.messages.length,4,'cash collection must not send a duplicate initial request acknowledgement');
    // Editing a governorate's rate affects a new cart, never the existing order.
    await query('mutation($input:UpdateShippingMethodInput!){updateShippingMethod(input:$input){id}}',{input:{id:shipping.data.createShippingMethod.id,translations:[{languageCode:'en',name:'CI Cairo delivery',description:'Test fixture only'}],calculator:{code:'default-shipping-calculator',arguments:[{name:'rate',value:'14500'},{name:'includesTax',value:'include'},{name:'taxRate',value:'0'}]}}},adminToken,true);
    const oldOrder=await query('query($id:ID!){order(id:$id){shippingWithTax totalWithTax}}',{id:order.id},adminToken,true);
    assert.equal(oldOrder.data.order.shippingWithTax,11500);assert.equal(oldOrder.data.order.totalWithTax,21500);
    // A second real order uses a manual transfer and the Arabic governorate name.
    const bankAdded=await query('mutation($id:ID!){addItemToOrder(productVariantId:$id,quantity:1){__typename ... on Order{id code} ... on ErrorResult{message}}}',{id:variant.data.createProductVariants[0].id},customerToken);
    assert.equal(bankAdded.data.addItemToOrder.__typename,'Order');const bankOrder=bankAdded.data.addItemToOrder;
    await query('mutation($input:CreateAddressInput!){setOrderShippingAddress(input:$input){__typename ... on ErrorResult{message}}}',{input:{fullName:'CI Customer',streetLine1:'CI bank order street',city:'Unknown',province:'not-a-governorate',countryCode:'EG',phoneNumber:'01012345678'}},customerToken);
    const unknownEligible=await query('{eligibleShippingMethods{id}}',{},customerToken);assert.equal(unknownEligible.data.eligibleShippingMethods.length,0,'an unknown governorate must not receive a fabricated flat rate');
    await query('mutation($input:CreateAddressInput!){setOrderShippingAddress(input:$input){__typename ... on ErrorResult{message}}}',{input:{fullName:'CI Customer',streetLine1:'CI bank order street',city:'Cairo',province:'القاهرة',countryCode:'EG',phoneNumber:'01012345678'}},customerToken);
    const arabicEligible=await query('{eligibleShippingMethods{id priceWithTax}}',{},customerToken);
    assert.deepEqual(arabicEligible.data.eligibleShippingMethods.map(m=>[m.id,m.priceWithTax]),[[shipping.data.createShippingMethod.id,14500]]);
    await query('mutation($id:ID!){setOrderShippingMethod(shippingMethodId:[$id]){__typename ... on ErrorResult{message}}}',{id:shipping.data.createShippingMethod.id},customerToken);
    await query('mutation{transitionOrderToState(state:"ArrangingPayment"){__typename ... on ErrorResult{message}}}',{},customerToken);
    const bankPlaced=await query('mutation{addPaymentToOrder(input:{method:"bank-transfer",metadata:{public:{paymentInstructions:"malicious override"}}}){__typename ... on Order{state totalWithTax shippingWithTax payments{id state method metadata}} ... on ErrorResult{message}}}',{},customerToken);
    assert.equal(bankPlaced.data.addPaymentToOrder.__typename,'Order',JSON.stringify(bankPlaced.data));
    const bankResult=bankPlaced.data.addPaymentToOrder;
    assert.equal(bankResult.state,'PaymentAuthorized');assert.equal(bankResult.shippingWithTax,14500);assert.equal(bankResult.totalWithTax,24500);
    assert.equal(bankResult.payments[0].state,'Authorized');
    assert.match(bankResult.payments[0].metadata.public.paymentInstructions,/CI beneficiary/);
    assert.equal(bankResult.payments[0].metadata.transferVerification,undefined,'private metadata is not exposed in Shop API');
    await waitFor(()=>smtp.messages.length===6,'Transfer customer/admin emails were not delivered');
    const bankEmails=smtp.messages.slice(4);assert.ok(bankEmails.some(m=>m.recipients.join(',').includes('customer@example.invalid')));assert.ok(bankEmails.some(m=>m.recipients.join(',').includes('ops@example.invalid')));
    for(const message of bankEmails){const raw=message.raw.replace(/=\r\n/g,'').replace(/=3D/g,'=');assert.match(raw,/Bank Transfer|bank transfer|InstaPay/i);assert.ok(!raw.includes('malicious override'));}
    const pendingBank=await query('query($id:ID!){order(id:$id){state payments{id state metadata} fulfillments{id}}}',{id:bankOrder.id},adminToken,true);
    assert.equal(pendingBank.data.order.fulfillments.length,0);assert.equal(pendingBank.data.order.payments[0].metadata.transferVerification,'pending');
    const bankSettled=await query('mutation($id:ID!){settlePayment(id:$id){__typename ... on Payment{state metadata} ... on ErrorResult{message}}}',{id:bankResult.payments[0].id},adminToken,true);
    assert.equal(bankSettled.data.settlePayment.state,'Settled');assert.equal(bankSettled.data.settlePayment.metadata.transferVerification,'verified');
    await waitFor(async()=>{const [[n]]=await control.query('SELECT COUNT(*) AS n FROM '+database+'.job_record WHERE queueName=? AND state<>?',['send-email','COMPLETED']);return Number(n.n)===0;},'Bank emails did not finish');
    assert.equal(smtp.messages.length,6,'manual verification must not resend the initial acknowledgement');
    assert.ok(smtp.authUsers.length>0);assert.ok(smtp.authUsers.every(user=>user==='ahmed@skillverse-global.com'));

    const [jobs]=await control.query('SELECT state,attempts FROM '+database+'.job_record WHERE queueName=?',['send-email']);
    assert.ok(jobs.every(j=>j.state==='COMPLETED'));assert.ok(jobs.some(j=>Number(j.attempts)>1),'temporary SMTP rejection must retry through the real SQL queue');
});
