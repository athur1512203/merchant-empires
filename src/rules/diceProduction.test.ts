import {describe,expect,it} from 'vitest';
import {createWaitingState} from './gameState';
import {calculateResourceProduction,getActivatedHexes} from './productionRules';
import {canRollDice,getDiceTotal,rollDice} from './diceRules';
import {canEndTurn,endTurn,getNextPlayer} from './turnRules';
import type {Building} from '../types';
import type {GameState} from './types';

const fixed=(...values:number[])=>{let i=0;return()=>values[i++]??values.at(-1)??0};
function playing(){return{...createWaitingState(),phase:'playing' as const,round:1,turnIndex:0,dice:null,rolled:false}}
function withToken(level:1|2|3=1){const s=playing(),v=s.board.vertices.find(x=>x.hexIds.length>=2)!,ids=new Set(v.hexIds);return{...s,board:{...s.board,hexes:s.board.hexes.map(h=>({...h,number:ids.has(h.id)?6:3}))},buildings:[{vertexId:v.id,playerId:0,type:'settlement',level} as Building]}}

describe('DiceRules',()=>{
 it('mỗi viên luôn từ 1 đến 6',()=>{for(let n=0;n<6;n++){const r=rollDice(playing(),0,fixed(n/6,n/6));expect(r.ok&&r.state.dice?.every(d=>d>=1&&d<=6)).toBe(true)}});
 it('tổng luôn từ 2 đến 12',()=>{expect(getDiceTotal(1,1)).toBe(2);expect(getDiceTotal(6,6)).toBe(12)});
 it('không gieo khi chưa playing',()=>expect(canRollDice(createWaitingState(),0).ok).toBe(false));
 it('không gieo ngoài lượt',()=>expect(canRollDice(playing(),1).ok).toBe(false));
 it('không gieo hai lần',()=>expect(canRollDice({...playing(),rolled:true},0).ok).toBe(false));
 it('action gieo chỉ phân phối một lần',()=>{const s=withToken(),r=rollDice(s,0,fixed(.45,.45));expect(r.ok).toBe(true);if(!r.ok)return;const count=r.state.players[0].resources[r.state.board.hexes.find(h=>h.number===6)!.resource];expect(rollDice(r.state,0,fixed(.45,.45)).ok).toBe(false);expect(r.state.players[0].resources[r.state.board.hexes.find(h=>h.number===6)!.resource]).toBe(count)});
});

describe('ProductionRules',()=>{
 it('tổng 7 không tạo tài nguyên',()=>expect(calculateResourceProduction(withToken(),7)).toEqual({}));
 it('tìm đúng các hex được kích hoạt',()=>expect(getActivatedHexes(withToken().board,6).length).toBeGreaterThanOrEqual(2));
 it.each([1,2,3] as const)('khu định cư cấp %s nhận đúng sản lượng mỗi hex',level=>{const s=withToken(level),v=s.board.vertices.find(x=>x.id===s.buildings[0].vertexId)!;const result=calculateResourceProduction(s,6)[0];const expected:Record<string,number>={};for(const id of v.hexIds){const r=s.board.hexes.find(h=>h.id===id)!.resource;expected[r]=(expected[r]??0)+level}expect(result).toEqual(expected)});
 it('nhiều công ty cùng nhận tài nguyên',()=>{const s=withToken(),v1=s.board.vertices.find(v=>v.id!==s.buildings[0].vertexId&&v.hexIds.some(id=>s.board.hexes.find(h=>h.id===id)?.number===6))!;s.buildings.push({vertexId:v1.id,playerId:1,type:'settlement',level:1});const r=calculateResourceProduction(s,6);expect(r[0]).toBeTruthy();expect(r[1]).toBeTruthy()});
 it('nhiều hex cùng số được cộng dồn',()=>{const s=withToken(),r=calculateResourceProduction(s,6)[0];expect(Object.values(r).reduce((a,b)=>a+(b??0),0)).toBeGreaterThanOrEqual(2)});
 it('nhiều khu định cư cùng công ty được cộng dồn',()=>{const s=withToken(),v=s.board.vertices.find(x=>x.id!==s.buildings[0].vertexId&&x.hexIds.some(id=>s.board.hexes.find(h=>h.id===id)?.number===6))!;s.buildings.push({vertexId:v.id,playerId:0,type:'settlement',level:1});expect(Object.values(calculateResourceProduction(s,6)[0]).reduce((a,b)=>a+(b??0),0)).toBeGreaterThan(2)});
 it('không có khu định cư phù hợp thì không tạo tài nguyên',()=>expect(calculateResourceProduction({...withToken(),buildings:[]},6)).toEqual({}));
});

describe('TurnRules',()=>{
 it('không kết thúc trước khi gieo',()=>expect(canEndTurn(playing(),0).ok).toBe(false));
 it('không kết thúc lượt người khác',()=>expect(canEndTurn({...playing(),rolled:true},1).ok).toBe(false));
 it('chuyển P1 → P2 → P3 → P4',()=>{let s:GameState={...playing(),rolled:true};for(let i=1;i<=3;i++){const r=endTurn(s,i-1);expect(r.ok&&r.state.turnIndex).toBe(i);if(!r.ok)return;s={...r.state,rolled:true}}});
 it('sau P4 tăng vòng và về P1',()=>{const s={...playing(),turnIndex:3,rolled:true},r=endTurn(s,3);expect(r.ok&&[r.state.turnIndex,r.state.round]).toEqual([0,2])});
 it('reset trạng thái gieo ở lượt mới',()=>{const r=endTurn({...playing(),rolled:true,dice:[2,3]},0);expect(r.ok&&r.state.rolled).toBe(false);expect(r.ok&&r.state.dice).toBe(null)});
 it('getNextPlayer không sửa state đầu vào',()=>{const s=playing(),n=getNextPlayer(s);expect(n.playerId).toBe(1);expect(s.turnIndex).toBe(0)});
});
