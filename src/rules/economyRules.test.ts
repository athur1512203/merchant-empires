import {describe,expect,it} from 'vitest';
import type {Building,Resource} from '../types';
import {CONSTRUCTION_COSTS,REFERENCE_RAW_PRICES} from './economyConfig';
import {applyAction,createWaitingState} from './gameState';
import {getNpcQuote,updateMarketPrices} from './marketRules';
import type {GameState} from './types';

function playing(over:Partial<GameState>={}):GameState{return{...createWaitingState(),phase:'playing',targetProfit:100,seed:42,rolled:true,...over}}
function rich():GameState{const s=playing(),p=s.players[0];return{...s,players:[{...p,cash:1000,resources:{metal:10,wood:10,wheat:10,cotton:10}},...s.players.slice(1)]}}
function validVertex(s:GameState){return s.board.vertices.find(v=>!s.buildings.some(b=>b.vertexId===v.id||(s.board.adjacency[v.id]??[]).includes(b.vertexId)))!.id}
const act=(s:GameState,a:Parameters<typeof applyAction>[1])=>applyAction(s,a);

describe('EconomyConfig',()=>{
 it('cả bốn giá ban đầu bằng 10',()=>expect(REFERENCE_RAW_PRICES).toEqual({metal:10,wood:10,wheat:10,cotton:10}));
 it('người chơi bắt đầu với 0 vàng',()=>expect(createWaitingState().players.every(p=>p.cash===0)).toBe(true));
 it('spread NPC không tạo chênh lệch mua bán chắc thắng',()=>{const s=playing();expect(getNpcQuote(s,'metal','buy',1).unitPrice).toBeGreaterThan(getNpcQuote(s,'metal','sell',1).unitPrice)});
});

describe('NPC Market',()=>{
 it('không mua khi thiếu vàng',()=>expect(act(playing(),{type:'BUY_RAW_MATERIAL',playerId:0,resource:'metal',quantity:1}).ok).toBe(false));
 it('bán nguyên liệu tự khai thác tạo vàng và lợi nhuận',()=>{const s=playing(),p=s.players[0];s.players[0]={...p,resources:{...p.resources,metal:2}};const r=act(s,{type:'SELL_RAW_MATERIAL',playerId:0,resource:'metal',quantity:1});expect(r.ok&&r.state.players[0]).toMatchObject({cash:9,revenue:9,costs:0,profit:9})});
 it('mua trừ đúng tiền, cộng kho và giá vốn',()=>{const r=act(rich(),{type:'BUY_RAW_MATERIAL',playerId:0,resource:'metal',quantity:2});expect(r.ok&&r.state.players[0]).toMatchObject({cash:978,resources:{metal:12},inventoryCost:{metal:22},profit:0})});
 it('bán cộng tiền và trừ kho',()=>{const r=act(rich(),{type:'SELL_RAW_MATERIAL',playerId:0,resource:'wood',quantity:2});expect(r.ok&&r.state.players[0]).toMatchObject({cash:1018,resources:{wood:8},revenue:18})});
 it('không bán vượt tồn kho',()=>expect(act(rich(),{type:'SELL_RAW_MATERIAL',playerId:0,resource:'wheat',quantity:11}).ok).toBe(false));
 it.each([0,-1,1.5,NaN,Infinity])('từ chối số lượng %s',quantity=>expect(act(rich(),{type:'BUY_RAW_MATERIAL',playerId:0,resource:'metal',quantity}).ok).toBe(false));
 it('không giao dịch ngoài lượt',()=>expect(act(rich(),{type:'BUY_RAW_MATERIAL',playerId:1,resource:'metal',quantity:1}).ok).toBe(false));
 it('không giao dịch trước khi gieo',()=>expect(act({...rich(),rolled:false},{type:'SELL_RAW_MATERIAL',playerId:0,resource:'metal',quantity:1}).ok).toBe(false));
 it('action lỗi giữ nguyên state',()=>{const s=rich(),snapshot=structuredClone(s);act(s,{type:'SELL_RAW_MATERIAL',playerId:0,resource:'metal',quantity:999});expect(s).toEqual(snapshot)});
 it('mua rồi bán không sinh lợi nhuận',()=>{const s=rich();s.players[0]={...s.players[0],resources:{...s.players[0].resources,metal:0}};let r=act(s,{type:'BUY_RAW_MATERIAL',playerId:0,resource:'metal',quantity:1});expect(r.ok).toBe(true);if(!r.ok)return;r=act(r.state,{type:'SELL_RAW_MATERIAL',playerId:0,resource:'metal',quantity:1});expect(r.ok&&r.state.players[0].profit).toBeLessThanOrEqual(0)});
 it('giá vốn bình quân gia quyền được ghi nhận khi bán',()=>{let s=rich();s.players[0]={...s.players[0],resources:{...s.players[0].resources,metal:0}};let r=act(s,{type:'BUY_RAW_MATERIAL',playerId:0,resource:'metal',quantity:2});if(!r.ok)throw Error();r=act(r.state,{type:'SELL_RAW_MATERIAL',playerId:0,resource:'metal',quantity:1});expect(r.ok&&r.state.players[0]).toMatchObject({costs:11,inventoryCost:{metal:11}})});
 it('mua tăng và bán giảm áp lực giá',()=>{let r=act(rich(),{type:'BUY_RAW_MATERIAL',playerId:0,resource:'metal',quantity:2});if(!r.ok)throw Error();expect(r.state.marketPressure.metal).toBe(2);r=act(r.state,{type:'SELL_RAW_MATERIAL',playerId:0,resource:'metal',quantity:1});expect(r.ok&&r.state.marketPressure.metal).toBe(1)});
 it('cung cầu tác động đúng chiều lên giá',()=>{const up=updateMarketPrices({...playing(),marketPressure:{metal:20,wood:0,wheat:0,cotton:0}},()=>.5),down=updateMarketPrices({...playing(),marketPressure:{metal:-20,wood:0,wheat:0,cotton:0}},()=>.5);expect(up.resourcePrices.metal).toBeGreaterThan(10);expect(down.resourcePrices.metal).toBeLessThan(10)});
 it('cùng seed và chuỗi action cho cùng kết quả',()=>{const run=()=>{let s=rich();for(let i=0;i<4;i++){s={...s,turnIndex:i,rolled:true};const r=act(s,{type:'END_TURN',playerId:i});if(!r.ok)throw Error();s=r.state}return s.resourcePrices};expect(run()).toEqual(run())});
 it('giá chỉ cập nhật sau lượt P4',()=>{let s=rich();s.marketPressure.metal=20;for(let i=0;i<3;i++){s={...s,turnIndex:i,rolled:true};const r=act(s,{type:'END_TURN',playerId:i});if(!r.ok)throw Error();expect(r.state.resourcePrices.metal).toBe(10);s=r.state}s={...s,turnIndex:3,rolled:true};const r=act(s,{type:'END_TURN',playerId:3});expect(r.ok&&r.state.resourcePrices.metal).not.toBe(10)});
 it('không thể cập nhật giá lần hai trong cùng một lần kết thúc vòng',()=>{const s={...rich(),turnIndex:3,rolled:true,marketPressure:{metal:20,wood:0,wheat:0,cotton:0}},first=act(s,{type:'END_TURN',playerId:3});expect(first.ok).toBe(true);if(!first.ok)return;const snapshot=structuredClone(first.state),second=act(first.state,{type:'END_TURN',playerId:3});expect(second.ok).toBe(false);expect(first.state).toEqual(snapshot)});
 it('đạt profitTarget kết thúc trận',()=>{const s=playing({targetProfit:9}),p=s.players[0];s.players[0]={...p,resources:{...p.resources,metal:1}};const r=act(s,{type:'SELL_RAW_MATERIAL',playerId:0,resource:'metal',quantity:1});expect(r.ok&&[r.state.phase,r.state.winnerId]).toEqual(['finished',0])});
});

