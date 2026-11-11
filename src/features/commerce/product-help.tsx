'use client';
import {useEffect, useState} from 'react';
import {
    BookOpen,
    FileDown,
    PlayCircle,
    Code2,
    ArrowUpRight,
} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {loadGrowth} from './growth-client';
import type {ProductHelp as Help} from './growth-types';

export function ProductHelp({productId}: {productId: string}) {
    const t = useTranslations('Growth'),
        locale = useLocale();
    const [help, setHelp] = useState<Help | null>(null),
        [error, setError] = useState(false);
    useEffect(() => {
        let active = true;
        void loadGrowth<{shopProductContent: {content: Help}}>(
            'content',
            {id: productId},
            locale,
        )
            .then((d) => {
                if (active) setHelp(d.shopProductContent.content);
            })
            .catch(() => {
                if (active) setError(true);
            });
        return () => {
            active = false;
        };
    }, [productId, locale]);
    if (error)
        return (
            <p className="mt-8 text-sm text-muted-foreground">
                {t('helpLoadError')}
            </p>
        );
    if (
        !help ||
        (!help.resources.length &&
            !help.faqs.length &&
            !Object.values(help.specs).some(Boolean))
    )
        return null;
    const icons = {
        manual: FileDown,
        video: PlayCircle,
        code: Code2,
        link: ArrowUpRight,
    };
    return (
        <section className="mt-10 space-y-6 rounded-3xl border p-5 sm:p-8">
            <h2 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
                <BookOpen className="size-6 text-primary" />
                {t('productHelp')}
            </h2>
            {Object.values(help.specs).some(Boolean) && (
                <dl className="grid gap-5 sm:grid-cols-2">
                    {Object.entries(help.specs)
                        .filter(([, value]) => value)
                        .map(([key, value]) => (
                            <div
                                key={key}
                                className="rounded-xl bg-muted/40 p-4"
                            >
                                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {t(key)}
                                </dt>
                                <dd className="mt-2 whitespace-pre-wrap text-sm leading-7">
                                    {value}
                                </dd>
                            </div>
                        ))}
                </dl>
            )}
            {help.resources.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                    {help.resources.map((r, i) => {
                        const Icon =
                            icons[r.kind as keyof typeof icons] || ArrowUpRight;
                        return (
                            <a
                                href={r.url}
                                key={i}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center gap-3 rounded-xl border p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
                            >
                                <Icon className="size-5 shrink-0 text-primary" />
                                <span className="min-w-0 flex-1 text-sm font-medium">
                                    {r.title}
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                        {t('resource.' + r.kind)}
                                    </span>
                                </span>
                                <ArrowUpRight className="size-4 text-muted-foreground" />
                            </a>
                        );
                    })}
                </div>
            )}
            {help.faqs.length > 0 && (
                <div>
                    <h3 className="mb-4 font-semibold">{t('faq')}</h3>
                    {help.faqs.map((q, i) => (
                        <details key={i} className="border-t py-4">
                            <summary className="cursor-pointer text-sm font-medium">
                                {q.question}
                            </summary>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                                {q.answer}
                            </p>
                        </details>
                    ))}
                </div>
            )}
        </section>
    );
}
