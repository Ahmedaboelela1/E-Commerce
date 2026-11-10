import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
require('reflect-metadata');
const {RequestContext, Channel, PaymentMethod, PaymentMethodService} = require('@vendure/core');
const {egyptBankTransferHandler: handler} = require('../dist/egypt-bank-transfer.js');
const {egyptGovernorateShippingChecker: shipping} = require('../dist/egypt-governorate-shipping.js');

function ctx(apiType='shop', user=true, channel='skillverse-eg') {
    return new RequestContext({apiType, channel:new Channel({id:1,code:channel,defaultCurrencyCode:'EGP',defaultLanguageCode:'en'}),
        session:user ? {user:{id:1,verified:true}} : undefined, isAuthorized:true, authorizedAsOwnerOnly:false});
}
const order = () => ({code:'EG-TEST-1',currencyCode:'EGP',shippingAddress:{countryCode:'EG',province:'Cairo',phoneNumber:'01012345678'}});
const methods = new Map();
const method = () => {
    const value = new PaymentMethod({id:methods.size+1,code:'bank-transfer',enabled:true,description:'CI beneficiary<br>CI bank reference'});
    methods.set(value.id,value);return value;
};
await handler.init({get(token){
    if(token===PaymentMethodService)return {findOne:async(_ctx,id)=>methods.get(id)};
    return {}; // Configurable-operation label translator is unused by payment execution.
}});

test('real bank handler snapshots admin instructions and never accepts customer-supplied paid metadata',async()=>{
    const result=await handler.createPayment(ctx(),order(),21500,[],{state:'Settled',public:{paymentInstructions:'attacker account'}},method());
    assert.equal(result.state,'Authorized');assert.equal(result.amount,21500);
    assert.equal(result.metadata.transferVerification,'pending');
    assert.equal(result.metadata.public.paymentInstructions,'CI beneficiary\nCI bank reference');
    assert.equal(result.metadata.public.reference,'EG-TEST-1');
    assert.equal((await handler.settlePayment(ctx(),order(),{},[],method())).success,false);
    const settled=await handler.settlePayment(ctx('admin'),order(),{},[],method());
    assert.equal(settled.success,true);assert.equal(settled.metadata.transferVerification,'verified');
});

test('bank transfer rejects guests, other channels/countries/currencies, invalid amounts/phones and missing instructions',async()=>{
    for(const [context,override,amount,description] of [
        [ctx('shop',false),{},21500], [ctx('admin'),{},21500], [ctx('shop',true,'other'),{},21500],
        [ctx(),{currencyCode:'USD'},21500], [ctx(),{shippingAddress:{countryCode:'SA',phoneNumber:'01012345678'}},21500],
        [ctx(),{shippingAddress:{countryCode:'EG',phoneNumber:'123'}},21500], [ctx(),{},0], [ctx(),{},21500,''],
    ]) {
        const paymentMethod=method();if(description!==undefined)paymentMethod.description=description;
        const result=await handler.createPayment(context,{...order(),...override},amount,[],{},paymentMethod);
        assert.equal(result.state,'Declined');
    }
});

test('governorate delivery accepts Arabic/English aliases and rejects mismatched addresses and channels',async()=>{
    const args=[{name:'governorate',value:'cairo'}];
    for(const province of ['Cairo','القاهرة','محافظة القاهره','Cairo Governorate']) {
        assert.equal(await shipping.check(ctx(),{...order(),shippingAddress:{...order().shippingAddress,province}},args,{}),true);
    }
    for(const candidate of [
        {...order(),shippingAddress:{...order().shippingAddress,province:'Alexandria'}},
        {...order(),shippingAddress:{...order().shippingAddress,province:''}},
        {...order(),shippingAddress:{...order().shippingAddress,countryCode:'SA'}},
        {...order(),currencyCode:'USD'},
    ]) assert.equal(await shipping.check(ctx(),candidate,args,{}),false);
    assert.equal(await shipping.check(ctx('shop',true,'other'),order(),args,{}),false);
});
