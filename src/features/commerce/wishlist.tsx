'use client';

import {
    createContext,
    Suspense,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react';
import {Heart} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {Link, usePathname, useRouter} from '@/platform/i18n/navigation';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';
import {toggleSavedProduct} from './actions';

const WishlistContext = createContext<{
    ids: string[];
    authenticated: boolean | null;
    setIds: (ids: string[]) => void;
}>({ids: [], authenticated: null, setIds() {}});
export function CommerceProvider({children}: {children: ReactNode}) {
    const [ids, setIds] = useState<string[]>([]);
    const [authenticated, setAuthenticated] = useState<boolean | null>(null);
    return (
        <WishlistContext.Provider value={{ids, authenticated, setIds}}>
            <Suspense fallback={null}>
                <WishlistLoader
                    setIds={setIds}
                    setAuthenticated={setAuthenticated}
                />
            </Suspense>
            {children}
        </WishlistContext.Provider>
    );
}
function WishlistLoader({
    setIds,
    setAuthenticated,
}: {
    setIds: (ids: string[]) => void;
    setAuthenticated: (value: boolean) => void;
}) {
    const pathname = usePathname();
    useEffect(() => {
        const abort = new AbortController();
        void fetch('/api/commerce/account', {
            signal: abort.signal,
            cache: 'no-store',
        })
            .then((r) =>
                r.ok ? r.json() : Promise.reject(new Error('Unavailable')),
            )
            .then((data) => {
                setIds(data.ids || []);
                setAuthenticated(data.authenticated);
            })
            .catch(() => undefined);
        return () => abort.abort();
    }, [pathname, setIds, setAuthenticated]);
    return null;
}
export function WishlistButton({
    productId,
    compact = false,
}: {
    productId: string;
    compact?: boolean;
}) {
    const t = useTranslations('Commerce');
    const {ids, authenticated, setIds} = useContext(WishlistContext);
    const locale = useLocale();
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const saved = ids.includes(productId);
    const toggle = useCallback(async () => {
        const pathname =
            window.location.pathname.replace(
                new RegExp(`^/${locale}(?=/|$)`),
                '',
            ) || '/';
        if (authenticated === false) {
            router.push(`/sign-in?redirectTo=${encodeURIComponent(pathname)}`);
            return;
        }
        setBusy(true);
        try {
            const result = await toggleSavedProduct(productId);
            if (result.requiresSignIn) {
                router.push(
                    `/sign-in?redirectTo=${encodeURIComponent(pathname)}`,
                );
                return;
            }
            if (result.ids) {
                setIds(result.ids);
                if (pathname === '/account/wishlist') router.refresh();
            } else toast.error(t('saveError'));
        } catch {
            toast.error(t('saveError'));
        } finally {
            setBusy(false);
        }
    }, [authenticated, locale, productId, router, setIds, t]);
    return (
        <Button
            type="button"
            variant="outline"
            size={compact ? 'icon' : 'default'}
            aria-label={saved ? t('removeSaved') : t('saveProduct')}
            aria-pressed={saved}
            disabled={busy}
            onClick={() => void toggle()}
            className={compact ? 'rounded-full bg-background/95 shadow-sm' : ''}
        >
            <Heart
                className={
                    saved ? 'size-4 fill-current text-rose-600' : 'size-4'
                }
            />
            {!compact && (saved ? t('saved') : t('saveProduct'))}
        </Button>
    );
}
export function WishlistLink() {
    const t = useTranslations('Commerce');
    const {ids} = useContext(WishlistContext);
    return (
        <Button
            render={<Link href="/account/wishlist" />}
            nativeButton={false}
            variant="ghost"
            size="icon"
            aria-label={t('wishlist')}
            className="relative"
        >
            <Heart className="size-5" />
            {ids.length > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                    {ids.length}
                </span>
            )}
        </Button>
    );
}
