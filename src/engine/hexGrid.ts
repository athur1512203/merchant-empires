import type {Edge,Hex,Vertex} from '../types';
import {buildLogicTopology,generateBoard} from '../rules/boardRules';
import type {BoardLogic,HexCell} from '../rules/types';
export const HEX_SIZE=53;
export const axialToPixel=(q:number,r:number,size=HEX_SIZE)=>({x:size*Math.sqrt(3)*(q+r/2),y:size*1.5*r});
export const hexCorners=(h:Pick<Hex,'x'|'y'>)=>Array.from({length:6},(_,i)=>{const a=(Math.PI/180)*(60*i-30);return{x:h.x+HEX_SIZE*Math.cos(a),y:h.y+HEX_SIZE*Math.sin(a)}});
export function decorateHexes(cells:HexCell[]):Hex[]{return cells.map(c=>({...c,...axialToPixel(c.q,c.r)}))}
export function decorateVertices(board:BoardLogic,hexes:Hex[]):Vertex[]{
  return board.vertices.map(v=>{
    const c=v.corners[0];
    const h=hexes.find(x=>x.q===c.q&&x.r===c.r)!;
    // Logic corners follow clockwise axial neighbors; SVG corners increase counterclockwise.
    // Map the common corner of neighbors i and i-1 to its actual pixel position.
    const p=hexCorners(h)[(1-c.i+6)%6];
    return{id:v.id,x:p.x,y:p.y,hexIds:v.hexIds};
  });
}
export function decorateEdges(board:BoardLogic,vertices:Vertex[]):Edge[]{
  const vm=new Map(vertices.map(v=>[v.id,v]));
  const seen=new Set<string>();
  const edges:Edge[]=[];
  for(const [a,ns] of Object.entries(board.adjacency)){
    for(const b of ns){
      const id=[a,b].sort().join('~');
      if(seen.has(id))continue;
      seen.add(id);
      const va=vm.get(a),vb=vm.get(b);
      if(!va||!vb)continue;
      edges.push({id,a,b,x1:va.x,y1:va.y,x2:vb.x,y2:vb.y});
    }
  }
  return edges;
}
export function visualFromBoard(board:BoardLogic){
  const hexes=decorateHexes(board.hexes);
  const vertices=decorateVertices(board,hexes);
  const edges=decorateEdges(board,vertices);
  return{hexes,vertices,edges};
}
export function createBoard(seed=1):Hex[]{return visualFromBoard(generateBoard(seed)).hexes}
export function buildTopology(hexes:Hex[],seed=1){
  const vis=visualFromBoard({seed,hexes,...buildLogicTopology(hexes)});
  return{vertices:vis.vertices,edges:vis.edges};
}
export const adjacentVertexIds=(vertexId:string,edges:Edge[])=>edges.filter(e=>e.a===vertexId||e.b===vertexId).map(e=>e.a===vertexId?e.b:e.a);
