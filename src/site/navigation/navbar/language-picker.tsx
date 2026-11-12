'use client';

import {useSearchParams} from 'next/navigation';

import {useLocale,useTranslations} from 'next-intl';
import {useRouter, usePathname} from '@/platform/i18n/navigation';
import {routing, localeNames} from '@/platform/i18n/routing';
import {Globe} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LanguagePicker() {
    const locale = useLocale();
    const search=useSearchParams(),t=useTranslations('Navigation');
    const router = useRouter();
    const pathname = usePathname();

    const handleLocaleChange = (newLocale: string) => {
        router.replace(`${pathname}${search.size?'?'+search.toString():''}${window.location.hash}`, {locale: newLocale});
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button aria-label={t('switchLanguage')} variant="ghost" size="sm" className="gap-1.5" />}>
                <Globe className="size-4" />
                <span>{localeNames[locale as keyof typeof localeNames] ?? locale.toUpperCase()}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {routing.locales.map((loc) => (
                    <DropdownMenuItem
                        key={loc}
                        onClick={() => handleLocaleChange(loc)}
                    >
                        <span>{localeNames[loc] ?? loc.toUpperCase()}</span>
                        {locale === loc && <span className="ms-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
