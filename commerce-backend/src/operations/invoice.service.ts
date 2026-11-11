import {Injectable} from '@nestjs/common';
import {
    ID,
    ProductVariantService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import PDFDocument from 'pdfkit';
import path from 'node:path';
import bidiFactory from 'bidi-js';
import {OrderInvoice} from './entities';
import {OrderOperationsService} from './order-operations.service';
import {identifier} from './rules';

interface InvoiceSnapshot {
    number: string;
    issuedAt: string;
    orderCode: string;
    sellerName: string;
    sellerAddress: string;
    sellerTaxId: string;
    customerName: string;
    customerAddress: string;
    currency: string;
    lines: Array<{name: string; sku: string; quantity: number; total: number}>;
    itemsTotal: number;
    shipping: number;
    tax: number;
    total: number;
}

const bidi = bidiFactory();
// PDFKit/fontkit shapes each Arabic word, but does not reorder words in a line.
// Resolve their visual order without reversing the letters that fontkit shapes.
function visualWords(line: string): string {
    if (!/[\u0590-\u08ff]/.test(line)) return line;
    const tokens = line.match(/\S+|\s+/g) || [];
    const tokenAt: number[] = [];
    for (let i = 0; i < tokens.length; i++)
        for (let j = 0; j < tokens[i].length; j++) tokenAt.push(i);
    const seen = new Set<number>();
    const ordered: string[] = [];
    for (const position of bidi.getReorderedIndices(
        line,
        bidi.getEmbeddingLevels(line),
    )) {
        const token = tokenAt[position];
        if (!seen.has(token)) {
            seen.add(token);
            ordered.push(tokens[token]);
        }
    }
    return ordered.join('');
}

function paragraph(
    doc: PDFKit.PDFDocument,
    value: string,
    width = 505,
    x = 45,
    align: 'left' | 'right' = 'left',
) {
    for (const block of String(value).split('\n')) {
        const words = block.split(/\s+/);
        let line = '';
        const draw = () => {
            if (doc.y + doc.currentLineHeight(true) > doc.page.height - 55)
                doc.addPage();
            const y = doc.y;
            const visual = visualWords(line);
            const parts = visual.match(/\S+|\s+/g) || [];
            const measured = parts.reduce(
                (sum, part) => sum + doc.widthOfString(part),
                0,
            );
            let cursor = align === 'right' ? x + width - measured : x;
            for (const part of parts) {
                if (part.trim()) doc.text(part, cursor, y, {lineBreak: false});
                cursor += doc.widthOfString(part);
            }
            doc.y = y + doc.currentLineHeight(true);
            doc.x = x;
        };
        for (const word of words) {
            const next = line ? line + ' ' + word : word;
            if (line && doc.widthOfString(next) > width) {
                draw();
                line = word;
            } else line = next;
        }
        draw();
    }
}

export async function renderInvoice(
    snapshot: InvoiceSnapshot,
    cancelled: boolean,
): Promise<Buffer> {
    const doc = new PDFDocument({
        size: 'A4',
        margin: 45,
        info: {
            Title: `Order invoice ${snapshot.number}`,
            Author: snapshot.sellerName,
        },
    });
    const buffers: Buffer[] = [];
    const result = new Promise<Buffer>((resolve, reject) => {
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);
    });
    doc.font(path.join(__dirname, 'assets', 'DejaVuSans.ttf'));
    const money = (amount: number) =>
        `${snapshot.currency} ${(amount / 100).toFixed(2)}`;
    doc.fillColor('#087e55')
        .fontSize(21)
        .text('ORDER INVOICE')
        .fillColor('#172738')
        .fontSize(11);
    doc.text(snapshot.number).text(
        new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Africa/Cairo',
            dateStyle: 'medium',
        }).format(new Date(snapshot.issuedAt)),
    );
    doc.moveDown().fontSize(13);
    paragraph(doc, snapshot.sellerName);
    doc.fontSize(10);
    paragraph(doc, snapshot.sellerAddress);
    if (snapshot.sellerTaxId)
        doc.text(`Tax registration: ${snapshot.sellerTaxId}`);
    doc.moveDown().text(`Order: ${snapshot.orderCode}`);
    paragraph(doc, snapshot.customerName);
    paragraph(doc, snapshot.customerAddress);
    if (cancelled)
        doc.moveDown()
            .fillColor('#b91c1c')
            .text('CANCELLED ORDER')
            .fillColor('#172738');
    doc.moveDown();
    for (const line of snapshot.lines) {
        const height = Math.max(
            40,
            doc.heightOfString(`${line.name}\n${line.sku}`, {width: 305}) + 15,
        );
        if (doc.y + height > doc.page.height - 130) doc.addPage();
        const y = doc.y;
        doc.fontSize(10);
        paragraph(doc, `${line.name}\n${line.sku}`, 305);
        doc.text(`Qty ${line.quantity}`, 355, y, {width: 65});
        doc.text(money(line.total), 425, y, {width: 125, align: 'right'});
        doc.y = y + height;
        doc.x = 45;
        doc.moveTo(45, doc.y - 7)
            .lineTo(550, doc.y - 7)
            .strokeColor('#dbe6df')
            .stroke();
    }
    if (doc.y > doc.page.height - 190) doc.addPage();
    doc.x = 45;
    doc.moveDown()
        .fontSize(11)
        .text(`Items (discounts included): ${money(snapshot.itemsTotal)}`, {
            width: 505,
            align: 'right',
        })
        .text(`Shipping: ${money(snapshot.shipping)}`, {
            width: 505,
            align: 'right',
        })
        .text(`Tax included in total: ${money(snapshot.tax)}`, {
            width: 505,
            align: 'right',
        })
        .fontSize(15)
        .text(`TOTAL: ${money(snapshot.total)}`, {width: 505, align: 'right'});
    doc.moveDown()
        .fontSize(9)
        .fillColor('#526473')
        .text(
            'This is an order invoice, not proof of payment. Payment receipt is verified separately by staff.',
            {width: 505},
        );
    paragraph(
        doc,
        'هذه فاتورة طلب وليست تأكيدًا لاستلام المبلغ.',
        505,
        45,
        'right',
    );
    doc.end();
    return result;
}

