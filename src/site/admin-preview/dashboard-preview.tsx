'use client';

import {useMemo, useState} from 'react';
import {ArrowDownToLine, ArrowUpRight, BarChart3, Boxes, Clock3, ClipboardList, LayoutDashboard, LockKeyhole, Package, Search, ShoppingBag, Truck} from 'lucide-react';
import {egyptCatalogProducts, formatEgp} from '@/site/home/egypt-catalog';
import {InexProductImage} from '@/site/home/inex-product-image';

type Tab = 'overview' | 'products' | 'inventory' | 'orders' | 'procurement';
type DraftRow = {quantity: string; leadDays: string; priceEgp: string};
const initialRows: Record<string, DraftRow> = Object.fromEntries(
    egyptCatalogProducts.map((p) => [p.sku, {
        quantity: '',
        leadDays: '',
        priceEgp: p.priceEgp === null ? '' : String(p.priceEgp),
    }])
);
const nav = [
    {id: 'overview', title: 'Overview', icon: LayoutDashboard},
    {id: 'products', title: 'Products', icon: Package},
    {id: 'inventory', title: 'Inventory', icon: Boxes},
    {id: 'orders', title: 'Orders', icon: ShoppingBag},
    {id: 'procurement', title: 'INEX Procurement', icon: ClipboardList},
] as const;

function formatDraftPrice(value: string): string {
    const n = Number(value);
    return value.trim() !== '' && Number.isFinite(n) && n >= 0 ? formatEgp(n) : 'Price on request';
}

