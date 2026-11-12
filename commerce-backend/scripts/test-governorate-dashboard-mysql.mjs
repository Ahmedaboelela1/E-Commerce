import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from '../../node_modules/playwright/index.mjs';
import {suiteFixture} from './testing/suite-fixture.mjs';

test('native Dashboard governorate selection, shipping price and saved configuration',
    {skip:!process.env.VENDURE_EMAIL_TEST_PORT,timeout:180000},async t=>{
    const f=await suiteFixture(t);
    const artifacts=process.env.SUITE_ARTIFACT_DIR||path.join(f.root,'shipping-artifacts');
    await fs.mkdir(artifacts,{recursive:true});
    if(process.env.BUILD_STOREFRONT==='true'){
        const build=spawn('npm',['run','build'],{cwd:path.resolve(process.cwd(),'..'),env:{...process.env,VENDURE_SHOP_API_URL:`http://localhost:${f.port}/shop-api`,VENDURE_CHANNEL_TOKEN:f.channelToken,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
        let log='';build.stdout.on('data',chunk=>log+=chunk);build.stderr.on('data',chunk=>log+=chunk);
        const [code]=await once(build,'exit');
        await fs.writeFile(path.join(artifacts,'storefront-build.log'),log);
        assert.equal(code,0,log.slice(-4000));
    }
    const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.setDefaultTimeout(10000);
    t.after(async()=>{
        if(!page.isClosed())await page.screenshot({path:path.join(artifacts,'shipping-final.png'),fullPage:true,animations:'disabled'}).catch(()=>{});
        await browser.close();
    });
    const base=`http://127.0.0.1:${f.port}/dashboard`;
    await page.goto(base+'/');
    await page.locator('#field-username').fill(f.env.SUPERADMIN_USERNAME);
    await page.locator('#field-password').fill(f.env.SUPERADMIN_PASSWORD);
    await page.getByRole('button',{name:/Log in|Sign in/i}).click();
    await page.waitForURL(url=>!url.pathname.includes('login'));
    const channel=page.getByRole('button').filter({hasText:/Default channel/}).first();
    await channel.waitFor();
    await channel.click();await page.getByText('skillverse-eg',{exact:true}).last().click();
    await page.getByRole('button').filter({hasText:'skillverse-eg'}).first().waitFor();
    await page.goto(base+'/shipping-methods/new');
    await page.getByRole('textbox',{name:'Name',exact:true}).fill('Dashboard Cairo test delivery');
    await page.getByRole('textbox',{name:'Code',exact:true}).fill('dashboard-cairo-test');
    await page.getByText('Select a fulfillment handler',{exact:true}).click();
    await page.getByRole('option',{name:/^Manually enter fulfillment details/}).click();
    await page.getByRole('button',{name:'Select Shipping Eligibility Checker',exact:true}).click();
    await page.getByRole('menuitem',{name:/Egypt delivery by governorate/}).click();
    // Newly added required args may automatically open their editor.
    const governorate=page.getByRole('button',{name:'Governorate / المحافظة',exact:true});
    await governorate.waitFor();
    if(await governorate.getAttribute('aria-expanded')!=='true')await governorate.click();
    await page.getByRole('combobox').filter({hasText:/Select an option/}).click();
    assert.equal((await page.getByRole('option').allTextContents()).filter(text=>text.trim()).length,27);
    await page.getByRole('option',{name:'القاهرة / Cairo',exact:true}).click();
    await page.getByTestId('page-heading').click();
    await page.getByRole('button',{name:'Select Shipping Calculator',exact:true}).click();
    await page.getByRole('menuitem',{name:/Default Flat-Rate Shipping Calculator/}).click();
    await page.getByRole('button',{name:'Shipping price',exact:true}).click();
    await page.locator('[data-slot="popover-content"]').getByRole('textbox').fill('115.00');
    await page.getByTestId('page-heading').click();
    await page.screenshot({path:path.join(artifacts,'shipping-governorate-selected.png'),fullPage:true,animations:'disabled'});
    await page.getByRole('button',{name:'Create',exact:true}).click();
    await page.waitForURL(url=>/\/shipping-methods\/[^/]+$/.test(url.pathname)&&!url.pathname.endsWith('/new'));
    const methods=()=>f.admin('{shippingMethods{items{id code checker{code args{name value}} calculator{code args{name value}}}}}');
    const saved=(await methods()).data.shippingMethods.items.find(m=>m.code==='dashboard-cairo-test');
    assert.ok(saved);
    assert.equal(saved.checker.args.find(a=>a.name==='governorate').value,'cairo');
    assert.equal(saved.calculator.args.find(a=>a.name==='rate').value,'11500');
    await page.reload();
    await governorate.click();
    await page.getByRole('combobox').filter({hasText:'القاهرة / Cairo'}).click();
    await page.getByRole('option',{name:'الجيزة / Giza',exact:true}).click();
    await page.getByTestId('page-heading').click();
    await page.getByRole('button',{name:'Update',exact:true}).click();
    await page.getByText('Successfully updated shipping method',{exact:true}).waitFor();
    const edited=(await methods()).data.shippingMethods.items.find(m=>m.id===saved.id);
    assert.equal(edited.checker.args.find(a=>a.name==='governorate').value,'giza');
    assert.equal(edited.calculator.args.find(a=>a.name==='rate').value,'11500');
    const original=(await methods()).data.shippingMethods.items.find(m=>m.id===f.shipping.id);
    assert.equal(original.checker.args.find(a=>a.name==='governorate').value,'cairo');
    assert.equal(original.calculator.args.find(a=>a.name==='rate').value,'11500');
    const token=await f.customer('shipping-browser@example.invalid');
    const shop=(query,variables={})=>f.query(query,variables,{token});
    await shop('mutation($id:ID!){addItemToOrder(productVariantId:$id,quantity:1){__typename}}',{id:f.variant.id});
    for(const [province,eligible] of [['القاهرة',false],['Giza',true],['الجيزة',true]]){
        await shop('mutation($input:CreateAddressInput!){setOrderShippingAddress(input:$input){__typename}}',{input:{fullName:'Synthetic Buyer',streetLine1:'Test street 1',city:province,province,countryCode:'EG',phoneNumber:'01012345678'}});
        const quotes=(await shop('{eligibleShippingMethods{code priceWithTax}}')).data.eligibleShippingMethods;
        const quote=quotes.find(q=>q.code==='dashboard-cairo-test');
        assert.equal(!!quote,eligible,province);
        if(quote)assert.equal(quote.priceWithTax,11500);
    }
    assert.deepEqual(errors,[]);
});