@Injectable()
export class ShopInvoiceService {
    constructor(
        private db: TransactionalConnection,
        private ops: OrderOperationsService,
        private variants: ProductVariantService,
    ) {}

    async download(ctx: RequestContext, orderId: ID, owner: boolean) {
        const order = await this.ops.loadOrder(ctx, orderId, owner);
        const key = {
            channelId: identifier(ctx.channelId),
            orderId: identifier(orderId),
        };
        let invoice = await this.db
            .getRepository(ctx, OrderInvoice)
            .findOneBy(key);
        if (!invoice) {
            if (order.state === 'Cancelled')
                throw new UserInputError(
                    'Cannot issue a new invoice for a cancelled order',
                );
            const settings = await this.ops.settings(ctx);
            if (!settings.sellerName || !settings.sellerAddress)
                throw new UserInputError(
                    'Seller invoice details are not configured',
                );
            const number = `${settings.invoicePrefix}-${new Date().getFullYear()}-${ctx.channelId}-${order.id}`;
            const snapshot: InvoiceSnapshot = {
                number,
                issuedAt: new Date().toISOString(),
                orderCode: order.code,
                sellerName: settings.sellerName,
                sellerAddress: settings.sellerAddress,
                sellerTaxId: settings.sellerTaxId,
                customerName:
                    order.shippingAddress?.fullName ||
                    `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`,
                customerAddress: [
                    order.shippingAddress?.streetLine1,
                    order.shippingAddress?.streetLine2,
                    order.shippingAddress?.city,
                    order.shippingAddress?.province,
                    order.shippingAddress?.country,
                ]
                    .filter(Boolean)
                    .join(', '),
                currency: order.currencyCode,
                lines: await Promise.all(
                    order.lines.map(async (line) => ({
                        name:
                            (
                                await this.variants.findOne(
                                    ctx,
                                    line.productVariant.id,
                                )
                            )?.name || line.productVariant.sku,
                        sku: line.productVariant.sku,
                        quantity: line.quantity,
                        total: line.proratedLinePriceWithTax,
                    })),
                ),
                itemsTotal: order.totalWithTax - order.shippingWithTax,
                shipping: order.shippingWithTax,
                tax: order.totalWithTax - order.total,
                total: order.totalWithTax,
            };
            try {
                invoice = await this.db
                    .getRepository(ctx, OrderInvoice)
                    .save(
                        new OrderInvoice({
                            ...key,
                            number,
                            snapshot: JSON.stringify(snapshot),
                        }),
                    );
            } catch (error) {
                invoice = await this.db
                    .getRepository(ctx, OrderInvoice)
                    .findOneBy(key);
                if (!invoice) throw error;
            }
        }
        if (!invoice) throw new UserInputError('Invoice could not be created');
        const buffer = await renderInvoice(
            JSON.parse(invoice.snapshot),
            order.state === 'Cancelled',
        );
        return {
            filename: `invoice-${invoice.number}.pdf`,
            mimeType: 'application/pdf',
            dataBase64: buffer.toString('base64'),
        };
    }
}
