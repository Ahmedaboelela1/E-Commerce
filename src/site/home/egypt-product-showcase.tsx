import {ArrowUpRight, Bot, CheckCircle2, PackageSearch, ShieldCheck, Truck} from 'lucide-react';
import {egyptCatalogProducts, formatEgp} from './egypt-catalog';

export function EgyptProductShowcase() {
    return (
        <section id="egypt-kits" className="scroll-mt-24 border-t border-border py-16 md:py-24">
            <div className="container mx-auto px-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                            INEX × Skillverse Global
                        </p>
                        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                            Robotics kits available in Egypt
                        </h2>
                        <p className="mt-3 max-w-2xl text-muted-foreground">
                            Explore our initial Egypt catalog. Prices are in Egyptian pounds and stock is handled
                            by the local Egyptian seller. Exact available quantities are confirmed before accepting orders.
                        </p>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
                        <ShieldCheck className="h-4 w-4" /> Supplier product details verified
                    </span>
                </div>

                <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {egyptCatalogProducts.filter((product) => product.stockStatus === 'in-stock').map((product) => (
                        <article key={product.sku} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                            <div className="relative flex h-48 items-center justify-center overflow-hidden bg-gradient-to-br from-[#102140] via-[#204278] to-[#2e5eab]">
                                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff18_1px,transparent_1px),linear-gradient(to_bottom,#ffffff18_1px,transparent_1px)] bg-[size:30px_30px]" />
                                <Bot className="relative h-20 w-20 text-white/90" strokeWidth={1.15} aria-hidden="true" />
                                <div className="absolute bottom-3 left-4 text-xs font-medium tracking-wide text-white/80">
                                    INEX ROBOTICS
                                </div>
                            </div>

                            <div className="flex flex-1 flex-col p-5">
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                                        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> In stock in Egypt
                                    </span>
                                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{product.category}</span>
                                </div>
                                <h3 className="text-xl font-bold tracking-tight">{product.name}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
                                <p className="mt-3 text-xs text-muted-foreground">INEX SKU: {product.sku} · {product.competition}</p>
                                <div className="mt-auto pt-6">
                                    <p className="text-2xl font-bold text-foreground">{product.priceEgp === null ? 'Price on request' : formatEgp(product.priceEgp)}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">Egypt price · availability subject to confirmation</p>
                                    <a
                                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"
                                        href={product.supplierUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Technical details from INEX <ArrowUpRight className="h-4 w-4" />
                                    </a>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>

                <div className="mt-9 grid gap-5 rounded-2xl border border-primary/20 bg-primary/5 p-6 md:grid-cols-[auto_1fr] md:items-start">
                    <PackageSearch className="h-8 w-8 text-primary" aria-hidden="true" />
                    <div>
                        <h3 className="text-xl font-bold">More INEX products — available on request</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            The wider INEX catalog is being prepared with an Available on Order status. Delivery estimates,
                            local prices and order acceptance will appear only after supplier and agent confirmation.
                        </p>
                        <a className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                           href="https://inex.co.th/home/product-category/robotics/"
                           target="_blank"
                           rel="noopener noreferrer">
                            Browse the INEX robotics catalog <ArrowUpRight className="h-4 w-4" />
                        </a>
                    </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {egyptCatalogProducts.filter((product) => product.stockStatus === 'available-on-order').map((product) => (
                        <article key={product.sku} className="flex items-start gap-3 rounded-xl border border-border p-4">
                            <PackageSearch className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                                <h4 className="font-semibold">{product.name}</h4>
                                <p className="mt-1 text-xs text-muted-foreground">SKU {product.sku} · Egypt price & lead time on confirmation</p>
                                <a href={product.supplierUrl} target="_blank" rel="noopener noreferrer"
                                   className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                                    INEX product details <ArrowUpRight className="h-3.5 w-3.5" />
                                </a>
                            </div>
                        </article>
                    ))}
                </div>

                <div className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <Truck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>
                        Catalog preview only. Live checkout, stock reservation, exact quantities, shipment dates and
                        local-agent invoicing will be enabled after the Vendure commerce backend is configured.
                    </p>
                </div>
            </div>
        </section>
    );
}
