import {config} from 'dotenv';
import {spawn} from 'node:child_process';
config({path:'server/.env',quiet:true,override:true});
const url=process.env.DATABASE_URL;
if(!url){console.error('DATABASE_URL missing in server/.env');process.exit(1)}
// Capture runner output and redact the URL/credentials even on unexpected failures.
const secrets=[url];
try{const parsed=new URL(url);secrets.push(parsed.password,decodeURIComponent(parsed.password))}catch{}
const redact=value=>{
  let result=value;
  for(const secret of secrets.filter(Boolean))result=result.split(secret).join('[REDACTED]');
  return result.replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/g,'[REDACTED_DATABASE_URL]');
};
const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','--no-file-parallelism',...process.argv.slice(2)],{windowsHide:true,env:{...process.env,TEST_DATABASE_URL:url},stdio:['ignore','pipe','pipe']});
let output='';
child.stdout.on('data',chunk=>{output+=chunk});child.stderr.on('data',chunk=>{output+=chunk});
child.on('error',()=>{console.error('Could not launch Vitest');process.exitCode=1});
child.on('close',code=>{process.stdout.write(redact(output));process.exitCode=code??1});
