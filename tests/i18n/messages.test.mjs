import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.join(import.meta.dirname, '..', '..');

async function findMessageFiles(directory) {
    const files = [];
    for (const entry of await readdir(directory, {withFileTypes: true})) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await findMessageFiles(file)));
        } else if (entry.name.endsWith('.json') && path.basename(directory) === 'messages') {
            files.push(path.relative(root, file));
        }
    }
    return files;
}

async function findTypeScriptFiles(directory) {
    const files = [];
    for (const entry of await readdir(directory, {withFileTypes: true})) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await findTypeScriptFiles(file));
        if (entry.isFile() && /\.tsx?$/.test(entry.name)) files.push(file);
    }
    return files;
}

test('every message file is registered in the locale message loader', async () => {
    const discovered = (await findMessageFiles(path.join(root, 'src'))).sort();
    const registrations = new Set();
    for (const messageFile of discovered) {
        const moduleDirectory = path.dirname(path.dirname(messageFile));
        const registrationFile = path.join(root, `${moduleDirectory}${path.sep}messages.ts`);
        const registration = await readFile(registrationFile, 'utf8');
        const locale = path.basename(messageFile, '.json');
        assert.match(
            registration,
            new RegExp(`\\b${locale}: \\(\\) => import\\(['"]\\./messages/${locale}\\.json['"]\\)`),
            `${messageFile} is not registered under its own locale.`,
        );
        registrations.add(
            path.relative(path.join(root, 'src'), registrationFile)
                .replace(/\\/g, '/')
                .replace(/\.ts$/, ''),
        );
    }

    const composition = await readFile(path.join(root, 'src/site/i18n/messages.ts'), 'utf8');
    const composed = new Set(
        [...composition.matchAll(/from ['"]@\/([^'"]+\/messages)['"]/g)].map(match => match[1]),
    );
    assert.deepEqual(composed, registrations, 'Site message composition must include every module registration.');
});

function messageKeys(value, prefix = '') {
    return Object.entries(value).flatMap(([key, child]) => {
        const qualified = prefix ? `${prefix}.${key}` : key;
        return child && typeof child === 'object' && !Array.isArray(child)
            ? messageKeys(child, qualified)
            : [qualified];
    });
}

test('message keys match across locales', async () => {
    const discovered = await findMessageFiles(path.join(root, 'src'));
    const englishFiles = discovered.filter(file => path.basename(file) === 'en.json');
    for (const englishFile of englishFiles) {
        const arabicFile = path.join(path.dirname(englishFile), 'ar.json');
        assert.ok(discovered.includes(arabicFile), `${englishFile} has no matching ar.json file.`);
        const english = JSON.parse(await readFile(path.join(root, englishFile), 'utf8'));
        const arabic = JSON.parse(await readFile(path.join(root, arabicFile), 'utf8'));
        assert.deepEqual(
            messageKeys(arabic).sort(),
            messageKeys(english).sort(),
            `${englishFile} and ${arabicFile} must define the same message keys.`,
        );
    }
});

test('message namespaces are unique per locale', async () => {
    const owners = new Map();
    for (const file of await findMessageFiles(path.join(root, 'src'))) {
        const locale = path.basename(file, '.json');
        const messages = JSON.parse(await readFile(path.join(root, file), 'utf8'));
        for (const namespace of Object.keys(messages)) {
            const key = `${locale}:${namespace}`;
            assert.ok(
                !owners.has(key),
                `Namespace "${namespace}" for locale "${locale}" is defined in both ${owners.get(key)} and ${file}.`,
            );
            owners.set(key, file);
        }
    }
});

test('features use only owned or shared message namespaces', async () => {
    const owners = new Map();
    for (const file of (await findMessageFiles(path.join(root, 'src'))).filter(candidate => path.basename(candidate) === 'en.json')) {
        const messages = JSON.parse(await readFile(path.join(root, file), 'utf8'));
        const feature = file.match(/^src[/\\]features[/\\]([^/\\]+)[/\\]/)?.[1];
        const owner = feature ?? (file.startsWith(`src${path.sep}platform${path.sep}i18n${path.sep}`) ? 'platform.i18n' : 'site');
        for (const namespace of Object.keys(messages)) owners.set(namespace, owner);
    }

    const violations = [];
    const featuresRoot = path.join(root, 'src', 'features');
    for (const file of await findTypeScriptFiles(featuresRoot)) {
        const feature = path.relative(featuresRoot, file).split(path.sep)[0];
        const content = await readFile(file, 'utf8');
        const namespaces = [
            ...content.matchAll(/(?:useTranslations|getTranslations)\(\s*['"]([^'"]+)['"]/g),
            ...content.matchAll(/namespace:\s*['"]([^'"]+)['"]/g),
        ].map(match => match[1]);
        for (const namespace of namespaces) {
            const owner = owners.get(namespace);
            if (owner !== feature && owner !== 'platform.i18n') {
                violations.push(`${path.relative(root, file)} uses ${namespace} owned by ${owner ?? 'nobody'}`);
            }
        }
    }
    assert.deepEqual(violations, []);
});

// ICU plural branches may differ across languages, but interpolation arguments must not.
test('Arabic ICU messages parse and preserve every English interpolation argument',async()=>{
    const {parse}=await import('@formatjs/icu-messageformat-parser');
    function argumentsIn(message){
        const names=new Set();
        function walk(nodes){for(const node of nodes){
            if(node.type>=1&&node.type<=6)names.add(node.value);
            if(node.options)for(const option of Object.values(node.options))walk(option.value);
            if(node.children)walk(node.children);
        }}
        walk(parse(message));return [...names].sort();
    }
    function flatten(value,prefix=''){
        return Object.entries(value).flatMap(([key,child])=>typeof child==='string'?[[prefix+key,child]]:flatten(child,prefix+key+'.'));
    }
    for(const file of (await findMessageFiles(path.join(root,'src'))).filter(f=>f.endsWith('/en.json'))){
        const english=flatten(JSON.parse(await readFile(path.join(root,file),'utf8')));
        const arabic=new Map(flatten(JSON.parse(await readFile(path.join(root,file.replace('/en.json','/ar.json')),'utf8'))));
        for(const [key,message] of english)assert.deepEqual(argumentsIn(arabic.get(key)),argumentsIn(message),file+':'+key);
    }
    assert.ok(!(await findMessageFiles(path.join(root,'src'))).some(f=>f.endsWith('/de.json')));
});
