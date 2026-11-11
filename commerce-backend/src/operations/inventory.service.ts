import {
    Injectable,
    OnApplicationBootstrap,
    OnModuleDestroy,
} from '@nestjs/common';
import {
    Channel,
    EventBus,
    ID,
    Logger,
    ProductVariant,
    ProductVariantService,
    RequestContext,
    RequestContextService,
    StockLevelService,
    StockMovementEvent,
    TransactionalConnection,
    GlobalSettingsService,
} from '@vendure/core';
import {Subscription} from 'rxjs';
import {LowStockNotice, MerchantSettings} from './entities';
import {LowStockAlertEvent} from './events';
import {OrderOperationsService} from './order-operations.service';
import {identifier, integer} from './rules';

@Injectable()
export class ShopInventoryService
    implements OnApplicationBootstrap, OnModuleDestroy
{
    private subscription?: Subscription;
    constructor(
        private db: TransactionalConnection,
        private variants: ProductVariantService,
        private stock: StockLevelService,
        private ops: OrderOperationsService,
        private events: EventBus,
        private contexts: RequestContextService,
        private globals: GlobalSettingsService,
    ) {}

    onApplicationBootstrap() {
        this.subscription = this.events
            .ofType(StockMovementEvent)
            .subscribe((event) => {
                void this.changed(event).catch((error) =>
                    Logger.error(
                        'Low stock check failed: ' + String(error),
                        'ShopOperations',
                    ),
                );
            });
    }
    onModuleDestroy() {
        this.subscription?.unsubscribe();
    }

    private async changed(event: StockMovementEvent) {
        const ids = [
            ...new Set(
                event.stockMovements.map((m) => String(m.productVariant.id)),
            ),
        ];
        for (const id of ids) {
            const variant = await this.db
                .getRepository(event.ctx, ProductVariant)
                .findOne({
                    where: {id: identifier(id)},
                    relations: ['channels'],
                });
            for (const channel of variant?.channels || []) {
                const ctx = await this.contexts.create({
                    apiType: 'admin',
                    channelOrToken: channel,
                });
                const settings = await this.ops.settings(ctx);
                if (settings.lowStockEnabled)
                    await this.inspect(ctx, id, settings, true);
            }
        }
    }

    private async inspect(
        ctx: RequestContext,
        id: ID,
        settings: MerchantSettings,
        notify: boolean,
    ) {
        const variant = await this.variants.findOne(ctx, id);
        if (!variant || variant.deletedAt) return null;
        const levels = await this.stock.getAvailableStock(ctx, id);
        const available = levels.stockOnHand - levels.stockAllocated;
        const tracked =
            variant.trackInventory === 'TRUE' ||
            (variant.trackInventory === 'INHERIT' &&
                (await this.globals.getSettings(ctx)).trackInventory);
        const low = tracked && available <= settings.lowStockThreshold;
        if (
            notify &&
            settings.lowStockEnabled &&
            settings.notificationEmail &&
            process.env.EMAIL_ENABLED === 'true'
        ) {
            const repo = this.db.getRepository(ctx, LowStockNotice);
            const key = {
                channelId: identifier(ctx.channelId),
                variantId: identifier(id),
            };
            let notice = await repo.findOneBy(key);
            if (!notice) {
                try {
                    notice = await repo.save(
                        new LowStockNotice({...key, alerted: false}),
                    );
                } catch {
                    notice = await repo.findOneBy(key);
                }
            }
            if (notice) {
                if (!low) await repo.update(notice.id, {alerted: false});
                else {
                    const claimed = await repo.update(
                        {id: notice.id, alerted: false},
                        {alerted: true},
                    );
                    if (claimed.affected) {
                        try {
                            await this.events.publish(
                                new LowStockAlertEvent(
                                    ctx,
                                    settings.notificationEmail,
                                    variant.sku,
                                    available,
                                    settings.lowStockThreshold,
                                ),
                            );
                        } catch (error) {
                            await repo.update(notice.id, {alerted: false});
                            throw error;
                        }
                    }
                }
            }
        }
        return {
            id: variant.id,
            sku: variant.sku,
            name: variant.name,
            available,
            onHand: levels.stockOnHand,
            allocated: levels.stockAllocated,
            low,
            tracked,
            threshold: settings.lowStockThreshold,
        };
    }

    async inventory(ctx: RequestContext, skip = 0) {
        const settings = await this.ops.settings(ctx);
        const variants = await this.variants.findAll(ctx, {
            skip: integer(skip, 0, 100000),
            take: 50,
            sort: {sku: 'ASC'},
        });
        const items = await Promise.all(
            variants.items.map((v) => this.inspect(ctx, v.id, settings, false)),
        );
        return {
            items: items.filter(Boolean),
            total: variants.totalItems,
            alertsEnabled: settings.lowStockEnabled,
        };
    }

    async scan(ctx: RequestContext) {
        const settings = await this.ops.settings(ctx);
        let skip = 0,
            total = 0;
        do {
            const page = await this.variants.findAll(ctx, {skip, take: 100});
            total = page.totalItems;
            for (const variant of page.items)
                await this.inspect(ctx, variant.id, settings, true);
            skip += page.items.length;
            if (!page.items.length) break;
        } while (skip < total);
        return {scanned: skip, alertsEnabled: settings.lowStockEnabled};
    }

    async scheduledScan() {
        await this.ops.cleanupReceipts();
        const settings = await this.db.rawConnection
            .getRepository(MerchantSettings)
            .findBy({lowStockEnabled: true});
        for (const row of settings) {
            const channel = await this.db.rawConnection
                .getRepository(Channel)
                .findOneBy({id: row.channelId});
            if (channel)
                await this.scan(
                    await this.contexts.create({
                        apiType: 'admin',
                        channelOrToken: channel,
                    }),
                );
        }
    }
}
