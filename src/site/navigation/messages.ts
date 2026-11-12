import type {MessageLoaders} from '@/platform/i18n/messages';

export const navigationMessageLoaders: MessageLoaders = {
    en: () => import('./messages/en.json'),
    ar: () => import('./messages/ar.json'),
};
