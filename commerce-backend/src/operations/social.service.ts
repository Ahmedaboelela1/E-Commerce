import {Injectable} from '@nestjs/common';
import {
    Customer,
    ID,
    Order,
    Product,
    ProductService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import {OrderOperationsService} from './order-operations.service';
import {ProductReview, WishlistItem} from './entities';
import {identifier, integer, text} from './rules';

@Injectable()
export class ShopSocialService {
    constructor(
        private db: TransactionalConnection,
        private ops: OrderOperationsService,
        private products: ProductService,
    ) {}

    private async product(ctx: RequestContext, productId: ID) {
        const product = await this.db.findOneInChannel(
            ctx,
            Product,
            identifier(productId),
            ctx.channelId,
            {relations: ['featuredAsset']},
        );
        if (!product?.enabled || product.deletedAt)
            throw new UserInputError('Product not found');
        return product;
    }

    async wishlistIds(ctx: RequestContext) {
        const customer = await this.ops.customer(ctx);
        const rows = await this.db
            .getRepository(ctx, WishlistItem)
            .findBy({
                channelId: identifier(ctx.channelId),
                customerId: identifier(customer.id),
            });
        return rows.map((row) => String(row.productId));
    }

    async wishlist(ctx: RequestContext) {
        const ids = await this.wishlistIds(ctx);
        const result: Product[] = [];
        for (const id of ids) {
            const product = await this.products.findOne(ctx, id, [
                'featuredAsset',
            ]);
            if (product?.enabled && !product.deletedAt) result.push(product);
        }
        return result;
    }

    async toggleWishlist(ctx: RequestContext, productId: ID) {
        const customer = await this.ops.customer(ctx);
        await this.product(ctx, productId);
        return this.db.withTransaction(ctx, async (tx) => {
            await this.db
                .getRepository(tx, Customer)
                .createQueryBuilder('c')
                .where('c.id=:id', {id: customer.id})
                .setLock('pessimistic_write')
                .getOneOrFail();
            const result = await this.toggleWishlistLocked(
                tx,
                productId,
                customer.id,
            );
            return result;
        });
    }

    private async toggleWishlistLocked(
        ctx: RequestContext,
        productId: ID,
        customerId: ID,
    ) {
        const repo = this.db.getRepository(ctx, WishlistItem);
        const key = {
            channelId: identifier(ctx.channelId),
            customerId: identifier(customerId),
            productId: identifier(productId),
        };
        const existing = await repo.findOneBy(key);
        if (existing) await repo.remove(existing);
        else {
            if (
                (await repo.countBy({
                    channelId: key.channelId,
                    customerId: key.customerId,
                })) >= 200
            )
                throw new UserInputError('The wishlist limit is 200 products');
            await repo.save(new WishlistItem(key));
        }
        return this.wishlistIds(ctx);
    }

    private async deliveredPurchase(
        ctx: RequestContext,
        productId: ID,
        customerId: ID,
    ): Promise<boolean> {
        return (
            (await this.db
                .getRepository(ctx, Order)
                .createQueryBuilder('o')
                .innerJoin('o.channels', 'channel')
                .innerJoin('o.lines', 'line')
                .innerJoin('line.productVariant', 'variant')
                .where('channel.id = :channel', {channel: ctx.channelId})
                .andWhere('o.customerId = :customer', {customer: customerId})
                .andWhere('o.state = :state', {state: 'Delivered'})
                .andWhere('variant.productId = :product', {
                    product: identifier(productId),
                })
                .getCount()) > 0
        );
    }

    async publicReviews(
        ctx: RequestContext,
        productId: ID,
        skip = 0,
        take = 10,
    ) {
        await this.product(ctx, productId);
        const key = {
            channelId: identifier(ctx.channelId),
            productId: identifier(productId),
            status: 'approved',
        };
        const repo = this.db.getRepository(ctx, ProductReview);
        const [rows, total] = await repo.findAndCount({
            where: key,
            order: {createdAt: 'DESC'},
            skip: integer(skip, 0, 10000),
            take: integer(take, 1, 50),
        });
        const aggregate = await repo
            .createQueryBuilder('r')
            .select('AVG(r.rating)', 'average')
            .where('r.channelId = :channel', {channel: ctx.channelId})
            .andWhere('r.productId = :product', {product: productId})
            .andWhere('r.status = :status', {status: 'approved'})
            .getRawOne();
        return {
            items: rows.map((row) => ({
                id: row.id,
                rating: row.rating,
                text: row.text,
                author: row.authorName,
                createdAt: row.createdAt,
                verifiedPurchase: true,
            })),
            total,
            average: Number(aggregate?.average || 0),
        };
    }

    async myReview(ctx: RequestContext, productId: ID) {
        const customer = await this.ops.customer(ctx);
        await this.product(ctx, productId);
        const row = await this.db
            .getRepository(ctx, ProductReview)
            .findOneBy({
                channelId: identifier(ctx.channelId),
                customerId: identifier(customer.id),
                productId: identifier(productId),
            });
        return {
            review: row
                ? {
                      id: row.id,
                      rating: row.rating,
                      text: row.text,
                      status: row.status,
                  }
                : null,
            eligible: await this.deliveredPurchase(ctx, productId, customer.id),
        };
    }

    async submitReview(
        ctx: RequestContext,
        productId: ID,
        rating: number,
        reviewText: string,
    ) {
        const customer = await this.ops.customer(ctx);
        await this.product(ctx, productId);
        if (!(await this.deliveredPurchase(ctx, productId, customer.id)))
            throw new UserInputError(
                'Reviews are available after a delivered purchase',
            );
        await this.db
            .getRepository(ctx, Customer)
            .createQueryBuilder('c')
            .where('c.id=:id', {id: customer.id})
            .setLock('pessimistic_write')
            .getOneOrFail();
        const repo = this.db.getRepository(ctx, ProductReview);
        const key = {
            channelId: identifier(ctx.channelId),
            customerId: identifier(customer.id),
            productId: identifier(productId),
        };
        const row =
            (await repo
                .createQueryBuilder('r')
                .where(
                    'r.channelId=:channelId AND r.customerId=:customerId AND r.productId=:productId',
                    key,
                )
                .setLock('pessimistic_write')
                .getOne()) || new ProductReview(key);
        Object.assign(row, {
            rating: integer(rating, 1, 5),
            text: text(reviewText, 2000, true),
            status: 'pending',
            moderatedByUserId: null,
            version: (row.version || 0) + 1,
            authorName:
                `${customer.firstName.trim().slice(0, 60)} ${customer.lastName.trim().slice(0, 1)}.`.trim(),
        });
        await repo.save(row);
        return this.myReview(ctx, productId);
    }

    async adminReviews(ctx: RequestContext, status = 'pending', skip = 0) {
        if (!['pending', 'approved', 'rejected'].includes(status))
            throw new UserInputError('Invalid review status');
        const [items, total] = await this.db
            .getRepository(ctx, ProductReview)
            .findAndCount({
                where: {channelId: identifier(ctx.channelId), status},
                order: {updatedAt: 'DESC'},
                take: 30,
                skip: integer(skip, 0, 10000),
            });
        return {items, total};
    }

    async moderate(
        ctx: RequestContext,
        reviewId: ID,
        status: string,
        version: number,
    ) {
        if (!['approved', 'rejected'].includes(status))
            throw new UserInputError('Choose approve or reject');
        const repo = this.db.getRepository(ctx, ProductReview);
        const row = await repo.findOneBy({
            id: identifier(reviewId),
            channelId: identifier(ctx.channelId),
        });
        if (!row) throw new UserInputError('Review not found');
        const updated = await repo.update(
            {
                id: row.id,
                channelId: identifier(ctx.channelId),
                version: integer(version, 1, 1000000),
            },
            {
                status,
                moderatedByUserId: identifier(ctx.activeUserId!),
                version: version + 1,
            },
        );
        if (!updated.affected)
            throw new UserInputError(
                'The review changed. Reload before moderating.',
            );
        return repo.findOneByOrFail({id: row.id});
    }
}
