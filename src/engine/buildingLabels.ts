import type {Building,Factory,Hex,Vertex} from '../types';
import {buildingArtwork} from '../config/gameAssets';
import {HEX_SIZE} from './hexGrid';

/** Presentation only: keep dice labels inside their hex and away from artwork. */
export function buildingLabelPositions(hexes:Hex[],vertices:Vertex[],buildings:Building[],factories:Factory[],zoom:number,fittedZoom:number){
  const displayScale=Math.min(1,zoom/fittedZoom),radius=15*Math.max(zoom,.7);
  const rectangles=buildings.flatMap(b=>{
    const v=vertices.find(v=>v.id===b.vertexId);if(!v)return[];
    const asset=buildingArtwork(b.level,factories.find(f=>f.vertexId===b.vertexId)?.level,b.playerId),width=asset.frameWidth*displayScale,height=asset.frameHeight*displayScale;
    return[{left:v.x*zoom-width/2,right:v.x*zoom+width/2,top:v.y*zoom-height/2,bottom:v.y*zoom+height/2}];
  });
  const inset=Math.max(0,HEX_SIZE*Math.sqrt(3)/2*zoom-radius-1);
  const normals=Array.from({length:6},(_,i)=>({x:Math.cos(i*Math.PI/3),y:Math.sin(i*Math.PI/3)}));
  const offsets=[{x:0,y:0}];
  for(let r=2;r<=inset*1.2;r+=2)for(let i=0;i<24;i++){
    const p={x:r*Math.cos(i*Math.PI/12),y:r*Math.sin(i*Math.PI/12)};
    if(normals.every(n=>p.x*n.x+p.y*n.y<=inset))offsets.push(p);
  }
  return new Map(hexes.map(h=>{
    let best=offsets[0],bestScore=Infinity;
    for(const p of offsets){
      const x=h.x*zoom+p.x,y=h.y*zoom+p.y;
      let score=(p.x*p.x+p.y*p.y)*.015;
      for(const rect of rectangles){
        const dx=Math.max(rect.left-x,0,x-rect.right),dy=Math.max(rect.top-y,0,y-rect.bottom);
        score+=Math.max(0,radius+1-Math.hypot(dx,dy))**2;
      }
      if(score<bestScore){best=p;bestScore=score}
    }
    return[h.id,{x:h.x+best.x/zoom,y:h.y+best.y/zoom}];
  }));
}
