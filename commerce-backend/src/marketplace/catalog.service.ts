import sanitizeHtml from 'sanitize-html';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import {
    Asset,
    AssetService,
    ChannelService,
    EventBus,
    ProductChannelEvent,
    ProductVariant,
    ProductVariantChannelEvent,
    ID,
    LanguageCode,
    Product,
    ProductService,
    ProductOptionGroup,
    ProductOptionGroupService,
    ProductOption,
    ProductOptionService,
    ProductVariantService,
    RequestContext,
    StockLocation,
    UserInputError,
} from '@vendure/core';
import { GlobalFlag } from '@vendure/common/lib/generated-types';
import { MarketplaceAccessService, StoreActor } from './access.service';
import { MarketplaceVendor } from './entities';
import { object } from '../growth/common';
import { identifier, integer, text } from '../operations/rules';

@Injectable()
export class MarketplaceCatalogService {
    constructor(
        private channels: ChannelService,
        private events: EventBus,
        private access: MarketplaceAccessService,
        private products: ProductService,
        private variants: ProductVariantService,
        private assets: AssetService,
        private optionGroups: ProductOptionGroupService,
        private options: ProductOptionService,
    ) {}

    async list(ctx: RequestContext, search = '', skip = 0) {
        const actor = await this.access.actor(ctx),
            page = integer(skip, 0, 100000);
        const qb = this.access.db
            .getRepository(ctx, Product)
            .createQueryBuilder('p')
            .innerJoin('p.channels', 'ch', 'ch.id=:store', {
                store: actor.store.channelId,
            })
            .leftJoin('p.translations', 'tr')
            .where('p.deletedAt IS NULL');
        if (actor.vendor)
            qb.andWhere('p.customFields.marketplaceOwnerId=:owner', {
                owner: actor.vendor.id,
            });
        if (search.trim())
            qb.andWhere('(tr.name LIKE :search OR tr.slug LIKE :search)', {
                search: `%${text(search, 100)}%`,
            });
        const total = await qb.getCount();
        const rows = await qb
            .orderBy('p.id', 'DESC')
            .skip(page)
            .take(30)
            .getMany();
        const items = [];
        for (const row of rows)
            items.push(await this.detailFor(ctx, actor, row.id));
        return { items, total };
    }

    async detail(ctx: RequestContext, id: ID) {
        return this.detailFor(ctx, await this.access.actor(ctx), id);
    }
    private async detailFor(ctx: RequestContext, actor: StoreActor, id: ID) {
        const raw = await this.access.product(ctx, actor, id);
        const product = await this.products.findOne(actor.store, id, [
            'translations',
            'assets',
            'assets.asset',
            'featuredAsset',
            'variants',
            'optionGroups',
        ]);
        if (!product) throw new UserInputError('Product not found');
        const owner = raw.customFields.marketplaceOwnerId
            ? await this.access.vendor(
                  ctx,
                  { ...actor, kind: 'admin' },
                  raw.customFields.marketplaceOwnerId,
              )
            : null;
        const location =
            owner?.stockLocationId || (await this.platformLocation(ctx, actor));
        const variants = [];
        for (const row of raw.variants) {
            const variant = await this.variants.findOne(actor.store, row.id, [
                'stockLevels',
                'translations',
            ]);
            if (!variant || variant.deletedAt) continue;
            variants.push({
                id: variant.id,
                name:
                    variant.translations.find(
                        (t) => t.languageCode === LanguageCode.en,
                    )?.name || variant.name,
                sku: variant.sku,
                enabled: variant.enabled,
                price: actor.store.channel.pricesIncludeTax
                    ? variant.priceWithTax
                    : variant.price,
                priceWithTax: variant.priceWithTax,
                stockOnHand:
                    variant.stockLevels.find(
                        (level) =>
                            String(level.stockLocationId) === String(location),
                    )?.stockOnHand || 0,
            });
        }
        return {
            id: raw.id,
            enabled: raw.enabled,
            updatedAt: raw.updatedAt.toISOString(),
            ownerId: owner?.id || null,
            seller: owner?.name || actor.store.channel.code,
            name:
                product.translations.find(
                    (t) => t.languageCode === LanguageCode.en,
                )?.name || product.name,
            slug:
                product.translations.find(
                    (t) => t.languageCode === LanguageCode.en,
                )?.slug || product.slug,
            description:
                product.translations.find(
                    (t) => t.languageCode === LanguageCode.en,
                )?.description ?? product.description,
            translations: product.translations.map((t) => ({
                languageCode: t.languageCode,
                name: t.name,
                slug: t.slug,
                description: t.description,
            })),
            assets: product.assets.map(({ asset }) => ({
                id: asset.id,
                name: asset.name,
                preview: this.preview(asset.preview),
            })),
            canAddVariants:
                !product.optionGroups?.length ||
                (product.optionGroups.length === 1 &&
                    product.optionGroups[0].code ===
                        `marketplace-variant-${product.id}`),
            featuredAssetId: product.featuredAsset?.id || null,
            variants,
            currencyCode: actor.store.currencyCode,
            pricesIncludeTax: actor.store.channel.pricesIncludeTax,
        };
    }

