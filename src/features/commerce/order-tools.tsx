'use client';

import {useCallback, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {FileDown, Truck, Phone, Upload} from 'lucide-react';
import type {FileDownload, OrderOperationsInfo} from './graphql';
import {getOrderInvoice, uploadTransferProof} from './actions';

export function downloadFile(file: FileDownload) {
    const data = Uint8Array.from(atob(file.dataBase64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([data], {type: file.mimeType}));
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function OrderTools({orderId}: {orderId: string}) {
    const t = useTranslations('Commerce');
    const [info, setInfo] = useState<OrderOperationsInfo | null>(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [reference, setReference] = useState('');
    const load = useCallback(async () => {
        const response = await fetch(
            `/api/commerce/order?orderId=${encodeURIComponent(orderId)}`,
            {cache: 'no-store'},
        );
        if (!response.ok) throw new Error('Unavailable');
        const data = await response.json();
        setInfo(data);
        setReference(data.transferReference || '');
    }, [orderId]);
    useEffect(() => {
        let active = true;
        void load().catch(() => {
            if (active) setError(t('loadError'));
        });
        return () => {
            active = false;
        };
    }, [load, t]);
    const submit = async (form: FormData) => {
        setBusy(true);
        setError('');
        setMessage('');
        form.set('orderId', orderId);
        try {
            const result = await uploadTransferProof(form);
            if (result.info) {
                setInfo(result.info);
                setMessage(t('proofSaved'));
            } else setError(t('proofError'));
        } catch {
            setError(t('proofError'));
        } finally {
            setBusy(false);
        }
    };
    const callbackLabel =
        info?.phoneStatus === 'confirmed'
            ? t('phoneConfirmed')
            : info?.phoneStatus === 'unreachable'
              ? t('phoneUnreachable')
              : info?.phoneStatus === 'cancelled'
                ? t('phoneDeclined')
                : t('phonePending');
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('orderFollowup')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
                {error && (
                    <div
                        role="alert"
                        className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                    >
                        {error}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setError('');
                                void load().catch(() =>
                                    setError(t('loadError')),
                                );
                            }}
                        >
                            {t('retry')}
                        </Button>
                    </div>
                )}
                {message && (
                    <p role="status" className="text-sm text-green-700">
                        {message}
                    </p>
                )}
                {!info && !error && (
                    <p className="text-sm text-muted-foreground">
                        {t('loading')}
                    </p>
                )}
                {info && (
                    <>
                        <p className="flex items-center gap-2 text-sm">
                            <Phone className="size-4" />
                            {callbackLabel}
                        </p>
                        {info.receiptStatus === 'accepted' && (
                            <p
                                role="status"
                                className="text-sm font-medium text-green-700"
                            >
                                {t('proofAccepted')}
                            </p>
                        )}
                        {info.shipments.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="flex items-center gap-2 font-semibold">
                                    <Truck className="size-4" />
                                    {t('tracking')}
                                </h3>
                                {info.shipments.map((shipment) => (
                                    <div
                                        key={shipment.id}
                                        className="rounded-lg border p-3 text-sm"
                                    >
                                        <p>
                                            {shipment.carrier} ·{' '}
                                            {shipment.trackingCode}
                                        </p>
                                        <p>{shipment.state}</p>
                                        {shipment.trackingUrl && (
                                            <a
                                                href={shipment.trackingUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-block pt-2 font-medium text-primary underline"
                                            >
                                                {t('trackShipment')}
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {info.invoiceAvailable && (
                            <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                    setBusy(true);
                                    setError('');
                                    void getOrderInvoice(orderId)
                                        .then((result) => {
                                            if (result.file)
                                                downloadFile(result.file);
                                            else setError(t('invoiceError'));
                                        })
                                        .catch(() =>
                                            setError(t('invoiceError')),
                                        )
                                        .finally(() => setBusy(false));
                                }}
                            >
                                <FileDown className="size-4" />
                                {t('downloadInvoice')}
                            </Button>
                        )}
                        {info.transferPending && (
                            <form
                                action={submit}
                                className="space-y-3 rounded-xl border p-4"
                            >
                                <h3 className="font-semibold">
                                    {t('transferProof')}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {t('proofHelp')}
                                </p>
                                {info.receiptStatus !== 'none' && (
                                    <p className="text-sm font-medium">
                                        {info.receiptStatus === 'accepted'
                                            ? t('proofAccepted')
                                            : info.receiptStatus === 'rejected'
                                              ? t('proofRejected')
                                              : t('proofPending')}
                                    </p>
                                )}
                                {info.receiptStatus === 'rejected' &&
                                    info.receiptReviewNote && (
                                        <p className="text-sm text-destructive">
                                            {info.receiptReviewNote}
                                        </p>
                                    )}
                                <label
                                    className="block text-sm font-medium"
                                    htmlFor={`reference-${orderId}`}
                                >
                                    {t('reference')}
                                </label>
                                <Input
                                    id={`reference-${orderId}`}
                                    name="reference"
                                    maxLength={120}
                                    value={reference}
                                    onChange={(e) =>
                                        setReference(e.target.value)
                                    }
                                    disabled={busy}
                                />
                                <label
                                    className="block text-sm font-medium"
                                    htmlFor={`receipt-${orderId}`}
                                >
                                    {t('receiptImage')}
                                </label>
                                <Input
                                    id={`receipt-${orderId}`}
                                    type="file"
                                    name="receipt"
                                    accept="image/png,image/jpeg,image/webp"
                                    disabled={busy}
                                />
                                <Button disabled={busy} type="submit">
                                    <Upload className="size-4" />
                                    {t('sendProof')}
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                    {t('proofPrivacy')}
                                </p>
                            </form>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
