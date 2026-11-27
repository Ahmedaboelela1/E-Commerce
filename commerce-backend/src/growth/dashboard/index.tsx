import {
    useLingui,
    defineDashboardExtension,
    api,
    useChannel,
    usePermissions,
} from '@vendure/dashboard';
import {useEffect, useState} from 'react';

type Variant = {id: string; name: string; sku: string; priceWithTax: number};
type Product = {id: string; name: string; variants: Variant[]};
type Content = {
    specs: {
        ageRange: string;
        programming: string;
        boxContents: string;
        competitions: string;
    };
    resources: Array<{kind: string; title: string; url: string}>;
    faqs: Array<{question: string; answer: string}>;
};
type Component = {
    variantId: string;
    quantity: number;
    name?: string;
    sku?: string;
};
type Bundle = {
    id?: string;
    name: string;
    description: string;
    price: number;
    enabled: boolean;
    sortOrder: number;
    version: number;
    components: Component[];
};
type QuoteItem = {
    variantId: number;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
};
type Offer = {
    items: QuoteItem[];
    shipping: number;
    message: string;
    expiresAt: string;
    currencyCode?: string;
};
type Quote = {
    id: string;
    organization: string;
    phone: string;
    email: string;
    notes: string;
    items: QuoteItem[];
    status: string;
    version: number;
    offer: Offer | null;
    orderId: string | null;
};
type Return = {
    id: string;
    orderId: string;
    customerId: number;
    kind: string;
    status: string;
    reason: string;
    photoCount: number;
    publicMessage: string;
    internalNotes: string;
    version: number;
    items: Array<{name: string; sku: string; quantity: number; amount: number}>;
    resolution: string | null;
    refundId: string | null;
    exchangeOrderId: string | null;
};
type Settings = {
    returnsEnabled: boolean;
    returnWindowDays: number;
    restockEnabled: boolean;
    cartRemindersEnabled: boolean;
    reminderHours: number;
    version: number;
};
type Download = {filename: string; mimeType: string; dataBase64: string};
const request = <T,>(q: string, v?: Record<string, unknown>) =>
    api.query<T>(q, v);
const emptyContent = (): Content => ({
    specs: {ageRange: '', programming: '', boxContents: '', competitions: ''},
    resources: [],
    faqs: [],
});
const emptyBundle = (): Bundle => ({
    name: '',
    description: '',
    price: 0,
    enabled: false,
    sortOrder: 0,
    version: 0,
    components: [],
});
const amount = (v: number) =>
    new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'EGP',
    }).format(v / 100);
