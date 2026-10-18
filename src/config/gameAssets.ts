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
