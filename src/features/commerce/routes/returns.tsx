'use client';
import {useCallback, useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link, useRouter} from '@/platform/i18n/navigation';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {loadGrowth, useGrowthWork, GrowthFeedback} from '../growth-client';
import {uploadReturnPhoto} from '../growth-actions';
import {downloadFile} from '../order-tools';
import type {FileDownload} from '../graphql';
import type {ReturnInfo} from '../growth-types';

export default function ReturnsPage() {
    const t = useTranslations('Growth'),
        locale = useLocale(),
        router = useRouter();
    const work = useGrowthWork();
    const [items, setItems] = useState<ReturnInfo[]>([]),
        [loading, setLoading] = useState(true),
        [skip, setSkip] = useState(0),
        [total, setTotal] = useState(0),
        [uploading, setUploading] = useState(false);
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const d = await loadGrowth<{
                myReturnRequests: {items: ReturnInfo[]; total: number};
            }>('returns', {skip: String(skip)}, locale);
            setItems(d.myReturnRequests.items);
            setTotal(d.myReturnRequests.total);
        } catch (error) {
            if (error instanceof Error && error.message === 'SIGN_IN')
                router.replace('/sign-in?redirectTo=/account/returns');
            else work.setError(t('loadError'));
        } finally {
            setLoading(false);
        }
    }, [locale, skip, router, t]);
    useEffect(() => {
        void load();
    }, [load]);
    const upload = async (form: FormData) => {
        setUploading(true);
        work.setError('');
        work.setMessage('');
        try {
            const r = await uploadReturnPhoto(form);
            if (r.requiresSignIn)
                router.push('/sign-in?redirectTo=/account/returns');
            else if (r.error) work.setError(t('returnPhotoFailed'));
            else {
                work.setMessage(t('photoSaved'));
                await load();
            }
        } catch {
            work.setError(t('returnPhotoFailed'));
        } finally {
            setUploading(false);
        }
    };
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">
                {t('returns')}
            </h1>
            <p className="text-sm leading-7 text-muted-foreground">
                {t('returnsAccountHelp')}{' '}
                <Link
                    href="/account/orders"
                    className="font-medium text-primary underline"
                >
                    {t('myOrders')}
                </Link>
            </p>
            <GrowthFeedback work={work} />
            {loading ? (
                <p>{t('loading')}</p>
            ) : !items.length ? (
                <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                    {t('noReturns')}
                </p>
            ) : (
                items.map((r) => (
                    <article
                        key={r.id}
                        className="space-y-4 rounded-2xl border p-5 sm:p-7"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2 className="text-lg font-semibold">
                                {t('returnNumber', {id: r.id})}
                            </h2>
                            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                                {t('status.' + r.status)}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t('returnType')}: {t(r.kind)}
                        </p>
                        <ul className="space-y-2 text-sm">
                            {r.items.map((i) => (
                                <li key={i.orderLineId}>
                                    {i.name} · {i.sku} × {i.quantity}
                                </li>
                            ))}
                        </ul>
                        <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                            {r.reason}
                        </p>
                        {r.publicMessage && (
                            <p className="whitespace-pre-wrap rounded-xl bg-muted/40 p-4 text-sm leading-7">
                                {r.publicMessage}
                            </p>
                        )}
                        {r.resolution && (
                            <p className="text-sm font-medium">
                                {t('resolution.' + r.resolution)}
                            </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {Array.from({length: r.photoCount}, (_, i) => (
                                <Button
                                    key={i}
                                    variant="outline"
                                    size="sm"
                                    disabled={work.busy}
                                    onClick={() =>
                                        void work
                                            .run<FileDownload>(
                                                'returnPhoto',
                                                {id: r.id, index: i},
                                                'myReturnPhoto',
                                            )
                                            .then((file) => {
                                                if (file) downloadFile(file);
                                            })
                                    }
                                >
                                    {t('downloadPhoto', {number: i + 1})}
                                </Button>
                            ))}
                        </div>
                        {['requested', 'authorized'].includes(r.status) &&
                            r.photoCount < 3 && (
                                <form
                                    action={upload}
                                    className="space-y-3 rounded-xl border p-4"
                                >
                                    <input
                                        type="hidden"
                                        name="returnId"
                                        value={r.id}
                                    />
                                    <label
                                        htmlFor={`return-photo-${r.id}`}
                                        className="block text-sm font-medium"
                                    >
                                        {t('returnPhoto')}
                                    </label>
                                    <Input
                                        id={`return-photo-${r.id}`}
                                        type="file"
                                        name="photo"
                                        accept="image/png,image/jpeg,image/webp"
                                        required
                                        disabled={uploading}
                                    />
                                    <p className="text-xs leading-6 text-muted-foreground">
                                        {t('returnPhotoHelp')}
                                    </p>
                                    <Button type="submit" disabled={uploading}>
                                        {t('uploadPhoto')}
                                    </Button>
                                </form>
                            )}
                    </article>
                ))
            )}
            <div className="flex gap-3">
                <Button
                    variant="outline"
                    disabled={!skip || loading}
                    onClick={() => setSkip(Math.max(0, skip - 30))}
                >
                    {t('previous')}
                </Button>
                <Button
                    variant="outline"
                    disabled={skip + 30 >= total || loading}
                    onClick={() => setSkip(skip + 30)}
                >
                    {t('next')}
                </Button>
                <Button variant="ghost" onClick={() => void load()}>
                    {t('refresh')}
                </Button>
            </div>
        </div>
    );
}
