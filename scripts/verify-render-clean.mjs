import {execFileSync,spawn} from 'node:child_process';
import {mkdir,copyFile,readFile,writeFile,access} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const clean=join(root,'.render-verification',`clean-${Date.now()}`);
const privateEnv=parse(await readFile(join(root,'server/.env')));
assert(privateEnv.DATABASE_URL,'server/.env must contain DATABASE_URL (never printed)');
const secrets=[privateEnv.DATABASE_URL];
try{const password=new URL(privateEnv.DATABASE_URL).password;secrets.push(password,decodeURIComponent(password))}catch{}
function redact(value){let result=String(value);for(const secret of secrets.filter(Boolean))result=result.split(secret).join('[REDACTED]');return result.replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/g,'[REDACTED_DATABASE_URL]')}
// No .env is copied. Runtime credentials only exist in child-process environments.
const env={...process.env,NODE_ENV:'production',DATABASE_URL:privateEnv.DATABASE_URL,FRONTEND_ORIGIN:'https://merchant-empires.vercel.app'};
delete env.TEST_DATABASE_URL;
const npmCli=process.env.npm_execpath??join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const summary={node:process.version,cleanDirectory:clean,steps:[],neonExistingRowsUnchanged:false};
async function run(label,args,extra={}){
  console.log(`CLEAN CHECK: ${label}`);
  const child=spawn(process.execPath,args,{cwd:clean,env:{...env,...extra},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',data=>{output+=data});child.stderr.on('data',data=>{output+=data});
  const [code]=await once(child,'exit');process.stdout.write(redact(output));
  assert.equal(code,0,`${label} failed`);summary.steps.push(label);return output;
}
let db,server;
try{
  const candidates=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
  await mkdir(clean,{recursive:true});
  for(const relative of new Set(candidates)){
    if(/(^|\/)(node_modules|dist|\.git|\.render-verification)(\/|$)/.test(relative)||/(^|\/)\.env(?:\..*)?$/.test(relative)&&!relative.endsWith('.env.example'))continue;
    const target=join(clean,relative);await mkdir(dirname(target),{recursive:true});await copyFile(join(root,relative),target);
  }
  await run('npm ci --include=dev',[npmCli,'ci','--include=dev','--no-fund']);
  await run('Prisma Client generation',[npmCli,'run','db:generate']);
  // Also prove default schema discovery works, not only the explicit script.
  await run('Prisma default schema discovery',['node_modules/prisma/build/index.js','validate']);
  const backendOutput=await run('backend production build',[npmCli,'run','server:build']);
  assert(!/vite build|building client environment/.test(backendOutput),'Backend invoked Vite');
  await access(join(clean,'server/dist/index.mjs'));
  const manifest=JSON.parse(await readFile(join(clean,'server/dist/build-manifest.json'),'utf8'));
  assert(manifest.inputs.includes('server/src/index.ts'));
  assert(manifest.inputs.every(path=>!path.includes('.test.')&&!/src\/(components|store)\//.test(path)));
  const require=createRequire(join(clean,'package.json'));
  const {PrismaClient}=require('@prisma/client');db=new PrismaClient({datasources:{db:{url:env.DATABASE_URL}}});
  async function fingerprint(){
    const result=new Map();
    for(const table of ['GameRoom','RoomPlayer','GameSnapshot','GameAction','AuctionBid']){
      // Fixed table allowlist; row contents/hashes are never printed or persisted.
      const rows=await db.$queryRawUnsafe(`SELECT id, md5(row_to_json(t)::text) AS digest FROM "${table}" t`);
      result.set(table,new Map(rows.map(row=>[row.id,row.digest])));
    }
    return result;
  }
  const before=await fingerprint();
  console.log('CLEAN CHECK: launch compiled production entry, Neon connection and HTTP/CORS');
  server=spawn(process.execPath,['server/dist/index.mjs'],{cwd:clean,env:{...env,PORT:'0',HOST:'0.0.0.0'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  server.stderr.on('data',()=>{});
  const port=await new Promise((resolvePort,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Production startup timed out; private output suppressed')),45_000);
    server.stdout.on('data',data=>{const match=String(data).match(/API ready port=(\d+)/);if(match){clearTimeout(timer);resolvePort(Number(match[1]))}});
    server.once('error',()=>{clearTimeout(timer);reject(new Error('Production process could not launch'))});
    server.once('exit',()=>{clearTimeout(timer);reject(new Error('Production process exited before readiness; private output suppressed'))});
  });
  const health=await fetch(`http://127.0.0.1:${port}/api/health`,{headers:{Origin:env.FRONTEND_ORIGIN},signal:AbortSignal.timeout(10_000)});
  assert.equal(health.status,200);assert.equal((await health.json()).status,'ok');assert.equal(health.headers.get('access-control-allow-origin'),env.FRONTEND_ORIGIN);
  const preflight=await fetch(`http://127.0.0.1:${port}/api/rooms`,{method:'OPTIONS',headers:{Origin:env.FRONTEND_ORIGIN,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type,idempotency-key'}});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),env.FRONTEND_ORIGIN);
  const exited=once(server,'exit');server.kill();await exited;server=undefined;
  summary.steps.push('compiled production startup + Neon + HTTP/CORS');
  await run('TypeScript frontend/backend/tests',[npmCli,'run','typecheck']);
  await run('all Vitest including Neon',['node_modules/vitest/vitest.mjs','run','--no-file-parallelism'],{TEST_DATABASE_URL:env.DATABASE_URL});
  await run('frontend production build (separate check)',[npmCli,'run','build']);
  const after=await fingerprint();
  for(const [table,rows] of before)for(const [id,digest] of rows)assert.equal(after.get(table).get(id),digest,`Existing ${table} row changed`);
  summary.neonExistingRowsUnchanged=true;summary.backendArtifact='server/dist/index.mjs';summary.backendInputs=manifest.inputs.length;
  await writeFile(join(root,'.render-verification/latest.json'),JSON.stringify(summary,null,2)+'\n');
  console.log('CLEAN VERIFICATION PASS: compiled backend, all tests, frontend build; existing Neon rows unchanged.');
}catch(error){console.error(redact(error instanceof Error?error.message:error));process.exitCode=1}
finally{server?.kill();await db?.$disconnect()}
