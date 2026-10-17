import {describe,expect,it} from 'vitest';
import {AUCTION_EVERY_ROUNDS,DELIVERY_ROUNDS,generateContract,penaltyAmount} from './economyConfig';
import {applyAction,createWaitingState} from './gameState';
import {visibleBids} from './auctionRules';
import {mulberry32} from './rng';
import type {GameState} from './types';

function playing(over:Partial<GameState>={}):GameState{return{...createWaitingState(),phase:'playing',targetProfit:50_000,seed:21,rolled:true,...over}}
const act=(s:GameState,a:Parameters<typeof applyAction>[1])=>applyAction(s,a);
function playTurns(s:GameState,n:number){let cur=s;for(let i=0;i<n;i++){cur={...cur,rolled:true};const r=act(cur,{type:'END_TURN',playerId:cur.seats[cur.turnIndex]});if(!r.ok)throw new Error(r.error);cur=r.state}return cur}

describe('Contracts & Auctions',()=>{
  it('không mở sớm và mở sau đúng 3 vòng, không mở hai lần',()=>{
    let s=playTurns(playing(),11);
    expect(s.round).toBe(3);expect(s.auction.status).toBe('idle');
    s=playTurns(s,1);
    expect(s.auction.status).toBe('open');expect(s.round).toBe(3);
    const snap=structuredClone(s);
    expect(act(s,{type:'END_TURN',playerId:s.seats[s.turnIndex]}).ok).toBe(false);
    expect(s).toEqual(snap);
  });
  it('cùng seed tạo cùng hợp đồng hợp lệ',()=>{
    const a=generateContract(mulberry32((21+3*13_331)>>>0),3,1),b=generateContract(mulberry32((21+3*13_331)>>>0),3,1);
    expect(a).toEqual(b);expect(a.quantity).toBeGreaterThan(0);expect(['machinery','rail','furniture','flour','fabric','clothing']).toContain(a.product);
  });
  it('mỗi người một giá, không gửi thay người khác, từ chối giá không hợp lệ, giữ kín trước khi đóng',()=>{
    let s=playTurns(playing(),12);
    expect(act(s,{type:'SUBMIT_BID',playerId:1,amount:10}).ok).toBe(false);
    expect(act(s,{type:'SUBMIT_BID',playerId:0,amount:0}).ok).toBe(false);
    expect(act(s,{type:'SUBMIT_BID',playerId:0,amount:1.5}).ok).toBe(false);
    const r=act(s,{type:'SUBMIT_BID',playerId:0,amount:20});expect(r.ok).toBe(true);if(!r.ok)return;
    expect(visibleBids(r.state.auction,1)).toEqual([]);
    expect(visibleBids(r.state.auction,0)[0].amount).toBe(20);
    expect(act(r.state,{type:'SUBMIT_BID',playerId:0,amount:15}).ok).toBe(false);
    s=r.state;
    s=act(s,{type:'SUBMIT_BID',playerId:1,amount:20}).ok? (act(s,{type:'SUBMIT_BID',playerId:1,amount:20}) as {ok:true;state:GameState}).state:s;
  });
  it('giá thấp nhất thắng, hòa thì người gửi trước, bỏ qua được, đủ 4 quyết định thì đóng, không tăng vòng khi đang đấu',()=>{
    let s=playTurns(playing(),12);expect(s.round).toBe(3);
    let r=act(s,{type:'SUBMIT_BID',playerId:0,amount:30});if(!r.ok)throw Error();
    r=act(r.state,{type:'SUBMIT_BID',playerId:1,amount:12});if(!r.ok)throw Error();
    r=act(r.state,{type:'SUBMIT_BID',playerId:2,amount:12});if(!r.ok)throw Error();
    expect(r.state.round).toBe(3);
    r=act(r.state,{type:'SKIP_BID',playerId:3});if(!r.ok)throw Error();
    expect(r.state.auction.status).toBe('idle');
    expect(r.state.round).toBe(4);
    const won=r.state.contracts[0];
    expect(won.winnerId).toBe(1);expect(won.winningBid).toBe(12);expect(won.deadlineRound).toBe(3+DELIVERY_ROUNDS);
    expect(won.status).toBe('active');expect(r.state.players[1].profit).toBe(0);
  });
  it('giao hàng: chủ sở hữu, đúng loại, không vượt, từng phần, trừ kho, chưa khóa hàng còn lại, thanh toán một lần',()=>{
    let s=playTurns(playing(),12);
    for(const [id,amount] of [[0,11],[1,40],[2,40]] as const){const a=act(s,{type:'SUBMIT_BID',playerId:id,amount});if(!a.ok)throw Error();s=a.state}
    {const a=act(s,{type:'SKIP_BID',playerId:3});if(!a.ok)throw Error();s=a.state}
    const c=s.contracts[0];expect(c.winnerId).toBe(0);
    s.players[0]={...s.players[0],products:{...s.players[0].products,[c.product]:c.quantity+2},inventoryCost:{...s.players[0].inventoryCost,[c.product]:c.quantity*10},cash:0};
    s={...s,rolled:true};
    expect(act(s,{type:'DELIVER_CONTRACT',playerId:1,contractId:c.id,quantity:1}).ok).toBe(false);
    const first=act(s,{type:'DELIVER_CONTRACT',playerId:0,contractId:c.id,quantity:1});expect(first.ok).toBe(true);if(!first.ok)return;
    expect(first.state.players[0].cash).toBe(0);expect(first.state.players[0].revenue).toBe(0);
    expect(first.state.players[0].products[c.product]).toBe(c.quantity+1);
    expect(first.state.contracts[0].delivered).toBe(1);
    const rest=c.quantity-1;
    const done=act(first.state,{type:'DELIVER_CONTRACT',playerId:0,contractId:c.id,quantity:rest});expect(done.ok).toBe(true);if(!done.ok)return;
    expect(done.state.contracts[0].status).toBe('completed');expect(done.state.contracts[0].paid).toBe(true);
    expect(done.state.players[0].cash).toBe(11);expect(done.state.players[0].revenue).toBe(11);
    expect(done.state.players[0].profit).toBe(11-done.state.players[0].costs);
    expect(act(done.state,{type:'DELIVER_CONTRACT',playerId:0,contractId:c.id,quantity:1}).ok).toBe(false);
  });
  it('hết hạn phạt 20% một lần, thiếu vàng thành outstandingPenalty, không giao sau hạn',()=>{
    let s=playTurns(playing(),12);
    for(const amount of [9,50,50]){const id=s.auction.bidSeat,r=act(s,{type:'SUBMIT_BID',playerId:id,amount});if(!r.ok)throw Error();s=r.state}
    const skip=act(s,{type:'SKIP_BID',playerId:3});if(!skip.ok)throw Error();s=skip.state;
    const c=s.contracts[0];expect(c.winnerId).toBe(0);
    s.players[0]={...s.players[0],cash:1};
    s=playTurns({...s,rolled:true},AUCTION_EVERY_ROUNDS*4);
    const failed=s.contracts.find(x=>x.id===c.id)!;
    expect(failed.status).toBe('failed');expect(failed.penaltyApplied).toBe(true);
    expect(s.players[0].profit).toBe(-penaltyAmount(9));
    expect(s.players[0].outstandingPenalty).toBeGreaterThan(0);
    s={...s,auction:{...s.auction,status:'idle'},rolled:true};
    expect(act(s,{type:'DELIVER_CONTRACT',playerId:0,contractId:c.id,quantity:1}).ok).toBe(false);
    const again=s.players[0].outstandingPenalty;
    s=failOnce(s,c.id);
    expect(s.players[0].outstandingPenalty).toBe(again);
  });
  it('đạt profitTarget kết thúc, action sau đó bị từ chối',()=>{
    let s=playTurns(playing({targetProfit:5}),12);
    const r0=act(s,{type:'SUBMIT_BID',playerId:0,amount:5});if(!r0.ok)throw Error();s=r0.state;
    for(const id of [1,2,3]){const r=act(s,{type:'SKIP_BID',playerId:id});if(!r.ok)throw Error();s=r.state}
    const c=s.contracts[0];
    s.players[0]={...s.players[0],products:{...s.players[0].products,[c.product]:c.quantity},inventoryCost:{...s.players[0].inventoryCost,[c.product]:0}};
    const d=act({...s,rolled:true},{type:'DELIVER_CONTRACT',playerId:0,contractId:c.id,quantity:c.quantity});
    expect(d.ok&&d.state.phase).toBe('finished');
    if(!d.ok)return;
    expect(act(d.state,{type:'ROLL_DICE',playerId:0}).ok).toBe(false);
  });
});
function failOnce(s:GameState,id:string){return{...s,contracts:s.contracts.map(c=>c.id===id?{...c,status:'failed' as const,penaltyApplied:true}:c)}}
