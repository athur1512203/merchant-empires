import {describe,it,expect} from 'vitest';
import {fitBoardView,resizeBoardView} from './boardCamera';
import {generateBoard} from '../rules/boardRules';
import {visualFromBoard,hexCorners} from './hexGrid';

describe('responsive board camera',()=>{
 it.each([[1920-360,1080-56],[1600-360,900-56],[1366-360,768-56],[390,844-56]])('fits every hex inside %s × %s', (width,height)=>{
  for(const seed of [1,42,765]){
   const {hexes}=visualFromBoard(generateBoard(seed)),view=fitBoardView(hexes,width,height);
   for(const hex of hexes)for(const corner of hexCorners(hex)){
    expect(corner.x*view.z+view.x).toBeGreaterThanOrEqual(0);
    expect(corner.x*view.z+view.x).toBeLessThanOrEqual(width);
    expect(corner.y*view.z+view.y).toBeGreaterThanOrEqual(0);
    expect(corner.y*view.z+view.y).toBeLessThanOrEqual(height);
   }
  }
 });
 it('auto fits a resized viewport until the user moves the camera',()=>{
  const old={width:1000,height:700},next={width:800,height:600},view={x:550,y:420,z:.9},fitted={x:400,y:300,z:.6};
  expect(resizeBoardView(view,fitted,old,next,false)).toEqual(fitted);
  const manual=resizeBoardView(view,fitted,old,next,true);
  expect(manual).toEqual({x:450,y:370,z:.9});
  expect((old.width/2-view.x)/view.z).toBe((next.width/2-manual.x)/manual.z);
  expect(resizeBoardView(view,fitted,old,old,true)).toEqual(view);
 });
});
