import {HEX_SIZE} from './hexGrid';
import type {Hex} from '../types';

type View={x:number;y:number;z:number};
/** Keep a manually chosen camera centered on the same world point after resize. */
export function resizeBoardView(view:View,fitted:View,previous:{width:number;height:number},next:{width:number;height:number},manual:boolean):View{
  return manual?{...view,x:view.x+(next.width-previous.width)/2,y:view.y+(next.height-previous.height)/2}:fitted;
}

export function fitBoardView(hexes:Pick<Hex,'x'|'y'>[],width:number,height:number){
  if(!hexes.length)return{x:width/2,y:height/2,z:1};
  // Room for settlement hit targets, the map title/tools, and bottom hint.
  const left=24,right=24,top=72,bottom=42;
  const minX=Math.min(...hexes.map(h=>h.x))-HEX_SIZE*Math.sqrt(3)/2-20;
  const maxX=Math.max(...hexes.map(h=>h.x))+HEX_SIZE*Math.sqrt(3)/2+20;
  const minY=Math.min(...hexes.map(h=>h.y))-HEX_SIZE-20;
  const maxY=Math.max(...hexes.map(h=>h.y))+HEX_SIZE+20;
  const z=Math.min(1.8,Math.max(.1,(width-left-right)/(maxX-minX)),Math.max(.1,(height-top-bottom)/(maxY-minY)));
  return{x:left+(width-left-right)/2-(minX+maxX)/2*z,y:top+(height-top-bottom)/2-(minY+maxY)/2*z,z};
}
