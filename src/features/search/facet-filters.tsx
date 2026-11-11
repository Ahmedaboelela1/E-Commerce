'use client';
import {use, useId, useOptimistic, useState, useTransition} from 'react';
import {useSearchParams} from 'next/navigation';
import {usePathname, useRouter} from '@/platform/i18n/navigation';
import {ResultOf} from '@/platform/vendure/graphql';
import {Button} from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetTrigger,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import {SlidersHorizontal} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {SearchProductsQuery} from './graphql';
import {selectedFacetIds} from './search-helpers';
import type {FilterCollection} from './data';

type FacetGroup = {
    id: string;
    name: string;
    values: Array<{id: string; name: string; count: number}>;
};
type ContentProps = {
    groups: FacetGroup[];
    collections: FilterCollection[];
    selected: string[];
    collection: string;
    inStock: boolean;
    active: boolean;
    pending: boolean;
    toggle: (id: string) => void;
    chooseCollection: (slug: string) => void;
    toggleStock: (checked: boolean) => void;
    clear: () => void;
};
function FilterContent(p: ContentProps) {
    const t = useTranslations('Filters'),
        id = useId();
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{t('title')}</h2>
                {p.active && (
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={p.pending}
                        onClick={p.clear}
                    >
                        {t('clearAll')}
                    </Button>
                )}
            </div>
            <div className="space-y-2">
                <label
                    htmlFor={id + '-collection'}
                    className="text-sm font-medium"
                >
                    {t('category')}
                </label>
                <select
                    id={id + '-collection'}
                    value={p.collection}
                    disabled={p.pending}
                    className="h-11 w-full min-w-0 rounded-xl border bg-background px-3 text-sm"
                    onChange={(e) => p.chooseCollection(e.target.value)}
                >
                    <option value="">{t('allCategories')}</option>
                    {p.collections.map((c) => (
                        <option key={c.id} value={c.slug}>
                            {c.name}
                        </option>
                    ))}
                </select>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-muted/40 p-3 text-sm">
                <input
                    type="checkbox"
                    checked={p.inStock}
                    disabled={p.pending}
                    onChange={(e) => p.toggleStock(e.target.checked)}
                    className="size-4 accent-primary"
                />
                {t('inStockOnly')}
            </label>
            {p.groups.map((g) => (
                <fieldset
                    disabled={p.pending}
                    key={g.id}
                    className="border-t pt-4"
                >
                    <legend className="mb-2 pr-2 text-sm font-semibold">
                        {g.name}
                    </legend>
                    <div className="space-y-1">
                        {g.values.map((v) => (
                            <label
                                key={v.id}
                                className="flex min-h-10 cursor-pointer items-center gap-3 text-sm"
                            >
                                <input
                                    type="checkbox"
                                    className="size-4 accent-primary"
                                    checked={p.selected.includes(v.id)}
                                    onChange={() => p.toggle(v.id)}
                                />
                                <span className="min-w-0 flex-1 break-words">
                                    {v.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {v.count}
                                </span>
                            </label>
                        ))}
                    </div>
                </fieldset>
            ))}
        </div>
    );
}
export function FacetFilters({
    productDataPromise,
    collectionsPromise,
    collectionSlug,
}: {
    productDataPromise: Promise<{
        data: ResultOf<typeof SearchProductsQuery>;
        token?: string;
    }>;
    collectionsPromise: Promise<FilterCollection[]>;
    collectionSlug?: string;
}) {
    const t = useTranslations('Filters'),
        result = use(productDataPromise),
        collections = use(collectionsPromise),
        params = useSearchParams(),
        path = usePathname(),
        router = useRouter();
    const [open, setOpen] = useState(false),
        [pending, startTransition] = useTransition();
    const [selected, setSelected] = useOptimistic(
            selectedFacetIds(params.getAll('facets')),
        ),
        [stock, setStock] = useOptimistic(params.get('stock') === '1');
    const collection = collectionSlug || params.get('collection') || '';
    const grouped = new Map<string, FacetGroup>();
    for (const i of result.data.search.facetValues) {
        const f = i.facetValue.facet;
        const g = grouped.get(f.id) || {id: f.id, name: f.name, values: []};
        g.values.push({
            id: i.facetValue.id,
            name: i.facetValue.name,
            count: i.count,
        });
        grouped.set(f.id, g);
    }
    const update = (next: URLSearchParams, nextPath = path) => {
        next.delete('page');
        router.push(`${nextPath}?${next}`);
        setOpen(false);
    };
    const toggle = (id: string) => {
        const values = selected.includes(id)
            ? selected.filter((v) => v !== id)
            : [...selected, id];
        startTransition(() => {
            setSelected(values);
            const next = new URLSearchParams(params);
            next.delete('facets');
            values.forEach((v) => next.append('facets', v));
            update(next);
        });
    };
    const chooseCollection = (slug: string) =>
        startTransition(() => {
            const next = new URLSearchParams(params);
            if (collectionSlug) {
                next.delete('collection');
                update(
                    next,
                    slug
                        ? `/collection/${encodeURIComponent(slug)}`
                        : '/search',
                );
            } else {
                if (slug) next.set('collection', slug);
                else next.delete('collection');
                update(next);
            }
        });
    const toggleStock = (value: boolean) =>
        startTransition(() => {
            setStock(value);
            const next = new URLSearchParams(params);
            if (value) next.set('stock', '1');
            else next.delete('stock');
            update(next);
        });
    const clear = () =>
        startTransition(() => {
            setSelected([]);
            setStock(false);
            const next = new URLSearchParams(params);
            ['facets', 'stock', 'collection'].forEach((k) => next.delete(k));
            update(next, collectionSlug ? '/search' : path);
        });
    const count = selected.length + Number(stock) + Number(Boolean(collection));
    const content = {
        groups: [...grouped.values()],
        collections,
        selected,
        collection,
        inStock: stock,
        active: count > 0,
        pending,
        toggle,
        chooseCollection,
        toggleStock,
        clear,
    };
    return (
        <>
            <div className="lg:hidden">
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger
                        render={
                            <Button
                                variant="outline"
                                className="h-11 w-full rounded-xl"
                            />
                        }
                    >
                        <SlidersHorizontal className="size-4" />
                        {t('filtersButton')}
                        {count > 0 && (
                            <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">
                                {count}
                            </span>
                        )}
                    </SheetTrigger>
                    <SheetContent side="left" className="overflow-y-auto p-6">
                        <SheetHeader>
                            <SheetTitle>{t('title')}</SheetTitle>
                        </SheetHeader>
                        <div className="mt-5">
                            <FilterContent {...content} />
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
            <div className="sticky top-24 hidden rounded-2xl border bg-card p-5 lg:block">
                <FilterContent {...content} />
            </div>
        </>
    );
}
