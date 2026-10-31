import {
    bootstrap,
    JobQueueService,
    Populator,
    runMigrations,
    TransactionalConnection,
} from '@vendure/core';
import type {INestApplication} from '@nestjs/common';
import {config} from './vendure-config';
import {initialData} from './initial-data';
import {assertRuntimeEnvironment} from './runtime-env';

/**
 * Hostinger's managed Node.js hosting does not allow manually executing npm
 * commands over SSH for an app. The owner may explicitly opt into this
 * *one-time*, idempotent country/zone setup on the first start.
 *
 * This never creates payment methods, activates checkout or creates fictional
 * agent accounts. Vendure itself creates the initial SuperAdmin from the
 * privately configured SUPERADMIN_USERNAME and SUPERADMIN_PASSWORD.
 */
async function initializeCountriesOnFirstBoot(app: INestApplication): Promise<void> {
    if (process.env.HOSTINGER_INITIALIZE_COUNTRIES !== 'YES_NEW_EMPTY_DATABASE') {
        return;
    }
    const conn = app.get(TransactionalConnection).rawConnection;
    const result: Array<{countryCount: number | string}> =
        await conn.query('SELECT COUNT(*) AS countryCount FROM country');
    const countryCount = Number(result[0]?.countryCount ?? 0);

    // Never repeat country/zone initialization after the first successful run.
    // If a partial seed has already occurred, stop for manual review.
    if (countryCount !== 0) {
        console.log('Hostinger first-boot setup: country data already present; skipping seed.');
        return;
    }

    console.log('Hostinger first-boot setup: adding approved Egypt, Saudi Arabia, Tunisia country and zone entries.');
    await app.get(Populator).populateInitialData(initialData);
    console.log('Hostinger first-boot setup: completed. Remove HOSTINGER_INITIALIZE_COUNTRIES from production variables.');
}

async function start() {
    assertRuntimeEnvironment();
    // Use the tested, committed schema migrations only; synchronize is never enabled.
    await runMigrations(config);
    let app: INestApplication | undefined;
    try {
        app = await bootstrap(config);
        await initializeCountriesOnFirstBoot(app);
        if (process.env.RUN_JOBS_IN_SERVER === 'true') {
            // Low-volume pilot only: jobs share the API process and SQL-backed queue.
            await app.get(JobQueueService).start();
            console.log('Vendure single-process mode: job queue started in API process.');
        }
    } catch (error) {
        await app?.close();
        throw error;
    }
}
start().catch(error => {
    console.error('Vendure server failed to start:', error);
    process.exitCode = 1;
});
