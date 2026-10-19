import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('../store/gameStore',async()=>{
 const {createWaitingState}=await import('../rules/gameState');
 const {visualFromBoard}=await import('../engine/hexGrid');
 const game=createWaitingState();
 const state={...game,...visualFromBoard(game.board),started:true,setup:false,ended:false,turn:0,mode:'inspect',localPlayerId:0,connection:'connected',busy:false,room:null,onlinePlayerIds:[],notice:null,selectedVertex:null,selectedHex:null,priceHistory:[],trades:[],logs:[],activeHexes:[],setMode:vi.fn()};
 return {useGameStore:()=>state,canControl:()=>state.turn===0,restoreConnection:vi.fn()};
});
import App from '../App';
import {useGameStore} from '../store/gameStore';
const state=()=>useGameStore();
const html=()=>renderToStaticMarkup(createElement(App));
describe('in-match layout and existing turn restrictions',()=>{
 beforeEach(()=>{Object.assign(state(),{turn:0,mode:'inspect',setup:false,ended:false,started:true,rolled:false,auction:{status:'idle',lot:null,bids:[],bidSeat:0}})});
 it('has exactly one right sidebar and no history UI or duplicated bottom inventory',()=>{
  const markup=html();expect(markup.match(/<aside/g)).toHaveLength(1);expect(markup).toContain('id="game-sidebar"');
  expect(markup).not.toMatch(/history-btn|history-drawer|bottom-bar|Lịch sử/);
  expect(markup.match(/class="recipe-book"/g)).toHaveLength(6);
  expect(markup).toContain('role="tablist"');
 });
 it('enables dice before roll, then end-turn after roll',()=>{
  let markup=html();expect(markup).toMatch(/class="primary dice"><span>Gieo xúc xắc/);expect(markup).toMatch(/class="end-turn" disabled=""/);
  state().rolled=true;markup=html();expect(markup).toMatch(/class="primary dice" disabled=""/);expect(markup).toMatch(/class="end-turn">/);
 });
 it.each(['setup','ended'] as const)('keeps both actions disabled during %s',key=>{
  state()[key]=true;const markup=html();expect(markup).toMatch(/class="primary dice" disabled=""/);expect(markup).toMatch(/class="end-turn" disabled=""/);
 });
 it('keeps both actions disabled outside the local turn and during bidding',()=>{
  state().turn=1;expect(html()).toMatch(/class="primary dice" disabled=""/);expect(html()).toMatch(/class="end-turn" disabled=""/);
  state().turn=0;state().auction.status='open';expect(html()).toMatch(/class="primary dice" disabled=""/);expect(html()).toMatch(/class="end-turn" disabled=""/);
 });
 it('renders small markers only while placing, and only on valid empty vertices',()=>{
  expect(html()).not.toContain('class="build-marker-dot"');
  state().mode='settlement';const placing=html();
  expect(placing).toContain('class="build-marker-dot"');
  const dots=placing.match(/class="build-marker-dot"/g)?.length;
  expect(placing.match(/class="build-marker-target"/g)?.length).toBe(dots);
  state().turn=1;expect(html()).not.toContain('class="build-marker-dot"');
 });
});
