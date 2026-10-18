import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {describe,it,expect} from 'vitest';
import {BuildingIcon} from './BuildingIcon';
import {buildingArtwork,BUILDING_COMPANIES} from '../config/gameAssets';

describe('normalized building image center',()=>{
  it.each(BUILDING_COMPANIES)('centers the visible PNG subject at the vertex for all five stages of %s',async(company)=>{
    const companyId=BUILDING_COMPANIES.indexOf(company);
    for(let stage=0;stage<5;stage++){
      const settlementLevel=stage===0?1:2,factoryLevel=stage<2?undefined:stage-1 as 1|2|3;
      const html=renderToStaticMarkup(createElement(BuildingIcon,{companyId,settlementLevel,factoryLevel,color:'#fff',selected:false,scale:1}));
      const svg=html.match(/<svg\s([^>]+)>/)![1];
      const attribute=(name:string)=>svg.match(new RegExp(`(?:^| )${name}="([^"]+)"`))![1];
      const [x,y,width,height]=['x','y','width','height'].map(name=>Number(attribute(name)));
      const [vx,vy,vw,vh]=attribute('viewBox').split(' ').map(Number);
      expect({x,y,width,height}).toEqual({x:-24,y:-24,width:48,height:48});
      expect(attribute('preserveAspectRatio')).toBe('xMidYMid meet');
      const asset=buildingArtwork(settlementLevel,factoryLevel,companyId);
      const png=await readFile(new URL(`../../public${asset.src}`,import.meta.url));
      const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      let left=info.width,top=info.height,right=0,bottom=0;
      for(let py=0;py<info.height;py++)for(let px=0;px<info.width;px++)if(data[(py*info.width+px)*4+3]>8){left=Math.min(left,px);top=Math.min(top,py);right=Math.max(right,px);bottom=Math.max(bottom,py)}
      // Project the actual opaque-content center through the rendered viewport,
      // including contain letterboxing. This catches transparent-padding drift.
      const factor=Math.min(width/vw,height/vh);
      const contentX=x+(width-vw*factor)/2+((left+right+1)/2-vx)*factor;
      const contentY=y+(height-vh*factor)/2+((top+bottom+1)/2-vy)*factor;
      expect(contentX).toBeCloseTo(0,8);expect(contentY).toBeCloseTo(0,8);
    }
  });
});
