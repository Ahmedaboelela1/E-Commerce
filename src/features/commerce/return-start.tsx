'use client';
import {useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/platform/i18n/navigation';
import {Button} from '@/components/ui/button';
import {
    loadGrowth,
    useGrowthWork,
    GrowthFeedback,
    fieldClass,
} from './growth-client';
import type {ReturnEligibility} from './growth-types';

export function ReturnStart({orderId}: {orderId: string}) {
    const t = useTranslations('Growth'),
        locale = useLocale();
    const work = useGrowthWork();
    const [eligibility, setEligibility] = useState<ReturnEligibility | null>(
            null,
        ),
        [open, setOpen] = useState(false),
        [saved, setSaved] = useState(false),
        [quantities, setQuantities] = useState<Record<string, number>>({});
    useEffect(() => {
        let active = true;
        void loadGrowth<{myReturnEligibility: ReturnEligibility}>(
            'eligibility',
            {id: orderId},
            locale,
        )
            .then((d) => {
                if (active) setEligibility(d.myReturnEligibility);
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [orderId, locale]);
    if (!eligibility?.enabled) return null;
    const submit = async (form: FormData) => {
        const items = Object.entries(quantities)
            .filter(([, q]) => q > 0)
            .map(([orderLineId, quantity]) => ({orderLineId, quantity}));
        const result = await work.run(
            'return',
            {
                id: orderId,
                input: {
                    kind: String(form.get('kind') || ''),
                    reason: String(form.get('reason') || ''),
                    items,
                },
            },
            'requestShopReturn',
        );
        if (result) {
            setSaved(true);
            work.setMessage(t('returnSaved'));
        }
    };
    return (
        <section className="rounded-2xl border p-5">
            <h2 className="font-semibold">{t('returns')}</h2>
            <p className="my-3 text-xs leading-6 text-muted-foreground">
                {t('returnWindow', {days: eligibility.windowDays})}
            </p>
            <GrowthFeedback work={work} />
            {saved ? (
                <Button
                    render={<Link href="/account/returns" />}
                    nativeButton={false}
                    className="mt-4 rounded-full"
                >
                    {t('viewReturnAddPhotos')}
                </Button>
            ) : eligibility.eligible ? (
                <>
                    <Button
                        variant="outline"
                        className="mt-2 rounded-full"
                        onClick={() => setOpen(!open)}
                    >
                        {t('requestReturn')}
                    </Button>
                    {open && (
                        <form action={submit} className="mt-5 space-y-4">
                            <fieldset
                                disabled={work.busy}
                                className="space-y-4"
                            >
                                <label className="block text-sm">
                                    {t('returnType')}
                                    <select
                                        name="kind"
                                        className={`${fieldClass} mt-2`}
                                    >
                                        <option value="refund">
                                            {t('refund')}
                                        </option>
                                        <option value="exchange">
                                            {t('exchange')}
                                        </option>
                                    </select>
                                </label>
                                <div className="space-y-3">
                                    {eligibility.lines.map((l) => (
                                        <label
                                            key={l.id}
                                            className="block text-sm"
                                        >
                                            {l.name}
                                            <input
                                                type="number"
                                                min={0}
                                                max={l.quantity}
                                                value={
                                                    quantities[String(l.id)] ||
                                                    0
                                                }
                                                onChange={(e) =>
                                                    setQuantities({
                                                        ...quantities,
                                                        [String(l.id)]: Number(
                                                            e.target.value,
                                                        ),
                                                    })
                                                }
                                                className={`${fieldClass} mt-2`}
                                            />
                                        </label>
                                    ))}
                                </div>
                                <label className="block text-sm">
                                    {t('returnReason')}
                                    <textarea
                                        name="reason"
                                        maxLength={3000}
                                        rows={4}
                                        required
                                        className={`${fieldClass} mt-2`}
                                    />
                                </label>
                                <p className="text-xs leading-6 text-muted-foreground">
                                    {t('returnHelp')}
                                </p>
                                <Button
                                    type="submit"
                                    disabled={
                                        !Object.values(quantities).some(
                                            (q) => q > 0,
                                        ) || work.busy
                                    }
                                >
                                    {t('sendReturn')}
                                </Button>
                            </fieldset>
                        </form>
                    )}
                </>
            ) : (
                <p className="text-sm leading-7 text-muted-foreground">
                    {t('returnNotEligible')}
                </p>
            )}
        </section>
    );
}
