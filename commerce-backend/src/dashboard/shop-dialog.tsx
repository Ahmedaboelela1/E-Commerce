import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogTitle,
    useLingui,
} from '@vendure/dashboard';
import { X } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import './shop-dialog.css';

export function ShopDialog({
    open,
    busy,
    title,
    className,
    opener,
    onClose,
    children,
}: {
    open: boolean;
    busy: boolean;
    title: string;
    className: string;
    opener: RefObject<HTMLButtonElement | null>;
    onClose: () => void;
    children: ReactNode;
}) {
    const { _: t, i18n } = useLingui();
    return (
        <Dialog
            open={open}
            disablePointerDismissal
            onOpenChange={(nextOpen) => {
                if (!nextOpen && !busy) onClose();
            }}
        >
            <DialogContent
                className={`sv-shop-dialog ${className}`}
                dir={i18n.locale === 'ar' ? 'rtl' : 'ltr'}
                finalFocus={opener}
                showCloseButton={false}
            >
                <DialogHeader className="shop-dialog-header">
                    <DialogTitle>{title}</DialogTitle>
                    <DialogClose aria-label={t('shop.Close')} disabled={busy}>
                        <X size={18} aria-hidden="true" />
                    </DialogClose>
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    );
}
