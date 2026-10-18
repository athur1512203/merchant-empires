import buildingBounds from './buildingAssetBounds.json';
import type {Commodity,Resource} from '../types';

// Public assets are copied unchanged to dist/assets/game by Vite.
const asset=(name:string)=>`${import.meta.env.BASE_URL}assets/game/${name}.webp`;
export const tileImages:Record<Resource,string>={
  metal:asset('tile_metal'),wood:asset('tile_wood'),
  wheat:asset('tile_wheat'),cotton:asset('tile_cotton'),
};
export const commodityImages:Record<Commodity,string>={
  metal:asset('resource_metal'),wood:asset('resource_wood'),
  wheat:asset('resource_wheat'),cotton:asset('resource_cotton'),
  machinery:asset('goods_machinery'),rail:asset('goods_rail'),
  furniture:asset('goods_furniture'),flour:asset('goods_flour'),
  fabric:asset('goods_fabric'),clothing:asset('goods_clothing'),
};

// Every stage shares one frame; alpha-content bounds normalize source padding.
export const BUILDING_ICON_SIZE=48;
export type BuildingStage='settlement_level_1'|'settlement_level_2'|'factory_level_1'|'factory_level_2'|'factory_level_3';
export const BUILDING_COMPANIES=['iron_works','timber_guild','golden_trade','ocean_empire'] as const;
export function buildingArtwork(settlementLevel:1|2,factoryLevel?:1|2|3,companyId=0){
  const stage:BuildingStage=factoryLevel?`factory_level_${factoryLevel}`:`settlement_level_${settlementLevel}`;
  const company=BUILDING_COMPANIES[companyId]??BUILDING_COMPANIES[0];
  const name=`${company}_${stage}` as keyof typeof buildingBounds;
  return{...buildingBounds[name],src:`${import.meta.env.BASE_URL}assets/game/buildings/${name}.png`,frameWidth:BUILDING_ICON_SIZE,frameHeight:BUILDING_ICON_SIZE};
}
