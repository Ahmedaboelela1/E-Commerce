'use client';
import {useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/platform/i18n/navigation';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {
    loadGrowth,
    useGrowthWork,
    GrowthFeedback,
    fieldClass,
} from '../growth-client';
import type {EntityId, QuoteItem} from '../growth-types';

type Product = {
    id: EntityId;
    name: string;
    variants: Array<{
        id: EntityId;
        name: string;
        sku: string;
        priceWithTax: number;
    }>;
};
export default function SchoolQuotePage() {
    const t = useTranslations('Growth'),
        locale = useLocale();
    const work = useGrowthWork();
    const [products, setProducts] = useState<Product[]>([]),
        [search, setSearch] = useState(''),
        [items, setItems] = useState<QuoteItem[]>([]),
        [saved, setSaved] = useState(false),
        [catalogBusy, setCatalogBusy] = useState(false);
    const load = async () => {
        setCatalogBusy(true);
        try {
            const d = await loadGrowth<{products: {items: Product[]}}>(
                'quoteCatalog',
                {q: search},
                locale,
            );
            setProducts(d.products.items);
        } catch {
            work.setError(t('loadError'));
        } finally {
            setCatalogBusy(false);
        }
    };
    useEffect(() => {
        void load();
    }, [locale]);
    const add = (v: Product['variants'][number]) => {
        setItems((current) =>
            current.some((i) => String(i.variantId) === String(v.id))
                ? current.map((i) =>
                      String(i.variantId) === String(v.id)
                          ? {...i, quantity: i.quantity + 1}
                          : i,
                  )
                : [
                      ...current,
                      {
                          variantId: v.id,
                          name: v.name,
                          sku: v.sku,
                          quantity: 1,
                          unitPrice: v.priceWithTax,
                      },
                  ],
        );
    };
    const submit = async (form: FormData) => {
        const result = await work.run(
            'quote',
            {
                organization: String(form.get('organization') || ''),
                phone: String(form.get('phone') || ''),
                notes: String(form.get('notes') || ''),
                items: items.map((i) => ({
                    variantId: i.variantId,
                    quantity: i.quantity,
                })),
                address: {
                    street: String(form.get('street') || ''),
                    city: String(form.get('city') || ''),
                    governorate: String(form.get('governorate') || ''),
                },
            },
            'requestSchoolQuote',
        );
        if (result) {
            setSaved(true);
            work.setMessage(t('quoteSaved'));
        }
    };
    return (
        <main className="container mx-auto max-w-5xl px-5 pb-16 pt-28">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t('schoolQuotes')}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                {t('quoteHelp')}
            </p>
            <div className="my-5">
                <GrowthFeedback work={work} />
            </div>
            {saved ? (
                <div className="rounded-3xl border bg-muted/20 p-8">
                    <p className="mb-5 leading-7">{t('quoteNoOrder')}</p>
                    <Button
                        render={<Link href="/account/quotes" />}
                        nativeButton={false}
                    >
                        {t('myQuotes')}
                    </Button>
                </div>
            ) : (
                <div className="mt-8 grid gap-7 lg:grid-cols-2">
                    <section className="rounded-3xl border p-5 sm:p-7">
                        <h2 className="mb-5 text-xl font-semibold">
                            {t('chooseProducts')}
                        </h2>
                        <form
                            className="mb-5 flex gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                void load();
                            }}
                        >
                            <Input
                                aria-label={t('searchProducts')}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t('searchProducts')}
                            />
                            <Button
                                type="submit"
                                variant="outline"
                                disabled={catalogBusy}
                            >
                                {t('search')}
                            </Button>
                        </form>
                        <div className="max-h-[32rem] space-y-3 overflow-y-auto">
                            {products.map((p) => (
                                <div
                                    className="rounded-xl bg-muted/30 p-4"
                                    key={p.id}
                                >
                                    <h3 className="font-medium">{p.name}</h3>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {p.variants.map((v) => (
                                            <Button
                                                key={v.id}
                                                size="sm"
                                                variant="outline"
                                                type="button"
                                                onClick={() => add(v)}
                                                disabled={
                                                    items.length >= 50 &&
                                                    !items.some(
                                                        (i) =>
                                                            String(
                                                                i.variantId,
                                                            ) === String(v.id),
                                                    )
                                                }
                                            >
                                                {v.sku || v.name} +
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                    <form
                        action={submit}
                        className="space-y-5 rounded-3xl border p-5 sm:p-7"
                    >
                        <h2 className="text-xl font-semibold">
                            {t('quoteRequest')}
                        </h2>
                        <fieldset disabled={work.busy} className="space-y-5">
                            <label className="block text-sm font-medium">
                                {t('organization')}
                                <Input
                                    name="organization"
                                    required
                                    maxLength={200}
                                    className="mt-2"
                                />
                            </label>
                            <label className="block text-sm font-medium">
                                {t('phone')}
                                <Input
                                    name="phone"
                                    type="tel"
                                    required
                                    minLength={10}
                                    maxLength={25}
                                    className="mt-2"
                                />
                            </label>
                            <div className="space-y-3">
                                {items.map((i, index) => (
                                    <div
                                        className="rounded-xl border p-3"
                                        key={i.variantId}
                                    >
                                        <p className="text-sm font-medium">
                                            {i.name}
                                        </p>
                                        <p className="my-2 text-xs text-muted-foreground">
                                            {i.sku}
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <label className="flex-1 text-xs">
                                                {t('quantity')}
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={10000}
                                                    value={i.quantity}
                                                    className={fieldClass}
                                                    required
                                                    onChange={(e) =>
                                                        setItems(
                                                            items.map((x, n) =>
                                                                n === index
                                                                    ? {
                                                                          ...x,
                                                                          quantity:
                                                                              Number(
                                                                                  e
                                                                                      .target
                                                                                      .value,
                                                                              ),
                                                                      }
                                                                    : x,
                                                            ),
                                                        )
                                                    }
                                                />
                                            </label>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    setItems(
                                                        items.filter(
                                                            (_, n) =>
                                                                n !== index,
                                                        ),
                                                    )
                                                }
                                            >
                                                {t('remove')}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <details className="rounded-xl border p-4">
                                <summary className="cursor-pointer text-sm font-medium">
                                    {t('deliveryAddressOptional')}
                                </summary>
                                <div className="mt-4 space-y-4">
                                    {['street', 'city', 'governorate'].map(
                                        (key) => (
                                            <label
                                                key={key}
                                                className="block text-sm"
                                            >
                                                {t(key)}
                                                <Input
                                                    name={key}
                                                    maxLength={
                                                        key === 'street'
                                                            ? 300
                                                            : 100
                                                    }
                                                    className="mt-2"
                                                />
                                            </label>
                                        ),
                                    )}
                                </div>
                            </details>
                            <label className="block text-sm font-medium">
                                {t('notes')}
                                <textarea
                                    name="notes"
                                    maxLength={3000}
                                    rows={4}
                                    className={`${fieldClass} mt-2`}
                                />
                            </label>
                            <p className="text-xs leading-6 text-muted-foreground">
                                {t('quoteNoOrder')}
                            </p>
                            <Button
                                type="submit"
                                className="h-12 w-full rounded-xl"
                                disabled={!items.length || work.busy}
                            >
                                {t('sendQuoteRequest')}
                            </Button>
                        </fieldset>
                    </form>
                </div>
            )}
        </main>
    );
}
