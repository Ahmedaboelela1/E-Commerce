import fs from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);

/** Execute the actual server component/action with explicit boundary substitutes. */
export function loadTypeScriptModule(filename, dependencies) {
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX},
    }).outputText;
    const module = {exports: {}};
    const resolve = name => {
        if (Object.hasOwn(dependencies, name)) return dependencies[name];
        if (name === 'react/jsx-runtime') return require(name);
        throw new Error(`Unexpected dependency: ${name}`);
    };
    new Function('require', 'module', 'exports', compiled)(resolve, module, module.exports);
    return module.exports;
}
