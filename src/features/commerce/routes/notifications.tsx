'use client';
import {useCallback, useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Bell, Mail} from 'lucide-react';
import {Link, useRouter} from '@/platform/i18n/navigation';
import {Button} from '@/components/ui/button';
import {loadGrowth, useGrowthWork, GrowthFeedback} from '../growth-client';
import type {StockWatchInfo} from '../growth-types';

export default function NotificationsPage() {
    const t = useTranslations('Growth'),
        locale = useLocale(),
        router = useRouter();
    const work = useGrowthWork();
    const [watches, setWatches] = useState<StockWatchInfo[]>([]),
        [consent, setConsent] = useState(false),
        [loading, setLoading] = useState(true);
    const load = useCallback(async () => {
        try {
            const d = await loadGrowth<{
                myStockWatches: StockWatchInfo[];
                myShopMailPreference: {cartReminderConsent: boolean};
            }>('preferences', {}, locale);
            setWatches(d.myStockWatches);
            setConsent(d.myShopMailPreference.cartReminderConsent);
        } catch (error) {
            if (error instanceof Error && error.message === 'SIGN_IN')
                router.replace('/sign-in?redirectTo=/account/notifications');
            else work.setError(t('loadError'));
        } finally {
            setLoading(false);
        }
    }, [locale, router, t]);
    useEffect(() => {
        void load();
    }, [load]);
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">
                {t('notifications')}
            </h1>
            <GrowthFeedback work={work} />
            {loading ? (
                <p>{t('loading')}</p>
            ) : (
                <>
                    <section className="space-y-4 rounded-2xl border p-5 sm:p-7">
                        <h2 className="flex items-center gap-3 text-lg font-semibold">
                            <Mail className="size-5 text-primary" />
                            {t('cartReminders')}
                        </h2>
                        <p className="text-sm leading-7 text-muted-foreground">
                            {t('reminderHelp')}
                        </p>
                        <label className="flex items-start gap-3 text-sm leading-7">
                            <input
                                type="checkbox"
                                checked={consent}
                                disabled={work.busy}
                                className="mt-2"
                                onChange={(e) => {
                                    const previous = consent,
                                        next = e.target.checked;
                                    setConsent(next);
                                    void work
                                        .run<{cartReminderConsent: boolean}>(
                                            'consent',
                                            {consent: next},
                                            'setShopCartReminderConsent',
                                        )
                                        .then((r) => {
                                            if (r) {
                                                setConsent(
                                                    r.cartReminderConsent,
                                                );
                                                work.setMessage(
                                                    t('preferencesSaved'),
                                                );
                                            } else setConsent(previous);
                                        });
                                }}
                            />
                            {t('cartConsent')}
                        </label>
                    </section>
                    <section className="space-y-4 rounded-2xl border p-5 sm:p-7">
                        <h2 className="flex items-center gap-3 text-lg font-semibold">
                            <Bell className="size-5 text-primary" />
                            {t('stockAlerts')}
                        </h2>
                        {!watches.length ? (
                            <p className="text-sm text-muted-foreground">
                                {t('noWatches')}
                            </p>
                        ) : (
                            watches.map((w) => (
                                <div
                                    key={w.id}
                                    className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
                                >
                                    <Link
                                        href={`/product/${w.slug}`}
                                        className="text-sm font-medium hover:text-primary"
                                    >
                                        {w.name}
                                    </Link>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={work.busy}
                                        onClick={() =>
                                            void work
                                                .run(
                                                    'stock',
                                                    {
                                                        id: w.variantId,
                                                        active: false,
                                                    },
                                                    'setShopStockWatch',
                                                )
                                                .then((r) => {
                                                    if (r) void load();
                                                })
                                        }
                                    >
                                        {t('stopStockWatch')}
                                    </Button>
                                </div>
                            ))
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
