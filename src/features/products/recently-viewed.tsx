'use client';
import {useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {History} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {ProductTile, type ProductTileData} from './product-tile';
import {
    RECENT_EVENT,
    clearRecentHistory,
    readRecentHistory,
    recentKey,
    recordRecentVisit,
} from './recent-history';

export function TrackViewedProduct({
    productId,
    channelId,
}: {
    productId: string;
    channelId: string;
}) {
    useEffect(
        () => recordRecentVisit(channelId, productId),
        [channelId, productId],
    );
    return null;
}
export function RecentlyViewedProducts({
    channelId,
    currentProductId,
    currencyCode,
}: {
    channelId: string;
    currentProductId?: string;
    currencyCode: string;
}) {
    const t = useTranslations('Product'),
        locale = useLocale();
    const [ids, setIds] = useState<string[]>([]),
        [items, setItems] = useState<ProductTileData[]>([]),
        [failed, setFailed] = useState(false),
        [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const load = () =>
            setIds(
                readRecentHistory(channelId)
                    .map((v) => v.id)
                    .filter((id) => id !== currentProductId),
            );
        const storage = (e: StorageEvent) => {
            if (e.key === null || e.key === recentKey(channelId)) load();
        };
        load();
        window.addEventListener(RECENT_EVENT, load);
        window.addEventListener('storage', storage);
        window.addEventListener('focus', load);
        return () => {
            window.removeEventListener(RECENT_EVENT, load);
            window.removeEventListener('storage', storage);
            window.removeEventListener('focus', load);
        };
    }, [channelId, currentProductId]);
    const list = ids.join(',');
    useEffect(() => {
        if (!list) {
            setItems([]);
            setFailed(false);
            return;
        }
        const abort = new AbortController();
        void fetch(
            `/api/catalog/recent?${new URLSearchParams({ids: list, locale})}`,
            {cache: 'no-store', signal: abort.signal},
        )
            .then((r) =>
                r.ok ? r.json() : Promise.reject(new Error('Unavailable')),
            )
            .then((d) => {
                if (!abort.signal.aborted) {
                    setItems(d.items);
                    setFailed(false);
                }
            })
            .catch(() => {
                if (!abort.signal.aborted) setFailed(true);
            });
        return () => abort.abort();
    }, [list, locale, currencyCode, attempt]);
    if (!ids.length || (!failed && !items.length)) return null;
    return (
        <section
            id="recently-viewed"
            aria-labelledby="recently-viewed-title"
            className="container mx-auto max-w-7xl px-5 py-12 md:py-16"
        >
            <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2
                        id="recently-viewed-title"
                        className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl"
                    >
                        <History className="size-6 text-primary" />
                        {t('recentlyViewed')}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        {t('recentlyViewedHelp')}
                    </p>
                </div>
                <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                        clearRecentHistory(channelId);
                        setIds([]);
                        setItems([]);
                    }}
                >
                    {t('clearHistory')}
                </Button>
            </div>
            {failed ? (
                <div className="space-y-3 rounded-2xl border p-5">
                    <p role="status" className="text-sm text-muted-foreground">
                        {t('recentUnavailable')}
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => setAttempt((v) => v + 1)}
                    >
                        {t('retryCatalog')}
                    </Button>
                </div>
            ) : (
                <div
                    className={`grid gap-3 sm:gap-5 ${items.length === 1 ? 'max-w-sm grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'}`}
                >
                    {items.map((p) => (
                        <ProductTile key={p.id} product={p} />
                    ))}
                </div>
            )}
        </section>
    );
}
