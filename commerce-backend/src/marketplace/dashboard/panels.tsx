import { useLingui, api, useChannel } from '@vendure/dashboard';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ProductDetailsEditor } from './product-details-editor';
import './product-details-editor.css';
import { slugFromProductName } from '../product-slug';
import { egyptGovernorates } from '../../egypt-governorates';

type Access = {
    kind: 'admin' | 'seller';
    storeName: string;
    currencyCode: string;
    sellerId: number | null;
    superAdmin: boolean;
    pricesIncludeTax: boolean;
};
type Vendor = {
    id: number;
    name: string;
    code: string;
    active: boolean;
    version: number;
};
type Image = { id: string; name: string; preview: string };
type Variant = {
    id?: string;
    name: string;
    sku: string;
    price: number;
    stockOnHand: number;
    enabled?: boolean;
};
type Product = {
    detailsEn?: string;
    detailsAr?: string;
    canAddVariants?: boolean;
    id?: string;
    updatedAt?: string;
    name: string;
    slug: string;
    description: string;
    enabled: boolean;
    ownerId: number | null;
    seller?: string;
    assets: Image[];
    variants: Variant[];
    translations?: {
        languageCode: string;
        name: string;
        slug: string;
        description: string;
    }[];
};
type Rate = {
    id?: string;
    vendorId: number | null;
    seller?: string;
    governorate: string;
    name: string;
    description: string;
    rate: number;
    version?: number | string;
};
type Payment = {
    version?: string;
    id?: string;
    name: string;
    code: string;
    type: string;
    description: string;
    enabled: boolean;
};
type Order = {
    id: string;
    state: string;
    payments?: {
        id: string;
        state: string;
        amount: number;
        refunds: { id: string; state: string; total: number }[];
    }[];
    code: string;
    customerName: string;
    paid: boolean;
    phoneStatus: string;
    amount: number;
    currencyCode: string;
    address: Record<string, string>;
    lines: {
        id: string;
        name: string;
        sku: string;
        quantity: number;
        remaining: number;
        amount: number;
    }[];
    fulfillments: {
        id: string;
        state: string;
        carrier: string;
        trackingCode: string;
        editable: boolean;
        trackingUrl?: string;
    }[];
};
const req = <T,>(query: string, variables?: Record<string, unknown>) =>
    api.query<T>(query, variables);
const mutate = (name: string, input: unknown) =>
    req<Record<string, unknown>>(
        `mutation($input:JSON!){${name}(input:$input)}`,
        { input },
    );
const amount = (value: number, currency = 'EGP') =>
    (value / 100).toLocaleString(undefined, { style: 'currency', currency });
const blankProduct = (): Product => ({
    name: '',
    slug: '',
    description: '',
    enabled: false,
    ownerId: null,
    assets: [],
    variants: [{ sku: '', name: '', price: 0, stockOnHand: 0, enabled: true }],
});
const styles = `.sv-market{padding:24px;max-width:1300px;margin:auto;line-height:1.6}.sv-market h1{font-size:26px;font-weight:700}.sv-market h2{font-size:21px;font-weight:650}.sv-market h3{font-weight:650}.sv-market p{margin:8px 0}.sv-market nav,.sv-market .actions{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.sv-market button,.sv-market input,.sv-market select,.sv-market textarea{font:inherit;border:1px solid #cbd5e1;border-radius:8px;padding:9px 12px;background:var(--card,#fff);color:inherit}.sv-market button{cursor:pointer;font-weight:600}.sv-market button.primary,.sv-market button[aria-current=page]{background:#087f5b;color:white;border-color:#087f5b}.sv-market button:disabled{opacity:.5;cursor:default}.sv-market button:focus-visible,.sv-market input:focus-visible,.sv-market select:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}.sv-market label{display:grid;gap:6px}.sv-market input:not([type=checkbox]),.sv-market select,.sv-market textarea{width:100%;min-width:0}.sv-market .panel{border:1px solid #dce5e2;border-radius:14px;padding:20px;margin:16px 0;background:var(--card,#fff)}.sv-market .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:12px 0}.sv-market .scroll{overflow-x:auto}.sv-market table{width:100%;border-collapse:collapse}.sv-market th,.sv-market td{text-align:start;padding:12px;border-bottom:1px solid #e2e8f0}.sv-market .notice{padding:12px;background:#e9f8f0;color:#14532d;border-radius:8px}.sv-market .error{padding:12px;background:#fff1f2;color:#991b1b;border-radius:8px}.sv-market .images{display:flex;gap:12px;flex-wrap:wrap}.sv-market .images img{width:100px;height:100px;object-fit:contain}.sv-market textarea{min-height:95px}.sv-market-embedded{padding:0;max-width:none;margin:0}.sv-market .actions{align-items:flex-end}
.sv-market .variant-actions { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.sv-market .variant-actions label { margin: 0; }
.sv-market .variant-actions button { width: fit-content; min-height: 28px; padding: 3px 8px; font-size: 12px; line-height: 1.4; }
`;

export type SellingSection =
    | 'catalog'
    | 'orders'
    | 'delivery'
    | 'payments'
    | 'accounts';

