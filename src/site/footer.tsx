import {NavigationLink} from '@/site/navigation/navigation-link';
import {SkillverseBrand} from '@/site/brand/skillverse-brand';

const currentYear = new Date().getFullYear();

export function Footer() {
    return (
        <footer className="mt-auto border-t border-[#1b3458] bg-[#102140] text-white">
            <div className="container mx-auto grid gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-5 sm:col-span-2 lg:col-span-1">
                    <NavigationLink href="/" aria-label="Skillverse Global Shop home" className="inline-flex items-center">
                        <SkillverseBrand inverse />
                    </NavigationLink>
                    <p className="max-w-sm text-sm leading-7 text-white/70">
                        Bringing technology to life. Opening a world of possibility through robotics,
                        AI and STEM education.
                    </p>
                    <a
                        href="mailto:info@skillverse-global.com"
                        className="inline-block text-sm font-medium text-[#a9c6f7] underline-offset-4 hover:underline"
                    >
                        info@skillverse-global.com
                    </a>
                </div>

                <div className="space-y-4">
                    <h2 className="text-sm font-bold tracking-wide text-white">Explore the shop</h2>
                    <nav aria-label="Shop links" className="flex flex-col gap-3 text-sm text-white/70">
                        <NavigationLink href="/search" className="transition-colors hover:text-white">
                            Browse products
                        </NavigationLink>
                        <a href="https://skillverse-global.com/products" className="transition-colors hover:text-white">
                            Products &amp; kits
                        </a>
                        <a href="https://skillverse-global.com/solutions" className="transition-colors hover:text-white">
                            STEM solutions
                        </a>
                    </nav>
                </div>

                <div className="space-y-4">
                    <h2 className="text-sm font-bold tracking-wide text-white">Skillverse Global</h2>
                    <nav aria-label="Company links" className="flex flex-col gap-3 text-sm text-white/70">
                        <a href="https://skillverse-global.com/about" className="transition-colors hover:text-white">
                            About us
                        </a>
                        <a href="https://skillverse-global.com/partners" className="transition-colors hover:text-white">
                            Our partners
                        </a>
                        <a href="https://skillverse-global.com/projects" className="transition-colors hover:text-white">
                            Projects
                        </a>
                        <a href="https://skillverse-global.com/contact" className="transition-colors hover:text-white">
                            Contact us
                        </a>
                    </nav>
                </div>

                <div className="space-y-4">
                    <h2 className="text-sm font-bold tracking-wide text-white">Get in touch</h2>
                    <div className="flex flex-col gap-3 text-sm text-white/70">
                        <span>Cairo, Egypt</span>
                        <a
                            href="https://www.facebook.com/SkillVerse.globall/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-colors hover:text-white"
                        >
                            Facebook ↗
                        </a>
                        <p className="max-w-xs leading-6 text-xs text-white/60">
                            Product availability, delivery and local selling terms are confirmed before ordering.
                        </p>
                    </div>
                </div>
            </div>

            <div className="border-t border-white/15">
                <div className="container mx-auto flex flex-col justify-between gap-2 px-4 py-5 text-xs text-white/55 sm:flex-row">
                    <span>© {currentYear} Skillverse Global. All rights reserved.</span>
                    <span>Built around possibility.</span>
                </div>
            </div>
        </footer>
    );
}
