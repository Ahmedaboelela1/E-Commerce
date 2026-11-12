'use client';
import {useLocale, useTranslations} from 'next-intl';
import {useState} from 'react';
import {useRouter} from '@/platform/i18n/navigation';
import {growthAction} from './growth-actions';

export function useGrowthWork() {
    const t = useTranslations('Growth');
    const router = useRouter();
    const [busy, setBusy] = useState(false),
        [error, setError] = useState(''),
        [message, setMessage] = useState('');
    const run = async <T,>(
        action: string,
        input: Record<string, unknown>,
        key: string,
    ): Promise<T | null> => {
        setBusy(true);
        setError('');
        setMessage('');
        try {
            const result = await growthAction(action, input);
            if (result.requiresSignIn) {
                router.push(
                    `/sign-in?redirectTo=${encodeURIComponent(window.location.pathname.replace(/^\/(en|ar)(?=\/|$)/, '') || '/')}`,
                );
                return null;
            }
            if (result.error || !result.data) {
                setError(t('actionError'));
                return null;
            }
            return result.data[key] as T;
        } catch {
            setError(t('actionError'));
            return null;
        } finally {
            setBusy(false);
        }
    };
    return {busy, error, message, setMessage, setError, run};
}
export function GrowthFeedback({
    work,
}: {
    work: ReturnType<typeof useGrowthWork>;
}) {
    return (
        <>
            {work.error && (
                <p
                    role="alert"
                    className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
                >
                    {work.error}
                </p>
            )}
            {work.message && (
                <p
                    role="status"
                    className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                >
                    {work.message}
                </p>
            )}
        </>
    );
}
export async function loadGrowth<T>(
    operation: string,
    params: Record<string, string> = {},
    locale = 'en',
): Promise<T> {
    const response = await fetch(
        `/api/commerce/growth?${new URLSearchParams({operation, locale, ...params})}`,
        {cache: 'no-store'},
    );
    if (response.status === 401) throw new Error('SIGN_IN');
    if (!response.ok) throw new Error('UNAVAILABLE');
    return response.json();
}
export function useGrowthLocale() {
    return useLocale();
}
export const fieldClass =
    'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
