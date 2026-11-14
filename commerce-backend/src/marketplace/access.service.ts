import { Injectable } from '@nestjs/common';
import {
    Channel,
    ID,
    Permission,
    RequestContext,
    TransactionalConnection,
    UserInputError,
    Product,
    Administrator,
    User,
} from '@vendure/core';
import { ManageStore, SellOwnProducts } from './permissions';
import { MarketplaceVendor, MarketplaceAudit } from './entities';
import { identifier } from '../operations/rules';

export type StoreActor = {
    kind: 'admin' | 'seller';
    store: RequestContext;
    vendor: MarketplaceVendor | null;
    superAdmin: boolean;
};

@Injectable()
export class MarketplaceAccessService {
    constructor(readonly db: TransactionalConnection) {}

    async actor(ctx: RequestContext): Promise<StoreActor> {
        if (ctx.apiType !== 'admin' || !ctx.activeUserId)
            throw new UserInputError('Sign in to the administration dashboard');
        const superAdmin = ctx.userHasPermissions([Permission.SuperAdmin]);
        const vendor = await this.db
            .getRepository(ctx, MarketplaceVendor)
            .findOneBy({ channelId: identifier(ctx.channelId) });
        if (superAdmin || ctx.userHasPermissions([ManageStore.Permission])) {
            const store = vendor
                ? await this.storeContext(ctx, vendor.storeChannelId)
                : ctx;
            if (store.channel.code === '__default_channel__')
                throw new UserInputError(
                    'Select the actual store channel, not the global default channel',
                );
            return { kind: 'admin', store, vendor: null, superAdmin };
        }
        if (
            !ctx.userHasPermissions([SellOwnProducts.Permission]) ||
            !vendor ||
            !vendor.active ||
            String(vendor.userId) !== String(ctx.activeUserId)
        )
            throw new UserInputError(
                'No active seller is assigned to this store account',
            );
        return {
            kind: 'seller',
            store: await this.storeContext(ctx, vendor.storeChannelId),
            vendor,
            superAdmin: false,
        };
    }

    async admin(ctx: RequestContext) {
        const actor = await this.actor(ctx);
        if (actor.kind !== 'admin')
            throw new UserInputError('Store administrator access is required');
        return actor;
    }

    async storeContext(ctx: RequestContext, id: ID) {
        const channel = await this.db.getRepository(ctx, Channel).findOne({
            where: { id },
            relations: ['defaultTaxZone', 'defaultShippingZone'],
        });
        if (!channel) throw new UserInputError('Store not found');
        return ctx.copy(channel);
    }

    async vendor(ctx: RequestContext, actor: StoreActor, id: unknown) {
        if (actor.kind === 'seller') {
            if (id != null && String(id) !== String(actor.vendor!.id))
                throw new UserInputError('Seller not found');
            return actor.vendor!;
        }
        const vendor = await this.db
            .getRepository(ctx, MarketplaceVendor)
            .findOneBy({
                id: identifier(id as ID),
                storeChannelId: identifier(actor.store.channelId),
            });
        if (!vendor) throw new UserInputError('Seller not found');
        return vendor;
    }

    async product(
        ctx: RequestContext,
        actor: StoreActor,
        id: ID,
        write = false,
    ) {
        const product = await this.db.findOneInChannel(
            ctx,
            Product,
            identifier(id),
            actor.store.channelId,
            {
                relations: [
                    'channels',
                    'variants',
                    'variants.stockLevels',
                    'assets',
                    'featuredAsset',
                    'translations',
                ],
            },
        );
        if (!product || product.deletedAt)
            throw new UserInputError('Product not found');
        const owner = product.customFields.marketplaceOwnerId;
        if (
            actor.kind === 'seller' &&
            String(owner) !== String(actor.vendor!.id)
        )
            throw new UserInputError('Product not found');
        if (owner) {
            const vendor = await this.vendor(
                ctx,
                { ...actor, kind: 'admin' },
                owner,
            );
            if (vendor.storeChannelId !== identifier(actor.store.channelId))
                throw new UserInputError('Product not found');
        }
        if (write && !actor.superAdmin) {
            const allowed = new Set([
                String(actor.store.channelId),
                ...(owner
                    ? [
                          String(
                              (
                                  await this.vendor(
                                      ctx,
                                      { ...actor, kind: 'admin' },
                                      owner,
                                  )
                              ).channelId,
                          ),
                      ]
                    : []),
            ]);
            if (
                product.channels.some(
                    (channel) =>
                        channel.code !== '__default_channel__' &&
                        !allowed.has(String(channel.id)),
                )
            )
                throw new UserInputError(
                    'This product is shared with another store. A SuperAdmin must separate its ownership before editing.',
                );
        }
        return product;
    }

    async unusedEmail(ctx: RequestContext, email: string) {
        const exists = await this.db
            .getRepository(ctx, User)
            .findOneBy({ identifier: email });
        const admin = await this.db
            .getRepository(ctx, Administrator)
            .findOneBy({ emailAddress: email });
        if (exists || admin)
            throw new UserInputError(
                'That email already has an account; use a new email rather than changing existing privileges',
            );
    }

    // Delegated accounts have no native CRUD permissions. Callers first validate the
    // actor and record ownership, then use this non-exported server capability.
    async write<T>(
        caller: RequestContext,
        actor: StoreActor,
        action: string,
        work: (tx: RequestContext) => Promise<T>,
    ) {
        const system = new RequestContext({
            apiType: 'admin',
            channel: actor.store.channel,
            languageCode: caller.languageCode,
            currencyCode: actor.store.currencyCode,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
        return this.db.withTransaction(system, async (tx) => {
            if (actor.vendor) {
                const vendor = await this.db
                    .getRepository(tx, MarketplaceVendor)
                    .findOne({
                        where: { id: actor.vendor.id },
                        lock: { mode: 'pessimistic_write' },
                    });
                if (
                    !vendor?.active ||
                    vendor.userId !== identifier(caller.activeUserId!)
                )
                    throw new UserInputError('Seller access is disabled');
            }
            const result = await work(tx);
            const resultId =
                typeof result === 'number'
                    ? result
                    : result && typeof result === 'object' && 'id' in result
                      ? Number(result.id)
                      : null;
            await this.db.getRepository(tx, MarketplaceAudit).save(
                new MarketplaceAudit({
                    storeChannelId: identifier(actor.store.channelId),
                    actorUserId: identifier(caller.activeUserId!),
                    action,
                    entityId:
                        resultId && Number.isSafeInteger(resultId)
                            ? resultId
                            : null,
                }),
            );
            return result;
        });
    }
}
