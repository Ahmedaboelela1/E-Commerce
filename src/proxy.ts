import createMiddleware from 'next-intl/middleware';
import {NextRequest, NextResponse} from 'next/server';
import {routing} from './platform/i18n/routing';

const middleware = createMiddleware(routing);
const commerceRoutes = new Set([
    'search', 'product', 'collection', 'cart', 'checkout', 'account',
    'sign-in', 'register', 'forgot-password', 'reset-password',
    'verify', 'verify-pending', 'order-confirmation',
]);

export function proxy(request: NextRequest) {
    // Until a real Vendure backend + local merchant checkout is configured,
    // do not send users into the read-only demo catalog or test checkout.
    if (process.env.NEXT_PUBLIC_ENABLE_CHECKOUT !== 'true') {
        const segments = request.nextUrl.pathname.split('/').filter(Boolean);
        const locale = routing.locales.find((candidate) => candidate === segments[0]);
        const route = locale ? segments[1] : segments[0];

        if (route && commerceRoutes.has(route)) {
            return NextResponse.redirect(new URL(locale ? `/${locale}` : '/', request.url));
        }
    }

    return middleware(request);
}

export const config = {matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']};