const css = `.sg{padding:24px;max-width:1400px;margin:auto}.sg h1{font-size:28px;font-weight:700}.sg h2{font-size:20px;font-weight:650;margin:12px 0}.sg h3{font-size:16px;font-weight:650;margin:10px 0}.sg p{margin:8px 0;font-size:14px;line-height:1.7}.sg .muted{color:var(--muted-foreground,#64748b);font-size:13px}.sg .box{border:1px solid var(--border,#dce5ed);border-radius:14px;padding:20px;margin:16px 0;background:var(--card,#fff)}.sg .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.sg label{display:block;font-size:13px;font-weight:600;margin:12px 0}.sg input:not([type=checkbox]),.sg select,.sg textarea{display:block;width:100%;border:1px solid var(--border,#d1dce5);border-radius:9px;background:var(--background,#fff);padding:10px;margin-top:5px;color:inherit}.sg button,.sg a.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--border,#d1dce5);border-radius:10px;padding:10px 16px;font-size:14px;font-weight:600;background:var(--background,#fff);cursor:pointer;text-decoration:none}.sg button.primary{background:#087e55;color:white;border-color:#087e55}.sg button:disabled,.sg fieldset:disabled{opacity:.5;cursor:not-allowed}.sg .actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.sg .error{background:#fff0f1;color:#b91c1c;padding:14px;border-radius:10px}.sg .success{background:#eaf7ef;color:#087e55;padding:14px;border-radius:10px}.sg table{width:100%;border-collapse:collapse;font-size:14px}.sg th,.sg td{text-align:start;padding:12px;border-bottom:1px solid var(--border,#dce5ed);vertical-align:top}.sg .table{overflow:auto}.sg input[type=checkbox]{margin-inline-end:8px}.sg .prose{white-space:pre-wrap;overflow-wrap:anywhere}`;
function useWork() {
    const { _: t } = useLingui();
    const [busy, setBusy] = useState(false),
        [error, setError] = useState(''),
        [message, setMessage] = useState('');
    const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        setError('');
        setMessage('');
        try {
            await fn();
        } catch (e) {
            setError(e instanceof Error ? e.message : t('shop.Request failed'));
        } finally {
            setBusy(false);
        }
    };
    return {busy, error, message, setMessage, run};
}
function Feedback({work}: {work: ReturnType<typeof useWork>}) {
    return (
        <>
            {work.error && (
                <p role="alert" className="error">
                    {work.error}
                </p>
            )}
            {work.message && (
                <p role="status" className="success">
                    {work.message}
                </p>
            )}
        </>
    );
}
function ProductPicker({
    onProduct,
    onVariant,
}: {
    onProduct?: (p: Product) => void;
    onVariant?: (v: Variant) => void;
}) {
    const { _: t } = useLingui();
    const [search, setSearch] = useState(''),
        [items, setItems] = useState<Product[]>([]),
        [selected, setSelected] = useState('');
    const work = useWork();
    const {hasPermissions}=usePermissions();
    const load = async () => {
        if(hasPermissions(['ManageStore'])&&!hasPermissions(['ReadCatalog'])){const d=await request<{marketplaceProducts:{items:Product[]}}>('query($search:String){marketplaceProducts(search:$search)}',{search});setItems(d.marketplaceProducts.items);return;}
        const d = await request<{products: {items: Product[]}}>(
            'query($options:ProductListOptions){products(options:$options){items{id name variants{id name sku priceWithTax}}}}',
            {
                options: {
                    take: 30,
                    filter: search ? {name: {contains: search}} : undefined,
                },
            },
        );
        setItems(d.products.items);
    };
    useEffect(() => {
        void work.run(load);
    }, []);
    return (
        <div className="box">
            <h2>{t('shop.Choose catalog products')}</h2>
            <Feedback work={work} />
            <div className="grid">
                <label>
                    {t('shop.Product name')}
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </label>
                <div className="actions">
                    <button
                        disabled={work.busy}
                        onClick={() => void work.run(load)}
                    >
                        {t('shop.Search')}
                    </button>
                </div>
            </div>
            <label>
                {t('shop.Product')}
                <select
                    value={selected}
                    onChange={(e) => {
                        setSelected(e.target.value);
                        const p = items.find((i) => i.id === e.target.value);
                        if (p) onProduct?.(p);
                    }}
                >
                    <option value="">{t('shop.Choose a product')}</option>
                    {items.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                        </option>
                    ))}
                </select>
            </label>
            {onVariant && selected && (
                <div className="actions">
                    {items
                        .find((p) => p.id === selected)
                        ?.variants.map((v) => (
                            <button key={v.id} onClick={() => onVariant(v)}>
                                {v.name} · {v.sku} +
                            </button>
                        ))}
                </div>
            )}
        </div>
    );
}
function CatalogPage() {
    const { _: t, i18n } = useLingui();
    const {activeChannel} = useChannel();
    const {hasPermissions:nativePermissions} = usePermissions();
    const hasPermissions=(permissions:string[])=>nativePermissions(permissions)||(nativePermissions(['ManageStore'])&&permissions.some(p=>['ReadOrder','UpdateOrder','ReadCatalog','UpdateCatalog','CreatePromotion'].includes(p)));
    const work = useWork();
    const [product, setProduct] = useState<Product | null>(null),
        [language, setLanguage] = useState('en'),
        [content, setContent] = useState<Content>(emptyContent),
        [version, setVersion] = useState(0),
        [loaded, setLoaded] = useState('');
    const [bundles, setBundles] = useState<Bundle[]>([]),
        [bundle, setBundle] = useState<Bundle>(emptyBundle),
        [skip, setSkip] = useState(0),
        [total, setTotal] = useState(0);
    const canEdit = hasPermissions(['UpdateCatalog']);
    const canBundle = canEdit && hasPermissions(['CreatePromotion']);
    const loadBundles = async () => {
        const d = await request<{
            shopAdminBundles: {items: Bundle[]; total: number};
        }>('query($skip:Int){shopAdminBundles(skip:$skip)}', {skip});
        setBundles(d.shopAdminBundles.items);
        setTotal(d.shopAdminBundles.total);
    };
    useEffect(() => {
        void work.run(loadBundles);
    }, [skip]);
    useEffect(() => {
        let active = true;
        if (!product) return;
        const key = product.id + ':' + language;
        void request<{shopCatalogContent: {content: Content; version: number}}>(
            'query($id:ID!,$language:String){shopCatalogContent(productId:$id,languageCode:$language)}',
            {id: product.id, language},
        )
            .then((d) => {
                if (active) {
                    setContent(d.shopCatalogContent.content);
                    setVersion(d.shopCatalogContent.version);
                    setLoaded(key);
                }
            })
            .catch((e) => {
                if (active)
                    void work.run(async () => {
                        throw e;
                    });
            });
        return () => {
            active = false;
        };
    }, [product?.id, language]);
    if (!hasPermissions(['ReadCatalog']))
        return <p>{t('shop.Catalog permission required.')}</p>;
    return (
        <div className="sg" dir={i18n.locale === 'ar' ? 'rtl' : 'ltr'}>
            <style>{css}</style>
            <h1>{t('shop.Catalog tools')}</h1>
            <p className="muted">
                {activeChannel?.code} {t('shop.· Actual specifications, help resources and stock-tracked product bundles')}
            </p>
            <Feedback work={work} />
            <ProductPicker
                onProduct={setProduct}
                onVariant={(v) =>
                    setBundle((b) => ({
                        ...b,
                        components: b.components.some(
                            (c) => String(c.variantId) === v.id,
                        )
                            ? b.components.map((c) =>
                                  String(c.variantId) === v.id
                                      ? {...c, quantity: c.quantity + 1}
                                      : c,
                              )
                            : [
                                  ...b.components,
                                  {
                                      variantId: v.id,
                                      name: v.name,
                                      sku: v.sku,
                                      quantity: 1,
                                  },
                              ],
                    }))
                }
            />
            {product && (
                <form
                    className="box"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void work.run(async () => {
                            const d = await request<{
                                saveShopProductContent: {version: number};
                            }>(
                                'mutation($id:ID!,$language:String!,$input:JSON!,$version:Int!){saveShopProductContent(productId:$id,languageCode:$language,input:$input,version:$version)}',
                                {
                                    id: product.id,
                                    language,
                                    input: content,
                                    version,
                                },
                            );
                            setVersion(d.saveShopProductContent.version);
                            work.setMessage(
                                t('shop.Product content saved'),
                            );
                        });
                    }}
                >
                    <h2>
                        {product.name} {t('shop.— comparison & help')}
                    </h2>
                    <label>
                        {t('shop.Language')}
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                        >
                            <option value="en">{t('shop.English')}</option>
                            <option value="ar">{t('shop.Arabic')}</option>
                        </select>
                    </label>
                    <fieldset
                        disabled={
                            !canEdit ||
                            work.busy ||
                            loaded !== product.id + ':' + language
                        }
                    >
                        <p className="muted">
                            {t('shop.Only enter manufacturer-confirmed information. Empty fields appear as not provided.')}
                        </p>
                        <div className="grid">
                            {Object.entries({
                                ageRange: t('shop.Age range'),
                                programming: t('shop.Programming'),
                                boxContents: t('shop.In the box'),
                                competitions:
                                    t('shop.Suitable competitions'),
                            }).map(([key, label]) => (
                                <label key={key}>
                                    {label}
                                    <textarea
                                        rows={3}
                                        value={
                                            content.specs[
                                                key as keyof Content['specs']
                                            ]
                                        }
                                        onChange={(e) =>
                                            setContent({
                                                ...content,
                                                specs: {
                                                    ...content.specs,
                                                    [key]: e.target.value,
                                                },
                                            })
                                        }
                                    />
                                </label>
                            ))}
                        </div>
                        <h3>{t('shop.Help resources')}</h3>
                        {content.resources.map((r, i) => (
                            <div className="box" key={i}>
                                <div className="grid">
                                    <label>
                                        {t('shop.Type')}
                                        <select
                                            value={r.kind}
                                            onChange={(e) =>
                                                setContent({
                                                    ...content,
                                                    resources:
                                                        content.resources.map(
                                                            (x, n) =>
                                                                n === i
                                                                    ? {
                                                                          ...x,
                                                                          kind: e
                                                                              .target
                                                                              .value,
                                                                      }
                                                                    : x,
                                                        ),
                                                })
                                            }
                                        >
                                            {[
                                                'manual',
                                                'video',
                                                'code',
                                                'link',
                                            ].map((k) => (
                                                <option key={k} value={k}>{t(`shop.resource.${k}`)}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        {t('shop.Title')}
                                        <input
                                            value={r.title}
                                            maxLength={160}
                                            required
                                            onChange={(e) =>
                                                setContent({
                                                    ...content,
                                                    resources:
                                                        content.resources.map(
                                                            (x, n) =>
                                                                n === i
                                                                    ? {
                                                                          ...x,
                                                                          title: e
                                                                              .target
                                                                              .value,
                                                                      }
                                                                    : x,
                                                        ),
                                                })
                                            }
                                        />
                                    </label>
                                    <label>
                                        {t('shop.HTTPS link')}
                                        <input
                                            type="url"
                                            value={r.url}
                                            required
                                            onChange={(e) =>
                                                setContent({
                                                    ...content,
                                                    resources:
                                                        content.resources.map(
                                                            (x, n) =>
                                                                n === i
                                                                    ? {
                                                                          ...x,
                                                                          url: e
                                                                              .target
                                                                              .value,
                                                                      }
                                                                    : x,
                                                        ),
                                                })
                                            }
                                        />
                                    </label>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setContent({
                                            ...content,
                                            resources: content.resources.filter(
                                                (_, n) => n !== i,
                                            ),
                                        })
                                    }
                                >
                                    {t('shop.Remove')}
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            disabled={content.resources.length >= 20}
                            onClick={() =>
                                setContent({
                                    ...content,
                                    resources: [
                                        ...content.resources,
                                        {kind: 'manual', title: '', url: ''},
                                    ],
                                })
                            }
                        >
                            {t('shop.Add resource')}
                        </button>
                        <h3>{t('shop.Frequently asked questions')}</h3>
                        {content.faqs.map((q, i) => (
                            <div className="box" key={i}>
                                <label>
                                    {t('shop.Question')}
                                    <input
                                        value={q.question}
                                        required
                                        maxLength={300}
                                        onChange={(e) =>
                                            setContent({
                                                ...content,
                                                faqs: content.faqs.map(
                                                    (x, n) =>
                                                        n === i
                                                            ? {
                                                                  ...x,
                                                                  question:
                                                                      e.target
                                                                          .value,
                                                              }
                                                            : x,
                                                ),
                                            })
                                        }
                                    />
                                </label>
                                <label>
                                    {t('shop.Answer')}
                                    <textarea
                                        value={q.answer}
                                        required
                                        rows={3}
                                        maxLength={3000}
                                        onChange={(e) =>
                                            setContent({
                                                ...content,
                                                faqs: content.faqs.map(
                                                    (x, n) =>
                                                        n === i
                                                            ? {
                                                                  ...x,
                                                                  answer: e
                                                                      .target
                                                                      .value,
                                                              }
                                                            : x,
                                                ),
                                            })
                                        }
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setContent({
                                            ...content,
                                            faqs: content.faqs.filter(
                                                (_, n) => n !== i,
                                            ),
                                        })
                                    }
                                >
                                    {t('shop.Remove')}
                                </button>
                            </div>
                        ))}
                        <div className="actions">
                            <button
                                type="button"
                                disabled={content.faqs.length >= 30}
                                onClick={() =>
                                    setContent({
                                        ...content,
                                        faqs: [
                                            ...content.faqs,
                                            {question: '', answer: ''},
                                        ],
                                    })
                                }
                            >
                                {t('shop.Add question')}
                            </button>
                            <button className="primary">
                                {t('shop.Save product content')}
                            </button>
                        </div>
                    </fieldset>
                </form>
            )}
            <section className="box">
                <h2>{t('shop.Existing bundles')}</h2>
                <div className="table">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('shop.Bundle')}</th>
                                <th>{t('shop.Price')}</th>
                                <th>{t('shop.Enabled')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {bundles.map((b) => (
                                <tr key={b.id}>
                                    <td>{b.name}</td>
                                    <td>{amount(b.price)}</td>
                                    <td>{b.enabled ? t('shop.Yes') : t('shop.No')}</td>
                                    <td>
                                        <button
                                            onClick={() =>
                                                setBundle({
                                                    ...b,
                                                    components:
                                                        b.components.map(
                                                            (c) => ({
                                                                ...c,
                                                                variantId:
                                                                    String(
                                                                        c.variantId,
                                                                    ),
                                                            }),
                                                        ),
                                                })
                                            }
                                        >
                                            {t('shop.Edit')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="actions">
                    <button
                        disabled={!skip}
                        onClick={() => setSkip(Math.max(0, skip - 50))}
                    >
                        {t('shop.Previous')}
                    </button>
                    <button
                        disabled={skip + 50 >= total}
                        onClick={() => setSkip(skip + 50)}
                    >
                        {t('shop.Next')}
                    </button>
                </div>
            </section>
            <form
                className="box"
                onSubmit={(e) => {
                    e.preventDefault();
                    void work.run(async () => {
                        await request(
                            'mutation($input:JSON!){saveShopBundle(input:$input)}',
                            {
                                input: {
                                    ...bundle,
                                    price: Math.round(bundle.price),
                                    components: bundle.components.map((c) => ({
                                        variantId: c.variantId,
                                        quantity: c.quantity,
                                    })),
                                },
                            },
                        );
                        await loadBundles();
                        setBundle(emptyBundle());
                        work.setMessage(t('shop.Bundle saved'));
                    });
                }}
            >
                <h2>
                    {bundle.id ? t('shop.Edit bundle') : t('shop.New bundle')}
                </h2>
                <p className="muted">
                    {t('shop.Choose component variants above. Components remain separate stock-tracked order lines. Bundle savings require all components; coupon codes do not combine with bundle savings.')}
                </p>
                <fieldset disabled={!canBundle || work.busy}>
                    <div className="grid">
                        <label>
                            {t('shop.Name')}
                            <input
                                value={bundle.name}
                                required
                                maxLength={200}
                                onChange={(e) =>
                                    setBundle({...bundle, name: e.target.value})
                                }
                            />
                        </label>
                        <label>
                            {t('shop.Bundle price (EGP, using channel tax settings)')}
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={bundle.price / 100 || ''}
                                required
                                onChange={(e) =>
                                    setBundle({
                                        ...bundle,
                                        price: Math.round(
                                            Number(e.target.value) * 100,
                                        ),
                                    })
                                }
                            />
                        </label>
                    </div>
                    <label>
                        {t('shop.Description')}
                        <textarea
                            rows={3}
                            maxLength={3000}
                            value={bundle.description}
                            onChange={(e) =>
                                setBundle({
                                    ...bundle,
                                    description: e.target.value,
                                })
                            }
                        />
                    </label>
                    {bundle.components.map((c, i) => (
                        <div key={i} className="grid">
                            <label>
                                {c.name || c.variantId} · {c.sku}
                                <input
                                    aria-label={`${t('shop.Quantity')} ${c.sku || c.variantId}`}
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={c.quantity}
                                    onChange={(e) =>
                                        setBundle({
                                            ...bundle,
                                            components: bundle.components.map(
                                                (x, n) =>
                                                    n === i
                                                        ? {
                                                              ...x,
                                                              quantity: Number(
                                                                  e.target
                                                                      .value,
                                                              ),
                                                          }
                                                        : x,
                                            ),
                                        })
                                    }
                                />
                            </label>
                            <div className="actions">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setBundle({
                                            ...bundle,
                                            components:
                                                bundle.components.filter(
                                                    (_, n) => n !== i,
                                                ),
                                        })
                                    }
                                >
                                    {t('shop.Remove component')}
                                </button>
                            </div>
                        </div>
                    ))}
                    <label>
                        <input
                            type="checkbox"
                            checked={bundle.enabled}
                            onChange={(e) =>
                                setBundle({
                                    ...bundle,
                                    enabled: e.target.checked,
                                })
                            }
                        />
                        {t('shop.Publish bundle')}
                    </label>
                    <div className="actions">
                        <button
                            className="primary"
                            disabled={bundle.components.length < 2}
                        >
                            {t('shop.Save bundle')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setBundle(emptyBundle())}
                        >
                            {t('shop.New')}
                        </button>
                    </div>
                </fieldset>
                {!canBundle && (
                    <p className="muted">
                        {t('shop.UpdateCatalog and CreatePromotion permissions are both required.')}
                    </p>
                )}
            </form>
        </div>
    );
}
function CarePage() {
    const { _: t, i18n } = useLingui();
    const {activeChannel} = useChannel();
    const {hasPermissions:nativePermissions} = usePermissions();
    const hasPermissions=(permissions:string[])=>nativePermissions(permissions)||(nativePermissions(['ManageStore'])&&permissions.some(p=>['ReadOrder','UpdateOrder','ReadCatalog','UpdateCatalog','CreatePromotion'].includes(p)));
    const work = useWork();
    const canEdit = hasPermissions(['UpdateOrder']);
    const [tab, setTab] = useState(() =>
            hasPermissions(['ReadOrder']) ? 'quotes' : 'settings',
        ),
        [quotes, setQuotes] = useState<Quote[]>([]),
        [returns, setReturns] = useState<Return[]>([]),
        [settings, setSettings] = useState<Settings | null>(null),
        [skip, setSkip] = useState(0),
        [total, setTotal] = useState(0);
    const [selectedQuote, setQuote] = useState<Quote | null>(null),
        [offer, setOffer] = useState<Offer | null>(null),
        [orderId, setOrderId] = useState('');
    const [selectedReturn, setReturn] = useState<Return | null>(null),
        [returnInput, setReturnInput] = useState({
            status: 'requested',
            publicMessage: '',
            internalNotes: '',
            resolution: 'refund',
            refundId: '',
            exchangeOrderId: '',
        }),
        [photo, setPhoto] = useState<Download | null>(null);
    const load = async () => {
        if (tab === 'quotes') {
            const d = await request<{
                shopSchoolQuotes: {items: Quote[]; total: number};
            }>('query($skip:Int){shopSchoolQuotes(skip:$skip)}', {skip});
            setQuotes(d.shopSchoolQuotes.items);
            setTotal(d.shopSchoolQuotes.total);
        }
        if (tab === 'returns') {
            const d = await request<{
                shopReturnRequests: {items: Return[]; total: number};
            }>('query($skip:Int){shopReturnRequests(skip:$skip)}', {skip});
            setReturns(d.shopReturnRequests.items);
            setTotal(d.shopReturnRequests.total);
        }
        if (tab === 'settings') {
            const d = await request<{shopGrowthSettings: Settings}>(
                'query{shopGrowthSettings}',
            );
            setSettings(d.shopGrowthSettings);
        }
    };
    useEffect(() => {
        void work.run(load);
    }, [tab, skip]);
    const openQuote = (q: Quote) => {
        setQuote(q);
        setOrderId('');
        setOffer(
            q.offer || {
                items: q.items,
                shipping: 0,
                message: '',
                expiresAt:
                    new Date(Date.now() + 7 * 86400000)
                        .toISOString()
                        .slice(0, 10) + 'T23:59:59.000Z',
            },
        );
    };
    const openReturn = (r: Return) => {
        setReturn(r);
        setPhoto(null);
        setReturnInput({
            status: r.status,
            publicMessage: r.publicMessage,
            internalNotes: r.internalNotes,
            resolution: r.resolution || 'refund',
            refundId: r.refundId || '',
            exchangeOrderId: r.exchangeOrderId || '',
        });
    };
    return (
        <div className="sg" dir={i18n.locale === 'ar' ? 'rtl' : 'ltr'}>
            <style>{css}</style>
            <h1>{t('shop.Customer care')}</h1>
            <p className="muted">
                {activeChannel?.code} {t('shop.· Quotation requests, returns and consent-based notifications')}
            </p>
            <div className="actions">
                {hasPermissions(['ReadOrder']) && (
                    <>
                        <button
                            onClick={() => {
                                setTab('quotes');
                                setSkip(0);
                                setReturn(null);
                            }}
                        >
                            {t('shop.School quotes')}
                        </button>
                        <button
                            onClick={() => {
                                setTab('returns');
                                setSkip(0);
                                setQuote(null);
                            }}
                        >
                            {t('shop.Returns')}
                        </button>
                    </>
                )}
                {hasPermissions(['ReadSettings']) && (
                    <button onClick={() => setTab('settings')}>
                        {t('shop.Policies & notifications')}
                    </button>
                )}
            </div>
            <Feedback work={work} />
            {tab === 'quotes' && hasPermissions(['ReadOrder']) && (
                <>
                    <div className="box table">
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('shop.Request')}</th>
                                    <th>{t('shop.Organization')}</th>
                                    <th>{t('shop.Contact')}</th>
                                    <th>{t('shop.Status')}</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {quotes.map((q) => (
                                    <tr key={q.id}>
                                        <td>#{q.id}</td>
                                        <td>{q.organization}</td>
                                        <td>
                                            {q.phone}
                                            <br />
                                            {q.email}
                                        </td>
                                        <td>{q.status}</td>
                                        <td>
                                            <button
                                                onClick={() => openQuote(q)}
                                            >
                                                {t('shop.Open')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {selectedQuote && offer && (
                        <div className="box">
                            <h2>
                                {t('shop.Quotation #')}{selectedQuote.id} —{' '}
                                {selectedQuote.organization}
                            </h2>
                            <p>
                                {selectedQuote.phone} · {selectedQuote.email}
                            </p>
                            <p className="prose">{selectedQuote.notes}</p>
                            <p className="muted">
                                {t('shop.Publishing sends the actual proposed prices and delivery charge to the customer. An accepted quote is finalized by creating a matching placed order in native Orders, then linking it here.')}
                            </p>
                            <fieldset
                                disabled={
                                    !canEdit ||
                                    work.busy ||
                                    ![
                                        'requested',
                                        'reviewing',
                                        'quoted',
                                    ].includes(selectedQuote.status)
                                }
                            >
                                {offer.items.map((i, n) => (
                                    <div className="grid" key={i.variantId}>
                                        <label>
                                            {i.name} · {i.sku}
                                            <input
                                                aria-label={`${t('shop.Quote quantity')} ${i.sku}`}
                                                type="number"
                                                min={1}
                                                max={10000}
                                                value={i.quantity}
                                                onChange={(e) =>
                                                    setOffer({
                                                        ...offer,
                                                        items: offer.items.map(
                                                            (x, j) =>
                                                                j === n
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
                                                    })
                                                }
                                            />
                                        </label>
                                        <label>
                                            {t('shop.Unit price (EGP)')}
                                            <input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={i.unitPrice / 100}
                                                onChange={(e) =>
                                                    setOffer({
                                                        ...offer,
                                                        items: offer.items.map(
                                                            (x, j) =>
                                                                j === n
                                                                    ? {
                                                                          ...x,
                                                                          unitPrice:
                                                                              Math.round(
                                                                                  Number(
                                                                                      e
                                                                                          .target
                                                                                          .value,
                                                                                  ) *
                                                                                      100,
                                                                              ),
                                                                      }
                                                                    : x,
                                                        ),
                                                    })
                                                }
                                            />
                                        </label>
                                    </div>
                                ))}
                                <div className="grid">
                                    <label>
                                        {t('shop.Agreed delivery (EGP)')}
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={offer.shipping / 100}
                                            onChange={(e) =>
                                                setOffer({
                                                    ...offer,
                                                    shipping: Math.round(
                                                        Number(e.target.value) *
                                                            100,
                                                    ),
                                                })
                                            }
                                        />
                                    </label>
                                    <label>
                                        {t('shop.Offer expires')}
                                        <input
                                            type="date"
                                            value={offer.expiresAt.slice(0, 10)}
                                            onChange={(e) =>
                                                setOffer({
                                                    ...offer,
                                                    expiresAt:
                                                        e.target.value +
                                                        'T23:59:59.000Z',
                                                })
                                            }
                                        />
                                    </label>
                                </div>
                                <label>
                                    {t('shop.Message to customer')}
                                    <textarea
                                        rows={3}
                                        value={offer.message}
                                        onChange={(e) =>
                                            setOffer({
                                                ...offer,
                                                message: e.target.value,
                                            })
                                        }
                                    />
                                </label>
                                <p>
                                    {t('shop.Total:')}{' '}
                                    <strong>
                                        {amount(
                                            offer.items.reduce(
                                                (s, i) =>
                                                    s +
                                                    i.unitPrice * i.quantity,
                                                offer.shipping,
                                            ),
                                        )}
                                    </strong>
                                </p>
                                <div className="actions">
                                    {[false, true].map((publish) => (
                                        <button
                                            key={String(publish)}
                                            className={publish ? 'primary' : ''}
                                            onClick={() =>
                                                void work.run(async () => {
                                                    const d = await request<{
                                                        publishSchoolQuote: Quote;
                                                    }>(
                                                        'mutation($id:ID!,$input:JSON!,$version:Int!,$publish:Boolean!){publishSchoolQuote(quoteId:$id,input:$input,version:$version,publish:$publish)}',
                                                        {
                                                            id: selectedQuote.id,
                                                            input: offer,
                                                            version:
                                                                selectedQuote.version,
                                                            publish,
                                                        },
                                                    );
                                                    openQuote(
                                                        d.publishSchoolQuote,
                                                    );
                                                    await load();
                                                    work.setMessage(
                                                        publish
                                                            ? t('shop.Offer published')
                                                            : t('shop.Draft saved'),
                                                    );
                                                })
                                            }
                                        >
                                            {publish
                                                ? t('shop.Publish offer')
                                                : t('shop.Save draft')}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>
                            {selectedQuote.status === 'accepted' && canEdit && (
                                <div className="box">
                                    <a className="btn" href="/dashboard/orders">
                                        {t('shop.Create the agreed order in Orders')}
                                    </a>
                                    <label>
                                        {t('shop.Matching placed order ID')}
                                        <input
                                            value={orderId}
                                            onChange={(e) =>
                                                setOrderId(e.target.value)
                                            }
                                        />
                                    </label>
                                    <button
                                        className="primary"
                                        disabled={!orderId || work.busy}
                                        onClick={() =>
                                            void work.run(async () => {
                                                await request(
                                                    'mutation($id:ID!,$order:ID!,$version:Int!){linkSchoolQuoteOrder(quoteId:$id,orderId:$order,version:$version)}',
                                                    {
                                                        id: selectedQuote.id,
                                                        order: orderId,
                                                        version:
                                                            selectedQuote.version,
                                                    },
                                                );
                                                setQuote(null);
                                                await load();
                                            })
                                        }
                                    >
                                        {t('shop.Link actual order')}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
            {tab === 'returns' && hasPermissions(['ReadOrder']) && (
                <>
                    <div className="box table">
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('shop.Request')}</th>
                                    <th>{t('shop.Order')}</th>
                                    <th>{t('shop.Type')}</th>
                                    <th>{t('shop.Status')}</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {returns.map((r) => (
                                    <tr key={r.id}>
                                        <td>#{r.id}</td>
                                        <td>
                                            <a
                                                href={`/dashboard/orders/${r.orderId}`}
                                            >
                                                {r.orderId}
                                            </a>
                                        </td>
                                        <td>{r.kind}</td>
                                        <td>{r.status}</td>
                                        <td>
                                            <button
                                                onClick={() => openReturn(r)}
                                            >
                                                {t('shop.Open')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {selectedReturn && (
                        <div className="box">
                            <h2>{t('shop.Return #')}{selectedReturn.id}</h2>
                            <a
                                className="btn"
                                href={`/dashboard/orders/${selectedReturn.orderId}`}
                            >
                                {t('shop.Open native order')}
                            </a>
                            <p className="prose">{selectedReturn.reason}</p>
                            {selectedReturn.items.map((i, n) => (
                                <p key={n}>
                                    {i.name} · {i.sku} × {i.quantity} ·{' '}
                                    {amount(i.amount)}
                                </p>
                            ))}
                            <div className="actions">
                                {Array.from(
                                    {length: selectedReturn.photoCount},
                                    (_, i) => (
                                        <button
                                            key={i}
                                            onClick={() =>
                                                void work.run(async () => {
                                                    const d = await request<{
                                                        shopReturnPhoto: Download;
                                                    }>(
                                                        'query($id:ID!,$index:Int!){shopReturnPhoto(returnId:$id,index:$index)}',
                                                        {
                                                            id: selectedReturn.id,
                                                            index: i,
                                                        },
                                                    );
                                                    setPhoto(d.shopReturnPhoto);
                                                })
                                            }
                                        >
                                            {t('shop.Private photo')} {i + 1}
                                        </button>
                                    ),
                                )}
                            </div>
                            {photo && (
                                <img
                                    alt={t('shop.Private return photo')}
                                    src={`data:${photo.mimeType};base64,${photo.dataBase64}`}
                                    style={{
                                        maxHeight: 450,
                                        maxWidth: '100%',
                                        objectFit: 'contain',
                                    }}
                                />
                            )}
                            <p className="muted">
                                {t('shop.Inspect received items before manually adjusting stock. Process a real refund in Orders or create a replacement order before resolving. This screen does not send funds or automatically restock goods.')}
                            </p>
                            <fieldset
                                disabled={
                                    !canEdit ||
                                    work.busy ||
                                    [
                                        'resolved',
                                        'rejected',
                                        'cancelled',
                                    ].includes(selectedReturn.status)
                                }
                            >
                                <label>
                                    {t('shop.Status')}
                                    <select
                                        value={returnInput.status}
                                        onChange={(e) =>
                                            setReturnInput({
                                                ...returnInput,
                                                status: e.target.value,
                                            })
                                        }
                                    >
                                        {[
                                            'requested',
                                            'authorized',
                                            'received',
                                            'resolved',
                                            'rejected',
                                        ].map((s) => (
                                            <option key={s} value={s}>{t(`shop.return.${s}`)}</option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    {t('shop.Message shown to customer')}
                                    <textarea
                                        rows={3}
                                        value={returnInput.publicMessage}
                                        onChange={(e) =>
                                            setReturnInput({
                                                ...returnInput,
                                                publicMessage: e.target.value,
                                            })
                                        }
                                    />
                                </label>
                                <label>
                                    {t('shop.Internal staff notes')}
                                    <textarea
                                        rows={3}
                                        value={returnInput.internalNotes}
                                        onChange={(e) =>
                                            setReturnInput({
                                                ...returnInput,
                                                internalNotes: e.target.value,
                                            })
                                        }
                                    />
                                </label>
                                {returnInput.status === 'resolved' && (
                                    <>
                                        <label>
                                            {t('shop.Actual resolution')}
                                            <select
                                                value={returnInput.resolution}
                                                onChange={(e) =>
                                                    setReturnInput({
                                                        ...returnInput,
                                                        resolution:
                                                            e.target.value,
                                                    })
                                                }
                                            >
                                                <option value="refund">
                                                    {t('shop.Settled refund')}
                                                </option>
                                                <option value="exchange">
                                                    {t('shop.Placed replacement order')}
                                                </option>
                                                <option value="unpaid-cancelled">
                                                    {t('shop.Unpaid order cancelled')}
                                                </option>
                                            </select>
                                        </label>
                                        {returnInput.resolution ===
                                            'refund' && (
                                            <label>
                                                {t('shop.Actual settled refund ID')}
                                                <input
                                                    value={returnInput.refundId}
                                                    onChange={(e) =>
                                                        setReturnInput({
                                                            ...returnInput,
                                                            refundId:
                                                                e.target.value,
                                                        })
                                                    }
                                                />
                                            </label>
                                        )}
                                        {returnInput.resolution ===
                                            'exchange' && (
                                            <label>
                                                {t('shop.Replacement order ID')}
                                                <input
                                                    value={
                                                        returnInput.exchangeOrderId
                                                    }
                                                    onChange={(e) =>
                                                        setReturnInput({
                                                            ...returnInput,
                                                            exchangeOrderId:
                                                                e.target.value,
                                                        })
                                                    }
                                                />
                                            </label>
                                        )}
                                    </>
                                )}
                                <button
                                    className="primary"
                                    onClick={() =>
                                        void work.run(async () => {
                                            const d = await request<{
                                                updateShopReturn: Return;
                                            }>(
                                                'mutation($id:ID!,$input:JSON!,$version:Int!){updateShopReturn(returnId:$id,input:$input,version:$version)}',
                                                {
                                                    id: selectedReturn.id,
                                                    input: returnInput,
                                                    version:
                                                        selectedReturn.version,
                                                },
                                            );
                                            openReturn(d.updateShopReturn);
                                            await load();
                                            work.setMessage(
                                                t('shop.Return updated'),
                                            );
                                        })
                                    }
                                >
                                    {t('shop.Save status')}
                                </button>
                            </fieldset>
                        </div>
                    )}
                </>
            )}
            {tab !== 'settings' && (
                <div className="actions">
                    <button
                        disabled={!skip}
                        onClick={() => setSkip(Math.max(0, skip - 30))}
                    >
                        {t('shop.Previous')}
                    </button>
                    <button
                        disabled={skip + 30 >= total}
                        onClick={() => setSkip(skip + 30)}
                    >
                        {t('shop.Next')}
                    </button>
                </div>
            )}
            {tab === 'settings' && settings && (
                <form
                    className="box"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void work.run(async () => {
                            const d = await request<{
                                saveShopGrowthSettings: Settings;
                            }>(
                                'mutation($input:JSON!){saveShopGrowthSettings(input:$input)}',
                                {input: settings},
                            );
                            setSettings(d.saveShopGrowthSettings);
                            work.setMessage(
                                t('shop.Settings saved'),
                            );
                        });
                    }}
                >
                    <h2>{t('shop.Return window & mail')}</h2>
                    <fieldset
                        disabled={
                            !hasPermissions(['UpdateSettings']) || work.busy
                        }
                    >
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.returnsEnabled}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        returnsEnabled: e.target.checked,
                                    })
                                }
                            />
                            {t('shop.Enable online return requests after publishing your actual policy')}
                        </label>
                        <label>
                            {t('shop.Actual return window in days')}
                            <input
                                type="number"
                                min={0}
                                max={365}
                                value={settings.returnWindowDays}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        returnWindowDays: Number(
                                            e.target.value,
                                        ),
                                    })
                                }
                            />
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.restockEnabled}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        restockEnabled: e.target.checked,
                                    })
                                }
                            />
                            {t('shop.Send requested back-in-stock alerts')}
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.cartRemindersEnabled}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        cartRemindersEnabled: e.target.checked,
                                    })
                                }
                            />
                            {t('shop.Enable cart reminders only for customers who opted in')}
                        </label>
                        <label>
                            {t('shop.Hours of cart inactivity')}
                            <input
                                type="number"
                                min={1}
                                max={168}
                                value={settings.reminderHours}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        reminderHours: Number(e.target.value),
                                    })
                                }
                            />
                        </label>
                        <p className="muted">
                            {t('shop.At most one reminder per cart. Email and the job queue must be running; unsubscribe links are included. New cart-reminder consent is off by default.')}
                        </p>
                        <div className="actions">
                            <button className="primary">{t('shop.Save')}</button>
                            <button
                                type="button"
                                onClick={() =>
                                    void work.run(async () => {
                                        const d = await request<{
                                            runShopCustomerNotifications: {
                                                stockNotifications: number;
                                                cartReminders: number;
                                            };
                                        }>(
                                            'mutation{runShopCustomerNotifications}',
                                        );
                                        work.setMessage(
                                            t('shop.Notification counts', {stock: d.runShopCustomerNotifications.stockNotifications, carts: d.runShopCustomerNotifications.cartReminders}),
                                        );
                                    })
                                }
                            >
                                {t('shop.Run notification check')}
                            </button>
                        </div>
                    </fieldset>
                </form>
            )}
        </div>
    );
}
function ChannelRoute({page}: {page: 'catalog' | 'care'}) {
    const {activeChannel} = useChannel();
    return page === 'catalog' ? (
        <CatalogPage key={activeChannel?.id} />
    ) : (
        <CarePage key={activeChannel?.id} />
    );
}
defineDashboardExtension({
    routes: [
        {
            path: '/shop-catalog-tools',
            navMenuItem: {
                requiresPermission: ['ReadCatalog','ManageStore'],
                sectionId: 'catalog',
                id: 'shop-catalog-tools',
                title: 'shop.Catalog tools',
            },
            component: () => <ChannelRoute page="catalog" />,
        },
        {
            path: '/shop-customer-care',
            navMenuItem: {
                requiresPermission: ['ReadOrder','ManageStore'],
                sectionId: 'sales',
                id: 'shop-customer-care',
                title: 'shop.Customer care',
            },
            component: () => <ChannelRoute page="care" />,
        },
    ],
});
