import createMiddleware from 'next-intl/middleware';
import {NextRequest, NextResponse} from 'next/server';
import {routing} from './platform/i18n/routing';

const middleware = createMiddleware(routing);

export function proxy(request: NextRequest) {
    if (/^\/de(?=\/|$)/.test(request.nextUrl.pathname)) {
        const target = request.nextUrl.clone();
        target.pathname = target.pathname.replace(/^\/de(?=\/|$)/, '/ar');
        return NextResponse.redirect(target, 308);
    }
    return middleware(request);
}

export const config = {matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']};
