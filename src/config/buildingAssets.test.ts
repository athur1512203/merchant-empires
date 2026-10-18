import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {buildingArtwork,BUILDING_COMPANIES} from './gameAssets';

const stages=[
  {name:'settlement_level_1',settlement:1,factory:undefined},
  {name:'settlement_level_2',settlement:2,factory:undefined},
  {name:'factory_level_1',settlement:2,factory:1},
  {name:'factory_level_2',settlement:2,factory:2},
  {name:'factory_level_3',settlement:2,factory:3},
] as const;
describe('company building artwork',()=>{
  it.each(BUILDING_COMPANIES)('ships five transparent PNGs with correct URLs, normalized content and uniform 48px frames for %s',async(company)=>{
    const companyId=BUILDING_COMPANIES.indexOf(company);
    for(const stage of stages){
      const asset=buildingArtwork(stage.settlement,stage.factory,companyId);
      const file=`${company}_${stage.name}.png`;
      expect(asset.src).toBe(`/assets/game/buildings/${file}`);
      const png=await readFile(new URL(`../../public/assets/game/buildings/${file}`,import.meta.url));
      const metadata=await sharp(png).metadata();
      expect(metadata).toMatchObject({format:'png',width:256,height:256,hasAlpha:true});
      const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      let left=256,top=256,right=0,bottom=0;
      for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)}
      // Actual opaque subject bounds, not merely a CSS frame size.
      expect({left,top,right,bottom}).toEqual({left:41,top:66,right:214,bottom:219});
      expect(asset.frameHeight).toBe(48);
      expect(asset.frameWidth).toBe(48);
      expect({x:asset.x,y:asset.y,width:asset.width,height:asset.height}).toEqual({x:40,y:65,width:176,height:156});
      expect(asset.x).toBeGreaterThanOrEqual(0);expect(asset.y).toBeGreaterThanOrEqual(0);
      expect(asset.x+asset.width).toBeLessThanOrEqual(256);expect(asset.y+asset.height).toBeLessThanOrEqual(256);
    }
  });
});
