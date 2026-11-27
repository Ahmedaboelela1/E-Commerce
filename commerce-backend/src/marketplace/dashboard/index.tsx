import { useLingui, defineDashboardExtension } from '@vendure/dashboard';
import { useEffect } from 'react';

function LegacySellingRedirect() {
    const { _: t } = useLingui();
    useEffect(() => {
        const old = new URLSearchParams(window.location.search).get('tab');
        const tab =
            old === 'catalog' || !old
                ? 'products'
                : ['orders', 'delivery', 'payments', 'accounts'].includes(old)
                  ? old
                  : 'products';
        const destination = new URL(window.location.href);
        destination.pathname = destination.pathname.replace(
            /\/store-workspace\/?$/,
            '/shop-operations',
        );
        destination.search = `?tab=${tab}`;
        destination.hash = '';
        window.location.replace(destination.href);
    }, []);
    return <p>{t('shop.Opening Shop operations')}</p>;
}

defineDashboardExtension({
    routes: [
        {
            path: '/store-workspace',
            component: () => <LegacySellingRedirect />,
        },
    ],
});