export function DashboardPreview() {
    const [tab, setTab] = useState<Tab>('overview');
    const [query, setQuery] = useState('');
    const [draft, setDraft] = useState<Record<string, DraftRow>>(initialRows);
    const [filter, setFilter] = useState<'all' | 'in-stock' | 'available-on-order'>('all');
    const filtered = useMemo(() => egyptCatalogProducts.filter((p) => {
        const textMatches = `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(query.toLowerCase());
        return textMatches && (filter === 'all' || p.stockStatus === filter);
    }), [query, filter]);

    function updateDraft(sku: string, field: keyof DraftRow, value: string) {
        setDraft((previous) => ({
            ...previous,
            [sku]: {...previous[sku], [field]: value},
        }));
    }

    function downloadCsv() {
        const header = ['inex_sku', 'name', 'status', 'price_egp_draft', 'egypt_on_hand_draft', 'supplier_lead_days_draft', 'supplier_url'];
        const rows = egyptCatalogProducts.map((p) => [
            p.sku, p.name, p.stockStatus, draft[p.sku]?.priceEgp ?? '',
            draft[p.sku]?.quantity ?? '', draft[p.sku]?.leadDays ?? '', p.supplierUrl,
        ]);
        const body = [header, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
        const url = URL.createObjectURL(new Blob(['\uFEFF', body], {type: 'text/csv;charset=utf-8'}));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'skillverse-egypt-catalog-draft.csv';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    const priced = egyptCatalogProducts.filter((p) => p.priceEgp !== null).length;
    const available = egyptCatalogProducts.filter((p) => p.stockStatus === 'in-stock').length;
    const requested = egyptCatalogProducts.length - available;

    return (
        <main className="min-h-screen bg-[#f5f8fd] pt-20 text-[#102140] dark:bg-slate-950 dark:text-white">
            <div className="mx-auto max-w-[1550px] px-4 py-8 lg:px-8">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    <div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4" /> <strong>PREVIEW MODE — not a live administrative system.</strong></div>
                    <span>Draft edits are temporary and not saved to inventory or orders.</span>
                </div>
                <div className="grid gap-6 lg:grid-cols-[238px_1fr]">
                    <aside className="h-fit rounded-2xl bg-[#102140] p-5 text-white shadow-md">
                        <div className="mb-8">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Skillverse Global</p>
                            <h1 className="mt-1 text-2xl font-bold">Commerce Hub</h1>
                            <p className="mt-2 text-sm text-white/65">Pilot · Egypt Agent</p>
                        </div>
                        <nav className="space-y-1" aria-label="Dashboard sections">
                            {nav.map(({id, title, icon: Icon}) => (
                                <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
                                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition ${tab === id ? 'bg-[#2e5eab] text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                                    <Icon className="h-4 w-4" />{title}
                                </button>
                            ))}
                        </nav>
                        <div className="mt-10 rounded-xl border border-white/15 bg-white/5 p-3 text-xs leading-relaxed text-white/65">
                            Egypt is the only pilot market. Saudi Arabia, Tunisia and other agents will be activated after back-end segregation tests.
                        </div>
                    </aside>

                    <div className="min-w-0 space-y-6">
                        <header className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2e5eab] dark:text-blue-300">Central operations · Egypt</p>
                                <h2 className="mt-2 text-3xl font-bold tracking-tight">{nav.find((x) => x.id === tab)?.title}</h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">INEX product catalog · EGP pricing · local agent sells and invoices.</p>
                            </div>
                            <button type="button" onClick={downloadCsv}
                                className="inline-flex items-center gap-2 rounded-lg bg-[#2e5eab] px-4 py-3 text-sm font-semibold text-white hover:bg-[#214785]">
                                <ArrowDownToLine className="h-4 w-4" /> Export draft CSV
                            </button>
                        </header>

                        {(tab === 'overview' || tab === 'products' || tab === 'inventory') && (
                            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Catalog summary">
                                {[
                                    {name: 'Catalog SKUs', number: String(egyptCatalogProducts.length), detail: 'Initial INEX selection', icon: Package},
                                    {name: 'Reported in stock', number: String(available), detail: 'Product types, not unit counts', icon: Boxes},
                                    {name: 'Available on request', number: String(requested), detail: 'Price & lead time pending', icon: Clock3},
                                    {name: 'EGP prices confirmed', number: String(priced), detail: 'Egypt retail price entries', icon: BarChart3},
                                ].map(({name, number, detail, icon: Icon}) => (
                                    <div key={name} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-medium text-slate-500 dark:text-slate-300">{name}</p>
                                            <Icon className="h-5 w-5 text-[#2e5eab] dark:text-blue-300" />
                                        </div>
                                        <p className="mt-3 text-3xl font-bold">{number}</p>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
                                    </div>
                                ))}
                            </section>
                        )}

                        {tab === 'overview' && (
                            <div className="grid gap-5 xl:grid-cols-2">
                                <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                                    <h3 className="text-lg font-semibold">Current pilot setup</h3>
                                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                        3 product types are reported in stock in Egypt; exact available quantities have not been supplied.
                                        Five additional INEX kits are listed for enquiries only. Customer orders and revenue are not connected yet.
                                    </p>
                                    <button type="button" className="mt-5 rounded-lg bg-[#102140] px-4 py-2.5 text-sm font-semibold text-white"
                                        onClick={() => setTab('inventory')}>Prepare Egypt stock quantities</button>
                                </section>
                                <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                                    <h3 className="text-lg font-semibold">Activation checklist</h3>
                                    <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                                        <li>✓ Product names, INEX SKUs and supplier links staged</li>
                                        <li>✓ Egyptian prices confirmed for three product types</li>
                                        <li>○ Validate actual unit counts and local seller identity</li>
                                        <li>○ Deploy Vendure Admin API, worker and database</li>
                                        <li>○ Configure Egypt Channel, payment, tax and shipping</li>
                                        <li>○ Enable confirmed lead-time / backorder rules</li>
                                    </ul>
                                </section>
                            </div>
                        )}

                        {(tab === 'products' || tab === 'inventory') && (
                            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                                <div className="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center dark:border-slate-800">
                                    <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800">
                                        <Search className="h-4 w-4 text-slate-500" />
                                        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product or SKU"
                                            className="h-11 w-full bg-transparent text-sm outline-none" />
                                    </label>
                                    <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}
                                        className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                                        <option value="all">All statuses</option>
                                        <option value="in-stock">In stock in Egypt</option>
                                        <option value="available-on-order">Available on request</option>
                                    </select>
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filtered.map((p) => (
                                        <div key={p.sku} className="grid gap-4 p-5 lg:grid-cols-[88px_1fr_auto] lg:items-center">
                                            <div className="h-20 w-20 overflow-hidden rounded-lg border bg-white">
                                                <InexProductImage sku={p.sku} name={p.name} className="h-full w-full object-contain" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-semibold">{p.name}</h3>
                                                <p className="mt-0.5 text-xs text-slate-500">INEX SKU {p.sku} · {p.category}</p>
                                                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{p.description}</p>
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {p.highlights.slice(0, 3).map((h) => <span key={h} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{h}</span>)}
                                                </div>
                                            </div>
                                            <div className="space-y-2 text-left lg:min-w-40 lg:text-right">
                                                <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${p.stockStatus === 'in-stock' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                                    {p.stockStatus === 'in-stock' ? 'In stock (qty pending)' : 'On request'}
                                                </span>
                                                <p className="text-lg font-bold">{formatDraftPrice(draft[p.sku].priceEgp)}</p>
                                                <a href={p.supplierUrl} target="_blank" rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs font-medium text-[#2e5eab] dark:text-blue-300">
                                                    INEX source <ArrowUpRight className="h-3.5 w-3.5" />
                                                </a>
                                            </div>
                                            {tab === 'inventory' && (
                                                <div className="grid gap-3 rounded-xl bg-slate-50 p-4 md:col-span-3 md:grid-cols-3 dark:bg-slate-800">
                                                    <label className="block text-xs font-semibold">Draft local price (EGP)
                                                        <input type="number" min="0" step="1" inputMode="numeric" value={draft[p.sku].priceEgp}
                                                            onChange={(e) => updateDraft(p.sku, 'priceEgp', e.target.value)}
                                                            placeholder="Not set" className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950" />
                                                    </label>
                                                    <label className="block text-xs font-semibold">Draft physical stock units
                                                        <input type="number" min="0" step="1" inputMode="numeric" value={draft[p.sku].quantity}
                                                            onChange={(e) => updateDraft(p.sku, 'quantity', e.target.value)}
                                                            placeholder="Unknown" className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950" />
                                                    </label>
                                                    <label className="block text-xs font-semibold">Draft supplier lead time (days)
                                                        <input type="number" min="0" step="1" inputMode="numeric" value={draft[p.sku].leadDays}
                                                            onChange={(e) => updateDraft(p.sku, 'leadDays', e.target.value)}
                                                            placeholder="Unconfirmed" className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950" />
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {filtered.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No matching products.</p>}
                                </div>
                                {tab === 'inventory' && <p className="border-t border-slate-200 p-5 text-xs text-amber-700 dark:border-slate-800 dark:text-amber-300">Draft inputs are stored in the current browser tab only. Export the CSV before leaving; this does not update customer-visible prices, physical inventory, or Vendure.</p>}
                            </section>
                        )}

                        {tab === 'orders' && (
                            <section className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900">
                                <ShoppingBag className="mx-auto h-10 w-10 text-[#2e5eab]" />
                                <h3 className="mt-4 text-xl font-bold">Orders not connected</h3>
                                <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-500">There is no verified local-agent order database yet. Once the Vendure backend is deployed, this area will show real orders, statuses, fulfillment and local seller details. No sample revenue is fabricated.</p>
                            </section>
                        )}

                        {tab === 'procurement' && (
                            <section className="grid gap-5 xl:grid-cols-2">
                                <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                                    <Truck className="h-9 w-9 text-[#2e5eab]" />
                                    <h3 className="mt-4 text-xl font-bold">Consolidated INEX purchase requests</h3>
                                    <p className="mt-3 text-sm leading-7 text-slate-500">Future workflow: collect supplier-confirmed requirements from each independent country agent, create purchase orders, track inbound shipments and allocate local quantities.</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                                    <h3 className="text-xl font-bold">Pending Egypt supplier planning</h3>
                                    <p className="mt-3 text-sm text-slate-500">{requested} pilot SKUs are listed on request without an approved local selling price or confirmed delivery lead time.</p>
                                    <button type="button" onClick={() => setTab('inventory')} className="mt-5 rounded-lg bg-[#2e5eab] px-4 py-2.5 text-sm font-semibold text-white">Prepare draft supply data</button>
                                </div>
                            </section>
                        )}

                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <LockKeyhole className="h-4 w-4" /> No live orders, bank data or editable backend access is exposed by this preview.
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
