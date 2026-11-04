import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {getAssetUploadDirectory} = require('../dist/asset-upload-directory.js');

test('persists files in an explicitly configured private directory', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-vendure-persistent-assets-'));
    const before = {...process.env};
    try {
        process.env.APP_ENV = 'production';
        process.env.ASSET_UPLOAD_DIR = path.join(temp, 'storage', 'vendure-assets');
        const directory = getAssetUploadDirectory();
        assert.equal(directory, path.join(temp, 'storage', 'vendure-assets'));
        const filename = path.join(directory, 'upload-smoke-test.txt');
        fs.writeFileSync(filename, 'persists outside the redeployed build');
        assert.equal(fs.readFileSync(filename, 'utf8'), 'persists outside the redeployed build');
        assert.throws(() => {
            process.env.ASSET_UPLOAD_DIR = path.join(temp, 'hbuilds', 'current', 'nodejs', 'static', 'assets');
            getAssetUploadDirectory();
        }, /outside Hostinger hbuilds and public_html/);
        assert.throws(() => {
            process.env.ASSET_UPLOAD_DIR = path.join(temp, 'public_html', 'assets');
            getAssetUploadDirectory();
        }, /outside Hostinger hbuilds and public_html/);
        assert.throws(() => {
            process.env.ASSET_UPLOAD_DIR = 'static/assets';
            getAssetUploadDirectory();
        }, /absolute filesystem path/);
    } finally {
        Object.assign(process.env, before);
        if (before.ASSET_UPLOAD_DIR === undefined) delete process.env.ASSET_UPLOAD_DIR;
        if (before.APP_ENV === undefined) delete process.env.APP_ENV;
        fs.rmSync(temp, {recursive: true, force: true});
    }
});
