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

// Alpha-content bounds of the unchanged 256px source PNGs. Cropping the SVG
// viewport removes transparent padding without resampling or altering artwork.
const building=(name:string,x:number,y:number,width:number,height:number)=>({src:`${import.meta.env.BASE_URL}assets/game/buildings/${name}.png`,x,y,width,height});
export const buildingImages={
  settlement_level_1:building('settlement_level_1',50,46,155,163),
  settlement_level_2:building('settlement_level_2',43,44,169,168),
  factory_level_1:building('factory_level_1',58,35,140,185),
  factory_level_2:building('factory_level_2',46,35,163,185),
  factory_level_3:building('factory_level_3',44,35,167,185),
};
export function buildingArtwork(settlementLevel:1|2,factoryLevel?:1|2|3){
  const key:keyof typeof buildingImages=factoryLevel?`factory_level_${factoryLevel}`:`settlement_level_${settlementLevel}`;
  return buildingImages[key];
}
