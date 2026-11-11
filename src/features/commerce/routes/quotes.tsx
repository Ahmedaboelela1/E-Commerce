'use client';
import {useCallback, useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter, Link} from '@/platform/i18n/navigation';
import {Button} from '@/components/ui/button';
import {Price} from '@/features/pricing/price';
import {loadGrowth, useGrowthWork, GrowthFeedback} from '../growth-client';
import type {SchoolQuoteInfo} from '../growth-types';

export default function QuotesPage() {
    const t = useTranslations('Growth'),
        locale = useLocale(),
        router = useRouter();
    const work = useGrowthWork();
    const [items, setItems] = useState<SchoolQuoteInfo[]>([]),
        [loading, setLoading] = useState(true),
        [skip, setSkip] = useState(0),
        [total, setTotal] = useState(0);
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const d = await loadGrowth<{
                mySchoolQuotes: {items: SchoolQuoteInfo[]; total: number};
            }>('quotes', {skip: String(skip)}, locale);
            setItems(d.mySchoolQuotes.items);
            setTotal(d.mySchoolQuotes.total);
        } catch (error) {
            if (error instanceof Error && error.message === 'SIGN_IN')
                router.replace('/sign-in?redirectTo=/account/quotes');
            else work.setError(t('loadError'));
        } finally {
            setLoading(false);
        }
    }, [locale, skip, router, t]);
    useEffect(() => {
        void load();
    }, [load]);
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-3xl font-bold tracking-tight">
                    {t('myQuotes')}
                </h1>
                <Button
                    render={<Link href="/school-quote" />}
                    nativeButton={false}
                    className="rounded-full"
                >
                    {t('newQuote')}
                </Button>
            </div>
            <GrowthFeedback work={work} />
            {loading ? (
                <p>{t('loading')}</p>
            ) : !items.length ? (
                <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                    {t('noQuotes')}
                </p>
            ) : (
                items.map((q) => (
                    <article
                        key={q.id}
                        className="space-y-4 rounded-2xl border p-5 sm:p-7"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <h2 className="text-xl font-semibold">
                                {q.organization} · #{q.id}
                            </h2>
                            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                                {t('status.' + q.status)}
                            </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                            {q.notes}
                        </p>
                        {q.offer ? (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-left">
                                                <th className="py-3">
                                                    {t('product')}
                                                </th>
                                                <th className="py-3">
                                                    {t('quantity')}
                                                </th>
                                                <th className="py-3">
                                                    {t('unitPrice')}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {q.offer.items.map((i) => (
                                                <tr
                                                    key={i.variantId}
                                                    className="border-b"
                                                >
                                                    <td className="py-3 pr-4">
                                                        {i.name}
                                                    </td>
                                                    <td>{i.quantity}</td>
                                                    <td>
                                                        <Price
                                                            value={i.unitPrice}
                                                            currencyCode={
                                                                q.offer!
                                                                    .currencyCode
                                                            }
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="space-y-2 rounded-xl bg-muted/40 p-4 text-sm">
                                    <p>
                                        {t('delivery')}:{' '}
                                        <Price
                                            value={q.offer.shipping}
                                            currencyCode={q.offer.currencyCode}
                                        />
                                    </p>
                                    <p className="font-semibold">
                                        {t('total')}:{' '}
                                        <Price
                                            value={q.offer.items.reduce(
                                                (s, i) =>
                                                    s +
                                                    i.quantity * i.unitPrice,
                                                q.offer.shipping,
                                            )}
                                            currencyCode={q.offer.currencyCode}
                                        />
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {t('expires')}:{' '}
                                        {new Date(
                                            q.offer.expiresAt,
                                        ).toLocaleDateString()}
                                    </p>
                                </div>
                                <p className="whitespace-pre-wrap text-sm leading-7">
                                    {q.offer.message}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {q.offer.sellerName} ·{' '}
                                    {q.offer.sellerAddress}
                                </p>
                                {q.status === 'quoted' &&
                                    new Date(q.offer.expiresAt) >
                                        new Date() && (
                                        <div className="flex flex-wrap gap-3">
                                            <Button
                                                disabled={work.busy}
                                                className="rounded-full"
                                                onClick={() =>
                                                    void work
                                                        .run(
                                                            'quoteResponse',
                                                            {
                                                                id: q.id,
                                                                accept: true,
                                                                version:
                                                                    q.version,
                                                            },
                                                            'respondToSchoolQuote',
                                                        )
                                                        .then((r) => {
                                                            if (r) {
                                                                work.setMessage(
                                                                    t(
                                                                        'quoteAccepted',
                                                                    ),
                                                                );
                                                                void load();
                                                            }
                                                        })
                                                }
                                            >
                                                {t('acceptQuote')}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                disabled={work.busy}
                                                className="rounded-full"
                                                onClick={() =>
                                                    void work
                                                        .run(
                                                            'quoteResponse',
                                                            {
                                                                id: q.id,
                                                                accept: false,
                                                                version:
                                                                    q.version,
                                                            },
                                                            'respondToSchoolQuote',
                                                        )
                                                        .then((r) => {
                                                            if (r) void load();
                                                        })
                                                }
                                            >
                                                {t('declineQuote')}
                                            </Button>
                                        </div>
                                    )}
                                {q.status === 'accepted' && (
                                    <p className="rounded-xl border border-primary/20 p-4 text-sm leading-7 text-muted-foreground">
                                        {t('quoteAcceptedHelp')}
                                    </p>
                                )}
                            </>
                        ) : (
                            <ul className="space-y-2 text-sm">
                                {q.items.map((i) => (
                                    <li key={i.variantId}>
                                        {i.name} × {i.quantity}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </article>
                ))
            )}
            <div className="flex gap-3">
                <Button
                    variant="outline"
                    disabled={!skip || loading}
                    onClick={() => setSkip(Math.max(0, skip - 30))}
                >
                    {t('previous')}
                </Button>
                <Button
                    variant="outline"
                    disabled={skip + 30 >= total || loading}
                    onClick={() => setSkip(skip + 30)}
                >
                    {t('next')}
                </Button>
                <Button variant="ghost" onClick={() => void load()}>
                    {t('refresh')}
                </Button>
            </div>
        </div>
    );
}
