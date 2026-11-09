import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {smtpCapture} from './testing/smtp-capture.mjs';
const require=createRequire(import.meta.url);
require('reflect-metadata');
const {RequestContext,Channel,User,NativeAuthenticationMethod,EntityHydrator,
    AccountRegistrationEvent,PasswordResetEvent,IdentifierChangeRequestEvent,AdministratorPasswordResetEvent,
    Administrator,OrderStateTransitionEvent}=require('@vendure/core');
const {EmailProcessor}=require('@vendure/email-plugin/lib/src/email-processor');
const {readShopEmailSettings}=require('../dist/email-settings.js');
const {createShopEmailOptions}=require('../dist/shop-email.js');
const base={EMAIL_ENABLED:'true',APP_ENV:'production',SMTP_USER:'ahmed@skillverse-global.com',SMTP_PASSWORD:'isolated-test-only',
    EMAIL_FROM_ADDRESS:'info@skillverse-global.com',EMAIL_ADMIN_TO:'ops@example.invalid',
    STOREFRONT_PUBLIC_URL:'https://shop.example.invalid',BACKEND_PUBLIC_URL:'https://api.example.invalid'};

test('SMTP is opt-in and supports a separate mailbox login and sender while validating TLS, links and headers',()=>{
    assert.equal(readShopEmailSettings({}),undefined);
    assert.equal(readShopEmailSettings({...base,EMAIL_ENABLED:'false'}),undefined);
    const settings=readShopEmailSettings(base);
    assert.equal(settings.host,'smtp.hostinger.com');assert.equal(settings.port,465);assert.equal(settings.secure,true);
    assert.equal(settings.user,'ahmed@skillverse-global.com');assert.equal(settings.fromAddress,'info@skillverse-global.com');
    const tls=readShopEmailSettings({...base,SMTP_PORT:'587',SMTP_SECURE:'false'});assert.equal(tls.requireTLS,true);
    for(const change of [{SMTP_USER:'not-an-email'},{SMTP_PASSWORD:''},
        {SMTP_PASSWORD:'REPLACE_ME'},{SMTP_PORT:'25'},{SMTP_PORT:'465',SMTP_SECURE:'false'},
        {STOREFRONT_PUBLIC_URL:'https://shop.example.invalid@evil.test/path'},
        {STOREFRONT_PUBLIC_URL:'http://shop.example.invalid'},
        {EMAIL_FROM_ADDRESS:'info@example.invalid\r\nBcc:attacker@example.invalid'},
        {EMAIL_ADMIN_TO:'ops@example.invalid,other@example.invalid'},{EMAIL_FROM_NAME:'Name\r\nBcc:evil'},
        {EMAIL_ENABLED:'yes'},{SMTP_SECURE:'yes'}]){
        assert.throws(()=>readShopEmailSettings({...base,...change}),error=>!error.message.includes('isolated-test-only'));
    }
});
function ctx(languageCode='en',code='skillverse-eg'){
    return new RequestContext({apiType:'shop',channel:new Channel({id:1,code,token:'test-token',defaultLanguageCode:'en',defaultCurrencyCode:'EGP'}),languageCode,isAuthorized:true,authorizedAsOwnerOnly:false});
}
function user(){return new User({id:2,identifier:'customer@example.invalid',authenticationMethods:[new NativeAuthenticationMethod({identifier:'customer@example.invalid',pendingIdentifier:'new@example.invalid',verificationToken:'verify+/= ?&',passwordResetToken:'reset+/= ?&',identifierChangeToken:'change+/= ?&'})]});}
const injector={get(token){assert.equal(token,EntityHydrator);return {hydrate:async()=>{}};}};
function order(){return {id:3,code:'EG-TEST-1',currencyCode:'EGP',totalWithTax:12500,shippingWithTax:2500,
    customer:{emailAddress:'customer@example.invalid',firstName:'<img src=x onerror=alert(1)>',lastName:'Customer',phoneNumber:'01012345678'},
    shippingAddress:{phoneNumber:'01012345678',streetLine1:'<script>bad</script>',city:'Cairo',country:'Egypt'},
    payments:[{method:'cash-on-delivery',state:'Authorized'}],
    lines:[{productVariant:{name:'Robot <script>bad</script>'},quantity:1,linePriceWithTax:10000}]};}

