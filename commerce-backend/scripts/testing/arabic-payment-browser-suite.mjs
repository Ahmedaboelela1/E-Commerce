import assert from 'node:assert/strict';
import path from 'node:path';
import {waitFor} from './suite-fixture.mjs';

/** Built storefront plus real native quotes; only synthetic customers and local SMTP. */
export async function arabicPaymentBrowserSuite(t,f,browser,origin,artifacts) {
    const token=await f.customer('arabic-browser@example.invalid');
    const shop=(q,v={})=>f.query(q,v,{token});
    const order=(await shop('mutation($id:ID!){addItemToOrder(productVariantId:$id,quantity:1){__typename ... on Order{id}}}',{id:f.variant.id})).data.addItemToOrder;
    assert.equal(order.__typename,'Order');
    await shop('mutation{setOrderShippingAddress(input:{fullName:"عميل الاختبار",streetLine1:"Synthetic street 1",city:"Cairo",province:"القاهرة",countryCode:"EG",phoneNumber:"01012345678"}){__typename}}');
    await shop('mutation($id:ID!){setOrderShippingMethod(shippingMethodId:[$id]){__typename}}',{id:f.shipping.id});
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.addCookies([{name:'vendure-auth-token',value:token,url:origin}]);
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await t.test('English checkout displays configured codes 01/02 using the approved handler',async()=>{
        await page.goto(origin+'/en/checkout');
        await page.getByText('Cash on delivery',{exact:true}).waitFor();
        await page.getByText('InstaPay / Bank transfer',{exact:true}).waitFor();
        assert.equal(await page.getByText('No payment methods available.',{exact:true}).count(),0);
        assert.equal(await page.getByText('To be calculated',{exact:true}).count(),0);
        await page.screenshot({path:path.join(artifacts,'configured-payment-codes-en.png'),fullPage:true});
    });
    await t.test('Arabic checkout is RTL, uses the Arabic font, and keeps offline choices actionable',async()=>{
        await page.goto(origin+'/ar/checkout');
        await page.getByText('الدفع عند الاستلام',{exact:true}).filter({visible:true}).waitFor();
        await page.getByText('إنستاباي / تحويل بنكي',{exact:true}).filter({visible:true}).waitFor();
        assert.equal(await page.locator('html').getAttribute('lang'),'ar');
        assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
        await page.getByText('إنستاباي / تحويل بنكي',{exact:true}).filter({visible:true}).click();
        await page.getByRole('button',{name:'المتابعة للمراجعة',exact:true}).click();
        await page.getByRole('button',{name:'إرسال الطلب',exact:true}).waitFor();
        await page.evaluate(()=>document.fonts.ready);
        assert.match(await page.locator('body').evaluate(e=>getComputedStyle(e).fontFamily),/arabic/i);
        await page.screenshot({path:path.join(artifacts,'checkout-ar-desktop.png'),fullPage:true});
        await page.getByRole('button',{name:'إرسال الطلب',exact:true}).click();
        await page.waitForURL(/\/ar\/order-confirmation\//);
        const placed=(await f.admin('query($id:ID!){order(id:$id){state payments{method state}}}',{id:order.id})).data.order;
        assert.equal(placed.state,'PaymentAuthorized');assert.equal(placed.payments[0].method,'01');assert.equal(placed.payments[0].state,'Authorized');
        await page.getByText('CI public receiving instructions — not a real account',{exact:true}).waitFor();
        const code=new URL(page.url()).pathname.split('/').at(-1);
        await waitFor(()=>f.smtp.messages.filter(m=>m.raw.includes(code)).length>=2,'Aliased bank method must send customer and staff notifications');
    });
    await t.test('locale switch preserves search, filters and fragment and removes German',async()=>{
        await page.goto(origin+'/en/search?q=Robot&sort=price-asc#products');
        await page.getByRole('button',{name:'Switch language',exact:true}).click();
        assert.equal(await page.getByText('Deutsch',{exact:true}).count(),0);
        await page.getByRole('menuitem',{name:'العربية',exact:true}).click();
        await page.waitForURL(u=>u.pathname==='/ar/search');
        const url=new URL(page.url());assert.equal(url.searchParams.get('q'),'Robot');assert.equal(url.searchParams.get('sort'),'price-asc');assert.equal(url.hash,'#products');
        assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
    });
    await t.test('Arabic product, favorites, recent history, account and mobile navigation render',async()=>{
        for(const route of ['/ar','/ar/product/suite-test-robot','/ar/account/wishlist','/ar/account/profile','/ar/cart','/ar/compare']) {
            const response=await page.goto(origin+route);assert.equal(response.status(),200,route);
            assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
            assert.equal(await page.getByText('Deutsch',{exact:true}).count(),0);
        }
        await page.setViewportSize({width:390,height:844});
        await page.goto(origin+'/ar/search');
        await page.locator('article').first().waitFor();
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Arabic catalog must fit mobile');
        await page.getByRole('button',{name:'فتح القائمة',exact:true}).click();
        await page.getByRole('dialog').waitFor();
        await page.screenshot({path:path.join(artifacts,'arabic-mobile-menu.png'),fullPage:true});
        await page.getByRole('button',{name:'إغلاق',exact:true}).click();
        assert.deepEqual(errors,[]);
    });
    await t.test('German links redirect permanently to Arabic without losing verification tokens',async()=>{
        const response=await fetch(origin+'/de/verify?token=synthetic%2Btoken&redirectTo=%2Fcheckout',{redirect:'manual'});
        assert.equal(response.status,308);
        const url=new URL(response.headers.get('location'),origin);assert.equal(url.pathname,'/ar/verify');assert.equal(url.searchParams.get('token'),'synthetic+token');assert.equal(url.searchParams.get('redirectTo'),'/checkout');
    });
    await context.close();
}
