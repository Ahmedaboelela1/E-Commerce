import type {MessageLoaders} from '@/platform/i18n/messages';

export const homeMessageLoaders: MessageLoaders = {
    en: () => import('./messages/en.json'),
    ar: () => import('./messages/ar.json'),
};
