import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const source=new URL('../asset/assets/',import.meta.url);
const destination=new URL('../public/assets/game/',import.meta.url);
const resources=['metal','wood','wheat','cotton'];
const goods=['machinery','rail','furniture','flour','fabric','clothing'];
const names=[...resources.map(x=>`tile_${x}`),...resources.map(x=>`resource_${x}`),...goods.map(x=>`goods_${x}`)];
await mkdir(destination,{recursive:true});
const manifest=[];
for(const name of names){
  const original=await readFile(new URL(`${name}.png`,source));
  const input=await sharp(original).metadata();
  // Never upscale or stretch. Preserve colors, dark subject details and alpha.
  const {data,info}=await sharp(original).rotate()
    .resize({width:name.startsWith('tile_')?360:192,height:name.startsWith('tile_')?360:192,fit:'inside',withoutEnlargement:true})
    .webp({quality:88,effort:6,alphaQuality:100}).toBuffer({resolveWithObject:true});
  await writeFile(new URL(`${name}.webp`,destination),data);
  manifest.push({file:`${name}.webp`,source:`${name}.png`,sourceSha256:createHash('sha256').update(original).digest('hex'),sourceBytes:original.length,bytes:data.length,sourceWidth:input.width,sourceHeight:input.height,width:info.width,height:info.height,background:name.startsWith('tile_')?'clipped-by-map':'original-preserved'});
}
await writeFile(new URL('manifest.json',destination),`${JSON.stringify(manifest,null,2)}\n`);
console.log(`Prepared ${manifest.length} assets in ${fileURLToPath(destination)}: ${manifest.reduce((sum,x)=>sum+x.sourceBytes,0)} → ${manifest.reduce((sum,x)=>sum+x.bytes,0)} bytes`);
