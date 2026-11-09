import {OrderStateTransitionEvent} from '@vendure/core';
import {
    defaultEmailHandlers,
    EmailEventListener,
} from '@vendure/email-plugin';

const onlyNewEgyptCODOrder = (event: OrderStateTransitionEvent) =>
    event.toState === 'PaymentAuthorized' &&
    event.fromState !== 'Modifying' &&
    event.ctx.channel.code === 'skillverse-eg' &&
    !!event.order.customer;

/**
 * These handlers send an acknowledgment and operational notification only
 * after Vendure creates the COD order in PaymentAuthorized state.
 * No funds are settled, no shipping is triggered, and the phone call remains
 * a required manual step before dispatch.
 */
export const customerOrderRequestHandler = new EmailEventListener('order-request-received')
    .on(OrderStateTransitionEvent)
    .filter(onlyNewEgyptCODOrder)
    .setRecipient(event => event.order.customer!.emailAddress)
    .setFrom('{{ fromAddress }}')
    .setSubject('Skillverse Global - Order request #{{ order.code }} received')
    .setTemplateVars(event => ({order: event.order}));

export const staffOrderRequestHandler = new EmailEventListener('order-request-admin')
    .on(OrderStateTransitionEvent)
    .filter(onlyNewEgyptCODOrder)
    .setRecipient(() => process.env.ORDER_NOTIFICATION_EMAIL || process.env.SMTP_USER || '')
    .setFrom('{{ fromAddress }}')
    .setSubject('Skillverse Egypt - Call to confirm order #{{ order.code }}')
    .setTemplateVars(event => ({order: event.order}));

// An alias is not an SMTP identity on Hostinger. Authenticate/send from
// the actual mailbox while directing customer replies to the info@ alias.
const replyTo = () => ({replyTo: process.env.SMTP_REPLY_TO || 'info@skillverse-global.com'});

export const skillverseEmailHandlers = [
    ...defaultEmailHandlers,
    customerOrderRequestHandler,
    staffOrderRequestHandler,
].map(handler => handler.setOptionalAddressFields(replyTo));
