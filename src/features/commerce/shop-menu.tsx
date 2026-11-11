'use client';
import {useTranslations} from 'next-intl';
import {ChevronDown} from 'lucide-react';
import {Link} from '@/platform/i18n/navigation';
import {Button} from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
export function ShopMenu() {
    const t = useTranslations('Growth');
    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
                {t('shop')}
                <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                {[
                    ['/search', 'browseProducts'],
                    ['/bundles', 'bundles'],
                    ['/school-quote', 'schoolQuotes'],
                    ['/compare', 'compareTitle'],
                ].map(([href, label]) => (
                    <DropdownMenuItem key={href} render={<Link href={href} />}>
                        {t(label)}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
export function ShopLinks({onNavigate}: {onNavigate?: () => void} = {}) {
    const t = useTranslations('Growth');
    return (
        <div className="flex flex-wrap gap-2 text-xs">
            {[
                ['/bundles', 'bundles'],
                ['/school-quote', 'schoolQuotes'],
                ['/compare', 'compareTitle'],
            ].map(([href, label]) => (
                <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    className="rounded-full border border-border bg-background px-4 py-2 transition-colors hover:border-primary/30 hover:text-primary"
                >
                    {t(label)}
                </Link>
            ))}
        </div>
    );
}

export function SchoolQuoteLink() {
    const t = useTranslations('Growth');
    return (
        <Link
            href="/school-quote"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
            {t('schoolQuotes')}
        </Link>
    );
}
