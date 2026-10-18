import type {Resource} from '../types';
import {mulberry32,shuffleInPlace} from './rng';
import {HEX_NEIGHBORS,hexId,type BoardLogic,type HexCell,type LogicVertex} from './types';

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


export const DEFAULT_BOARD_SIZE=61;
export const MIN_BOARD_SIZE=60;
export const MAX_BOARD_SIZE=80;
type Cell={q:number;r:number};
const key=(c:Cell)=>hexId(c.q,c.r);
const neighbors=(c:Cell)=>HEX_NEIGHBORS.map(([q,r])=>({q:c.q+q,r:c.r+r}));

/** Checks connected land, bounded aspect, no holes, and no one-cell tips. */
export function inspectShape(cells:Cell[]){
  const ids=new Set(cells.map(key)),seen=new Set<string>(),queue=cells.length?[cells[0]]:[];
  for(const c of queue){if(seen.has(key(c)))continue;seen.add(key(c));for(const n of neighbors(c))if(ids.has(key(n))&&!seen.has(key(n)))queue.push(n)}
  const xs=cells.map(c=>Math.sqrt(3)*(c.q+c.r/2)),ys=cells.map(c=>1.5*c.r);
  const width=Math.max(...xs)-Math.min(...xs)+Math.sqrt(3),height=Math.max(...ys)-Math.min(...ys)+2;
  const minNeighbors=Math.min(...cells.map(c=>neighbors(c).filter(n=>ids.has(key(n))).length));
  const minQ=Math.min(...cells.map(c=>c.q))-1,maxQ=Math.max(...cells.map(c=>c.q))+1,minR=Math.min(...cells.map(c=>c.r))-1,maxR=Math.max(...cells.map(c=>c.r))+1;
  const water=new Set<string>(),outside:Cell[]=[{q:minQ,r:minR}];
  for(const c of outside){const id=key(c);if(water.has(id)||ids.has(id))continue;water.add(id);for(const n of neighbors(c))if(n.q>=minQ&&n.q<=maxQ&&n.r>=minR&&n.r<=maxR&&!water.has(key(n))&&!ids.has(key(n)))outside.push(n)}
  let holes=0;for(let q=minQ;q<=maxQ;q++)for(let r=minR;r<=maxR;r++)if(!ids.has(hexId(q,r))&&!water.has(hexId(q,r)))holes++;
  return{connected:seen.size===cells.length,unique:ids.size===cells.length,width,height,aspect:Math.max(width/height,height/width),minNeighbors,holes};
}

function growRegion(count:number,random:()=>number):Cell[]{
  for(let attempt=0;attempt<64;attempt++){
    const cells:Cell[]=[{q:0,r:0},...neighbors({q:0,r:0})],ids=new Set(cells.map(key));
    const angle=random()*Math.PI*2,phase=random()*Math.PI*2;
    while(cells.length<count){
      const frontier=new Map<string,Cell>();for(const c of cells)for(const n of neighbors(c))if(!ids.has(key(n)))frontier.set(key(n),n);
      const options=[...frontier.values()].map(c=>{
        const adjacent=neighbors(c).filter(n=>ids.has(key(n))).length;
        const x=Math.sqrt(3)*(c.q+c.r/2),y=1.5*c.r,a=Math.atan2(y,x);
        const weight=adjacent<2?0:Math.exp(adjacent*.75-Math.hypot(x,y)*.32+.8*Math.cos(a-angle)+.65*Math.sin(3*a+phase));
        return{c,weight};
      }).filter(o=>o.weight>0);
      let pick=random()*options.reduce((sum,o)=>sum+o.weight,0),chosen=options[options.length-1].c;
      for(const option of options){pick-=option.weight;if(pick<=0){chosen=option.c;break}}
      cells.push(chosen);ids.add(key(chosen));
    }
    const shape=inspectShape(cells);
    if(shape.connected&&shape.unique&&shape.aspect<=1.65&&shape.minNeighbors>=2&&shape.holes===0)return cells.sort((a,b)=>a.r-b.r||a.q-b.q);
  }
  throw new Error('Unable to generate a compact connected map');
}

// Preserve the original relative dice-token distribution, scaled to map size.
const TOKEN_WEIGHTS=[2,3,4,5,4,5,5,4,3,2];
const NUMBERS=[2,3,4,5,6,8,9,10,11,12];
const RESOURCES:Resource[]=['metal','wood','wheat','cotton'];
function tokenPool(count:number){
  const quotas=TOKEN_WEIGHTS.map((n,i)=>({number:NUMBERS[i],exact:n*count/37,count:Math.floor(n*count/37)}));
  let extra=count-quotas.reduce((sum,q)=>sum+q.count,0);
  for(const q of [...quotas].sort((a,b)=>(b.exact-b.count)-(a.exact-a.count)))if(extra-->0)q.count++;
  return quotas.flatMap(q=>Array<number>(q.count).fill(q.number));
}
function spread<T>(cells:Cell[],pool:T[],random:()=>number,penalty:(a:T,b:T)=>number):T[]{
  const assigned=new Map<string,T>(),remaining=[...pool];
  for(const c of shuffleInPlace([...cells],random)){
    const nearby=neighbors(c).flatMap(n=>assigned.has(key(n))?[assigned.get(key(n))!]:[]);
    let best=Infinity,index=0;
    for(let i=0;i<remaining.length;i++){
      const score=nearby.reduce((sum,n)=>sum+penalty(remaining[i],n),0)+random()*.8;
      if(score<best){best=score;index=i}
    }
    assigned.set(key(c),remaining.splice(index,1)[0]);
  }
  return cells.map(c=>assigned.get(key(c))!);
}
export function generateBoard(seed:number,count=DEFAULT_BOARD_SIZE):BoardLogic{
  if(!Number.isInteger(count)||count<MIN_BOARD_SIZE||count>MAX_BOARD_SIZE)throw new RangeError('Map size must be an integer from 60 to 80');
  const random=mulberry32(seed),cells=growRegion(count,random);
  const resourcePool=Array.from({length:count},(_,i)=>RESOURCES[i%4]);
  const resources=spread(cells,shuffleInPlace(resourcePool,random),random,(a,b)=>a===b?3:0);
  const tokens=spread(cells,tokenPool(count),random,(a,b)=>(a===b?3:0)+([6,8].includes(a)&&[6,8].includes(b)?4:0));
  const hexes:HexCell[]=cells.map((c,i)=>({id:key(c),...c,resource:resources[i],number:tokens[i]}));
  return{seed,mapSeed:seed,hexes,...buildLogicTopology(hexes)};
}

export function vertexById(board:BoardLogic,id:string){return board.vertices.find(v=>v.id===id)}
export function areVerticesAdjacent(board:BoardLogic,a:string,b:string){return (board.adjacency[a]??[]).includes(b)}
