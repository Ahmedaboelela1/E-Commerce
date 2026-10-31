import {bootstrap, runMigrations} from '@vendure/core';
import {config} from './vendure-config';
import {assertRuntimeEnvironment} from './runtime-env';

async function start() {
    assertRuntimeEnvironment();
    // Never set TypeORM synchronize=true on the Hostinger database.
    await runMigrations(config);
    await bootstrap(config);
}
start().catch(error => {
    console.error('Vendure server failed to start:', error);
    process.exitCode = 1;
});
