import {cpSync, mkdirSync} from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
mkdirSync(path.join(root, 'dist/operations/assets'), {recursive: true});
cpSync(
    path.join(root, 'src/operations/assets'),
    path.join(root, 'dist/operations/assets'),
    {recursive: true},
);
