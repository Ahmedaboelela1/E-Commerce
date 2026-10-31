import {bootstrapWorker} from '@vendure/core';
import {config} from './vendure-config';
import {assertRuntimeEnvironment} from './runtime-env';

async function startWorker() {
    assertRuntimeEnvironment();
    const worker = await bootstrapWorker(config);
    await worker.startJobQueue();
}
startWorker().catch(error => {
    console.error('Vendure worker failed to start:', error);
    process.exitCode = 1;
});
