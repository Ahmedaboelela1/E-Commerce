import {SellingSectionPanel,SellingOrderDetails,type SellingSection} from '../../marketplace/dashboard';
import {
    useLingui,
    defineDashboardExtension,
    api,
    useChannel,
    usePermissions,
} from '@vendure/dashboard';
import {useCallback, useEffect, useRef, useState} from 'react';
import {consolidateCommerceNavigation} from './navigation';
import {ShopDialog} from '../../dashboard/shop-dialog';

type Payment = {
    id: string;
    method: string;
    offlineType: 'bank-transfer' | 'cash-on-delivery' | null;
    state: string;
    amount: number;
};
type OrderRow = {
    id: string;
    code: string;
    state: string;
    total: number;
    currencyCode: string;
    customer: string;
    phoneStatus: string;
    receiptStatus: string;
};
type OrderDetail = OrderRow & {
    customerName: string;
    email: string;
    phone: string;
    notes: string;
    version: number;
    receiptUploaded: boolean;
    transferReference: string;
    receiptReviewNote: string;
    payments: Payment[];
    shipments: Array<{
        id: string;
        carrier: string;
        trackingCode: string;
        state: string;
        trackingUrl?: string;
    }>;
};
type Settings = {
    sellerName: string;
    sellerAddress: string;
    sellerTaxId: string;
    invoicePrefix: string;
    lowStockEnabled: boolean;
    lowStockThreshold: number;
    notificationEmail: string;
};
type Stock = {
    id: string;
    sku: string;
    name: string;
    available: number;
    allocated: number;
    onHand: number;
    low: boolean;
};
type Review = {
    id: string;
    productId: number;
    rating: number;
    text: string;
    authorName: string;
    status: string;
    version: number;
};
type Report = {
    currencyCode: string;
    orderCount: number;
    cancelledCount: number;
    gross: number;
    collected: number;
    pending: number;
    refunded: number;
    topProducts: Array<{
        productId: string;
        variantId: string;
        quantity: number;
        name: string;
        sku: string;
    }>;
};
type Download = {filename: string; mimeType: string; dataBase64: string};

const css = `.sv-suite{padding:24px;max-width:1400px;margin:auto;color:var(--foreground,#172738)}.sv-suite h1{font-size:28px;font-weight:700;margin-bottom:6px}.sv-suite h2{font-size:20px;font-weight:650;margin:16px 0}.sv-suite p{margin:8px 0}.sv-suite button,.sv-suite a.sv-btn{border:1px solid var(--border,#d8e2e8);border-radius:9px;padding:9px 16px;background:var(--background,#fff);font-size:14px;cursor:pointer;font-weight:600;text-decoration:none}.sv-suite button:disabled{opacity:.45;cursor:not-allowed}.sv-suite .sv-primary{background:#087e55;color:white;border-color:#087e55}.sv-suite .sv-danger{color:#b91c1c}.sv-suite input:not([type=checkbox]),.sv-suite select,.sv-suite textarea{display:block;border:1px solid var(--border,#ccd8df);border-radius:8px;padding:10px;width:100%;margin-top:5px;background:var(--background,#fff);color:inherit}.sv-suite label{display:block;font-size:13px;font-weight:600;margin:12px 0}.sv-suite .sv-box{border:1px solid var(--border,#dbe5eb);border-radius:14px;padding:18px;margin:14px 0;background:var(--card,#fff)}.sv-suite .sv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px}.sv-suite .sv-tabs{display:flex;gap:8px;overflow:auto;padding:16px 0}.sv-suite [aria-selected=true]{background:#087e55;color:white}.sv-suite table{width:100%;border-collapse:collapse;text-align:start;font-size:14px}.sv-suite th,.sv-suite td{padding:12px;border-bottom:1px solid var(--border,#e4ebef);text-align:start;vertical-align:top}.sv-suite .sv-table{overflow:auto}.sv-suite .sv-muted{color:var(--muted-foreground,#64748b);font-size:13px}.sv-suite .sv-error{padding:12px;border-radius:9px;background:#fff0f1;color:#a61b29}.sv-suite .sv-success{padding:12px;border-radius:9px;background:#eaf7ef;color:#087e55}.sv-suite .sv-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.sv-suite .sv-metric{font-size:26px;font-weight:700}.sv-suite .sv-prose{white-space:pre-wrap;overflow-wrap:anywhere}.sv-suite input[type=checkbox]{margin-inline-end:8px}.sv-suite .sv-low{color:#b91c1c;font-weight:700}`;

