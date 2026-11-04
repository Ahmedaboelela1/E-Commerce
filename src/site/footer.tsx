import Image from 'next/image';
import {NavigationLink} from '@/site/navigation/navigation-link';

export async function Footer() {
    return (
        <footer className="mt-auto border-t border-border bg-[#102140] text-white">
            <div className="container mx-auto grid gap-8 px-4 py-12 md:grid-cols-3">
                <div className="space-y-3">
                    <NavigationLink href="/" className="inline-flex items-center gap-3 font-bold">
                        <Image src="/skillverse-brand.svg" alt="Skillverse Global" width={34} height={40} className="h-10 w-auto rounded bg-white p-1"/>
                        <span>Skillverse Global Shop</span>
                    </NavigationLink>
                    <p className="max-w-sm text-sm leading-relaxed text-white/70">
                        Robotics, STEM and competition solutions. Explore INEX products through our global store network.
                    </p>
                </div>
                <div className="space-y-3 text-sm">
                    <h2 className="font-semibold">Explore</h2>
                    <ul className="space-y-2 text-white/70">
                        <li><NavigationLink href="/#egypt-kits" className="hover:text-white">Egypt INEX kits</NavigationLink></li>
                        <li><a href="https://inex.co.th/home/product-category/robotics/" target="_blank" rel="noopener noreferrer" className="hover:text-white">INEX full robotics catalog</a></li>
                        <li><a href="https://skillverse-global.com" className="hover:text-white">Skillverse Global</a></li>
                    </ul>
                </div>
                <div className="space-y-3 text-sm">
                    <h2 className="font-semibold">Buying information</h2>
                    <p className="text-white/70">
                        Each national store is operated by its local selling agent, who is responsible for local invoices,
                        importation, payments and fulfillment. Product availability and delivery estimates require confirmation.
                    </p>
                </div>
            </div>
            <div className="border-t border-white/15 py-5">
                <div className="container mx-auto flex flex-wrap justify-between gap-2 px-4 text-xs text-white/60">
                    <span>© 2026 Skillverse Global. All rights reserved.</span>
                    <span>INEX product names belong to their respective owner.</span>
                </div>
            </div>
        </footer>
    );
}
