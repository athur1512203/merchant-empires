import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {buildingArtwork,BUILDING_COMPANIES} from './gameAssets';

const stages=[
  {name:'settlement_level_1',settlement:1,factory:undefined,width:26.625766871165645},
  {name:'settlement_level_2',settlement:2,factory:undefined,width:28.166666666666668},
  {name:'factory_level_1',settlement:2,factory:1,width:21.18918918918919},
  {name:'factory_level_2',settlement:2,factory:2,width:24.67027027027027},
  {name:'factory_level_3',settlement:2,factory:3,width:25.275675675675675},
] as const;
describe('company building artwork',()=>{
  it.each(BUILDING_COMPANIES)('ships five transparent PNGs with correct URLs, bounds and 2x frame sizes for %s',async(company)=>{
    const companyId=BUILDING_COMPANIES.indexOf(company);
    for(const stage of stages){
      const asset=buildingArtwork(stage.settlement,stage.factory,companyId);
      const file=`${company}_${stage.name}.png`;
      expect(asset.src).toBe(`/assets/game/buildings/${file}`);
      const png=await readFile(new URL(`../../public/assets/game/buildings/${file}`,import.meta.url));
      const metadata=await sharp(png).metadata();
      expect(metadata).toMatchObject({format:'png',width:256,height:256,hasAlpha:true});
      expect(asset.frameHeight).toBe(56);
      expect(asset.frameWidth).toBeCloseTo(stage.width*2,10);
      expect(asset.x).toBeGreaterThanOrEqual(0);expect(asset.y).toBeGreaterThanOrEqual(0);
      expect(asset.x+asset.width).toBeLessThanOrEqual(256);expect(asset.y+asset.height).toBeLessThanOrEqual(256);
    }
  });
});
