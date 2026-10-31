import Image from "next/image";
import {NavigationLink} from '@/site/navigation/navigation-link';
import {NavbarCollections} from '@/site/navigation/navbar/navbar-collections';
import {NavbarCart} from '@/site/navigation/navbar/navbar-cart';
import {NavbarUser} from '@/site/navigation/navbar/navbar-user';
import {ThemeSwitcher} from '@/site/navigation/navbar/theme-switcher';
import {LanguagePicker} from '@/site/navigation/navbar/language-picker';
import {CurrencyPickerWrapper} from '@/site/navigation/navbar/currency-picker-wrapper';
import {MobileNavWrapper} from '@/site/navigation/navbar/mobile-nav-wrapper';
import {Suspense} from "react";
import {SearchInput} from '@/site/navigation/search-input';
import {NavbarUserSkeleton} from '@/site/navigation/skeletons/navbar-user-skeleton';
import {SearchInputSkeleton} from '@/site/navigation/skeletons/search-input-skeleton';

const liveCheckout = process.env.NEXT_PUBLIC_ENABLE_CHECKOUT === "true";

export function Navbar() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-md bg-background/80">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center gap-8">
                        {liveCheckout && <Suspense><MobileNavWrapper /></Suspense>}
                        <NavigationLink href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
                            <Image src="/skillverse-brand.svg" alt="Skillverse Global" width={30} height={34} className="h-9 w-auto" />
                            <span>Skillverse <span className="text-primary">Global</span></span>
                        </NavigationLink>
                        <nav className="hidden md:flex items-center gap-6">
                            {liveCheckout ? <Suspense><NavbarCollections/></Suspense> : (
                                <NavigationLink href="/#egypt-kits" className="text-sm font-semibold text-muted-foreground hover:text-primary">Egypt Kits</NavigationLink>
                            )}
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        {!liveCheckout && <span className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:inline-flex">Catalog preview</span>}
                        {liveCheckout && (<div className="flex items-center gap-4">
                        <div className="hidden lg:flex">
                            <Suspense fallback={<SearchInputSkeleton />}>
                                <SearchInput/>
                            </Suspense>
                        </div>
                        <Suspense>
                            <LanguagePicker />
                        </Suspense>
                        <Suspense>
                            <CurrencyPickerWrapper />
                        </Suspense>
                        <Suspense>
                            <ThemeSwitcher />
                        </Suspense>
                        <Suspense>
                            <NavbarCart/>
                        </Suspense>
                        <Suspense fallback={<NavbarUserSkeleton />}>
                            <NavbarUser/>
                        </Suspense>
                        </div>)}
                    </div>
                </div>
            </div>
        </header>
    );
}
