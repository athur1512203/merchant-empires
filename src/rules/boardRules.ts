import type {Resource} from '../types';
import {mulberry32,shuffleInPlace} from './rng';
import {HEX_NEIGHBORS,hexId,type BoardLogic,type HexCell,type LogicVertex} from './types';

export const ROW_COUNTS=[4,5,6,7,6,5,4] as const;
const AXIAL_CELLS=(()=>{const cells:{q:number;r:number}[]=[];for(let q=-3;q<=3;q++){const r1=Math.max(-3,-q-3),r2=Math.min(3,-q+3);for(let r=r1;r<=r2;r++)cells.push({q,r});}return cells;})();

export function rowLengths(hexes:HexCell[]){
  const rows=new Map<number,number>();
  for(const h of hexes)rows.set(h.r,(rows.get(h.r)??0)+1);
  return [...rows.entries()].sort((a,b)=>a[0]-b[0]).map(([,n])=>n);
}

function neighborIds(q:number,r:number){return HEX_NEIGHBORS.map(([dq,dr])=>hexId(q+dq,r+dr))}

function vertexKey(q:number,r:number,corner:number){
  const [a,b]=[HEX_NEIGHBORS[corner],HEX_NEIGHBORS[(corner+5)%6]];
  return [hexId(q,r),hexId(q+a[0],r+a[1]),hexId(q+b[0],r+b[1])].sort().join('|');
}

export function buildLogicTopology(hexes:HexCell[]):Pick<BoardLogic,'vertices'|'adjacency'>{
  const onBoard=new Set(hexes.map(h=>h.id));
  const vm=new Map<string,LogicVertex>();
  for(const h of hexes){
    for(let i=0;i<6;i++){
      const id=vertexKey(h.q,h.r,i);
      const v=vm.get(id)??{id,hexIds:[],neighborIds:[],corners:[]};
      if(!v.hexIds.includes(h.id))v.hexIds.push(h.id);
      if(!v.corners.some(c=>c.q===h.q&&c.r===h.r&&c.i===i))v.corners.push({q:h.q,r:h.r,i});
      vm.set(id,v);
    }
  }
  const adjacency:Record<string,string[]>={};
  for(const h of hexes){
    for(let i=0;i<6;i++){
      const a=vertexKey(h.q,h.r,i),b=vertexKey(h.q,h.r,(i+1)%6);
      adjacency[a]=adjacency[a]??[];
      adjacency[b]=adjacency[b]??[];
      if(!adjacency[a].includes(b))adjacency[a].push(b);
      if(!adjacency[b].includes(a))adjacency[b].push(a);
    }
  }
  const vertices=[...vm.values()].map(v=>({...v,hexIds:v.hexIds.filter(id=>onBoard.has(id)).sort(),neighborIds:adjacency[v.id]??[]}));
  return{vertices,adjacency};
}

const TOKEN_POOL=[2,2,3,3,3,4,4,4,4,5,5,5,5,5,6,6,6,6,8,8,8,8,8,9,9,9,9,9,10,10,10,10,11,11,11,12,12];
const RESOURCE_POOL:Resource[]=[...Array.from({length:10},()=>'metal' as const),...Array.from({length:9},()=>'wood' as const),...Array.from({length:9},()=>'wheat' as const),...Array.from({length:9},()=>'cotton' as const)];

function hexIndex(hexes:HexCell[]){return new Map(hexes.map((h,i)=>[h.id,i]))}
function sixEightAdjacent(hexes:HexCell[]){
  const idx=hexIndex(hexes);
  for(const h of hexes){
    if(h.number!==6&&h.number!==8)continue;
    for(const nid of neighborIds(h.q,h.r)){
      const n=hexes[idx.get(nid)!];
      if(n&&(n.number===6||n.number===8))return true;
    }
  }
  return false;
}
function sameResourceClusters(hexes:HexCell[]){
  const idx=hexIndex(hexes);let bad=0;
  for(const h of hexes)for(const nid of neighborIds(h.q,h.r)){const n=hexes[idx.get(nid)!];if(n&&n.resource===h.resource)bad++;}
  return bad;
}

export function generateBoard(seed:number):BoardLogic{
  const random=mulberry32(seed);
  let best:HexCell[]|null=null,bestScore=Infinity;
  for(let attempt=0;attempt<240;attempt++){
    const tokens=shuffleInPlace([...TOKEN_POOL],random);
    const resources=shuffleInPlace([...RESOURCE_POOL],random);
    const hexes:HexCell[]=AXIAL_CELLS.map((c,i)=>({id:hexId(c.q,c.r),q:c.q,r:c.r,resource:resources[i],number:tokens[i]}));
    if(hexes.some(h=>h.number===7)||hexes.length!==37)continue;
    const sixEight=sixEightAdjacent(hexes)?80:0;
    const score=sixEight+sameResourceClusters(hexes);
    if(score<bestScore){best=hexes;bestScore=score;if(score===0)break}
  }
  const hexes=best??AXIAL_CELLS.map((c,i)=>({id:hexId(c.q,c.r),q:c.q,r:c.r,resource:RESOURCE_POOL[i%4],number:TOKEN_POOL[i]}));
  const topo=buildLogicTopology(hexes);
  return{seed,hexes,...topo};
}

export function vertexById(board:BoardLogic,id:string){return board.vertices.find(v=>v.id===id)}
export function areVerticesAdjacent(board:BoardLogic,a:string,b:string){return (board.adjacency[a]??[]).includes(b)}
