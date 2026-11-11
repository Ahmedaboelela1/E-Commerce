'use client';
import {
    createContext,
    Suspense,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react';
import {ArrowLeftRight, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Link, usePathname} from '@/platform/i18n/navigation';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';

const key = 'skillverse.compare.v1';
const CompareContext = createContext<{
    ids: string[];
    toggle: (id: string) => void;
    clear: () => void;
}>({ids: [], toggle() {}, clear() {}});
export function ComparisonProvider({children}: {children: ReactNode}) {
    const [ids, setIds] = useState<string[]>([]);
    const t = useTranslations('Growth');
    useEffect(() => {
        const load = () => {
            try {
                const saved: unknown = JSON.parse(
                    localStorage.getItem(key) || '[]',
                );
                setIds(
                    Array.isArray(saved)
                        ? [
                              ...new Set(
                                  saved.filter(
                                      (i): i is string =>
                                          typeof i === 'string' &&
                                          /^\d+$/.test(i),
                                  ),
                              ),
                          ].slice(0, 4)
                        : [],
                );
            } catch {
                setIds([]);
            }
        };
        load();
        window.addEventListener('storage', load);
        return () => window.removeEventListener('storage', load);
    }, []);
    const update = (next: string[]) => {
        setIds(next);
        try {
            localStorage.setItem(key, JSON.stringify(next));
        } catch {
            toast.error(t('storageUnavailable'));
        }
    };
    const toggle = (id: string) => {
        const actual = String(id);
        if (ids.includes(actual)) update(ids.filter((i) => i !== actual));
        else if (ids.length < 4) update([...ids, actual]);
        else toast.error(t('compareLimit'));
    };
    return (
        <CompareContext.Provider value={{ids, toggle, clear: () => update([])}}>
            {children}
            <Suspense fallback={null}>
                <CompareBar />
            </Suspense>
        </CompareContext.Provider>
    );
}
export function useComparison() {
    return useContext(CompareContext);
}
export function CompareButton({
    productId,
    compact = false,
}: {
    productId: string | number;
    compact?: boolean;
}) {
    const {ids, toggle} = useComparison();
    const t = useTranslations('Growth');
    const selected = ids.includes(String(productId));
    return (
        <Button
            type="button"
            variant="ghost"
            aria-pressed={selected}
            aria-label={selected ? t('removeCompare') : t('addCompare')}
            onClick={() => toggle(String(productId))}
            className={`h-10 rounded-full px-3 text-xs ${selected ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
        >
            <ArrowLeftRight className="size-3.5" />
            {!compact && (selected ? t('comparing') : t('compare'))}
        </Button>
    );
}
function CompareBar() {
    const {ids, clear} = useComparison();
    const t = useTranslations('Growth');
    const path = usePathname();
    if (!ids.length || path === '/compare') return null;
    return (
        <aside
            aria-label={t('comparisonBar')}
            className="fixed bottom-4 inset-x-3 z-40 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-background/95 p-3 shadow-xl backdrop-blur-md"
        >
            <span className="text-xs font-medium sm:text-sm">
                {t('compareCount', {count: ids.length})}
            </span>
            <div className="flex items-center gap-2">
                <Button
                    render={<Link href="/compare" />}
                    nativeButton={false}
                    size="sm"
                    className="rounded-full px-4"
                >
                    {t('compare')}
                    <ArrowLeftRight className="size-4" />
                </Button>
                <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t('clearCompare')}
                    onClick={clear}
                >
                    <X className="size-4" />
                </Button>
            </div>
        </aside>
    );
}
