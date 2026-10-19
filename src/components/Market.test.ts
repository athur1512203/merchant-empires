import {describe,it,expect,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('../store/gameStore',async()=>{
 const {createWaitingState}=await import('../rules/gameState');
 const game=createWaitingState();
 const state={...game,localPlayerId:0,rolled:true,ended:false,turn:0,priceHistory:[],version:1,connection:'connected',busy:false,notice:null};
 return {useGameStore:()=>state,canControl:()=>state.turn===0&&!state.busy};
});
import {Market} from './Market';
import {useGameStore} from '../store/gameStore';
import {getNpcQuote} from '../rules/marketRules';
import {formatGold} from '../i18n/vi';
describe('NPC market presentation',()=>{
 it('shows four asset-backed price cards and selectable inventory rows',()=>{
  const html=renderToStaticMarkup(createElement(Market));
  expect(html.match(/class="market-price-card"/g)).toHaveLength(4);
  expect(html.match(/class="commodity-icon"/g)).toHaveLength(9);
  expect(html).toContain('Chọn Kim loại');expect(html).toContain('Số lượng giao dịch');
  expect(html).toContain('Giảm số lượng');expect(html).toContain('Tăng số lượng');
  expect(html).toContain('Mua từ NPC');expect(html).toContain('Bán cho NPC');
 });
 it('uses live NPC quotes and communicates insufficient gold and stock',()=>{
  const state=useGameStore();state.resourcePrices.metal=37;state.players[0].cash=0;state.players[0].resources.metal=0;
  const html=renderToStaticMarkup(createElement(Market));
  expect(html).toContain(formatGold(getNpcQuote(state,'metal','buy',1).total));
  expect(html).toContain(formatGold(getNpcQuote(state,'metal','sell',1).total));
  expect(html).toContain('Không đủ vàng để mua.');expect(html).toContain('Không đủ nguyên liệu để bán.');
  expect(html).toMatch(/disabled=""[^>]*>Mua từ NPC/);expect(html).toMatch(/disabled=""[^>]*>Bán cho NPC/);
 });
 it('does not allow trade outside the current turn',()=>{
  const state=useGameStore();state.turn=1;
  const html=renderToStaticMarkup(createElement(Market));
  expect(html).toContain('Chỉ giao dịch trong lượt của bạn');expect(html).toMatch(/disabled=""[^>]*>Mua từ NPC/);
 });
});