test('real handlers, MJML rendering and SMTP deliver correct account links and separate COD customer/admin messages',async t=>{
    const smtp=await smtpCapture();t.after(()=>smtp.close());
    const settings=readShopEmailSettings({...base,APP_ENV:'dev',SMTP_HOST:'127.0.0.1',SMTP_PORT:String(smtp.port),SMTP_SECURE:'false'});
    const options=createShopEmailOptions(settings),events=[];
    const processor=new EmailProcessor(options,{get:token=>injector.get(token)},{publish:async event=>events.push(event)});
    await processor.init();
    const context=ctx(),account=user();
    const inputs=[
        [new AccountRegistrationEvent(context,account),'email-verification','customer@example.invalid','/en/verify','verify+/= ?&'],
        [new PasswordResetEvent(context,account),'password-reset','customer@example.invalid','/en/reset-password','reset+/= ?&'],
        [new IdentifierChangeRequestEvent(context,account),'email-address-change','new@example.invalid','/en/account/verify-email','change+/= ?&'],
        [new AdministratorPasswordResetEvent(context,new Administrator({emailAddress:'admin@example.invalid'}),account),'admin-password-reset','admin@example.invalid','/dashboard/reset-password','reset+/= ?&'],
        [new OrderStateTransitionEvent('ArrangingPayment','PaymentAuthorized',context,order()),'cod-order-request','customer@example.invalid'],
        [new OrderStateTransitionEvent('ArrangingPayment','PaymentAuthorized',context,order()),'cod-admin-alert','ops@example.invalid'],
    ];
    for(const [event,type,to,path,token] of inputs){
        const handler=options.handlers.find(h=>h.type===type);
        const data=await handler.handle(event,await options.globalTemplateVars(context,injector),injector);
        assert.equal(data.recipient,to);assert.equal(data.replyTo,settings.fromAddress);assert.equal(data.bcc,undefined);
        if(path){const link=new URL(data.templateVars.actionUrl);assert.equal(link.pathname,path);assert.equal(link.searchParams.get('token'),token);assert.equal(link.origin,type==='admin-password-reset'?settings.backendUrl:settings.storefrontUrl);}
        await processor.process(data);
        const sent=events.at(-1);assert.equal(sent.success,true);assert.match(sent.details.from,/<info@skillverse-global.com>$/);
        assert.equal(sent.details.recipient,to);assert.ok(sent.details.text);assert.match(smtp.messages.at(-1).raw,/From:.*info@skillverse-global.com/);
        if(type.startsWith('cod-')){
            assert.match(sent.details.body,/Shipping|shipping/);assert.match(sent.details.body,/manually/);
            assert.ok(!sent.details.body.includes('<script>bad</script>'));assert.ok(!sent.details.body.includes('<img src=x'));
            assert.match(sent.details.text,/No cash has been collected/);
        }
    }
    assert.equal(smtp.messages.length,6);
    assert.ok(smtp.authUsers.length>0);assert.ok(smtp.authUsers.every(user=>user==='ahmed@skillverse-global.com'));
    const verification=options.handlers.find(h=>h.type==='email-verification');
    const german=ctx('de');const localized=await verification.handle(new AccountRegistrationEvent(german,account),await options.globalTemplateVars(german,injector),injector);
    assert.equal(new URL(localized.templateVars.actionUrl).pathname,'/de/verify');
    for(const [from,to,context,record] of [
        ['PaymentAuthorized','PaymentSettled',ctx(),order()],['Modifying','PaymentAuthorized',ctx(),order()],
        ['ArrangingPayment','PaymentAuthorized',ctx('en','skillverse-sa'),order()],
        ['ArrangingPayment','PaymentAuthorized',ctx(),{...order(),currencyCode:'USD'}],
    ])for(const handler of options.handlers.filter(h=>h.type.startsWith('cod-')))
        assert.equal(await handler.handle(new OrderStateTransitionEvent(from,to,context,record),{},injector),undefined);
    const wrong=order();wrong.payments=[{method:'other-provider',state:'Authorized'}];
    assert.equal(await options.handlers.find(h=>h.type==='cod-order-request').handle(new OrderStateTransitionEvent('ArrangingPayment','PaymentAuthorized',ctx(),wrong),{},injector),undefined);
    assert.equal(smtp.messages.length,6,'wrong channel/payment/state and later settlement must not send order acknowledgements');
});

test('SMTP failure surfaces to the job processor and the queued payload remains retryable',async t=>{
    const smtp=await smtpCapture({rejectFirst:true});t.after(()=>smtp.close());
    const settings=readShopEmailSettings({...base,APP_ENV:'dev',SMTP_HOST:'127.0.0.1',SMTP_PORT:String(smtp.port),SMTP_SECURE:'false'});
    const options=createShopEmailOptions(settings),events=[];
    const processor=new EmailProcessor(options,{get:token=>injector.get(token)},{publish:async event=>events.push(event)});await processor.init();
    const context=ctx(),data=await options.handlers[0].handle(new AccountRegistrationEvent(context,user()),await options.globalTemplateVars(context,injector),injector);
    await assert.rejects(processor.process(data),/451/);assert.equal(events.at(-1).success,false);assert.equal(smtp.messages.length,0);
    await processor.process(data);assert.equal(events.at(-1).success,true);assert.equal(smtp.messages.length,1);
});
