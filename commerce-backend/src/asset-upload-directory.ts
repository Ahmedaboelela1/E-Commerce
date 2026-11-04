import fs from 'node:fs';
import path from 'node:path';

const EPHEMERAL_DIRECTORY = path.join(process.cwd(), 'static', 'assets');

/**
 * Hostinger redeploys to new hbuilds/version directories, so storing assets
 * under process.cwd() loses images with an old deployment. Prefer an absolute
 * directory outside hbuilds and public_html, controlled via ASSET_UPLOAD_DIR.
 */
export function getAssetUploadDirectory(): string {
    const configured = process.env.ASSET_UPLOAD_DIR?.trim();
    if (!configured) {
        if (process.env.APP_ENV !== 'dev') {
            console.warn(
                'Vendure asset uploads use the temporary deployment directory. ' +
                'Set ASSET_UPLOAD_DIR to a writable absolute path outside hbuilds/public_html.'
            );
        }
        return EPHEMERAL_DIRECTORY;
    }

    if (!path.isAbsolute(configured)) {
        throw new Error('ASSET_UPLOAD_DIR must be an absolute filesystem path.');
    }

    const directory = path.resolve(configured);
    if (process.env.APP_ENV !== 'dev') {
        const segments = directory.split(path.sep);
        if (segments.includes('hbuilds') || segments.includes('public_html')) {
            throw new Error('ASSET_UPLOAD_DIR must be outside Hostinger hbuilds and public_html.');
        }
    }

    try {
        fs.mkdirSync(directory, {recursive: true, mode: 0o700});
        fs.accessSync(directory, fs.constants.R_OK | fs.constants.W_OK);
    } catch (error) {
        throw new Error(
            `ASSET_UPLOAD_DIR is not writable (${directory}). ` +
            'Create a private folder outside hbuilds/public_html in Hostinger File Manager. ' +
            'Filesystem error: ' + String(error)
        );
    }
    console.log(`Vendure asset uploads configured at persistent directory: ${directory}`);
    return directory;
}
