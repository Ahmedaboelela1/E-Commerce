import {Injectable} from '@nestjs/common';
import {
    ID,
    ProductService,
    ProductVariantService,
    RequestContext,
    UserInputError,
} from '@vendure/core';
import {
    GrowthCommon,
    identifier,
    integer,
    json,
    object,
    text,
    url,
} from './common';
import {ProductContent} from './entities';

interface Content {
    specs: {
        ageRange: string;
        programming: string;
        boxContents: string;
        competitions: string;
    };
    resources: Array<{kind: string; title: string; url: string}>;
    faqs: Array<{question: string; answer: string}>;
}
const empty = (): Content => ({
    specs: {ageRange: '', programming: '', boxContents: '', competitions: ''},
    resources: [],
    faqs: [],
});

@Injectable()
export class CatalogToolsService {
    constructor(
        private common: GrowthCommon,
        private products: ProductService,
        private variants: ProductVariantService,
    ) {}
    async content(
        ctx: RequestContext,
        productId: ID,
        languageCode: string = ctx.languageCode,
        fallback = true,
        publicOnly = true,
    ) {
        await this.common.product(ctx, productId, publicOnly);
        const repo = this.common.db.getRepository(ctx, ProductContent);
        const key = {
            channelId: identifier(ctx.channelId),
            productId: identifier(productId),
        };
        const row =
            (await repo.findOneBy({
                ...key,
                languageCode: String(languageCode),
            })) ||
            (fallback
                ? await repo.findOneBy({...key, languageCode: 'en'})
                : null);
        return {
            content: row ? json(row.content, empty()) : empty(),
            version: row?.version || 0,
            languageCode: row?.languageCode || String(languageCode),
        };
    }
    async save(
        ctx: RequestContext,
        productId: ID,
        languageCode: string,
        value: unknown,
        version: number,
    ) {
        await this.common.product(ctx, productId, false);
        if (!['en', 'ar'].includes(languageCode))
            throw new UserInputError('Choose English or Arabic');
        const input = object(value);
        const specs = object(input.specs || {});
        const resources = Array.isArray(input.resources) ? input.resources : [];
        const faqs = Array.isArray(input.faqs) ? input.faqs : [];
        if (resources.length > 20 || faqs.length > 30)
            throw new UserInputError(
                'Limit help resources to 20 and questions to 30',
            );
        const content: Content = {
            specs: {
                ageRange: text(specs.ageRange, 200),
                programming: text(specs.programming, 1000),
                boxContents: text(specs.boxContents, 3000),
                competitions: text(specs.competitions, 1000),
            },
            resources: resources.map((raw) => {
                const r = object(raw);
                const kind = text(r.kind, 20, true);
                if (!['manual', 'video', 'code', 'link'].includes(kind))
                    throw new UserInputError('Choose a resource type');
                return {kind, title: text(r.title, 160, true), url: url(r.url)};
            }),
            faqs: faqs.map((raw) => {
                const q = object(raw);
                return {
                    question: text(q.question, 300, true),
                    answer: text(q.answer, 3000, true),
                };
            }),
        };
        const repo = this.common.db.getRepository(ctx, ProductContent);
        const key = {
            channelId: identifier(ctx.channelId),
            productId: identifier(productId),
            languageCode,
        };
        const row = await repo.findOneBy(key);
        if ((row?.version || 0) !== integer(version, 0, 1000000))
            throw new UserInputError(
                'Product content changed. Reload before saving.',
            );
        if (row) {
            const result = await repo.update(
                {...key, version},
                {content: JSON.stringify(content), version: version + 1},
            );
            if (!result.affected)
                throw new UserInputError(
                    'Product content changed. Reload before saving.',
                );
        } else
            await repo.save(
                new ProductContent({
                    ...key,
                    content: JSON.stringify(content),
                    version: 1,
                }),
            );
        return {content, version: version + 1, languageCode};
    }
    async availability(ctx: RequestContext, id: ID) {
        const variant = await this.common.variant(ctx, id);
        return {
            id: variant.id,
            available:
                (await this.variants.getSaleableStockLevel(ctx, variant)) > 0,
            priceWithTax: variant.priceWithTax,
            currencyCode: ctx.currencyCode,
        };
    }
    async compare(ctx: RequestContext, ids: ID[]) {
        if (!Array.isArray(ids) || ids.length > 4)
            throw new UserInputError('Compare up to four products');
        const result = [];
        for (const id of [...new Set(ids.map(identifier))]) {
            await this.common.product(ctx, id);
            const product = await this.products.findOne(ctx, id, [
                'featuredAsset',
            ]);
            if (!product) continue;
            const variants = await this.variants.getVariantsByProductId(
                ctx,
                id,
                {take: 100},
            );
            for (
                let skip = variants.items.length;
                skip < variants.totalItems;
                skip += 100
            ) {
                const next = await this.variants.getVariantsByProductId(
                    ctx,
                    id,
                    {take: 100, skip},
                );
                variants.items.push(...next.items);
            }
            const prices = variants.items.map((v) => v.priceWithTax);
            result.push({
                id: product.id,
                name: product.name,
                slug: product.slug,
                preview: this.common.preview(product.featuredAsset?.preview),
                minimum: prices.length ? Math.min(...prices) : null,
                maximum: prices.length ? Math.max(...prices) : null,
                currencyCode: ctx.channel.defaultCurrencyCode,
                variants: await Promise.all(
                    variants.items.map(async (v) => ({
                        id: v.id,
                        name: v.name,
                        sku: v.sku,
                        price: v.priceWithTax,
                        available:
                            (await this.variants.getSaleableStockLevel(
                                ctx,
                                v,
                            )) > 0,
                    })),
                ),
                ...(await this.content(ctx, id)),
            });
        }
        return result;
    }
}
