import {bootstrap, JobQueueService, runMigrations} from '@vendure/core';
import {config} from './vendure-config';
import {assertRuntimeEnvironment} from './runtime-env';

async function start() {
    assertRuntimeEnvironment();
    // Never set TypeORM synchronize=true on the Hostinger database.
    await runMigrations(config);
    const app = await bootstrap(config);
    if (process.env.RUN_JOBS_IN_SERVER === 'true') {
        // Pilot mode: process queued jobs on this API process instead of deploying
        // a separate worker. Keep the SQL job queue so pending jobs persist.
        await app.get(JobQueueService).start();
        console.log('Vendure single-process mode: job queue started in API process.');
    }
}
start().catch(error => {
    console.error('Vendure server failed to start:', error);
    process.exitCode = 1;
});
