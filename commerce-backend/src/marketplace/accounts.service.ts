import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
    Administrator,
    AdministratorEvent,
    EventBus,
    ChannelService,
    Permission,
    RequestContext,
    UserService,
    User,
    Product,
    ProductService,
    StockLocation,
    Channel,
    Role,
    RoleEvent,
    SellerService,
    StockLocationService,
    UserInputError,
} from '@vendure/core';
import { MarketplaceAccessService } from './access.service';
import { MarketplaceVendor } from './entities';
import { ManageStore, SellOwnProducts } from './permissions';
import { identifier, text } from '../operations/rules';
import { object } from '../growth/common';

@Injectable()
export class MarketplaceAccountsService {
    constructor(
        private access: MarketplaceAccessService,
        private users: UserService,
        private events: EventBus,
        private products: ProductService,
        private sellers: SellerService,
        private channels: ChannelService,
        private locations: StockLocationService,
    ) {}

    async create(
        ctx: RequestContext,
        value: unknown,
        kind: 'admin' | 'seller',
    ) {
        const actor = await this.access.admin(ctx),
            input = object(value);
        if (kind === 'admin' && !actor.superAdmin)
            throw new UserInputError(
                'Only a SuperAdmin may create store administrators',
            );
        const name = text(input.name, 200, true),
            email = text(input.email, 200, true).toLowerCase();
        const password = input.password;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
            throw new UserInputError('Enter a valid email');
        if (
            typeof password !== 'string' ||
            password.length < 12 ||
            password.length > 200
        )
            throw new UserInputError('Use a password of 12–200 characters');
        const code = text(input.code, 60, kind === 'seller');
        if (kind === 'seller' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code))
            throw new UserInputError(
                'Seller code must contain lowercase letters, numbers and hyphens',
            );
        await this.access.unusedEmail(ctx, email);
        return this.access.write(ctx, actor, `create-${kind}`, async (tx) => {
            // Serialize custom account provisioning across stores before checking identity.
            await this.access.db.getRepository(tx, Channel).findOne({
                where: { code: '__default_channel__' },
                lock: { mode: 'pessimistic_write' },
            });
            await this.access.unusedEmail(tx, email);
            if (kind === 'admin') {
                const roleCode =
                    actor.store.channel.code === 'skillverse-eg'
                        ? 'admin'
                        : `admin-${actor.store.channelId}`;
                let role = await this.access.db
                    .getRepository(tx, Role)
                    .findOne({
                        where: { code: roleCode },
                        relations: ['channels'],
                    });
                if (
                    role &&
                    (role.permissions.filter(
                        (p) => p !== Permission.Authenticated,
                    ).length !== 1 ||
                        !role.permissions.includes(ManageStore.Permission) ||
                        role.channels.length !== 1 ||
                        String(role.channels[0].id) !==
                            String(actor.store.channelId))
                )
                    throw new UserInputError(
                        'The admin role name is already used by another permission policy',
                    );
                role ??= await this.createRole(tx, {
                    code: roleCode,
                    description: `Store admin — ${actor.store.channel.code}`,
                    permissions: [ManageStore.Permission],
                    channelIds: [actor.store.channelId],
                });
                const admin = await this.createAdministrator(tx, {
                    emailAddress: email,
                    firstName: name,
                    lastName: '',
                    password,
                    roleIds: [role.id],
                });
                return {
                    id: admin.id,
                    email: admin.emailAddress,
                    role: 'admin',
                    store: actor.store.channel.code,
                };
            }
            const existing = await this.access.db
                .getRepository(tx, MarketplaceVendor)
                .findOneBy({
                    storeChannelId: identifier(actor.store.channelId),
                    code,
                });
            if (existing)
                throw new UserInputError(
                    'Seller code is already used in this store',
                );
            const seller = await this.sellers.create(tx, { name });
            const store = actor.store.channel;
            const child = await this.channels.create(tx, {
                code: `seller-${store.id}-${code}`,
                token: randomBytes(24).toString('hex'),
                sellerId: seller.id,
                defaultLanguageCode: store.defaultLanguageCode,
                availableLanguageCodes: store.availableLanguageCodes,
                pricesIncludeTax: store.pricesIncludeTax,
                defaultCurrencyCode: store.defaultCurrencyCode,
                availableCurrencyCodes: store.availableCurrencyCodes,
                defaultTaxZoneId: store.defaultTaxZone.id,
                defaultShippingZoneId: store.defaultShippingZone.id,
                trackInventory: true,
                outOfStockThreshold: 0,
            });
            if ('errorCode' in child) throw new UserInputError(child.message);
            const location = await this.locations.create(tx, {
                name: `${name} — ${store.code} seller stock`,
                description: 'Seller-owned inventory',
            });
            await this.channels.assignToChannels(
                tx,
                StockLocation,
                location.id,
                [child.id],
            );
            await this.channels.assignToChannels(
                tx,
                StockLocation,
                location.id,
                [store.id],
            );
            const role = await this.createRole(tx, {
                code: `seller-${child.id}`,
                description: `Seller — ${name}`,
                permissions: [SellOwnProducts.Permission],
                channelIds: [child.id],
            });
            const admin = await this.createAdministrator(tx, {
                emailAddress: email,
                firstName: name,
                lastName: '',
                password,
                roleIds: [role.id],
            });
            const vendor = await this.access.db
                .getRepository(tx, MarketplaceVendor)
                .save(
                    new MarketplaceVendor({
                        storeChannelId: identifier(store.id),
                        channelId: identifier(child.id),
                        sellerId: identifier(seller.id),
                        stockLocationId: identifier(location.id),
                        userId: identifier(admin.user.id),
                        name,
                        code,
                        active: true,
                        version: 1,
                    }),
                );
            return {
                id: vendor.id,
                name,
                code,
                email,
                channel: child.code,
                role: 'seller',
            };
        });
    }

    // Exact, server-owned role policies only. The native administrative create APIs
    // require grant privileges on every child channel; delegated operators deliberately
    // hold none. Never accept permissions, role IDs or channels from the request.
    private async createRole(
        tx: RequestContext,
        input: {
            code: string;
            description: string;
            permissions: Permission[];
            channelIds: import('@vendure/core').ID[];
        },
    ) {
        const channels = [];
        for (const id of input.channelIds)
            channels.push((await this.access.storeContext(tx, id)).channel);
        const role = await this.access.db.getRepository(tx, Role).save(
            new Role({
                code: input.code,
                description: input.description,
                permissions: [Permission.Authenticated, ...input.permissions],
                channels,
            }),
        );
        await this.events.publish(new RoleEvent(tx, role, 'created'));
        return role;
    }
    private async createAdministrator(
        tx: RequestContext,
        input: {
            emailAddress: string;
            firstName: string;
            lastName: string;
            password: string;
            roleIds: import('@vendure/core').ID[];
        },
    ) {
        const user = await this.users.createAdminUser(
            tx,
            input.emailAddress,
            input.password,
        );
        user.roles = [];
        for (const id of input.roleIds)
            user.roles.push(
                await this.access.db
                    .getRepository(tx, Role)
                    .findOneByOrFail({ id }),
            );
        await this.access.db.getRepository(tx, User).save(user);
        const admin = await this.access.db
            .getRepository(tx, Administrator)
            .save(
                new Administrator({
                    emailAddress: input.emailAddress,
                    firstName: input.firstName,
                    lastName: input.lastName,
                    user,
                }),
            );
        await this.events.publish(new AdministratorEvent(tx, admin, 'created'));
        return admin;
    }
    async setActive(ctx: RequestContext, value: unknown) {
        const actor = await this.access.admin(ctx),
            input = object(value),
            vendor = await this.access.vendor(ctx, actor, input.id);
        if (typeof input.active !== 'boolean')
            throw new UserInputError('Choose an account status');
        const active = input.active;
        return this.access.write(
            ctx,
            actor,
            'change-seller-status',
            async (tx) => {
                const fresh = await this.access.db
                    .getRepository(tx, MarketplaceVendor)
                    .findOne({
                        where: { id: vendor.id },
                        lock: { mode: 'pessimistic_write' },
                    });
                if (!fresh || input.version !== fresh.version)
                    throw new UserInputError('Seller changed; refresh first');
                if (!input.active) {
                    const products = await this.access.db
                        .getRepository(tx, Product)
                        .findBy({
                            customFields: {
                                marketplaceOwnerId: identifier(vendor.id),
                            },
                        });
                    for (const product of products) {
                        await this.access.product(tx, actor, product.id, true);
                        await this.products.update(tx, {
                            id: product.id,
                            enabled: false,
                        });
                    }
                }
                fresh.active = active;
                fresh.version++;
                await this.access.db
                    .getRepository(tx, MarketplaceVendor)
                    .save(fresh);
                return { id: fresh.id, active: fresh.active };
            },
        );
    }

    async vendors(ctx: RequestContext) {
        const actor = await this.access.actor(ctx);
        if (actor.kind === 'seller')
            return [
                {
                    id: actor.vendor!.id,
                    name: actor.vendor!.name,
                    code: actor.vendor!.code,
                    active: true,
                    version: actor.vendor!.version,
                },
            ];
        return this.access.db.getRepository(ctx, MarketplaceVendor).find({
            where: { storeChannelId: identifier(actor.store.channelId) },
            select: {
                id: true,
                name: true,
                code: true,
                active: true,
                version: true,
            },
            order: { id: 'ASC' },
        });
    }
}