export function SellingSectionPanel({ section }: { section: SellingSection }) {
    const { _: t, i18n } = useLingui();
    const tab = section;
    const { activeChannel } = useChannel();
    const [access, setAccess] = useState<Access | null>(null),
        [error, setError] = useState(''),
        [message, setMessage] = useState(''),
        [busy, setBusy] = useState(false);
    const [vendors, setVendors] = useState<Vendor[]>([]),
        [products, setProducts] = useState<Product[]>([]),
        [orders, setOrders] = useState<Order[]>([]),
        [rates, setRates] = useState<Rate[]>([]),
        [payments, setPayments] = useState<Payment[]>([]);
    const [search, setSearch] = useState(''),
        [skip, setSkip] = useState(0),
        [total, setTotal] = useState(0),
        [edit, setEdit] = useState<Product | null>(null),
        [selected, setSelected] = useState<Order | null>(null),
        [rate, setRate] = useState<Rate | null>(null),
        [payment, setPayment] = useState<Payment | null>(null);
    const refresh = useCallback(async () => {
        const data = await req<{
            marketplaceAccess: Access;
            marketplaceVendors: Vendor[];
        }>('{marketplaceAccess marketplaceVendors}');
        setAccess(data.marketplaceAccess);
        setVendors(data.marketplaceVendors);
        if (tab === 'catalog') {
            const d = await req<{
                marketplaceProducts: { items: Product[]; total: number };
            }>(
                'query($search:String,$skip:Int){marketplaceProducts(search:$search,skip:$skip)}',
                { search, skip },
            );
            setProducts(d.marketplaceProducts.items);
            setTotal(d.marketplaceProducts.total);
        }
        if (tab === 'orders') {
            const d = await req<{
                marketplaceOrders: { items: Order[]; total: number };
            }>('query($skip:Int){marketplaceOrders(skip:$skip)}', { skip });
            setOrders(d.marketplaceOrders.items);
            setTotal(d.marketplaceOrders.total);
        }
        if (tab === 'delivery')
            setRates(
                (
                    await req<{ marketplaceDeliveryRates: Rate[] }>(
                        '{marketplaceDeliveryRates}',
                    )
                ).marketplaceDeliveryRates,
            );
        if (tab === 'payments' && data.marketplaceAccess.kind === 'admin')
            setPayments(
                (
                    await req<{ marketplacePaymentMethods: Payment[] }>(
                        '{marketplacePaymentMethods}',
                    )
                ).marketplacePaymentMethods,
            );
    }, [activeChannel?.id, tab, search, skip]);
    useEffect(() => {
        setEdit(null);
        setSelected(null);
        setRate(null);
        setPayment(null);
        setAccess(null);
        setError('');
        void refresh().catch((e) => setError(e.message));
    }, [refresh]);
    async function run(action: () => Promise<unknown>) {
        setBusy(true);
        setError('');
        setMessage('');
        try {
            await action();
            await refresh();
            setMessage(t('shop.Saved'));
        } catch (e) {
            setError(
                e instanceof Error ? e.message : t('shop.Unable to save'),
            );
        } finally {
            setBusy(false);
        }
    }
    return (
        <section className="sv-market sv-market-embedded">
            <style>{styles}</style>
            {error && (
                <p role="alert" className="error">
                    {error}
                </p>
            )}
            {message && (
                <p role="status" className="notice">
                    {message}
                </p>
            )}
            {access && (
                <fieldset
                    disabled={busy}
                    style={{ border: 0, minWidth: 0, padding: 0 }}
                >
                    {tab === 'catalog' && (
                        <>
                            <div className="actions">
                                <label>
                                    {t('shop.Search')}
                                    <input
                                        value={search}
                                        onChange={(e) => {
                                            setSkip(0);
                                            setSearch(e.target.value);
                                        }}
                                    />
                                </label>
                                <button
                                    className="primary"
                                    onClick={() => setEdit(blankProduct())}
                                >
                                    {t('shop.Add product')}
                                </button>
                            </div>
                            <div className="panel scroll">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{t('shop.Product')}</th>
                                            <th>{t('shop.Seller')}</th>
                                            <th>{t('shop.Status')}</th>
                                            <th>{t('shop.Price')}</th>
                                            <th>{t('shop.Stock')}</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map((p) => (
                                            <tr key={p.id}>
                                                <td>{p.name}</td>
                                                <td>{p.seller}</td>
                                                <td>
                                                    {p.enabled
                                                        ? t('shop.Published')
                                                        : t('shop.Hidden')}
                                                </td>
                                                <td>
                                                    {p.variants
                                                        .map((v) =>
                                                            amount(
                                                                v.price,
                                                                access.currencyCode,
                                                            ),
                                                        )
                                                        .join(' · ')}
                                                </td>
                                                <td>
                                                    {p.variants.reduce(
                                                        (sum, v) =>
                                                            sum + v.stockOnHand,
                                                        0,
                                                    )}
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={() =>
                                                            setEdit(p)
                                                        }
                                                    >
                                                        {t('shop.Edit')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {!products.length && (
                                    <p>{t('shop.No products yet')}</p>
                                )}
                            </div>
                            {edit && (
                                <ProductEditor
                                    key={`${edit.id || 'new'}-${activeChannel?.id}`}
                                    product={edit}
                                    access={access}
                                    vendors={vendors}
                                    close={() => setEdit(null)}
                                    save={(input) =>
                                        run(async () => {
                                            await mutate(
                                                'saveMarketplaceProduct',
                                                input,
                                            );
                                            setEdit(null);
                                        })
                                    }
                                />
                            )}
                        </>
                    )}
                    {tab === 'orders' && (
                        <>
                            <p>
                                {t('shop.Payments are collected centrally. Confirm delivery only after the parcel arrives.')}
                            </p>
                            <div className="panel scroll">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{t('shop.Order')}</th>
                                            <th>{t('shop.Customer')}</th>
                                            <th>
                                                {access.kind === 'seller'
                                                    ? t('shop.Your items + delivery')
                                                    : t('shop.Total')}
                                            </th>
                                            <th>{t('shop.Payment')}</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.map((o) => (
                                            <tr key={o.id}>
                                                <td>{o.code}</td>
                                                <td>{o.customerName}</td>
                                                <td>
                                                    {amount(
                                                        o.amount,
                                                        o.currencyCode,
                                                    )}
                                                </td>
                                                <td>
                                                    {o.paid
                                                        ? t('shop.Collected')
                                                        : t('shop.Awaiting collection')}
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={() =>
                                                            setSelected(o)
                                                        }
                                                    >
                                                        {t('shop.View items')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {!orders.length && (
                                    <p>{t('shop.No orders yet')}</p>
                                )}
                            </div>
                            {selected && (
                                <OrderPanel
                                    key={selected.id}
                                    order={selected}
                                    run={run}
                                    reload={async () =>
                                        setSelected(
                                            (
                                                await req<{
                                                    marketplaceOrder: Order;
                                                }>(
                                                    'query($id:ID!){marketplaceOrder(id:$id)}',
                                                    { id: selected.id },
                                                )
                                            ).marketplaceOrder,
                                        )
                                    }
                                />
                            )}
                        </>
                    )}
                    {['catalog', 'orders'].includes(tab) && (
                        <div className="actions">
                            <button
                                disabled={skip === 0}
                                onClick={() => setSkip(Math.max(0, skip - 30))}
                            >
                                {t('shop.Previous')}
                            </button>
                            <span>
                                {skip + 1}–{Math.min(skip + 30, total)} /{' '}
                                {total}
                            </span>
                            <button
                                disabled={skip + 30 >= total}
                                onClick={() => setSkip(skip + 30)}
                            >
                                {t('shop.Next')}
                            </button>
                        </div>
                    )}
                    {tab === 'delivery' && (
                        <>
                            {access.superAdmin && <a href="/dashboard/shipping-methods">
                                {t('shop.Advanced shipping settings')}
                            </a>}
                            <p>
                                {t('shop.Rates are charged separately for each seller. No carrier API is used.')}
                            </p>
                            <button
                                className="primary"
                                onClick={() =>
                                    setRate({
                                        vendorId: access.sellerId,
                                        governorate: 'cairo',
                                        name: '',
                                        description: '',
                                        rate: 0,
                                    })
                                }
                            >
                                {t('shop.Add governorate rate')}
                            </button>
                            <div className="panel scroll">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{t('shop.Seller')}</th>
                                            <th>{t('shop.Governorate')}</th>
                                            <th>{t('shop.Name')}</th>
                                            <th>{t('shop.Price')}</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rates.map((row) => (
                                            <tr key={row.id}>
                                                <td>{row.seller}</td>
                                                <td>
                                                    {
                                                        egyptGovernorates.find(
                                                            (g) =>
                                                                g[0] ===
                                                                row.governorate,
                                                        )?.[2]
                                                    }
                                                </td>
                                                <td>{row.name}</td>
                                                <td>
                                                    {amount(
                                                        row.rate,
                                                        access.currencyCode,
                                                    )}
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={() =>
                                                            setRate(row)
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
                            {rate && (
                                <form
                                    className="panel"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        void run(async () => {
                                            await mutate(
                                                'saveMarketplaceDeliveryRate',
                                                rate,
                                            );
                                            setRate(null);
                                        });
                                    }}
                                >
                                    <h2>{t('shop.Delivery rate')}</h2>
                                    <div className="grid">
                                        {access.kind === 'admin' && (
                                            <label>
                                                {t('shop.Seller')}
                                                <select
                                                    value={rate.vendorId || ''}
                                                    disabled={!!rate.id}
                                                    onChange={(e) =>
                                                        setRate({
                                                            ...rate,
                                                            vendorId: e.target
                                                                .value
                                                                ? Number(
                                                                      e.target
                                                                          .value,
                                                                  )
                                                                : null,
                                                        })
                                                    }
                                                >
                                                    <option value="">
                                                        {t('shop.Store-owned products')}
                                                    </option>
                                                    {vendors
                                                        .filter((v) => v.active)
                                                        .map((v) => (
                                                            <option
                                                                value={v.id}
                                                                key={v.id}
                                                            >
                                                                {v.name}
                                                            </option>
                                                        ))}
                                                </select>
                                            </label>
                                        )}
                                        <label>
                                            {t('shop.Governorate')}
                                            <select
                                                value={rate.governorate}
                                                disabled={!!rate.id}
                                                onChange={(e) =>
                                                    setRate({
                                                        ...rate,
                                                        governorate:
                                                            e.target.value,
                                                    })
                                                }
                                            >
                                                {egyptGovernorates.map(
                                                    ([id, en, ar]) => (
                                                        <option
                                                            key={id}
                                                            value={id}
                                                        >
                                                            {i18n.locale === 'ar' ? ar : en}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </label>
                                        <label>
                                            {t('shop.Name')}
                                            <input
                                                required
                                                value={rate.name}
                                                onChange={(e) =>
                                                    setRate({
                                                        ...rate,
                                                        name: e.target.value,
                                                    })
                                                }
                                            />
                                        </label>
                                        <label>
                                            {t('shop.Delivery charge (EGP)')}
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                required
                                                value={rate.rate / 100}
                                                onChange={(e) =>
                                                    setRate({
                                                        ...rate,
                                                        rate: Math.round(
                                                            Number(
                                                                e.target.value,
                                                            ) * 100,
                                                        ),
                                                    })
                                                }
                                            />
                                        </label>
                                    </div>
                                    <label>
                                        {t('shop.Delivery description')}
                                        <textarea
                                            value={rate.description}
                                            onChange={(e) =>
                                                setRate({
                                                    ...rate,
                                                    description: e.target.value,
                                                })
                                            }
                                        />
                                    </label>
                                    <div className="actions">
                                        <button
                                            className="primary"
                                            type="submit"
                                        >
                                            {t('shop.Save rate')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRate(null)}
                                        >
                                            {t('shop.Close')}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </>
                    )}
                    {tab === 'payments' && access.kind === 'admin' && (
                        <>
                            <p>
                                {t('shop.Collection belongs to store management. Card payments remain unavailable.')}
                            </p>
                            <div className="actions">
                                {['cash-on-delivery', 'bank-transfer']
                                    .filter(
                                        (type) =>
                                            !payments.some(
                                                (p) => p.type === type,
                                            ),
                                    )
                                    .map((type) => (
                                        <button
                                            key={type}
                                            onClick={() =>
                                                setPayment({
                                                    code: type,
                                                    type,
                                                    name: '',
                                                    description: '',
                                                    enabled: false,
                                                })
                                            }
                                        >
                                            {type === 'cash-on-delivery' ? t('shop.Add cash on delivery') : t('shop.Add bank transfer')}
                                        </button>
                                    ))}
                            </div>
                            {payments.map((p) => (
                                <div key={p.id} className="panel">
                                    <h3>{p.name}</h3>
                                    <p>
                                        {p.enabled
                                            ? t('shop.Enabled')
                                            : t('shop.Disabled')}{' '}
                                        · {p.type}
                                    </p>
                                    <button onClick={() => setPayment(p)}>
                                        {t('shop.Edit method')}
                                    </button>
                                </div>
                            ))}
                            {payment && (
                                <form
                                    className="panel"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        void run(async () => {
                                            await mutate(
                                                'saveMarketplacePaymentMethod',
                                                payment,
                                            );
                                            setPayment(null);
                                        });
                                    }}
                                >
                                    <h2>{t('shop.Payment method')}</h2>
                                    <div className="grid">
                                        <label>
                                            {t('shop.Name')}
                                            <input
                                                required
                                                value={payment.name}
                                                onChange={(e) =>
                                                    setPayment({
                                                        ...payment,
                                                        name: e.target.value,
                                                    })
                                                }
                                            />
                                        </label>
                                        <label>
                                            {t('shop.Code')}
                                            <input
                                                required
                                                disabled={!!payment.id}
                                                value={payment.code}
                                                onChange={(e) =>
                                                    setPayment({
                                                        ...payment,
                                                        code: e.target.value,
                                                    })
                                                }
                                            />
                                        </label>
                                    </div>
                                    <label>
                                        {t('shop.Public receiving instructions')}
                                        <textarea
                                            required={
                                                payment.type === 'bank-transfer'
                                            }
                                            value={payment.description}
                                            onChange={(e) =>
                                                setPayment({
                                                    ...payment,
                                                    description: e.target.value,
                                                })
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span>
                                            <input
                                                type="checkbox"
                                                checked={payment.enabled}
                                                onChange={(e) =>
                                                    setPayment({
                                                        ...payment,
                                                        enabled:
                                                            e.target.checked,
                                                    })
                                                }
                                            />{' '}
                                            {t('shop.Enabled')}
                                        </span>
                                    </label>
                                    <div className="actions">
                                        <button className="primary">
                                            {t('shop.Save method')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPayment(null)}
                                        >
                                            {t('shop.Close')}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </>
                    )}
                    {tab === 'accounts' && access.kind === 'admin' && (
                        <>
                            <AccountForm
                                superAdmin={access.superAdmin}
                                run={run}
                            />
                            <div className="panel">
                                <h2>{t('shop.Sellers')}</h2>
                                <p>
                                    {t('shop.Disabling a seller hides their products and blocks their workspace. Re-enabling does not republish products.')}
                                </p>
                                {vendors.map((v) => (
                                    <div className="actions" key={v.id}>
                                        <span>
                                            {v.name} · {v.code} ·{' '}
                                            {v.active
                                                ? t('shop.Active')
                                                : t('shop.Disabled')}
                                        </span>
                                        <button
                                            onClick={() =>
                                                void run(() =>
                                                    mutate(
                                                        'setStoreSellerActive',
                                                        {
                                                            id: v.id,
                                                            active: !v.active,
                                                            version: v.version,
                                                        },
                                                    ),
                                                )
                                            }
                                        >
                                            {v.active
                                                ? t('shop.Disable seller')
                                                : t('shop.Enable seller')}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </fieldset>
            )}
        </section>
    );
}

function ProductEditor({
    product,
    access,
    vendors,
    save,
    close,
}: {
    product: Product;
    access: Access;
    vendors: Vendor[];
    save: (input: unknown) => Promise<void>;
    close: () => void;
}) {
    const { _: t } = useLingui();
    const [p, set] = useState(product),
        [customSlug, setCustomSlug] = useState(Boolean(product.slug)),
        [uploadError, setUploadError] = useState(''),
        [uploading, setUploading] = useState(false);
    const ar = p.translations?.find((t) => t.languageCode === 'ar');
    const [arName, setArName] = useState(ar?.name || ''),
        [arDescription, setArDescription] = useState(ar?.description || '');
    const slug = customSlug ? p.slug : slugFromProductName(p.name);
    const field = (key: 'name' | 'slug' | 'description', value: string) =>
        set((prev) => ({ ...prev, [key]: value }));
    return (
        <form
            className="panel"
            aria-label={t('shop.Product editor')}
            onSubmit={(e) => {
                e.preventDefault();
                void save({
                    ...p,
                    slug,
                    removedVariantIds: product.variants
                        .filter(
                            (original) =>
                                original.id != null &&
                                !p.variants.some((v) => v.id === original.id),
                        )
                        .map((original) => original.id),
                    vendorId: p.ownerId,
                    assetIds: p.assets.map((a) => a.id),
                    arName,
                    arDescription,
                    arSlug: ar?.slug,
                });
            }}
        >
            <h2>
                {p.id
                    ? t('shop.Edit product')
                    : t('shop.New product')}
            </h2>
            <p>
                {access.pricesIncludeTax
                    ? t('shop.Prices include store tax')
                    : t('shop.Prices exclude store tax')}
            </p>
            <div className="grid">
                {access.kind === 'admin' && (
                    <label>
                        {t('shop.Seller')}
                        <select
                            value={p.ownerId || ''}
                            disabled={!!p.id || p.assets.length > 0}
                            onChange={(e) =>
                                set({
                                    ...p,
                                    ownerId: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                })
                            }
                        >
                            <option value="">
                                {t('shop.Store-owned product')}
                            </option>
                            {vendors
                                .filter((v) => v.active)
                                .map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.name}
                                    </option>
                                ))}
                        </select>
                    </label>
                )}
                <label>
                    {t('shop.Name (English)')}
                    <input
                        required
                        value={p.name}
                        onChange={(e) => field('name', e.target.value)}
                    />
                </label>
                <label>
                    {t('shop.URL slug')}
                    <input
                        required
                        value={slug}
                        maxLength={200}
                        onChange={(e) => {
                            setCustomSlug(true);
                            field('slug', e.target.value);
                        }}
                        onBlur={() => {
                            if (!p.slug.trim()) setCustomSlug(false);
                        }}
                    />
                </label>
                <label>
                    {t('shop.Name (Arabic)')}
                    <input
                        dir="rtl"
                        value={arName}
                        onChange={(e) => setArName(e.target.value)}
                    />
                </label>
            </div>
            <label>
                {t('shop.Description (English)')}
                <textarea
                    value={p.description}
                    onChange={(e) => field('description', e.target.value)}
                />
            </label>
            <label>
                {t('shop.Description (Arabic)')}
                <textarea
                    dir="rtl"
                    value={arDescription}
                    onChange={(e) => setArDescription(e.target.value)}
                />
            </label>
            <ProductDetailsEditor label={t('shop.Details (English)')} direction="ltr" value={p.detailsEn || ''} assets={p.assets}
                onChange={detailsEn => set(prev => ({ ...prev, detailsEn }))}/>
            <ProductDetailsEditor label={t('shop.Details (Arabic)')} direction="rtl" value={p.detailsAr || ''} assets={p.assets}
                onChange={detailsAr => set(prev => ({ ...prev, detailsAr }))}/>
            <h3>{t('shop.Variants & stock')}</h3>
            {p.variants.map((v, index) => (
                <div
                    className="grid"
                    key={v.id == null ? `draft-${index}` : `saved-${v.id}`}
                >
                    <label>
                        {t('shop.Variant name')}
                        <input
                            required
                            value={v.name}
                            onChange={(e) =>
                                set({
                                    ...p,
                                    variants: p.variants.map((row, i) =>
                                        i === index
                                            ? { ...row, name: e.target.value }
                                            : row,
                                    ),
                                })
                            }
                        />
                    </label>
                    <label>
                        {t('shop.SKU')}
                        <input
                            required
                            value={v.sku}
                            onChange={(e) =>
                                set({
                                    ...p,
                                    variants: p.variants.map((row, i) =>
                                        i === index
                                            ? { ...row, sku: e.target.value }
                                            : row,
                                    ),
                                })
                            }
                        />
                    </label>
                    <label>
                        {t('shop.Price (EGP)')}
                        <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={v.price / 100}
                            onChange={(e) =>
                                set({
                                    ...p,
                                    variants: p.variants.map((row, i) =>
                                        i === index
                                            ? {
                                                  ...row,
                                                  price: Math.round(
                                                      Number(e.target.value) *
                                                          100,
                                                  ),
                                              }
                                            : row,
                                    ),
                                })
                            }
                        />
                    </label>
                    <label>
                        {t('shop.Stock')}
                        <input
                            required
                            type="number"
                            min="0"
                            step="1"
                            value={v.stockOnHand}
                            onChange={(e) =>
                                set({
                                    ...p,
                                    variants: p.variants.map((row, i) =>
                                        i === index
                                            ? {
                                                  ...row,
                                                  stockOnHand: Number(
                                                      e.target.value,
                                                  ),
                                              }
                                            : row,
                                    ),
                                })
                            }
                        />
                    </label>
                    <div className="variant-actions">
                        <label>
                            <span>
                                <input
                                    type="checkbox"
                                    checked={v.enabled !== false}
                                    onChange={(e) =>
                                        set({
                                            ...p,
                                            variants: p.variants.map((row, i) =>
                                                i === index
                                                    ? {
                                                          ...row,
                                                          enabled: e.target.checked,
                                                      }
                                                    : row,
                                            ),
                                        })
                                    }
                                />{' '}
                                {t('shop.Available')}
                            </span>
                        </label>
                        <button
                            type="button"
                            aria-label={t('shop.Remove variant')}
                            disabled={p.variants.length === 1}
                            title={
                                p.variants.length === 1
                                    ? t('shop.Keep at least one variant')
                                    : undefined
                            }
                            onClick={() =>
                                set((prev) => ({
                                    ...prev,
                                    variants: prev.variants.filter(
                                        (_, i) => i !== index,
                                    ),
                                }))
                            }
                        >
                            {t('shop.Remove')}
                        </button>
                    </div>
                </div>
            ))}
            <button
                type="button"
                disabled={p.variants.length >= 50 || p.canAddVariants === false}
                onClick={() =>
                    set({
                        ...p,
                        variants: [
                            ...p.variants,
                            {
                                name: '',
                                sku: '',
                                price: 0,
                                stockOnHand: 0,
                                enabled: true,
                            },
                        ],
                    })
                }
            >
                {t('shop.Add variant')}
            </button>
            {p.canAddVariants === false && (
                <p>
                    {t('shop.New combinations of sizes or colors for this product must be configured by SuperAdmin. You can edit existing variants here.')}
                </p>
            )}
            {p.id && access.superAdmin && (
                <p>
                    <a href={`/dashboard/products/${p.id}`}>
                        {t('shop.Advanced product options')}
                    </a>
                </p>
            )}
            <h3>{t('shop.Product images')}</h3>
            <div className="images">
                {p.assets.map((image) => (
                    <figure key={image.id}>
                        <img src={image.preview} alt={image.name} />
                        <figcaption>
                            <button
                                type="button"
                                onClick={() =>
                                    set({
                                        ...p,
                                        assets: p.assets.filter(
                                            (a) => a.id !== image.id,
                                        ),
                                    })
                                }
                            >
                                {t('shop.Remove')}
                            </button>
                        </figcaption>
                    </figure>
                ))}
            </div>
            <label>
                {t('shop.Upload image, max 5 MB')}
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploading}
                    onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        setUploadError('');
                        try {
                            const result = await api.uploadWithProgress<{
                                uploadMarketplaceImage: Image;
                            }>(
                                'mutation($file:Upload!,$vendorId:ID){uploadMarketplaceImage(file:$file,vendorId:$vendorId)}',
                                {
                                    file,
                                    vendorId:
                                        access.sellerId || p.ownerId || null,
                                },
                            );
                            if (!result.success)
                                throw Error(t('shop.Upload failed'));
                            set((prev) => ({
                                ...prev,
                                assets: [
                                    ...prev.assets,
                                    result.data.uploadMarketplaceImage,
                                ],
                            }));
                        } catch (error) {
                            setUploadError(
                                error instanceof Error
                                    ? error.message
                                    : t('shop.Upload failed'),
                            );
                        } finally {
                            setUploading(false);
                            e.target.value = '';
                        }
                    }}
                />
            </label>
            {uploadError && (
                <p role="alert" className="error">
                    {uploadError}
                </p>
            )}
            <label>
                <span>
                    <input
                        type="checkbox"
                        checked={p.enabled}
                        onChange={(e) =>
                            set({ ...p, enabled: e.target.checked })
                        }
                    />{' '}
                    {t('shop.Published')}
                </span>
            </label>
            <div className="actions">
                <button className="primary" disabled={uploading}>
                    {t('shop.Save product')}
                </button>
                <button type="button" onClick={close}>
                    {t('shop.Close')}
                </button>
            </div>
        </form>
    );
}

function AccountForm({
    superAdmin,
    run,
}: {
    superAdmin: boolean;
    run: (action: () => Promise<unknown>) => Promise<void>;
}) {
    const { _: t } = useLingui();
    const [kind, setKind] = useState('seller');
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = e.currentTarget,
            data = Object.fromEntries(new FormData(form));
        await run(async () => {
            await mutate(
                kind === 'admin' ? 'createStoreAdmin' : 'createStoreSeller',
                data,
            );
            form.reset();
        });
    }
    return (
        <form className="panel" onSubmit={submit}>
            <h2>{t('shop.Create account')}</h2>
            <p>
                {t('shop.New, unique email. Share the password privately and let the user change it from their profile.')}
            </p>
            <div className="grid">
                <label>
                    {t('shop.Role')}
                    <select
                        value={kind}
                        onChange={(e) => setKind(e.target.value)}
                    >
                        <option value="seller">{t('shop.Seller')}</option>
                        {superAdmin && (
                            <option value="admin">{t('shop.Admin')}</option>
                        )}
                    </select>
                </label>
                <label>
                    {t('shop.Name')}
                    <input required name="name" autoComplete="off" />
                </label>
                {kind === 'seller' && (
                    <label>
                        {t('shop.Seller code')}
                        <input
                            required
                            name="code"
                            pattern="[a-z0-9]+(-[a-z0-9]+)*"
                            placeholder="robot-academy"
                        />
                    </label>
                )}
                <label>
                    {t('shop.Email')}
                    <input
                        required
                        type="email"
                        name="email"
                        autoComplete="off"
                    />
                </label>
                <label>
                    {t('shop.Initial password')}
                    <input
                        required
                        type="password"
                        name="password"
                        minLength={12}
                        autoComplete="new-password"
                    />
                </label>
            </div>
            <button className="primary">{t('shop.Create account')}</button>
        </form>
    );
}
function OrderPanel({
    order,
    run,
    reload,
    embedded = false,
}: {
    embedded?: boolean;
    order: Order;
    run: (action: () => Promise<unknown>) => Promise<void>;
    reload: () => Promise<void>;
}) {
    const { _: t } = useLingui();
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    return (
        <section className="panel">
            <h2>
                {embedded
                    ? t('shop.Order items & shipping')
                    : order.code}
            </h2>
            <p>
                {Object.values(order.address || {})
                    .filter(Boolean)
                    .join(' · ')}
            </p>
            {!embedded && (
                <p>
                    {t('shop.Telephone confirmation:')} {order.phoneStatus}
                </p>
            )}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    const data = Object.fromEntries(
                        new FormData(e.currentTarget),
                    );
                    void run(async () => {
                        await mutate('dispatchMarketplaceItems', {
                            ...data,
                            orderId: order.id,
                            lines: order.lines
                                .filter(
                                    (line) => (quantities[line.id] || 0) > 0,
                                )
                                .map((line) => ({
                                    id: line.id,
                                    quantity: quantities[line.id],
                                })),
                        });
                        setQuantities({});
                        await reload();
                    });
                }}
            >
                <div className="scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('shop.Item')}</th>
                                <th>{t('shop.SKU')}</th>
                                <th>{t('shop.Quantity')}</th>
                                <th>{t('shop.Amount')}</th>
                                <th>{t('shop.Dispatch now')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.lines.map((line) => (
                                <tr key={line.id}>
                                    <td>{line.name}</td>
                                    <td>{line.sku}</td>
                                    <td>{line.quantity}</td>
                                    <td>
                                        {amount(
                                            line.amount,
                                            order.currencyCode,
                                        )}
                                    </td>
                                    <td>
                                        <input
                                            aria-label={`${t('shop.Dispatch')} ${line.sku}`}
                                            type="number"
                                            min="0"
                                            max={line.remaining}
                                            step="1"
                                            value={quantities[line.id] || 0}
                                            onChange={(e) =>
                                                setQuantities({
                                                    ...quantities,
                                                    [line.id]: Number(
                                                        e.target.value,
                                                    ),
                                                })
                                            }
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="grid">
                    <label>
                        {t('shop.Carrier')}
                        <input required name="carrier" />
                    </label>
                    <label>
                        {t('shop.Tracking number')}
                        <input required name="trackingCode" />
                    </label>
                </div>
                <button
                    className="primary"
                    disabled={!Object.values(quantities).some((n) => n > 0)}
                >
                    {t('shop.Record actual dispatch')}
                </button>
            </form>
            {order.payments && (
                <section className="panel">
                    <h3>{t('shop.Central order management')}</h3>
                    <p>
                        {t('shop.Cancellation and refunds are separate actions. A refund stays pending until the money is actually returned.')}
                    </p>
                    {order.state !== 'Cancelled' && (
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const data = new FormData(e.currentTarget);
                                void run(async () => {
                                    await mutate('cancelStoreOrder', {
                                        orderId: order.id,
                                        reason: String(data.get('reason')),
                                    });
                                    await reload();
                                });
                            }}
                        >
                            <label>
                                {t('shop.Cancellation reason')}
                                <input required name="reason" maxLength={255} />
                            </label>
                            <label>
                                <span>
                                    <input type="checkbox" required /> {t('shop.Cancel the whole order')}
                                </span>
                            </label>
                            <button>{t('shop.Cancel order')}</button>
                        </form>
                    )}
                    {order.payments
                        .filter((p) => p.state === 'Settled')
                        .map((p) => (
                            <div key={p.id}>
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        const data = new FormData(
                                            e.currentTarget,
                                        );
                                        void run(async () => {
                                            await mutate('refundStoreOrder', {
                                                orderId: order.id,
                                                paymentId: p.id,
                                                amount: Math.round(
                                                    Number(data.get('amount')) *
                                                        100,
                                                ),
                                                reason: String(
                                                    data.get('reason'),
                                                ),
                                            });
                                            await reload();
                                        });
                                    }}
                                >
                                    <div className="grid">
                                        <label>
                                            {t('shop.Refund amount (EGP)')}
                                            <input
                                                required
                                                type="number"
                                                name="amount"
                                                min="0.01"
                                                step="0.01"
                                                max={
                                                    (p.amount -
                                                        p.refunds
                                                            .filter(
                                                                (r) =>
                                                                    r.state !==
                                                                    'Failed',
                                                            )
                                                            .reduce(
                                                                (sum, r) =>
                                                                    sum +
                                                                    r.total,
                                                                0,
                                                            )) /
                                                    100
                                                }
                                            />
                                        </label>
                                        <label>
                                            {t('shop.Reason')}
                                            <input
                                                name="reason"
                                                required
                                                maxLength={255}
                                            />
                                        </label>
                                    </div>
                                    <button>
                                        {t('shop.Create pending refund')}
                                    </button>
                                </form>
                                {p.refunds.map((r) => (
                                    <div key={r.id}>
                                        <p>
                                            {amount(
                                                r.total,
                                                order.currencyCode,
                                            )}{' '}
                                            · {r.state}
                                        </p>
                                        {r.state === 'Pending' && (
                                            <form
                                                onSubmit={(e) => {
                                                    e.preventDefault();
                                                    const data = new FormData(
                                                        e.currentTarget,
                                                    );
                                                    void run(async () => {
                                                        await mutate(
                                                            'settleStoreRefund',
                                                            {
                                                                orderId:
                                                                    order.id,
                                                                refundId: r.id,
                                                                confirmed: true,
                                                                reference:
                                                                    String(
                                                                        data.get(
                                                                            'reference',
                                                                        ),
                                                                    ),
                                                            },
                                                        );
                                                        await reload();
                                                    });
                                                }}
                                            >
                                                <label>
                                                    {t('shop.Actual refund reference')}
                                                    <input
                                                        name="reference"
                                                        required
                                                        maxLength={120}
                                                    />
                                                </label>
                                                <label>
                                                    <span>
                                                        <input
                                                            type="checkbox"
                                                            required
                                                        />{' '}
                                                        {t('shop.The money was actually returned')}
                                                    </span>
                                                </label>
                                                <button>
                                                    {t('shop.Confirm actual refund')}
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                </section>
            )}
            <h3>{t('shop.Shipments')}</h3>
            {order.fulfillments.map((f) => (
                <div key={f.id} className="actions">
                    <span>
                        {f.carrier} · {f.trackingCode} · {f.state}
                    </span>
                    {f.editable && f.state === 'Shipped' && (
                        <button
                            onClick={() =>
                                void run(async () => {
                                    await req(
                                        'mutation($id:ID!){transitionMarketplaceShipment(id:$id,state:"Delivered")}',
                                        { id: f.id },
                                    );
                                    await reload();
                                })
                            }
                        >
                            {t('shop.Mark delivered')}
                        </button>
                    )}
                    {f.editable && ['Pending', 'Shipped'].includes(f.state) && (
                        <button
                            onClick={() =>
                                void run(async () => {
                                    await req(
                                        'mutation($id:ID!){transitionMarketplaceShipment(id:$id,state:"Cancelled")}',
                                        { id: f.id },
                                    );
                                    await reload();
                                })
                            }
                        >
                            {t('shop.Cancel shipment')}
                        </button>
                    )}
                </div>
            ))}
        </section>
    );
}

// The existing Sales page owns navigation and the selected order. Reuse the
// scoped order API here so shipping/refunds stay inside that same order view.
export function SellingOrderDetails({
    orderId,
    reloadKey,
    onChange,
}: {
    orderId: string;
    reloadKey?: string;
    onChange: () => Promise<void>;
}) {
    const { _: t } = useLingui();
    const [order, setOrder] = useState<Order | null>(null),
        [error, setError] = useState(''),
        [message, setMessage] = useState(''),
        [busy, setBusy] = useState(false);
    const refresh = useCallback(async () => {
        const data = await req<{ marketplaceOrder: Order }>(
            'query($id:ID!){marketplaceOrder(id:$id)}',
            { id: orderId },
        );
        return data.marketplaceOrder;
    }, [orderId]);
    useEffect(() => {
        let current = true;
        setError('');
        void refresh()
            .then((order) => {
                if (current) setOrder(order);
            })
            .catch((error) => {
                if (current) setError(error.message);
            });
        return () => {
            current = false;
        };
    }, [refresh, reloadKey]);
    const run = async (action: () => Promise<unknown>) => {
        setBusy(true);
        setError('');
        setMessage('');
        try {
            await action();
            setOrder(await refresh());
            await onChange();
            setMessage(t('shop.Saved'));
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : t('shop.Unable to save'),
            );
        } finally {
            setBusy(false);
        }
    };
    return (
        <section
            className="sv-market sv-market-embedded"
            aria-label={t('shop.Order items and shipping')}
        >
            <style>{styles}</style>
            {error && (
                <p className="error" role="alert">
                    {error}
                </p>
            )}
            {message && (
                <p className="notice" role="status">
                    {message}
                </p>
            )}
            {order && (
                <fieldset
                    disabled={busy}
                    style={{ border: 0, padding: 0, minWidth: 0 }}
                >
                    <OrderPanel
                        key={order.id}
                        order={order}
                        embedded
                        run={run}
                        reload={async () => setOrder(await refresh())}
                    />
                </fieldset>
            )}
        </section>
    );
}
