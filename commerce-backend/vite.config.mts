import {LanguageCode} from '@vendure/core';
import {vendureDashboardPlugin} from '@vendure/dashboard/vite';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {defineConfig} from 'vite';

export default defineConfig({
    base: '/dashboard/',
    build: {outDir: join(process.cwd(), 'dist/dashboard')},
    plugins: [
        vendureDashboardPlugin({
            vendureConfigPath: pathToFileURL(join(process.cwd(), 'src/vendure-config.ts')),
            i18n: {availableLanguages: [LanguageCode.en, LanguageCode.ar], defaultLanguage: LanguageCode.en},
            api: {host: 'auto', port: 'auto', adminApiPath: 'admin-api', tokenMethod: 'bearer'},
        }),
    ],
});
