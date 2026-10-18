import type {Commodity} from '../types';
import {commodityImages} from '../config/gameAssets';

/** Decorative image: the adjacent commodity name remains the accessible label. */
export function ResourceIcon({type,size=20}:{type:Commodity;size?:number}){
  return <img className="commodity-icon" src={commodityImages[type]} width={size} height={size} alt="" aria-hidden="true" draggable={false} decoding="async"/>;
}
