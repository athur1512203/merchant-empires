import {describe,it,expect} from 'vitest';
import {generateBoard,inspectShape,MIN_BOARD_SIZE,MAX_BOARD_SIZE} from './boardRules';
import {HEX_NEIGHBORS,hexId} from './types';
import {visualFromBoard,hexCorners} from '../engine/hexGrid';
import {fitBoardView} from '../engine/boardCamera';

describe('irregular axial map regression',()=>{
  it('validates 1,000 seeds across every supported size, including topology and camera',()=>{
    const silhouettes=new Set<string>();
    for(let seed=0;seed<1000;seed++){
      const count=MIN_BOARD_SIZE+seed%(MAX_BOARD_SIZE-MIN_BOARD_SIZE+1);
      const board=generateBoard(seed,count),ids=new Set(board.hexes.map(h=>hexId(h.q,h.r)));
      expect(ids.size,`seed ${seed}`).toBe(count);
      expect(board.hexes).toHaveLength(count);
      // Independent graph traversal, rather than relying on generator checks.
      const reached=new Set<string>([board.hexes[0].id]);
      const queue=[board.hexes[0]];
      const byId=new Map(board.hexes.map(h=>[h.id,h]));
      for(const h of queue)for(const [q,r] of HEX_NEIGHBORS){const n=byId.get(hexId(h.q+q,h.r+r));if(n&&!reached.has(n.id)){reached.add(n.id);queue.push(n)}}
      expect(reached.size).toBe(count);
      expect(board.hexes.every(h=>Number.isInteger(h.number)&&h.number>=2&&h.number<=12&&h.number!==7)).toBe(true);
      expect(new Set(board.vertices.map(v=>v.id)).size).toBe(board.vertices.length);
      const shape=inspectShape(board.hexes);
      expect(shape).toMatchObject({connected:true,unique:true,holes:0});
      expect(shape.aspect).toBeLessThanOrEqual(1.65);expect(shape.minNeighbors).toBeGreaterThanOrEqual(2);
      const visual=visualFromBoard(board),pixels=new Set(visual.vertices.map(v=>`${v.x.toFixed(4)},${v.y.toFixed(4)}`));
      expect(pixels.size).toBe(board.vertices.length);
      for(const v of board.vertices){
        const p=visual.vertices.find(x=>x.id===v.id)!;
        for(const corner of v.corners){
          const h=visual.hexes.find(x=>x.q===corner.q&&x.r===corner.r)!;
          const point=hexCorners(h)[(1-corner.i+6)%6];
          expect(Math.hypot(point.x-p.x,point.y-p.y)).toBeLessThan(.00001);
        }
      }
      const camera=fitBoardView(visual.hexes,800,520);
      for(const h of visual.hexes)for(const p of hexCorners(h)){
        expect(p.x*camera.z+camera.x).toBeGreaterThan(0);expect(p.x*camera.z+camera.x).toBeLessThan(800);
        expect(p.y*camera.z+camera.y).toBeGreaterThan(0);expect(p.y*camera.z+camera.y).toBeLessThan(520);
      }
      silhouettes.add([...ids].sort().join(';'));
    }
    expect(silhouettes.size).toBeGreaterThan(990);
  },60000);
  it('is deterministic, varies geometry, and defaults to 61 cells',()=>{
    expect(generateBoard(42)).toEqual(generateBoard(42));
    expect(generateBoard(42).hexes).toHaveLength(61);
    expect(generateBoard(42).hexes.map(h=>h.id)).not.toEqual(generateBoard(43).hexes.map(h=>h.id));
    for(const count of [59,81,61.5,NaN])expect(()=>generateBoard(1,count)).toThrow(RangeError);
  });
});
