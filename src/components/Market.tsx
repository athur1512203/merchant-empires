import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Minus,Plus} from 'lucide-react';
import {RAW_MATERIALS,getNpcQuote} from '../rules';
import {useGameStore,canControl} from '../store/gameStore';
import {formatGold,vi} from '../i18n/vi';
import {ResourceIcon} from './ResourceIcon';
import type {Resource} from '../types';

type PendingTrade={resource:Resource;quantity:number;side:'buy'|'sell';expectedStock:number;version:number;roomId?:string};
export function Market(){
 const s=useGameStore(),me=s.players.find(p=>p.id===s.localPlayerId)??s.players[0];
 const [item,setItem]=useState<Resource>('metal'),[amount,setAmount]=useState(1),[toast,setToast]=useState('');
 const pending=useRef<PendingTrade|null>(null);
 const valid=Number.isInteger(amount)&&amount>0;
 const buy=getNpcQuote(s,item,'buy',amount),sell=getNpcQuote(s,item,'sell',amount);
 const blocked=!canControl(s)||s.auction.status==='open'||s.ended||!s.rolled;
 const buyReason=blocked?'Chỉ giao dịch trong lượt của bạn, sau khi gieo và ngoài phiên đấu thầu.':!valid?'Nhập số lượng nguyên dương.':buy.total>me.cash?'Không đủ vàng để mua.':null;
 const sellReason=blocked?'Chỉ giao dịch trong lượt của bạn, sau khi gieo và ngoài phiên đấu thầu.':!valid?'Nhập số lượng nguyên dương.':amount>me.resources[item]?'Không đủ nguyên liệu để bán.':null;
 useEffect(()=>{
  const trade=pending.current;if(!trade)return;
  if(s.room?.id!==trade.roomId||s.notice||s.connection==='replaced'){pending.current=null;return}
  // Confirm only after the server snapshot changes stock and the command settles.
  if(!s.busy&&s.connection==='connected'&&s.version>trade.version&&me.resources[trade.resource]===trade.expectedStock){
   setToast(`Đã ${trade.side==='buy'?'mua':'bán'} ${trade.quantity} ${vi.resources[trade.resource].toLowerCase()}.`);pending.current=null;
  }
 },[s.version,s.busy,s.connection,s.notice,s.room?.id,me.resources]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(timer)},[toast]);
 const transact=(side:'buy'|'sell')=>{
  if(side==='buy'?buyReason:sellReason)return;
  pending.current={resource:item,quantity:amount,side,expectedStock:me.resources[item]+(side==='buy'?amount:-amount),version:s.version,roomId:s.room?.id};
  setToast('');if(side==='buy')s.buy(item,amount);else s.sell(item,amount);
 };
 return <section className="market-panel" aria-label="Thị trường nguyên liệu">
  <h3>Bảng giá NPC</h3><div className="market-price-grid">{RAW_MATERIALS.map(resource=>{
   const purchase=getNpcQuote(s,resource,'buy',1),sale=getNpcQuote(s,resource,'sell',1);
   const change=s.priceHistory.find(p=>p.resource===resource&&p.round===s.round);
   return <article className="market-price-card" key={resource}><div className="market-resource-name"><ResourceIcon type={resource} size={32}/><b>{vi.resources[resource]}</b></div><div className="market-price buy-price"><span>Mua</span><strong>{formatGold(purchase.unitPrice)}</strong></div><div className="market-price sell-price"><span>Bán</span><strong>{formatGold(sale.unitPrice)}</strong></div><small className="market-change">{change?`${change.percent>=0?'+':''}${change.percent.toFixed(0)}% · vòng ${change.round}`:'Chưa có biến động vòng này'}</small></article>;
  })}</div>
  <h3>Chọn nguyên liệu</h3><div className="market-resource-list">{RAW_MATERIALS.map(resource=><button key={resource} className={'market-resource-row '+(item===resource?'selected':'')} aria-pressed={item===resource} aria-label={'Chọn '+vi.resources[resource]} onClick={()=>setItem(resource)}><ResourceIcon type={resource} size={32}/><span className="market-row-details"><b>{vi.resources[resource]}</b><span><span className="buy-price">Mua {formatGold(getNpcQuote(s,resource,'buy',1).unitPrice)}</span><span className="sell-price">Bán {formatGold(getNpcQuote(s,resource,'sell',1).unitPrice)}</span></span><small>Đang có: {me.resources[resource]}</small></span><span className="market-selection" aria-hidden="true">{item===resource?<Check size={16}/>:'Chọn'}</span></button>)}</div>
  <section className="market-order" aria-label="Giao dịch NPC"><div className="market-resource-name"><ResourceIcon type={item} size={32}/><h3>Giao dịch {vi.resources[item].toLowerCase()}</h3></div><label htmlFor="market-quantity">Số lượng giao dịch</label><div className="market-quantity"><button aria-label="Giảm số lượng" disabled={!Number.isFinite(amount)||amount<=1} onClick={()=>setAmount(n=>Math.max(1,n-1))}><Minus size={18}/></button><input id="market-quantity" type="number" min={1} step={1} value={Number.isNaN(amount)?'':amount} onChange={e=>setAmount(e.target.value===''?NaN:Number(e.target.value))}/><button aria-label="Tăng số lượng" onClick={()=>setAmount(n=>Number.isFinite(n)?n+1:1)}><Plus size={18}/></button></div>
   <div className="market-totals"><div><span>Tổng chi khi mua</span><b className="buy-price">{valid?formatGold(buy.total):'—'}</b></div><div><span>Tổng thu khi bán</span><b className="sell-price">{valid?formatGold(sell.total):'—'}</b></div></div>
   <div className="market-submit"><button className="primary" disabled={!!buyReason} aria-describedby={buyReason?'market-buy-reason':undefined} onClick={()=>transact('buy')}>Mua từ NPC</button><button className="secondary" disabled={!!sellReason} aria-describedby={sellReason?'market-sell-reason':undefined} onClick={()=>transact('sell')}>Bán cho NPC</button></div>
   {buyReason&&<p id="market-buy-reason" className="market-reason">Mua: {buyReason}</p>}{sellReason&&<p id="market-sell-reason" className="market-reason">Bán: {sellReason}</p>}
  </section>
  {toast&&createPortal(<div className="trade-toast" role="status"><Check size={18}/>{toast}<button aria-label="Đóng xác nhận giao dịch" onClick={()=>setToast('')}>×</button></div>,document.body)}
 </section>;
}
