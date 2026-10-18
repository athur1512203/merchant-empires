import {describe,it,expect} from 'vitest';
import {buildingLabelPositions} from './buildingLabels';
import {HEX_SIZE} from './hexGrid';
import type {Building,Hex,Vertex} from '../types';

const hex:Hex={id:'0,0',q:0,r:0,x:0,y:0,resource:'wood',number:6};
describe('building-aware dice labels',()=>{
  it('keeps an unobstructed label at the original center',()=>{
    expect(buildingLabelPositions([hex],[],[],[],.6,.6).get(hex.id)).toEqual({x:0,y:0});
  });
  it('keeps labels inside the cell and vertex coordinates unchanged with doubled artwork',()=>{
    const v:Vertex={id:'bottom',x:0,y:HEX_SIZE,hexIds:[hex.id]};
    const b:Building={vertexId:v.id,playerId:0,type:'settlement',level:1};
    const label=buildingLabelPositions([hex],[v],[b],[],.6,.6).get(hex.id)!;
    // A 56px building can occupy the full interior at fitted zoom. The label
    // stays inside its hex and is painted above artwork by Board.
    expect(Math.hypot(label.x,label.y)).toBeLessThan(HEX_SIZE);
    expect(v).toEqual({id:'bottom',x:0,y:HEX_SIZE,hexIds:[hex.id]});
  });
  it('keeps crowded labels within the hex at fitted and detailed zoom',()=>{
    const vertices:Vertex[]=Array.from({length:6},(_,i)=>({id:`v${i}`,x:HEX_SIZE*Math.cos((i*60-30)*Math.PI/180),y:HEX_SIZE*Math.sin((i*60-30)*Math.PI/180),hexIds:[hex.id]}));
    const buildings:Building[]=vertices.map(v=>({vertexId:v.id,playerId:0,type:'settlement',level:2}));
    for(const zoom of [.4,.6,1,1.8]){
      const label=buildingLabelPositions([hex],vertices,buildings,[],zoom,.6).get(hex.id)!;
      const radius=15*Math.max(zoom,.7),inradius=HEX_SIZE*Math.sqrt(3)/2*zoom;
      for(let i=0;i<6;i++)expect((label.x*Math.cos(i*Math.PI/3)+label.y*Math.sin(i*Math.PI/3))*zoom+radius).toBeLessThanOrEqual(inradius);
    }
  });
});
