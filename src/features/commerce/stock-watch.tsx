'use client';
import {useEffect, useState} from 'react';
import {Bell} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
import {loadGrowth, useGrowthWork, GrowthFeedback} from './growth-client';
import type {StockWatchInfo} from './growth-types';

export function StockWatchButton({variantId}: {variantId: string}) {
    const t = useTranslations('Growth'),
        locale = useLocale();
    const work = useGrowthWork();
    const [active, setActive] = useState(false),
        [enabled, setEnabled] = useState(false);
    useEffect(() => {
        let mounted = true;
        void loadGrowth<{shopGrowthFeatures: {restockEnabled: boolean}}>(
            'features',
            {},
            locale,
        )
            .then((d) => {
                if (mounted) setEnabled(d.shopGrowthFeatures.restockEnabled);
            })
            .catch(() => undefined);
        void loadGrowth<{myStockWatches: StockWatchInfo[]}>(
            'preferences',
            {},
            locale,
        )
            .then((d) => {
                if (mounted)
                    setActive(
                        d.myStockWatches.some(
                            (w) => String(w.variantId) === variantId,
                        ),
                    );
            })
            .catch(() => undefined);
        return () => {
            mounted = false;
        };
    }, [variantId, locale]);
    if (!enabled) return null;
    return (
        <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm leading-6 text-muted-foreground">
                {t('stockHelp')}
            </p>
            <Button
                variant="outline"
                disabled={work.busy}
                className="rounded-full"
                aria-pressed={active}
                onClick={() =>
                    void work
                        .run<StockWatchInfo[]>(
                            'stock',
                            {id: variantId, active: !active},
                            'setShopStockWatch',
                        )
                        .then((result) => {
                            if (result) {
                                setActive(
                                    result.some(
                                        (w) =>
                                            String(w.variantId) === variantId,
                                    ),
                                );
                                work.setMessage(
                                    active
                                        ? t('watchRemoved')
                                        : t('watchSaved'),
                                );
                            }
                        })
                }
            >
                <Bell className="size-4" />
                {active ? t('stopStockWatch') : t('notifyMe')}
            </Button>
            <GrowthFeedback work={work} />
        </div>
    );
}
