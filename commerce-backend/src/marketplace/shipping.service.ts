import { Injectable } from '@nestjs/common';
import {
    Channel,
    ChannelService,
    ID,
    Order,
    OrderLine,
    OrderService,
    Product,
    RequestContext,
    ShippingLine,
    ShippingMethod,
    ShippingMethodService,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { MarketplaceAccessService } from './access.service';
import { MarketplaceShipping, MarketplaceVendor } from './entities';
import {
    egyptGovernorates,
    resolveEgyptGovernorate,
} from '../egypt-governorate-shipping';
import { identifier, integer, text } from '../operations/rules';
import { object } from '../growth/common';

@Injectable()
export class MarketplaceShippingService {
    constructor(
        private channels: ChannelService,
        readonly db: TransactionalConnection,
        private access: MarketplaceAccessService,
        private methods: ShippingMethodService,
        private orders: OrderService,
    ) {}

    async lineOwner(ctx: RequestContext, line: OrderLine) {
        const product = await this.db
            .getRepository(ctx, Product)
            .findOneBy({ id: line.productVariant.productId });
        const owner = product?.customFields.marketplaceOwnerId;
        if (!owner) return undefined;
        const vendor = await this.db
            .getRepository(ctx, MarketplaceVendor)
            .findOneBy({
                id: identifier(owner),
                storeChannelId: identifier(ctx.channelId),
                active: true,
            });
        if (!vendor)
            throw new UserInputError(
                'This seller is not currently accepting orders',
            );
        return this.db
            .getRepository(ctx, Channel)
            .findOneByOrFail({ id: vendor.channelId });
    }

    async group(ctx: RequestContext, methodId: ID) {
        const route = await this.db
            .getRepository(ctx, MarketplaceShipping)
            .findOneBy({
                storeChannelId: identifier(ctx.channelId),
                shippingMethodId: identifier(methodId),
            });
        if (!route) return { id: 'store', name: ctx.channel.code };
        const vendor = await this.db
            .getRepository(ctx, MarketplaceVendor)
            .findOneBy({
                id: route.vendorId,
                storeChannelId: identifier(ctx.channelId),
            });
        if (!vendor) return { id: 'unavailable', name: '' };
        return { id: String(vendor.channelId), name: vendor.name };
    }

    async lineGroups(ctx: RequestContext, order: Order) {
        const lines = order.lines || [];
        if (lines.some((line) => line.sellerChannelId != null)) {
            const ids = [
                ...new Set(
                    lines
                        .filter((line) => line.sellerChannelId != null)
                        .map((line) => identifier(line.sellerChannelId!)),
                ),
            ];
            const vendors = await this.db
                .getRepository(ctx, MarketplaceVendor)
                .findBy({ storeChannelId: identifier(ctx.channelId) });
            if (
                ids.some(
                    (id) =>
                        !vendors.some(
                            (vendor) =>
                                vendor.channelId === id && vendor.active,
                        ),
                )
            )
                throw new UserInputError(
                    'A seller in this cart is no longer accepting orders',
                );
        }
        return [
            ...new Set(
                lines.map((line) =>
                    line.sellerChannelId == null
                        ? 'store'
                        : String(line.sellerChannelId),
                ),
            ),
        ];
    }

    async eligible(
        ctx: RequestContext,
        order: Order,
        vendorId: number,
        governorate: string,
    ) {
        if (
            ctx.currencyCode !== 'EGP' ||
            order.shippingAddress?.countryCode !== 'EG' ||
            resolveEgyptGovernorate(order.shippingAddress.province || '') !==
                governorate
        )
            return false;
        const vendor = await this.db
            .getRepository(ctx, MarketplaceVendor)
            .findOneBy({
                id: vendorId,
                storeChannelId: identifier(ctx.channelId),
                active: true,
            });
        return (
            !!vendor &&
            ctx.currencyCode === 'EGP' &&
            order.shippingAddress?.countryCode === 'EG' &&
            resolveEgyptGovernorate(order.shippingAddress.province || '') ===
                governorate &&
            order.lines.some(
                (line) =>
                    String(line.sellerChannelId) === String(vendor.channelId),
            )
        );
    }

    async assign(
        ctx: RequestContext,
        shippingLine: ShippingLine,
        order: Order,
    ) {
        const group = await this.group(ctx, shippingLine.shippingMethodId!);
        return order.lines.filter(
            (line) =>
                (line.sellerChannelId == null
                    ? 'store'
                    : String(line.sellerChannelId)) === group.id,
        );
    }

    async validate(ctx: RequestContext, order: Order) {
        const groups = await this.lineGroups(ctx, order);
        const selected: string[] = [];
        for (const line of order.shippingLines || []) {
            if (!line.shippingMethodId)
                return 'Select delivery for every seller';
            selected.push((await this.group(ctx, line.shippingMethodId)).id);
        }
        if (
            groups.length !== selected.length ||
            new Set(selected).size !== selected.length ||
            groups.some((group) => !selected.includes(group))
        )
            return 'Select one delivery method for every seller / اختر طريقة توصيل لكل بائع';
    }

    async requiredGroups(ctx: RequestContext) {
        if (ctx.apiType !== 'shop' || !ctx.activeUserId)
            throw new UserInputError('Sign in before choosing delivery');
        const order = await this.orders.getActiveOrderForUser(
            ctx,
            ctx.activeUserId,
        );
        if (!order) return [];
        const groups = [
                ...new Set(
                    order.lines.map((line) =>
                        line.sellerChannelId == null
                            ? 'store'
                            : String(line.sellerChannelId),
                    ),
                ),
            ],
            vendors = await this.db
                .getRepository(ctx, MarketplaceVendor)
                .findBy({ storeChannelId: identifier(ctx.channelId) });
        return groups.map((id) => ({
            id,
            name:
                id === 'store'
                    ? ctx.channel.code
                    : vendors.find((v) => String(v.channelId) === id)?.name ||
                      '',
        }));
    }

    async setForActiveOrder(ctx: RequestContext, ids: ID[]) {
        if (ctx.apiType !== 'shop' || !ctx.activeUserId)
            throw new UserInputError('Sign in before choosing delivery');
        if (
            !Array.isArray(ids) ||
            !ids.length ||
            ids.length > 50 ||
            new Set(ids.map(String)).size !== ids.length
        )
            throw new UserInputError(
                'Select one delivery method for every seller',
            );
        return this.db.withTransaction(ctx, async (tx) => {
            const order = await this.orders.getActiveOrderForUser(
                tx,
                ctx.activeUserId!,
            );
            if (
                !order ||
                !['AddingItems', 'ArrangingPayment'].includes(order.state) ||
                !order.lines.length
            )
                throw new UserInputError('No editable cart found');
            await this.db.getRepository(tx, Order).findOne({
                where: { id: order.id },
                lock: { mode: 'pessimistic_write' },
            });
            if (order.state === 'ArrangingPayment') {
                const result = await this.orders.transitionToState(
                    tx,
                    order.id,
                    'AddingItems',
                );
                if ('errorCode' in result)
                    throw new UserInputError(result.message);
            }
            const groups = await this.lineGroups(tx, order),
                selected: string[] = [];
            for (const id of ids) {
                if (
                    !(await this.db.findOneInChannel(
                        tx,
                        ShippingMethod,
                        identifier(id),
                        ctx.channelId,
                    ))
                )
                    throw new UserInputError('Shipping method not found');
                selected.push((await this.group(tx, id)).id);
            }
            if (
                groups.length !== selected.length ||
                new Set(selected).size !== selected.length ||
                groups.some((group) => !selected.includes(group))
            )
                throw new UserInputError(
                    'Select one delivery method for every seller',
                );
            // Only an unplaced, customer-owned cart is reset. Native 3.8's setter removes
            // the wrong suffix when reducing an existing multi-shipping selection.
            // Rebuild its draft lines atomically, then let Vendure calculate all prices,
            // taxes, discounts and line assignments through its normal setter.
            if (order.shippingLines.length > 1 || ids.length > 1) {
                await this.db
                    .getRepository(tx, OrderLine)
                    .createQueryBuilder()
                    .update()
                    .set({ shippingLineId: () => 'NULL' })
                    .where('orderId=:id', { id: order.id })
                    .execute();
                for (const line of order.shippingLines)
                    await this.db.getRepository(tx, ShippingLine).remove(line);
            }
            const result = await this.orders.setShippingMethod(
                tx,
                order.id,
                ids,
            );
            if ('errorCode' in result) throw new UserInputError(result.message);
            const error = await this.validate(tx, result);
            if (error) throw new UserInputError(error);
            return { success: true, orderId: result.id };
        });
    }

    async list(ctx: RequestContext) {
        const actor = await this.access.actor(ctx);
        const routes = await this.db
            .getRepository(ctx, MarketplaceShipping)
            .findBy({
                storeChannelId: identifier(actor.store.channelId),
                ...(actor.vendor
                    ? { vendorId: identifier(actor.vendor.id) }
                    : {}),
            });
        const items = [];
        for (const route of routes) {
            const method = await this.methods.findOne(
                actor.store,
                route.shippingMethodId,
            );
            if (!method) continue;
            const vendor = await this.db
                .getRepository(ctx, MarketplaceVendor)
                .findOneBy({ id: route.vendorId });
            items.push({
                id: method.id,
                vendorId: route.vendorId,
                seller: vendor?.name,
                governorate: route.governorate,
                name: method.name,
                description: method.description,
                rate: Number(
                    method.calculator.args.find((a) => a.name === 'rate')
                        ?.value || 0,
                ),
                version: route.version,
            });
        }
        if (!actor.vendor) {
            const native = await this.methods.findAll(actor.store, {
                take: 100,
            });
            for (const method of native.items.filter(
                (m) =>
                    m.checker.code === 'egypt-governorate' &&
                    !routes.some(
                        (row) => String(row.shippingMethodId) === String(m.id),
                    ),
            ))
                items.push({
                    id: method.id,
                    vendorId: null,
                    seller: actor.store.channel.code,
                    governorate:
                        method.checker.args.find(
                            (a) => a.name === 'governorate',
                        )?.value || '',
                    name: method.name,
                    description: method.description,
                    rate: Number(
                        method.calculator.args.find((a) => a.name === 'rate')
                            ?.value || 0,
                    ),
                    version: method.updatedAt.toISOString(),
                });
        }
        return items;
    }

    async save(ctx: RequestContext, value: unknown) {
        const actor = await this.access.actor(ctx),
            input = object(value);
        if (!actor.vendor && input.vendorId == null)
            return this.savePlatform(ctx, input);
        const vendor = await this.access.vendor(ctx, actor, input.vendorId);
        const governorate = text(input.governorate, 60, true);
        if (!egyptGovernorates.some((row) => row[0] === governorate))
            throw new UserInputError('Select an Egyptian governorate');
        const rate = integer(input.rate, 0, 100000000),
            name = text(input.name, 200, true),
            description = text(input.description, 3000);
        return this.access.write(
            ctx,
            actor,
            'save-seller-delivery',
            async (tx) => {
                await this.db.getRepository(tx, MarketplaceVendor).findOne({
                    where: { id: vendor.id },
                    lock: { mode: 'pessimistic_write' },
                });
                const row = await this.db
                    .getRepository(tx, MarketplaceShipping)
                    .findOneBy({
                        vendorId: identifier(vendor.id),
                        storeChannelId: identifier(actor.store.channelId),
                        governorate,
                    });
                if (row && input.version !== row.version)
                    throw new UserInputError(
                        'Delivery rate changed; refresh before saving',
                    );
                const target = await this.access.storeContext(
                    tx,
                    vendor.channelId,
                );
                const existing = row
                    ? await this.methods.findOne(target, row.shippingMethodId)
                    : null;
                if (existing && !actor.superAdmin) {
                    const raw = await this.db.findOneInChannel(
                        tx,
                        ShippingMethod,
                        existing.id,
                        vendor.channelId,
                        { relations: ['channels'] },
                    );
                    const allowed = new Set([
                        String(vendor.channelId),
                        String(actor.store.channelId),
                    ]);
                    if (
                        !raw ||
                        raw.channels.some(
                            (channel) =>
                                channel.code !== '__default_channel__' &&
                                !allowed.has(String(channel.id)),
                        )
                    )
                        throw new UserInputError(
                            'A SuperAdmin must separate a delivery method shared with another store',
                        );
                }
                const taxArgs =
                    existing?.calculator.args ||
                    (await this.deliveryTaxPolicy(tx, actor.store));
                const methodInput = {
                    translations: [
                        {
                            languageCode:
                                actor.store.channel.defaultLanguageCode,
                            name,
                            description,
                        },
                    ],
                    fulfillmentHandler: 'manual-fulfillment',
                    checker: {
                        code: 'marketplace-seller-governorate',
                        arguments: [
                            { name: 'vendorId', value: String(vendor.id) },
                            { name: 'governorate', value: governorate },
                        ],
                    },
                    calculator: {
                        code: 'default-shipping-calculator',
                        arguments: [
                            { name: 'rate', value: String(rate) },
                            {
                                name: 'includesTax',
                                value:
                                    taxArgs.find(
                                        (a) => a.name === 'includesTax',
                                    )?.value || 'auto',
                            },
                            {
                                name: 'taxRate',
                                value:
                                    taxArgs.find((a) => a.name === 'taxRate')
                                        ?.value || '0',
                            },
                        ],
                    },
                };
                const method = row
                    ? await this.methods.update(target, {
                          ...methodInput,
                          id: row.shippingMethodId,
                      })
                    : await this.methods.create(target, {
                          ...methodInput,
                          code: `seller-${vendor.id}-${governorate}`,
                      });
                await this.channels.assignToChannels(
                    tx,
                    ShippingMethod,
                    method.id,
                    [actor.store.channelId],
                );
                await this.db.getRepository(tx, MarketplaceShipping).save(
                    new MarketplaceShipping({
                        ...row,
                        storeChannelId: identifier(actor.store.channelId),
                        vendorId: identifier(vendor.id),
                        shippingMethodId: identifier(method.id),
                        governorate,
                        version: (row?.version || 0) + 1,
                    }),
                );
                return { id: method.id };
            },
        );
    }
    private async deliveryTaxPolicy(
        ctx: RequestContext,
        store: RequestContext,
    ) {
        const methods = await this.db
            .getRepository(ctx, ShippingMethod)
            .createQueryBuilder('method')
            .innerJoin('method.channels', 'channel', 'channel.id=:id', {
                id: store.channelId,
            })
            .where('method.deletedAt IS NULL')
            .getMany();
        const policies = methods
            .filter(
                (method) =>
                    method.checker.code !== 'marketplace-seller-governorate' &&
                    method.calculator.code === 'default-shipping-calculator',
            )
            .map((method) =>
                method.calculator.args.filter((arg) =>
                    ['includesTax', 'taxRate'].includes(arg.name),
                ),
            );
        const distinct = new Set(
            policies.map((args) => {
                const taxRate = Number(
                    args.find((arg) => arg.name === 'taxRate')?.value || 0,
                );
                const mode =
                    args.find((arg) => arg.name === 'includesTax')?.value ||
                    'auto';
                const includesTax =
                    mode === 'auto'
                        ? store.channel.pricesIncludeTax
                        : mode === 'include';
                // At zero tax, include/exclude/auto produce exactly the same charge.
                return JSON.stringify({
                    taxRate,
                    includesTax: taxRate === 0 ? null : includesTax,
                });
            }),
        );
        if (distinct.size !== 1)
            throw new UserInputError(
                'A SuperAdmin must configure a consistent store delivery tax policy before adding seller rates',
            );
        return policies[0];
    }

    private async savePlatform(
        ctx: RequestContext,
        input: Record<string, unknown>,
    ) {
        const actor = await this.access.admin(ctx),
            id = input.id ? identifier(input.id as ID) : null;
        const governorate = text(input.governorate, 60, true),
            rate = integer(input.rate, 0, 100000000);
        if (!egyptGovernorates.some((row) => row[0] === governorate))
            throw new UserInputError('Select an Egyptian governorate');
        const name = text(input.name, 200, true),
            description = text(input.description, 3000);
        return this.access.write(
            ctx,
            actor,
            'save-store-delivery',
            async (tx) => {
                const existing = id
                    ? await this.db.findOneInChannel(
                          tx,
                          ShippingMethod,
                          id,
                          actor.store.channelId,
                          { relations: ['channels'] },
                      )
                    : null;
                if (
                    id &&
                    (!existing ||
                        existing.checker.code !== 'egypt-governorate' ||
                        (await this.db
                            .getRepository(tx, MarketplaceShipping)
                            .findOneBy({ shippingMethodId: id })))
                )
                    throw new UserInputError('Delivery method not found');
                if (
                    existing &&
                    (input.version !== existing.updatedAt.toISOString() ||
                        existing.channels.some(
                            (channel) =>
                                channel.code !== '__default_channel__' &&
                                String(channel.id) !==
                                    String(actor.store.channelId),
                        ))
                )
                    throw new UserInputError(
                        'Delivery changed or belongs to another store; refresh before editing',
                    );
                const args =
                    existing?.calculator.args ||
                    (await this.deliveryTaxPolicy(tx, actor.store));
                const common = {
                    translations: [
                        {
                            languageCode:
                                actor.store.channel.defaultLanguageCode,
                            name,
                            description,
                        },
                    ],
                    fulfillmentHandler: 'manual-fulfillment',
                    checker: {
                        code: 'egypt-governorate',
                        arguments: [
                            { name: 'governorate', value: governorate },
                        ],
                    },
                    calculator: {
                        code: 'default-shipping-calculator',
                        arguments: [
                            { name: 'rate', value: String(rate) },
                            {
                                name: 'includesTax',
                                value:
                                    args.find((a) => a.name === 'includesTax')
                                        ?.value || 'auto',
                            },
                            {
                                name: 'taxRate',
                                value:
                                    args.find((a) => a.name === 'taxRate')
                                        ?.value || '0',
                            },
                        ],
                    },
                };
                const method = existing
                    ? await this.methods.update(tx, {
                          ...common,
                          id: existing.id,
                      })
                    : await this.methods.create(tx, {
                          ...common,
                          code: `store-${actor.store.channelId}-${governorate}`,
                      });
                return { id: method.id };
            },
        );
    }
}
