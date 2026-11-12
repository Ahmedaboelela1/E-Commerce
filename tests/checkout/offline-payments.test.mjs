import test from 'node:test';
import assert from 'node:assert/strict';
import {isOfflinePaymentMethod, getTransferInstructions} from '../../src/features/checkout/offline-payments.ts';

test('only cash on delivery and manual transfer may reach the offline checkout',()=>{
    assert.equal(isOfflinePaymentMethod('cash-on-delivery'),true);
    assert.equal(isOfflinePaymentMethod('bank-transfer'),true);
    for(const code of ['visa','dummy-payment-handler','wallet','BANK-TRANSFER','']) assert.equal(isOfflinePaymentMethod(code),false);
});

test('transfer display uses only public instructions on a pending transfer',()=>{
    const payment={method:'bank-transfer',state:'Authorized',metadata:{privateAccount:'private',public:{paymentInstructions:'Public beneficiary'}}};
    assert.equal(getTransferInstructions([payment]),'Public beneficiary');
    for(const candidate of [{...payment,state:'Declined'},{...payment,state:'Settled'},{...payment,method:'cash-on-delivery'},
        {...payment,metadata:{privateAccount:'private'}},{...payment,metadata:'invalid'},
        {...payment,metadata:{public:{paymentInstructions:123}}}]) assert.equal(getTransferInstructions([candidate]),undefined);
});

test('merchant codes are accepted only when the server identifies an approved handler',()=>{
    assert.equal(isOfflinePaymentMethod({code:'01',offlineType:'bank-transfer'}),true);
    assert.equal(isOfflinePaymentMethod({code:'02',offlineType:'cash-on-delivery'}),true);
    assert.equal(isOfflinePaymentMethod({code:'cash-on-delivery',offlineType:null}),false);
    assert.equal(isOfflinePaymentMethod({code:'01',offlineType:'dummy-payment-handler'}),false);
    assert.equal(getTransferInstructions([{method:'01',state:'Authorized',metadata:{public:{paymentType:'bank-transfer',paymentInstructions:'Verified public instructions'}}}]),'Verified public instructions');
});
