'use client';
import {useSearchParams} from 'next/navigation';
import {usePathname, useRouter} from '@/platform/i18n/navigation';
import {useTranslations} from 'next-intl';
import {Search} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
export function CatalogSearch() {
    const t = useTranslations('Search'),
        params = useSearchParams(),
        path = usePathname(),
        router = useRouter();
    return (
        <form
            key={params.get('q') || ''}
            className="mb-6 flex gap-2 rounded-2xl border bg-card p-3"
            onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget),
                    next = new URLSearchParams(params),
                    term = String(data.get('q') || '')
                        .trim()
                        .slice(0, 200);
                if (term) next.set('q', term);
                else next.delete('q');
                next.delete('page');
                router.push(`${path}?${next}`);
            }}
        >
            <div className="relative min-w-0 flex-1">
                <Search className="absolute start-3 top-3 size-4 text-muted-foreground" />
                <Input
                    type="search"
                    name="q"
                    defaultValue={params.get('q') || ''}
                    maxLength={200}
                    aria-label={t('searchLabel')}
                    placeholder={t('searchPlaceholder')}
                    className="h-11 border-0 bg-muted/40 ps-10 shadow-none"
                />
            </div>
            <Button type="submit" className="h-11 rounded-xl px-5">
                {t('searchButton')}
            </Button>
        </form>
    );
}
