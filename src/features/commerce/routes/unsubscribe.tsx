'use client';
import {Suspense} from 'react';
import {useSearchParams} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
import {Link} from '@/platform/i18n/navigation';
import {useGrowthWork, GrowthFeedback} from '../growth-client';
export default function UnsubscribePage() {
    return (
        <Suspense>
            <UnsubscribeContent />
        </Suspense>
    );
}
function UnsubscribeContent() {
    const p = useSearchParams(),
        t = useTranslations('Growth'),
        work = useGrowthWork();
    return (
        <main className="container mx-auto max-w-xl px-5 pb-16 pt-28">
            <section className="space-y-5 rounded-3xl border p-7">
                <h1 className="text-2xl font-bold">{t('unsubscribeTitle')}</h1>
                <p className="text-sm leading-7 text-muted-foreground">
                    {t('unsubscribeHelp')}
                </p>
                <GrowthFeedback work={work} />
                {!work.message && (
                    <Button
                        disabled={work.busy}
                        onClick={() =>
                            void work
                                .run(
                                    'unsubscribe',
                                    {
                                        kind: p.get('kind'),
                                        id: p.get('id'),
                                        token: p.get('token'),
                                    },
                                    'unsubscribeShopMail',
                                )
                                .then((r) => {
                                    if (r) work.setMessage(t('unsubscribed'));
                                })
                        }
                    >
                        {t('unsubscribe')}
                    </Button>
                )}
                <p>
                    <Link
                        href="/account/notifications"
                        className="text-sm text-primary underline"
                    >
                        {t('notificationSettings')}
                    </Link>
                </p>
            </section>
        </main>
    );
}
