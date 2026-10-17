import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';

// Bundle only our server/shared rules; keep Prisma and other packages external.
// Build-time types are checked separately. No Vite, React entry or test is bundled.
const result=await build({
  entryPoints:['server/src/index.ts'],outfile:'server/dist/index.mjs',
  bundle:true,platform:'node',target:'node24',format:'esm',packages:'external',
  metafile:true,sourcemap:false,logLevel:'info'
});
const inputs=Object.keys(result.metafile.inputs);
if(inputs.some(path=>/\.test\.|src\/(components|store)\//.test(path)))throw new Error('Unexpected frontend/test input in backend build');
await mkdir('server/dist',{recursive:true});
await writeFile('server/dist/build-manifest.json',JSON.stringify({entry:'server/dist/index.mjs',inputs},null,2)+'\n');