function download(file: Download) {
    const bytes = Uint8Array.from(atob(file.dataBase64), (c) =>
        c.charCodeAt(0),
    );
    const url = URL.createObjectURL(new Blob([bytes], {type: file.mimeType}));
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const request = <T,>(document: string, variables?: Record<string, unknown>) =>
    api.query<T>(document, variables);
const money = (value: number, currency = 'EGP') =>
    (value / 100).toLocaleString(undefined, {style: 'currency', currency});
const dateValue = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function OperationsPage() {
    const { _: t, i18n } = useLingui();
    const {activeChannel} = useChannel();
    const {hasPermissions} = usePermissions();
    const storeAdmin = hasPermissions(['ManageStore']);
    const allowed = (permission:string) => hasPermissions([permission]) || (storeAdmin && ['ReadOrder','UpdateOrder','ReadCatalog','UpdateCatalog','CreatePromotion'].includes(permission));
    const sellerOnly=hasPermissions(['SellOwnProducts'])&&!storeAdmin;
    const canReadOrders=allowed('ReadOrder');
    const canManageCatalog=storeAdmin||sellerOnly;
    const integratedOrderManagement=storeAdmin&&activeChannel?.code!=='__default_channel__';
    const tabDefinitions:[string,string,boolean][]=[
        ['orders',t('shop.Orders'),canReadOrders||sellerOnly],
        ['products',t('shop.Products'),canManageCatalog],
        ['reports',t('shop.Sales'),allowed('ReadOrder')],
        ['inventory',t('shop.Stock'),allowed('ReadCatalog')],
        ['delivery',t('shop.Delivery rates'),canManageCatalog],
        ['payments',t('shop.Payments'),storeAdmin],
        ['accounts',t('shop.Team & sellers'),storeAdmin],
        ['reviews',t('shop.Reviews'),allowed('ReadCatalog')],
        ['coupons',t('shop.Coupons'),allowed('CreatePromotion')],
        ['settings',t('shop.Settings'),hasPermissions(['ReadSettings'])],
    ];
    const tabs=tabDefinitions.filter(([, ,visible])=>visible);
    const [requestedTab, setTab] = useState(()=>typeof window==='undefined'?'orders':new URLSearchParams(window.location.search).get('tab')||'orders');
    const tab = tabs.some((item) => item[0] === requestedTab)
        ? requestedTab
        : tabs[0]?.[0] || '';
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [search, setSearch] = useState('');
    const [skip, setSkip] = useState(0);
    const [total, setTotal] = useState(0);
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [selected, setSelected] = useState<OrderDetail | null>(null);
    const orderOpener = useRef<HTMLButtonElement>(null);
    const openOrderSession = useRef<{id: string} | null>(null);
    const [notes, setNotes] = useState('');
    const [phoneStatus, setPhoneStatus] = useState('pending');
    const [reference, setReference] = useState('');
    const [fundsReceived, setFundsReceived] = useState(false);
    const [rejectNote, setRejectNote] = useState('');
    const [carrier, setCarrier] = useState('aramex');
    const [tracking, setTracking] = useState('');
    const [receipt, setReceipt] = useState<Download | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [stock, setStock] = useState<Stock[]>([]);
    const [stockTotal, setStockTotal] = useState(0);
    const [stockSkip, setStockSkip] = useState(0);
    const [reviewStatus, setReviewStatus] = useState('pending');
    const [reviews, setReviews] = useState<Review[]>([]);
    const [reviewSkip, setReviewSkip] = useState(0);
    const [reviewTotal, setReviewTotal] = useState(0);
    const [from, setFrom] = useState(
        dateValue(new Date(Date.now() - 30 * 86400000)),
    );
    const [to, setTo] = useState(dateValue(new Date()));
    const [report, setReport] = useState<Report | null>(null);
    const [coupon, setCoupon] = useState({
        name: '',
        code: '',
        percent: 10,
        minimum: 0,
        usageLimit: 100,
        startsAt: '',
        endsAt: '',
        enabled: false,
    });

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setError('');
        setMessage('');
        try {
            await action();
        } catch (e) {
            setError(e instanceof Error ? e.message : t('shop.Request failed'));
        } finally {
            setBusy(false);
        }
    };
    const loadOrders = useCallback(async () => {
        const d = await request<{
            shopOperationsOrders: {items: OrderRow[]; total: number};
        }>(
            'query($search:String,$skip:Int){shopOperationsOrders(search:$search,skip:$skip)}',
            {search, skip},
        );
        setOrders(d.shopOperationsOrders.items);
        setTotal(d.shopOperationsOrders.total);
    }, [search, skip]);
    const loadOrder = async (id: string) => {
        const session = openOrderSession.current;
        if (session?.id !== id) return;
        const d = await request<{shopOperationsOrder: OrderDetail}>(
            'query($id:ID!){shopOperationsOrder(orderId:$id)}',
            {id},
        );
        if (openOrderSession.current !== session) return;
        setSelected(d.shopOperationsOrder);
        setNotes(d.shopOperationsOrder.notes);
        setPhoneStatus(d.shopOperationsOrder.phoneStatus);
        setReference(d.shopOperationsOrder.transferReference);
        setFundsReceived(false);
        setReceipt(null);
        setRejectNote('');
        setTracking('');
    };
    const loadTab = useCallback(async () => {
        if (tab === 'orders' && canReadOrders) await loadOrders();
        if (tab === 'inventory') {
            const d = await request<{
                shopOperationsInventory: {items: Stock[]; total: number};
            }>('query($skip:Int){shopOperationsInventory(skip:$skip)}', {
                skip: stockSkip,
            });
            setStock(d.shopOperationsInventory.items);
            setStockTotal(d.shopOperationsInventory.total);
        }
        if (tab === 'reviews') {
            const d = await request<{
                shopProductReviews: {items: Review[]; total: number};
            }>(
                'query($status:String,$skip:Int){shopProductReviews(status:$status,skip:$skip)}',
                {status: reviewStatus, skip: reviewSkip},
            );
            setReviews(d.shopProductReviews.items);
            setReviewTotal(d.shopProductReviews.total);
        }
        if (tab === 'settings') {
            const d = await request<{shopOperationsSettings: Settings}>(
                'query{shopOperationsSettings}',
            );
            setSettings(d.shopOperationsSettings);
        }
    }, [tab, loadOrders, stockSkip, reviewStatus, reviewSkip, canReadOrders]);
    useEffect(() => {
        openOrderSession.current = null;
        setSelected(null);
        setReceipt(null);
        setError('');
        setMessage('');
        setSkip(0);
        setStockSkip(0);
        setReviewSkip(0);
        setReport(null);
    }, [activeChannel?.id]);
    useEffect(() => {
        void loadTab().catch((e) =>
            setError(e instanceof Error ? e.message : t('shop.Could not load data')),
        );
    }, [loadTab, activeChannel?.id]);
    const permissions = allowed;
    const refreshOrder = async () => {
        if (selected) await loadOrder(selected.id);
        await loadOrders();
    };

    const showOrder = tab === 'orders' && selected !== null;
    const closeOrder = () => {
        openOrderSession.current = null;
        setSelected(null);
        setReceipt(null);
        setError('');
        setMessage('');
    };
    const feedback = (
        <>
            {error && (
                <p role="alert" className="sv-error">
                    {error}
                </p>
            )}
            {message && (
                <p role="status" className="sv-success">
                    {message}
                </p>
            )}
        </>
    );

    return (
        <div className="sv-suite" dir={i18n.locale === 'ar' ? 'rtl' : 'ltr'}>
            <style>{css}</style>
            <h1>{t('shop.Shop operations')}</h1>
            <p className="sv-muted">
                {activeChannel?.code} · {sellerOnly?t('shop.Your products, stock and order items only'):t('shop.Confirm, verify payment, then ship manually')}
            </p>
            <div className="sv-tabs" role="tablist">
                {tabs.map(([key, title]) => (
                    <button
                        key={key}
                        role="tab"
                        aria-selected={tab === key}
                        onClick={() => {
                            setTab(key);
                            const url=new URL(window.location.href);url.searchParams.set('tab',key);
                            window.history.replaceState(window.history.state,'',url);
                            closeOrder();
                        }}
                    >
                        {title}
                    </button>
                ))}
            </div>
            {!showOrder && feedback}
            {sellerOnly&&tab==='orders'&&<SellingSectionPanel key="seller-orders" section="orders"/>}
            {(['products','delivery','payments','accounts'].includes(tab))&&<SellingSectionPanel key={tab} section={(tab==='products'?'catalog':tab) as SellingSection}/>}
            {tab === 'orders' && permissions('ReadOrder') && (
                <>
                    <form
                        className="sv-actions"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void run(loadOrders);
                        }}
                    >
                        <label>
                            {t('shop.Order code')}
                            <input
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setSkip(0);
                                }}
                            />
                        </label>
                        <button disabled={busy}>{t('shop.Search')}</button>
                    </form>
                    <div className="sv-box sv-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('shop.Order')}</th>
                                    <th>{t('shop.Customer')}</th>
                                    <th>{t('shop.State')}</th>
                                    <th>{t('shop.Phone')}</th>
                                    <th>{t('shop.Transfer')}</th>
                                    <th>{t('shop.Total')}</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((o) => (
                                    <tr key={o.id}>
                                        <td>{o.code}</td>
                                        <td>{o.customer}</td>
                                        <td>{o.state}</td>
                                        <td>{o.phoneStatus}</td>
                                        <td>{o.receiptStatus}</td>
                                        <td>
                                            {money(o.total, o.currencyCode)}
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                aria-haspopup="dialog"
                                                disabled={busy}
                                                onClick={(event) => {
                                                    orderOpener.current = event.currentTarget;
                                                    openOrderSession.current = {id: o.id};
                                                    void run(() => loadOrder(o.id));
                                                }}
                                            >
                                                {t('shop.Open')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p>{total} {t('shop.orders')}</p>
                        <div className="sv-actions">
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
                    </div>
                    <ShopDialog
                        open={showOrder}
                        busy={busy}
                        title={selected ? `${selected.code} — ${selected.customerName}` : ''}
                        className="sv-suite"
                        opener={orderOpener}
                        onClose={closeOrder}
                    >
                        {selected && <div className="min-w-0 break-words">
                            {feedback}
                            <p>
                                {selected.email} · {selected.phone}
                            </p>
                            {hasPermissions(['ReadOrder']) && <a
                                className="sv-btn"
                                href={`/dashboard/orders/${selected.id}`}
                            >
                                {t('shop.Advanced order details')}
                            </a>}

                            {permissions('UpdateOrder') && selected.payments.some(p=>p.offlineType==='cash-on-delivery'&&p.state==='Authorized') && <form className="sv-box" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;const data=new FormData(form);void run(async()=>{await request('mutation($id:ID!,$reference:String!){confirmStoreCashReceipt(orderId:$id,confirmed:true,reference:$reference)}',{id:selected.id,reference:String(data.get('cashReference')||'')});await refreshOrder();form.reset();});}}><h3>{t('shop.Actual cash collection')}</h3><label>{t('shop.Collection reference')}<input name="cashReference" required maxLength={120}/></label><label><input type="checkbox" required/> {t('shop.I verified actual cash receipt')}</label><button className="sv-primary" disabled={busy}>{t('shop.Record cash received')}</button></form>}
                            {permissions('UpdateOrder') && (
                                <>
                                    <div className="sv-grid">
                                        <label>
                                            {t('shop.Phone confirmation')}
                                            <select
                                                value={phoneStatus}
                                                onChange={(e) =>
                                                    setPhoneStatus(
                                                        e.target.value,
                                                    )
                                                }
                                            >
                                                <option value="pending">
                                                    {t('shop.Awaiting call')}
                                                </option>
                                                <option value="confirmed">
                                                    {t('shop.Confirmed')}
                                                </option>
                                                <option value="unreachable">
                                                    {t('shop.Unreachable')}
                                                </option>
                                                <option value="cancelled">
                                                    {t('shop.Customer declined')}
                                                </option>
                                            </select>
                                        </label>
                                        <label>
                                            {t('shop.Internal call notes')}
                                            <textarea
                                                maxLength={2000}
                                                rows={3}
                                                value={notes}
                                                onChange={(e) =>
                                                    setNotes(e.target.value)
                                                }
                                            />
                                        </label>
                                    </div>
                                    <button
                                        className="sv-primary"
                                        disabled={busy}
                                        onClick={() =>
                                            void run(async () => {
                                                await request(
                                                    'mutation($id:ID!,$status:String!,$notes:String!,$version:Int!){updateOrderCallback(orderId:$id,status:$status,notes:$notes,version:$version)}',
                                                    {
                                                        id: selected.id,
                                                        status: phoneStatus,
                                                        notes,
                                                        version:
                                                            selected.version,
                                                    },
                                                );
                                                await refreshOrder();
                                                setMessage(
                                                    t('shop.Call status saved'),
                                                );
                                            })
                                        }
                                    >
                                        {t('shop.Save callback')}
                                    </button>
                                    <p className="sv-muted">
                                        {integratedOrderManagement?t('shop.Declining a call blocks dispatch. Cancel the order below to release reserved stock.'):t('shop.Declining a call blocks dispatch. Cancel the actual order in Orders to release reserved stock.')}
                                    </p>
                                </>
                            )}
                            <h2>{t('shop.Transfer')}</h2>
                            <p>
                                {selected.receiptStatus} ·{' '}
                                {selected.transferReference}
                            </p>
                            {selected.receiptReviewNote && (
                                <p>{selected.receiptReviewNote}</p>
                            )}
                            {selected.receiptUploaded && (
                                <button
                                    disabled={busy}
                                    onClick={() =>
                                        void run(async () => {
                                            const d = await request<{
                                                shopTransferReceipt: Download | null;
                                            }>(
                                                'query($id:ID!){shopTransferReceipt(orderId:$id)}',
                                                {id: selected.id},
                                            );
                                            setReceipt(d.shopTransferReceipt);
                                        })
                                    }
                                >
                                    {t('shop.View private receipt')}
                                </button>
                            )}
                            {receipt && (
                                <div>
                                    <img
                                        src={`data:${receipt.mimeType};base64,${receipt.dataBase64}`}
                                        alt={t('shop.Transfer receipt')}
                                        style={{
                                            maxWidth: '100%',
                                            maxHeight: 500,
                                            objectFit: 'contain',
                                        }}
                                    />
                                    <button onClick={() => download(receipt)}>
                                        {t('shop.Download receipt')}
                                    </button>
                                </div>
                            )}
                            {permissions('UpdateOrder') &&
                                selected.payments?.some(
                                    (p) =>
                                        p.offlineType === 'bank-transfer' &&
                                        p.state === 'Authorized',
                                ) && (
                                    <div className="sv-box">
                                        <label>
                                            {t('shop.Verified transfer reference')}
                                            <input
                                                maxLength={120}
                                                value={reference}
                                                onChange={(e) =>
                                                    setReference(e.target.value)
                                                }
                                            />
                                        </label>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={fundsReceived}
                                                onChange={(e) =>
                                                    setFundsReceived(
                                                        e.target.checked,
                                                    )
                                                }
                                            />
                                            {t('shop.I checked actual receipt in the receiving account')}
                                        </label>
                                        <button
                                            className="sv-primary"
                                            disabled={
                                                busy ||
                                                !fundsReceived ||
                                                !reference.trim()
                                            }
                                            onClick={() =>
                                                void run(async () => {
                                                    await request(
                                                        'mutation($id:ID!,$reference:String!){verifyShopTransfer(orderId:$id,reference:$reference,confirmFundsReceived:true)}',
                                                        {
                                                            id: selected.id,
                                                            reference,
                                                        },
                                                    );
                                                    await refreshOrder();
                                                    setMessage(
                                                        t('shop.Receipt confirmed'),
                                                    );
                                                })
                                            }
                                        >
                                            {t('shop.Confirm receipt and settle payment')}
                                        </button>
                                        <label>
                                            {t('shop.Reason for rejecting proof')}
                                            <textarea
                                                value={rejectNote}
                                                onChange={(e) =>
                                                    setRejectNote(
                                                        e.target.value,
                                                    )
                                                }
                                                maxLength={1000}
                                            />
                                        </label>
                                        <button
                                            className="sv-danger"
                                            disabled={
                                                busy || !rejectNote.trim()
                                            }
                                            onClick={() =>
                                                void run(async () => {
                                                    await request(
                                                        'mutation($id:ID!,$note:String!){rejectShopTransferProof(orderId:$id,note:$note)}',
                                                        {
                                                            id: selected.id,
                                                            note: rejectNote,
                                                        },
                                                    );
                                                    await refreshOrder();
                                                })
                                            }
                                        >
                                            {t('shop.Reject proof')}
                                        </button>
                                    </div>
                                )}
                            {integratedOrderManagement ? <SellingOrderDetails key={selected.id} orderId={selected.id} reloadKey={`${selected.version}:${selected.phoneStatus}:${selected.payments.map(payment=>payment.state).join(',')}`} onChange={refreshOrder}/> : <>
                            <h2>{t('shop.Shipping')}</h2>
                            {selected.shipments?.map((s) => (
                                <p key={s.id}>
                                    {s.carrier} · {s.trackingCode} · {s.state}{' '}
                                    {s.trackingUrl && (
                                        <a
                                            href={s.trackingUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {t('shop.Track')}
                                        </a>
                                    )}
                                </p>
                            ))}
                            {permissions('UpdateOrder') && (
                                <>
                                    <div className="sv-grid">
                                        <label>
                                            {t('shop.Carrier')}
                                            <select
                                                value={carrier}
                                                onChange={(e) =>
                                                    setCarrier(e.target.value)
                                                }
                                            >
                                                <option value="aramex">
                                                    {t('shop.Aramex')}
                                                </option>
                                                <option value="dhl">DHL</option>
                                                <option value="other">
                                                    {t('shop.Other carrier')}
                                                </option>
                                            </select>
                                        </label>
                                        <label>
                                            {t('shop.Tracking number')}
                                            <input
                                                value={tracking}
                                                maxLength={120}
                                                onChange={(e) =>
                                                    setTracking(e.target.value)
                                                }
                                            />
                                        </label>
                                    </div>
                                    <button
                                        className="sv-primary"
                                        disabled={busy || !tracking.trim()}
                                        onClick={() =>
                                            void run(async () => {
                                                await request(
                                                    'mutation($id:ID!,$carrier:String!,$tracking:String!){dispatchShopOrder(orderId:$id,carrier:$carrier,trackingCode:$tracking)}',
                                                    {
                                                        id: selected.id,
                                                        carrier,
                                                        tracking,
                                                    },
                                                );
                                                await refreshOrder();
                                                setMessage(
                                                    t('shop.Shipment recorded'),
                                                );
                                            })
                                        }
                                    >
                                        {t('shop.Record actual dispatch')}
                                    </button>
                                </>
                            )}
                            </>}
                            <h2>{t('shop.Invoice')}</h2>
                            <button
                                disabled={busy}
                                onClick={() =>
                                    void run(async () => {
                                        const d = await request<{
                                            shopOrderInvoice: Download;
                                        }>(
                                            'query($id:ID!){shopOrderInvoice(orderId:$id)}',
                                            {id: selected.id},
                                        );
                                        download(d.shopOrderInvoice);
                                    })
                                }
                            >
                                {t('shop.Download PDF')}
                            </button>
                        </div>}
                    </ShopDialog>
                </>
            )}
            {tab === 'reports' && permissions('ReadOrder') && (
                <>
                    <form
                        className="sv-actions"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void run(async () => {
                                const start = new Date(from + 'T00:00:00');
                                const end = new Date(to + 'T00:00:00');
                                end.setDate(end.getDate() + 1);
                                const d = await request<{
                                    shopSalesReport: Report;
                                }>(
                                    'query($from:String!,$to:String!){shopSalesReport(from:$from,to:$to)}',
                                    {
                                        from: start.toISOString(),
                                        to: end.toISOString(),
                                    },
                                );
                                setReport(d.shopSalesReport);
                            });
                        }}
                    >
                        <label>
                            {t('shop.From')}
                            <input
                                type="date"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                                required
                            />
                        </label>
                        <label>
                            {t('shop.To')}
                            <input
                                type="date"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                required
                            />
                        </label>
                        <button disabled={busy}>
                            {t('shop.Show report')}
                        </button>
                    </form>
                    {report && (
                        <>
                            <div className="sv-grid">
                                {[
                                    ['Orders', report.orderCount],
                                    [t('shop.Cancelled'), report.cancelledCount],
                                    [
                                        t('shop.Order value'),
                                        money(
                                            report.gross,
                                            report.currencyCode,
                                        ),
                                    ],
                                    [
                                        t('shop.Collected, net refunds'),
                                        money(
                                            report.collected,
                                            report.currencyCode,
                                        ),
                                    ],
                                    [
                                        t('shop.Awaiting collection'),
                                        money(
                                            report.pending,
                                            report.currencyCode,
                                        ),
                                    ],
                                    [
                                        t('shop.Refunded'),
                                        money(
                                            report.refunded,
                                            report.currencyCode,
                                        ),
                                    ],
                                ].map(([name, value]) => (
                                    <div className="sv-box" key={name}>
                                        <div>{name}</div>
                                        <div className="sv-metric">{value}</div>
                                    </div>
                                ))}
                            </div>
                            <p className="sv-muted">
                                {t('shop.Amounts describe orders placed in the selected period and their current payment/refund state.')}
                            </p>
                            <div className="sv-box">
                                <h2>{t('shop.Most ordered products')}</h2>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{t('shop.Product / variant')}</th>
                                            <th>{t('shop.Units')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.topProducts.map((p) => (
                                            <tr key={p.variantId}>
                                                <td>
                                                    <a
                                                        href={`/dashboard/products/${p.productId}`}
                                                    >
                                                        {p.name} ({p.sku})
                                                    </a>
                                                </td>
                                                <td>{p.quantity}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </>
            )}
            {tab === 'inventory' && permissions('ReadCatalog') && (
                <>
                    <p>
                        {t('shop.Low stock alerts are opt-in. Set recipient and threshold in Settings')}
                    </p>
                    {permissions('UpdateCatalog') && (
                        <button
                            disabled={busy}
                            onClick={() =>
                                void run(async () => {
                                    await request(
                                        'mutation{checkShopLowStock}',
                                    );
                                    await loadTab();
                                    setMessage(
                                        t('shop.Stock check completed'),
                                    );
                                })
                            }
                        >
                            {t('shop.Check stock and alerts')}
                        </button>
                    )}
                    <div className="sv-box sv-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('shop.SKU')}</th>
                                    <th>{t('shop.Product')}</th>
                                    <th>{t('shop.Available')}</th>
                                    <th>{t('shop.Allocated')}</th>
                                    <th>{t('shop.On hand')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stock.map((s) => (
                                    <tr
                                        key={s.id}
                                        className={s.low ? 'sv-low' : ''}
                                    >
                                        <td>{s.sku}</td>
                                        <td>{s.name}</td>
                                        <td>{s.available}</td>
                                        <td>{s.allocated}</td>
                                        <td>{s.onHand}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="sv-actions">
                            <button
                                disabled={!stockSkip}
                                onClick={() =>
                                    setStockSkip(Math.max(0, stockSkip - 50))
                                }
                            >
                                {t('shop.Previous')}
                            </button>
                            <button
                                disabled={stockSkip + 50 >= stockTotal}
                                onClick={() => setStockSkip(stockSkip + 50)}
                            >
                                {t('shop.Next')}
                            </button>
                        </div>
                    </div>
                </>
            )}
            {tab === 'reviews' && permissions('ReadCatalog') && (
                <>
                    <label>
                        {t('shop.Review status')}
                        <select
                            value={reviewStatus}
                            onChange={(e) => {
                                setReviewStatus(e.target.value);
                                setReviewSkip(0);
                            }}
                        >
                            <option value="pending">
                                {t('shop.Pending')}
                            </option>
                            <option value="approved">{t('shop.Approved')}</option>
                            <option value="rejected">{t('shop.Rejected')}</option>
                        </select>
                    </label>
                    {reviews.map((r) => (
                        <div className="sv-box" key={r.id}>
                            <h2>
                                {r.rating}/5 — {r.authorName}
                            </h2>
                            <a href={`/dashboard/products/${r.productId}`}>
                                {t('shop.Product')} {r.productId}
                            </a>
                            <p className="sv-prose">{r.text}</p>
                            {permissions('UpdateCatalog') && (
                                <div className="sv-actions">
                                    {['approved', 'rejected'].map((status) => (
                                        <button
                                            key={status}
                                            disabled={busy}
                                            onClick={() =>
                                                void run(async () => {
                                                    await request(
                                                        'mutation($id:ID!,$status:String!,$version:Int!){moderateShopReview(reviewId:$id,status:$status,version:$version)}',
                                                        {
                                                            id: r.id,
                                                            status,
                                                            version: r.version,
                                                        },
                                                    );
                                                    await loadTab();
                                                })
                                            }
                                        >
                                            {status === 'approved'
                                                ? t('shop.Approve')
                                                : t('shop.Reject')}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    <div className="sv-actions">
                        <button
                            disabled={!reviewSkip}
                            onClick={() =>
                                setReviewSkip(Math.max(0, reviewSkip - 30))
                            }
                        >
                            {t('shop.Previous')}
                        </button>
                        <button
                            disabled={reviewSkip + 30 >= reviewTotal}
                            onClick={() => setReviewSkip(reviewSkip + 30)}
                        >
                            {t('shop.Next')}
                        </button>
                    </div>
                </>
            )}
            {tab === 'coupons' && permissions('CreatePromotion') && (
                <form
                    className="sv-box"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void run(async () => {
                            await request(
                                'mutation($input:JSON!){createShopCoupon(input:$input)}',
                                {
                                    input: {
                                        ...coupon,
                                        minimum: Math.round(
                                            coupon.minimum * 100,
                                        ),
                                        startsAt: coupon.startsAt
                                            ? new Date(
                                                  coupon.startsAt,
                                              ).toISOString()
                                            : null,
                                        endsAt: coupon.endsAt
                                            ? new Date(
                                                  coupon.endsAt,
                                              ).toISOString()
                                            : null,
                                    },
                                },
                            );
                            setMessage(
                                t('shop.Coupon created. Manage it in Marketing → Promotions'),
                            );
                        });
                    }}
                >
                    <h2>{t('shop.Discount coupon')}</h2>
                    <div className="sv-grid">
                        <label>
                            {t('shop.Name')}
                            <input
                                value={coupon.name}
                                maxLength={100}
                                onChange={(e) =>
                                    setCoupon({...coupon, name: e.target.value})
                                }
                                required
                            />
                        </label>
                        <label>
                            {t('shop.Code')}
                            <input
                                value={coupon.code}
                                maxLength={30}
                                onChange={(e) =>
                                    setCoupon({
                                        ...coupon,
                                        code: e.target.value.toUpperCase(),
                                    })
                                }
                                required
                            />
                        </label>
                        <label>
                            {t('shop.Discount %')}
                            <input
                                type="number"
                                min={1}
                                max={99}
                                value={coupon.percent}
                                onChange={(e) =>
                                    setCoupon({
                                        ...coupon,
                                        percent: Number(e.target.value),
                                    })
                                }
                                required
                            />
                        </label>
                        <label>
                            {t('shop.Minimum order, currency units')}
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={coupon.minimum}
                                onChange={(e) =>
                                    setCoupon({
                                        ...coupon,
                                        minimum: Number(e.target.value),
                                    })
                                }
                            />
                        </label>
                        <label>
                            {t('shop.Total uses')}
                            <input
                                type="number"
                                min={1}
                                value={coupon.usageLimit}
                                onChange={(e) =>
                                    setCoupon({
                                        ...coupon,
                                        usageLimit: Number(e.target.value),
                                    })
                                }
                            />
                        </label>
                        <label>
                            {t('shop.Starts at')}
                            <input
                                type="datetime-local"
                                value={coupon.startsAt}
                                onChange={(e) =>
                                    setCoupon({
                                        ...coupon,
                                        startsAt: e.target.value,
                                    })
                                }
                            />
                        </label>
                        <label>
                            {t('shop.Expires at')}
                            <input
                                type="datetime-local"
                                value={coupon.endsAt}
                                onChange={(e) =>
                                    setCoupon({
                                        ...coupon,
                                        endsAt: e.target.value,
                                    })
                                }
                            />
                        </label>
                    </div>
                    <label>
                        <input
                            type="checkbox"
                            checked={coupon.enabled}
                            onChange={(e) =>
                                setCoupon({
                                    ...coupon,
                                    enabled: e.target.checked,
                                })
                            }
                        />
                        {t('shop.Enable coupon')}
                    </label>
                    <p className="sv-muted">
                        {t('shop.One use per customer. Additional product/category promotions are managed in Marketing → Promotions.')}
                    </p>
                    <button className="sv-primary" disabled={busy}>
                        {t('shop.Create coupon')}
                    </button>
                </form>
            )}
            {tab === 'settings' && settings && permissions('ReadSettings') && (
                <form
                    className="sv-box"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void run(async () => {
                            const d = await request<{
                                saveShopOperationsSettings: Settings;
                            }>(
                                'mutation($input:JSON!){saveShopOperationsSettings(input:$input)}',
                                {input: settings},
                            );
                            setSettings(d.saveShopOperationsSettings);
                            setMessage(t('shop.Settings saved'));
                        });
                    }}
                >
                    <h2>{t('shop.Invoice seller')}</h2>
                    <p className="sv-muted">
                        {t('shop.Enter the actual seller details before customers can download invoices.')}
                    </p>
                    <div className="sv-grid">
                        <label>
                            {t('shop.Legal seller name')}
                            <input
                                value={settings.sellerName || ''}
                                maxLength={200}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        sellerName: e.target.value,
                                    })
                                }
                            />
                        </label>
                        <label>
                            {t('shop.Tax registration, if applicable')}
                            <input
                                value={settings.sellerTaxId || ''}
                                maxLength={100}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        sellerTaxId: e.target.value,
                                    })
                                }
                            />
                        </label>
                        <label>
                            {t('shop.Invoice prefix')}
                            <input
                                value={settings.invoicePrefix || 'SV'}
                                maxLength={20}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        invoicePrefix:
                                            e.target.value.toUpperCase(),
                                    })
                                }
                                required
                            />
                        </label>
                    </div>
                    <label>
                        {t('shop.Legal seller address')}
                        <textarea
                            rows={3}
                            maxLength={1000}
                            value={settings.sellerAddress || ''}
                            onChange={(e) =>
                                setSettings({
                                    ...settings,
                                    sellerAddress: e.target.value,
                                })
                            }
                        />
                    </label>
                    <h2>{t('shop.Stock alerts')}</h2>
                    <div className="sv-grid">
                        <label>
                            {t('shop.Available stock threshold')}
                            <input
                                type="number"
                                min={0}
                                max={10000}
                                value={settings.lowStockThreshold}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        lowStockThreshold: Number(
                                            e.target.value,
                                        ),
                                    })
                                }
                            />
                        </label>
                        <label>
                            {t('shop.Notification email')}
                            <input
                                type="email"
                                value={settings.notificationEmail || ''}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        notificationEmail: e.target.value,
                                    })
                                }
                            />
                        </label>
                    </div>
                    <label>
                        <input
                            type="checkbox"
                            checked={settings.lowStockEnabled}
                            onChange={(e) =>
                                setSettings({
                                    ...settings,
                                    lowStockEnabled: e.target.checked,
                                })
                            }
                        />
                        {t('shop.Enable stock alerts')}
                    </label>
                    <p className="sv-muted">
                        {t('shop.Sent once per low-stock episode, reset after restocking. Email and the job queue must be running.')}
                    </p>
                    <button
                        className="sv-primary"
                        disabled={busy || !permissions('UpdateSettings')}
                    >
                        {t('shop.Save')}
                    </button>
                </form>
            )}
        </div>
    );
}

function OperationsRoute() {
    const {activeChannel} = useChannel();
    // A channel switch discards form state and late responses from the previous channel.
    return <OperationsPage key={activeChannel?.id || 'loading'} />;
}

defineDashboardExtension({
    navSections: consolidateCommerceNavigation,
    routes: [
        {
            path: '/shop-operations',
            navMenuItem: {
                requiresPermission: ['ReadOrder','ManageStore','SellOwnProducts'],
                sectionId: 'sales',
                id: 'shop-operations',
                title: 'shop.Shop operations',
            },
            component: () => <OperationsRoute />,
        },
    ],
});
