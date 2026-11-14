import { defineDashboardExtension } from '@vendure/dashboard';
import { useEffect } from 'react';

function LegacySellingRedirect() {
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
    return <p>Opening Shop operations / جارٍ فتح إدارة المتجر…</p>;
}

defineDashboardExtension({
    routes: [
        {
            path: '/store-workspace',
            component: () => <LegacySellingRedirect />,
        },
    ],
});