    private safeHtml(value: string) {
        return sanitizeHtml(value, {
            allowedTags: [
                'p',
                'br',
                'strong',
                'b',
                'em',
                'i',
                'ul',
                'ol',
                'li',
                'h2',
                'h3',
                'h4',
                'blockquote',
                'a',
            ],
            allowedAttributes: { a: ['href', 'title'] },
            allowedSchemes: ['https', 'http', 'mailto'],
            allowProtocolRelative: false,
        });
    }
    private preview(value: string) {
        if (/^https?:\/\//i.test(value)) return value;
        const prefix =
            process.env.ASSET_URL_PREFIX ||
            `${process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`}/assets/`;
        return new URL(
            value.replace(/^\/?assets\//, ''),
            prefix.replace(/\/?$/, '/'),
        ).href;
    }

    async platformLocation(ctx: RequestContext, actor: StoreActor) {
        const vendors = await this.access.db
            .getRepository(ctx, MarketplaceVendor)
            .findBy({ storeChannelId: identifier(actor.store.channelId) });
        const rows = await this.access.db
            .getRepository(ctx, StockLocation)
            .createQueryBuilder('s')
            .innerJoin('s.channels', 'ch', 'ch.id=:id', {
                id: actor.store.channelId,
            })
            .getMany();
        const location = rows.find(
            (row) =>
                !vendors.some(
                    (vendor) =>
                        String(vendor.stockLocationId) === String(row.id),
                ),
        );
        if (!location)
            throw new UserInputError(
                'A SuperAdmin must configure a warehouse for the store',
            );
        return identifier(location.id);
    }

    async save(ctx: RequestContext, value: unknown) {
        const actor = await this.access.actor(ctx),
            input = object(value);
        const id = input.id == null ? null : identifier(input.id as ID);
        const old = id ? await this.access.product(ctx, actor, id, true) : null;
        const vendor = old?.customFields.marketplaceOwnerId
            ? await this.access.vendor(
                  ctx,
                  actor,
                  old.customFields.marketplaceOwnerId,
              )
            : actor.vendor ||
              (input.vendorId != null
                  ? await this.access.vendor(ctx, actor, input.vendorId)
                  : null);
        if (
            old &&
            input.vendorId != null &&
            String(input.vendorId) !==
                String(old.customFields.marketplaceOwnerId)
        )
            throw new UserInputError(
                'Product ownership cannot be changed by editing a product',
            );
        if (vendor && !vendor.active)
            throw new UserInputError('Seller is disabled');
        const name = text(input.name, 200, true),
            slug = text(input.slug, 200, true),
            description = this.safeHtml(text(input.description, 20000));
        if (!/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(slug))
            throw new UserInputError(
                'Use a URL slug with words separated by hyphens',
            );
        const translations = [
            { languageCode: LanguageCode.en, name, slug, description },
        ];
        if (
            input.arName &&
            actor.store.channel.availableLanguageCodes.includes(LanguageCode.ar)
        )
            translations.push({
                languageCode: LanguageCode.ar,
                name: text(input.arName, 200, true),
                slug: text(input.arSlug || slug, 200, true),
                description: this.safeHtml(text(input.arDescription, 20000)),
            });
        if (
            !Array.isArray(input.variants) ||
            !input.variants.length ||
            input.variants.length > 50
        )
            throw new UserInputError('Provide between 1 and 50 variants');
        const variantInputs = input.variants.map((raw) => {
            const v = object(raw),
                variantId = v.id == null ? null : identifier(v.id as ID);
            if (
                variantId &&
                (!old ||
                    !old.variants.some(
                        (row) => String(row.id) === String(variantId),
                    ))
            )
                throw new UserInputError('Variant not found');
            return {
                id: variantId,
                sku: text(v.sku, 100, true),
                name: text(v.name || name, 200, true),
                price: integer(v.price, 0, 1000000000),
                stockOnHand: integer(v.stockOnHand, 0, 100000000),
                enabled: v.enabled !== false,
            };
        });
        if (
            new Set(variantInputs.map((v) => v.sku)).size !==
            variantInputs.length
        )
            throw new UserInputError('Each variant needs a distinct SKU');
        const assetIds = Array.isArray(input.assetIds)
            ? input.assetIds.map((id) => identifier(id as ID))
            : [];
        if (assetIds.length > 20)
            throw new UserInputError('Use no more than 20 product images');
        for (const assetId of assetIds) {
            if (
                !(await this.access.db.findOneInChannel(
                    ctx,
                    Asset,
                    assetId,
                    vendor?.channelId || actor.store.channelId,
                ))
            )
                throw new UserInputError(
                    'Image not found in this seller account',
                );
        }
        const result = await this.access.write(
            ctx,
            actor,
            id ? 'update-product' : 'create-product',
            async (tx) => {
                if (id) {
                    await this.access.db.getRepository(tx, Product).findOne({
                        where: { id },
                        lock: { mode: 'pessimistic_write' },
                    });
                    const fresh = await this.access.product(
                        tx,
                        actor,
                        id,
                        true,
                    );
                    if (input.updatedAt !== fresh.updatedAt.toISOString())
                        throw new UserInputError(
                            'Product changed; refresh it before saving',
                        );
                }
                const productCtx = vendor
                    ? await this.access.storeContext(tx, vendor.channelId)
                    : tx;
                const location =
                    vendor?.stockLocationId ||
                    (await this.platformLocation(tx, actor));
                const product = id
                    ? await this.products.update(productCtx, {
                          id,
                          enabled: input.enabled === true,
                          translations,
                          assetIds,
                          featuredAssetId:
                              assetIds[0] || (null as unknown as ID),
                      })
                    : await this.products.create(productCtx, {
                          enabled: input.enabled === true,
                          translations,
                          assetIds,
                          featuredAssetId: assetIds[0],
                          customFields: {
                              marketplaceOwnerId: vendor?.id || null,
                          },
                      });
                const optionMap = await this.variantOptions(
                    productCtx,
                    actor.store.channelId,
                    product.id,
                    variantInputs,
                );
                if (vendor && variantInputs.some((v) => v.id == null)) {
                    const assigned = await this.access.db
                        .getRepository(tx, Product)
                        .findOneOrFail({
                            where: { id: product.id },
                            relations: ['channels'],
                        });
                    const allowed = new Set([
                        String(vendor.channelId),
                        String(actor.store.channelId),
                    ]);
                    if (
                        assigned.channels.some(
                            (channel) =>
                                channel.code !== '__default_channel__' &&
                                !allowed.has(String(channel.id)),
                        )
                    )
                        throw new UserInputError(
                            'Use the SuperAdmin catalog to add variants to products shared across stores',
                        );
                    // Native createSingle() automatically invokes a permission-gated
                    // cross-channel assignment. Keep creation within the seller channel;
                    // the validated store association is restored below in this same
                    // transaction, along with every new variant and its store price.
                    // A failure rolls the association back with the whole product edit.
                    await this.access.db
                        .getRepository(tx, Product)
                        .createQueryBuilder()
                        .relation(Product, 'channels')
                        .of(product.id)
                        .remove(actor.store.channelId);
                }
                for (const v of variantInputs) {
                    const optionId = optionMap.get(
                        v.id ? String(v.id) : `new:${v.sku}`,
                    );
                    const common = {
                        ...(optionId ? { optionIds: [optionId] } : {}),
                        sku: v.sku,
                        enabled: v.enabled,
                        trackInventory: GlobalFlag.TRUE,
                        price: v.price,
                        stockLevels: [
                            {
                                stockLocationId: location,
                                stockOnHand: v.stockOnHand,
                            },
                        ],
                        translations: [
                            { languageCode: LanguageCode.en, name: v.name },
                        ],
                    };
                    if (v.id)
                        await this.variants.update(productCtx, [
                            { ...common, id: v.id },
                        ]);
                    else
                        await this.variants.create(productCtx, [
                            { ...common, productId: product.id },
                        ]);
                }
                if (vendor) {
                    await this.channels.assignToChannels(
                        tx,
                        Product,
                        product.id,
                        [actor.store.channelId],
                    );
                    const variants = (await this.products.findOne(
                        productCtx,
                        product.id,
                        ['variants'],
                    ))!.variants;
                    for (const v of variants) {
                        const row = variantInputs.find((item) =>
                            item.id
                                ? String(item.id) === String(v.id)
                                : item.sku === v.sku,
                        );
                        await this.channels.assignToChannels(
                            tx,
                            ProductVariant,
                            v.id,
                            [actor.store.channelId],
                        );
                        if (row)
                            await this.variants.createOrUpdateProductVariantPrice(
                                tx,
                                v.id,
                                row.price,
                                actor.store.channelId,
                                actor.store.currencyCode,
                            );
                        await this.events.publish(
                            new ProductVariantChannelEvent(
                                tx,
                                v,
                                actor.store.channelId,
                                'assigned',
                            ),
                        );
                    }
                    await this.events.publish(
                        new ProductChannelEvent(
                            tx,
                            product,
                            actor.store.channelId,
                            'assigned',
                        ),
                    );
                }
                return product.id;
            },
        );
        return this.detail(ctx, result);
    }

    private async variantOptions(
        ctx: RequestContext,
        storeId: ID,
        productId: ID,
        inputs: { id: number | null; sku: string; name: string }[],
    ) {
        const product = await this.products.findOne(ctx, productId, [
            'variants',
            'optionGroups',
        ]);
        if (!product) throw new UserInputError('Product not found');
        const groups = product.optionGroups.filter((group) => !group.deletedAt);
        let group = groups.find(
            (group) => group.code === `marketplace-variant-${productId}`,
        );
        const existing = product.variants.filter(
            (variant) => !variant.deletedAt,
        );
        const map = new Map<string, ID>();
        if (groups.length && (!group || groups.length !== 1)) {
            if (inputs.some((v) => v.id == null))
                throw new UserInputError(
                    'A SuperAdmin must configure new combinations for products with existing option matrices',
                );
            return map;
        }
        if (
            !group &&
            existing.length + inputs.filter((v) => v.id == null).length <= 1
        )
            return map;
        if (group) {
            const raw = await this.access.db
                .getRepository(ctx, ProductOptionGroup)
                .findOne({ where: { id: group.id }, relations: ['products'] });
            if (
                !raw ||
                raw.products.some((p) => String(p.id) !== String(productId))
            )
                throw new UserInputError(
                    'A SuperAdmin must separate shared variant options before editing',
                );
        } else {
            group = await this.optionGroups.create(ctx, {
                code: `marketplace-variant-${productId}`,
                translations: [
                    { languageCode: LanguageCode.en, name: 'Variant' },
                    ...(ctx.channel.availableLanguageCodes.includes(
                        LanguageCode.ar,
                    )
                        ? [{ languageCode: LanguageCode.ar, name: 'الإصدار' }]
                        : []),
                ],
            });
            await this.products.addOptionGroupToProduct(
                ctx,
                productId,
                group.id,
            );
        }
        await this.channels.assignToChannels(
            ctx,
            ProductOptionGroup,
            group.id,
            [storeId],
        );
        for (const row of existing) {
            const variant = await this.variants.findOne(ctx, row.id, [
                'options',
            ]);
            if (!variant) continue;
            const input = inputs.find((v) => String(v.id) === String(row.id));
            const name =
                input?.name ||
                variant.translations.find(
                    (t) => t.languageCode === LanguageCode.en,
                )?.name ||
                variant.name;
            let option = variant.options.find(
                (option) => String(option.groupId) === String(group!.id),
            );
            if (!option) {
                option = await this.options.create(ctx, group, {
                    code: `sku-${randomUUID()}`,
                    translations: [{ languageCode: LanguageCode.en, name }],
                });
                await this.variants.update(ctx, [
                    { id: row.id, optionIds: [option.id] },
                ]);
            } else if (input) {
                await this.options.update(ctx, {
                    id: option.id,
                    translations: [{ languageCode: LanguageCode.en, name }],
                });
            }
            await this.channels.assignToChannels(
                ctx,
                ProductOption,
                option.id,
                [storeId],
            );
            map.set(String(row.id), option.id);
        }
        for (const input of inputs.filter((v) => v.id == null)) {
            const option = await this.options.create(ctx, group, {
                code: `sku-${randomUUID()}`,
                translations: [
                    { languageCode: LanguageCode.en, name: input.name },
                ],
            });
            await this.channels.assignToChannels(
                ctx,
                ProductOption,
                option.id,
                [storeId],
            );
            map.set(`new:${input.sku}`, option.id);
        }
        return map;
    }

    async upload(
        ctx: RequestContext,
        file: Parameters<AssetService['create']>[1]['file'],
        vendorId?: ID,
    ) {
        const actor = await this.access.actor(ctx),
            vendor =
                actor.vendor ||
                (vendorId
                    ? await this.access.vendor(ctx, actor, vendorId)
                    : null);
        const upload = await file;
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of upload.createReadStream()) {
            size += chunk.length;
            if (size > 5 * 1024 * 1024)
                throw new UserInputError('Product image exceeds 5 MB');
            chunks.push(Buffer.from(chunk));
        }
        const image = sharp(Buffer.concat(chunks), {
            limitInputPixels: 20000000,
        });
        const metadata = await image.metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format || ''))
            throw new UserInputError('Use a JPEG, PNG or WebP product image');
        const png = await image.rotate().png().toBuffer();
        const safeFile = {
            ...upload,
            filename: 'product-image.png',
            mimetype: 'image/png',
            createReadStream: () => Readable.from(png),
        };
        return this.access.write(
            ctx,
            actor,
            'upload-product-image',
            async (tx) => {
                const target = vendor
                    ? await this.access.storeContext(tx, vendor.channelId)
                    : tx;
                const asset = await this.assets.create(target, {
                    file: Promise.resolve(safeFile),
                });
                if ('errorCode' in asset)
                    throw new UserInputError(asset.message);
                if (!asset.mimeType.startsWith('image/'))
                    throw new UserInputError('Upload a product image');
                if (vendor)
                    await this.channels.assignToChannels(tx, Asset, asset.id, [
                        actor.store.channelId,
                    ]);
                return {
                    id: asset.id,
                    name: asset.name,
                    preview: this.preview(asset.preview),
                };
            },
        );
    }
}
