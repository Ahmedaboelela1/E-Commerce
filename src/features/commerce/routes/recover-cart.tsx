'use client';
import {Suspense, useEffect, useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import {Link, useRouter} from '@/platform/i18n/navigation';
import {Button} from '@/components/ui/button';
import {loadGrowth} from '../growth-client';
export default function RecoverCartPage() {
    return (
        <Suspense>
            <RecoverCartContent />
        </Suspense>
    );
}
function RecoverCartContent() {
    const p = useSearchParams(),
        t = useTranslations('Growth'),
        locale = useLocale(),
        router = useRouter();
    const token = p.get('token') || '';
    const [state, setState] = useState<
        'loading' | 'ready' | 'changed' | 'error'
    >('loading');
    useEffect(() => {
        let active = true;
        void loadGrowth<{
            myRecoveryCart: {available: boolean; orderId?: string | number};
            activeOrder: {id: string} | null;
        }>('recovery', {token}, locale)
            .then((d) => {
                if (active)
                    setState(
                        d.myRecoveryCart.available &&
                            String(d.myRecoveryCart.orderId) ===
                                String(d.activeOrder?.id)
                            ? 'ready'
                            : 'changed',
                    );
            })
            .catch((error) => {
                if (error instanceof Error && error.message === 'SIGN_IN')
                    router.replace(
                        `/sign-in?redirectTo=${encodeURIComponent('/cart/recover?token=' + token)}`,
                    );
                else if (active) setState('error');
            });
        return () => {
            active = false;
        };
    }, [token, locale, router]);
    return (
        <main className="container mx-auto max-w-xl px-5 pb-16 pt-28">
            <section className="space-y-5 rounded-3xl border p-7">
                <h1 className="text-2xl font-bold">{t('recoverCart')}</h1>
                <p className="text-sm leading-7 text-muted-foreground">
                    {state === 'loading'
                        ? t('loading')
                        : state === 'ready'
                          ? t('recoveryReady')
                          : state === 'changed'
                            ? t('recoveryChanged')
                            : t('loadError')}
                </p>
                {state !== 'loading' && (
                    <Button render={<Link href="/cart" />} nativeButton={false}>
                        {t('openCart')}
                    </Button>
                )}
            </section>
        </main>
    );
}
