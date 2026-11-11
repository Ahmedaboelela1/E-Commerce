'use client';

import {useCallback, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Star, ShieldCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Link} from '@/platform/i18n/navigation';
import type {MyReview, ReviewPage} from './graphql';
import {submitReview} from './actions';

export function ProductReviews({productId}: {productId: string}) {
    const t = useTranslations('Commerce');
    const [data, setData] = useState<ReviewPage | null>(null);
    const [own, setOwn] = useState<MyReview | null>(null);
    const [authenticated, setAuthenticated] = useState(false);
    const [rating, setRating] = useState(5);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [skip, setSkip] = useState(0);
    const load = useCallback(async () => {
        const response = await fetch(
            `/api/commerce/reviews?productId=${encodeURIComponent(productId)}&skip=${skip}`,
            {cache: 'no-store'},
        );
        if (!response.ok) throw new Error('Unavailable');
        const result = await response.json();
        setData(result.reviews);
        setOwn(result.own);
        setAuthenticated(result.authenticated);
        if (result.own?.review) {
            setRating(result.own.review.rating);
            setText(result.own.review.text);
        }
    }, [productId, skip]);
    useEffect(() => {
        void load().catch(() => setError(t('reviewsError')));
    }, [load, t]);
    return (
        <section className="mt-12 space-y-5 rounded-2xl border p-5 md:p-7">
            <h2 className="text-2xl font-bold">{t('reviews')}</h2>
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}{' '}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setError('');
                            void load().catch(() =>
                                setError(t('reviewsError')),
                            );
                        }}
                    >
                        {t('retry')}
                    </Button>
                </p>
            )}
            {!data && !error && (
                <p className="text-muted-foreground">{t('loading')}</p>
            )}
            {data && (
                <>
                    <p className="flex items-center gap-2">
                        <Star className="size-5 fill-amber-400 text-amber-400" />
                        {data.total
                            ? t('ratingSummary', {
                                  rating: data.average.toFixed(1),
                                  count: data.total,
                              })
                            : t('noReviews')}
                    </p>
                    {data.items.map((review) => (
                        <article
                            key={review.id}
                            className="space-y-2 border-t pt-4"
                        >
                            <div className="flex flex-wrap items-center gap-3">
                                <strong>{review.author}</strong>
                                <span>{review.rating}/5</span>
                                <span className="flex items-center gap-1 text-xs text-green-700">
                                    <ShieldCheck className="size-3" />
                                    {t('verifiedPurchase')}
                                </span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                {review.text}
                            </p>
                        </article>
                    ))}
                    {data.total > 10 && (
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                disabled={!skip}
                                onClick={() => setSkip(Math.max(0, skip - 10))}
                            >
                                {t('previous')}
                            </Button>
                            <Button
                                variant="outline"
                                disabled={skip + 10 >= data.total}
                                onClick={() => setSkip(skip + 10)}
                            >
                                {t('next')}
                            </Button>
                        </div>
                    )}
                </>
            )}
            {own?.eligible && (
                <form
                    className="space-y-3 rounded-xl bg-muted/50 p-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        setBusy(true);
                        setError('');
                        setMessage('');
                        void submitReview(productId, rating, text)
                            .then((result) => {
                                if (result.review) {
                                    setOwn(result.review);
                                    setMessage(t('reviewSaved'));
                                } else setError(t('reviewError'));
                            })
                            .catch(() => setError(t('reviewError')))
                            .finally(() => setBusy(false));
                    }}
                >
                    <h3 className="font-semibold">
                        {own.review ? t('editReview') : t('writeReview')}
                    </h3>
                    {own.review && (
                        <p className="text-sm text-muted-foreground">
                            {own.review.status === 'approved'
                                ? t('reviewApproved')
                                : own.review.status === 'rejected'
                                  ? t('reviewRejected')
                                  : t('reviewPending')}
                        </p>
                    )}
                    <label
                        className="block text-sm font-medium"
                        htmlFor={`rating-${productId}`}
                    >
                        {t('yourRating')}
                    </label>
                    <select
                        id={`rating-${productId}`}
                        className="h-10 w-full rounded-md border bg-background px-3"
                        value={rating}
                        onChange={(e) => setRating(Number(e.target.value))}
                        disabled={busy}
                    >
                        {[5, 4, 3, 2, 1].map((value) => (
                            <option key={value} value={value}>
                                {value}/5
                            </option>
                        ))}
                    </select>
                    <label
                        className="block text-sm font-medium"
                        htmlFor={`review-${productId}`}
                    >
                        {t('yourReview')}
                    </label>
                    <textarea
                        id={`review-${productId}`}
                        className="min-h-28 w-full rounded-md border bg-background p-3"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        maxLength={2000}
                        required
                        disabled={busy}
                    />
                    <Button disabled={busy || !text.trim()} type="submit">
                        {t('sendReview')}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        {t('moderationNote')}
                    </p>
                </form>
            )}
            {data && !own?.eligible && (
                <p className="text-sm text-muted-foreground">
                    {authenticated ? (
                        t('purchaseRequired')
                    ) : (
                        <Link
                            href="/sign-in"
                            className="text-primary underline"
                        >
                            {t('signInReview')}
                        </Link>
                    )}
                </p>
            )}
            {message && (
                <p role="status" className="text-sm text-green-700">
                    {message}
                </p>
            )}
        </section>
    );
}
