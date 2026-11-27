'use client';

import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { CreditCard, Banknote, Landmark } from 'lucide-react';
import { useCheckout } from '../checkout-provider';
import {useTranslations} from 'next-intl';
import {isOfflinePaymentMethod,getOfflinePaymentType} from '@/features/checkout/offline-payments';

interface PaymentStepProps {
  onComplete: () => void;
}

export default function PaymentStep({ onComplete }: PaymentStepProps) {
  const t = useTranslations('Checkout');
  const { paymentMethods, selectedPaymentMethodCode, setSelectedPaymentMethodCode } = useCheckout();
  const offlineMethods = paymentMethods.filter((method) => isOfflinePaymentMethod(method));

  const handleContinue = () => {
    if (!offlineMethods.some(method => method.code === selectedPaymentMethodCode)) return;
    onComplete();
  };

  if (offlineMethods.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{t('noPaymentMethods')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="font-semibold">{t('selectPaymentMethod')}</h3>

      <RadioGroup
        value={selectedPaymentMethodCode || ''}
        onValueChange={setSelectedPaymentMethodCode}
        className="auto-rows-fr grid-cols-[minmax(0,1fr)]"
      >
        {offlineMethods.map((method) => (
          <Label key={method.code} htmlFor={method.code} className="block min-w-0 cursor-pointer">
            <Card className="h-full w-full flex-row items-center gap-3 p-4">
              <RadioGroupItem value={method.code} id={method.code} />
              {getOfflinePaymentType(method) === 'bank-transfer'
                ? <Landmark aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                : <Banknote aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />}
              <div className="min-w-0 flex-1 space-y-1 wrap-anywhere">
                <p className="font-medium">{getOfflinePaymentType(method) === 'bank-transfer' ? t('bankTransfer') : t('cashOnDelivery')}</p>
                <p className="text-xs text-muted-foreground">{method.name}</p>
                {method.description && (
                  <div className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: method.description }} />
                )}
              </div>
            </Card>
          </Label>
        ))}
      </RadioGroup>
      {getOfflinePaymentType(offlineMethods.find(m=>m.code===selectedPaymentMethodCode)||'') === 'bank-transfer' && (
        <p className="rounded-lg bg-muted p-4 text-sm">{t('transferVerificationNote')}</p>
      )}

      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground" aria-disabled="true">
        <div className="flex items-center gap-2 font-medium">
          <CreditCard className="h-5 w-5" />
          {t('visaComingSoon')}
        </div>
        <p className="mt-1">{t('visaNotAvailable')}</p>
      </div>
      <p className="text-sm text-muted-foreground">{t('phoneConfirmationNote')}</p>

      <Button
        onClick={handleContinue}
        disabled={!offlineMethods.some(method => method.code === selectedPaymentMethodCode)}
        className="w-full"
      >
        {t('continueToReview')}
      </Button>
    </div>
  );
}
