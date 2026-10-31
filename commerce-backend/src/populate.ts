import {bootstrap, runMigrations} from '@vendure/core';
import {populate} from '@vendure/core/cli';
import {config} from './vendure-config';
import {initialData} from './initial-data';
import {assertRuntimeEnvironment} from './runtime-env';

async function seedInitialData() {
    assertRuntimeEnvironment();
    if (process.env.ALLOW_INITIAL_SEED !== 'YES_EMPTY_DB_BACKED_UP') {
        throw new Error('Refusing seed; set ALLOW_INITIAL_SEED=YES_EMPTY_DB_BACKED_UP after confirming an empty, backed-up database.');
    }
    await runMigrations(config);
    const app = await populate(() => bootstrap(config), initialData);
    await app.close();
}
seedInitialData().catch(error => {
    console.error('Vendure initial seed failed:', error);
    process.exitCode = 1;
});