describe('ConstructionRules',()=>{
 it('không xây khi thiếu nguyên liệu',()=>{const s=playing();s.players[0]={...s.players[0],cash:100};expect(act(s,{type:'BUILD_SETTLEMENT',playerId:0,vertexId:validVertex(s)}).ok).toBe(false)});
 it('không xây khi thiếu vàng',()=>{const s=rich();s.players[0]={...s.players[0],cash:0};expect(act(s,{type:'BUILD_SETTLEMENT',playerId:0,vertexId:validVertex(s)}).ok).toBe(false)});
 it('không xây ở đỉnh không hợp lệ',()=>expect(act(rich(),{type:'BUILD_SETTLEMENT',playerId:0,vertexId:'missing'}).ok).toBe(false));
 it('xây thành công trừ đúng chi phí, không đổi lợi nhuận',()=>{const s=rich(),id=validVertex(s),r=act(s,{type:'BUILD_SETTLEMENT',playerId:0,vertexId:id});expect(r.ok&&r.state.players[0]).toMatchObject({cash:1000-CONSTRUCTION_COSTS.settlement.gold,profit:0});expect(r.ok&&r.state.buildings.some(b=>b.vertexId===id&&b.level===1)).toBe(true)});
 it('không xây quá 3 khu định cư',()=>{const s=rich();s.buildings=s.board.vertices.slice(0,3).map((v):Building=>({vertexId:v.id,playerId:0,type:'settlement',level:1}));expect(act(s,{type:'BUILD_SETTLEMENT',playerId:0,vertexId:validVertex(s)}).ok).toBe(false)});
 it('nâng cấp lần lượt 1→2→3',()=>{let s=rich(),id=validVertex(s);s.buildings=[{vertexId:id,playerId:0,type:'settlement',level:1}];let r=act(s,{type:'UPGRADE_SETTLEMENT',playerId:0,vertexId:id});expect(r.ok&&r.state.buildings[0].level).toBe(2);if(!r.ok)return;r=act(r.state,{type:'UPGRADE_SETTLEMENT',playerId:0,vertexId:id});expect(r.ok&&r.state.buildings[0].level).toBe(3)});
 it('không nâng vượt cấp 3',()=>{const s=rich(),id=validVertex(s);s.buildings=[{vertexId:id,playerId:0,type:'settlement',level:3}];expect(act(s,{type:'UPGRADE_SETTLEMENT',playerId:0,vertexId:id}).ok).toBe(false)});
 it('không nâng công trình đối thủ',()=>{const s=rich(),id=validVertex(s);s.buildings=[{vertexId:id,playerId:1,type:'settlement',level:1}];expect(act(s,{type:'UPGRADE_SETTLEMENT',playerId:0,vertexId:id}).ok).toBe(false)});
 it('CAPEX có chi phí nhưng lợi nhuận không bị trừ',()=>{const s=rich(),id=validVertex(s);s.buildings=[{vertexId:id,playerId:0,type:'settlement',level:1}];const r=act(s,{type:'UPGRADE_SETTLEMENT',playerId:0,vertexId:id});expect(r.ok&&r.state.players[0].capitalExpenditure).toBe(50);expect(r.ok&&r.state.players[0].profit).toBe(0)});
});
