'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Loader2, Truck } from 'lucide-react';
import { useRouter } from '@/platform/i18n/navigation';
import { useCheckout } from '../checkout-provider';
import { setShippingMethod as setShippingMethodAction } from '../actions';
import {useTranslations, useLocale} from 'next-intl';
import {toIntlLocale} from '@/platform/i18n/locale-utils';

interface DeliveryStepProps {
  onComplete: () => void;
}

export default function DeliveryStep({ onComplete }: DeliveryStepProps) {
  const t = useTranslations('Checkout');
  const locale = useLocale();
  const intlLocale = toIntlLocale(locale);
  const router = useRouter();
  const { shippingMethods, deliveryGroups, order } = useCheckout();
  const groups = deliveryGroups.map(group => group.id);
  const [selection, setSelection] = useState<Record<string,string>>(() => Object.fromEntries(groups.map(group => {
    const options = shippingMethods.filter(method => method.deliveryGroup === group);
    const previous = options.find(method => order.shippingLines.some(line => line.shippingMethod.id === method.id));
    return [group, previous?.id || (options.length === 1 ? options[0].id : '')];
  })));
  const [error, setError] = useState(false);
  const complete = groups.every(group => shippingMethods.some(method => method.deliveryGroup === group && method.id === selection[group]));
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!complete) return;
    setError(false);

    setSubmitting(true);
    try {
      await setShippingMethodAction(groups.map(group => selection[group]));
      router.refresh();
      onComplete();
    } catch (error) {
      console.error('Error setting shipping method:', error);
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (shippingMethods.length === 0 || groups.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{t('noShippingMethods')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="font-semibold">{t('selectShippingMethod')}</h3>

      {groups.length > 1 && <p className="text-sm text-muted-foreground">{t('sellerDeliveryNotice')}</p>}
      {groups.map(group => <fieldset key={group} className="space-y-3">
        {groups.length > 1 && <legend className="font-medium">{deliveryGroups.find(item => item.id === group)?.name}</legend>}
        {!shippingMethods.some(method=>method.deliveryGroup===group)&&<p role="alert" className="text-destructive">{t('noSellerDelivery')}</p>}
        <RadioGroup value={selection[group] || ''} onValueChange={id => setSelection(previous => ({...previous,[group]:id}))}>
        {shippingMethods.filter(method => method.deliveryGroup === group).map((method) => (
          <Label key={method.id} htmlFor={method.id} className="cursor-pointer">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <RadioGroupItem value={method.id} id={method.id} />
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{method.name}</p>
                    {method.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {method.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-end flex-shrink-0">
                  <p className="font-semibold">
                    {method.priceWithTax === 0
                      ? t('free')
                      : (method.priceWithTax / 100).toLocaleString(intlLocale, {
                          style: 'currency',
                          currency: order.currencyCode,
                        })}
                  </p>
                </div>
              </div>
            </Card>
          </Label>
        ))}
      </RadioGroup>
      </fieldset>)}
      {error && <p role="alert" className="text-destructive">{t('deliverySaveError')}</p>}

      <Button
        onClick={handleContinue}
        disabled={!complete || submitting}
        className="w-full"
      >
        {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
        {t('continueToPayment')}
      </Button>
    </div>
  );
}
