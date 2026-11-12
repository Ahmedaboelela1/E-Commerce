import {getTranslations} from 'next-intl/server';
import {NavigationLink} from '@/site/navigation/navigation-link';
import {SkillverseBrand} from '@/site/brand/skillverse-brand';

const currentYear = new Date().getFullYear();

export async function Footer() {
    const t=await getTranslations('Footer');
    return (
        <footer className="mt-auto border-t border-[#1b3458] bg-[#102140] text-white">
            <div className="container mx-auto grid gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-5 sm:col-span-2 lg:col-span-1">
                    <NavigationLink href="/" aria-label={t('homeLabel')} className="inline-flex items-center">
                        <SkillverseBrand inverse />
                    </NavigationLink>
                    <p className="max-w-sm text-sm leading-7 text-white/70">
                        {t('brandDescription')}
                    </p>
                    <a
                        href="mailto:info@skillverse-global.com"
                        className="inline-block text-sm font-medium text-[#a9c6f7] underline-offset-4 hover:underline"
                    >
                        info@skillverse-global.com
                    </a>
                </div>

                <div className="space-y-4">
                    <h2 className="text-sm font-bold tracking-wide text-white">{t('exploreShop')}</h2>
                    <nav aria-label={t('shopLinks')} className="flex flex-col gap-3 text-sm text-white/70">
                        <NavigationLink href="/search" className="transition-colors hover:text-white">
                            {t('browseProducts')}
                        </NavigationLink>
                        <a href="https://skillverse-global.com/products" className="transition-colors hover:text-white">
                            {t('productsKits')}
                        </a>
                        <a href="https://skillverse-global.com/solutions" className="transition-colors hover:text-white">
                            {t('stemSolutions')}
                        </a>
                    </nav>
                </div>

                <div className="space-y-4">
                    <h2 className="text-sm font-bold tracking-wide text-white">Skillverse Global</h2>
                    <nav aria-label={t('companyLinks')} className="flex flex-col gap-3 text-sm text-white/70">
                        <a href="https://skillverse-global.com/about" className="transition-colors hover:text-white">
                            {t('aboutUs')}
                        </a>
                        <a href="https://skillverse-global.com/partners" className="transition-colors hover:text-white">
                            {t('partners')}
                        </a>
                        <a href="https://skillverse-global.com/projects" className="transition-colors hover:text-white">
                            {t('projects')}
                        </a>
                        <a href="https://skillverse-global.com/contact" className="transition-colors hover:text-white">
                            {t('contactUs')}
                        </a>
                    </nav>
                </div>

                <div className="space-y-4">
                    <h2 className="text-sm font-bold tracking-wide text-white">{t('getInTouch')}</h2>
                    <div className="flex flex-col gap-3 text-sm text-white/70">
                        <span>{t('location')}</span>
                        <a
                            href="https://www.facebook.com/SkillVerse.globall/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-colors hover:text-white"
                        >
                            {t('facebook')} ↗
                        </a>
                        <p className="max-w-xs leading-6 text-xs text-white/60">
                            {t('availabilityTerms')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="border-t border-white/15">
                <div className="container mx-auto flex flex-col justify-between gap-2 px-4 py-5 text-xs text-white/55 sm:flex-row">
                    <span>{t('brandCopyright',{year:currentYear})}</span>
                    <span>{t('tagline')}</span>
                </div>
            </div>
        </footer>
    );
}
