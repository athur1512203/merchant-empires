import {useState} from 'react';
import {PRODUCTS,PRODUCT_PRICES} from '../config/economy';
import {CONSTRUCTION_COSTS,FACTORY_CAPACITY,FACTORY_COSTS,RAW_MATERIALS,getNpcQuote,manufactureQuote,remainingCapacity,visibleBids,type ConstructionCost} from '../rules';
import {qty} from '../engine/economyEngine';
import {formatGold,vi} from '../i18n/vi';
import {useGameStore,canControl} from '../store/gameStore';
import type {Commodity,Product,Resource} from '../types';

export function EconomyPanel(){
  const s=useGameStore(),me=s.players.find(p=>p.id===s.localPlayerId)??s.players[0],[tab,setTab]=useState<'industry'|'market'|'tender'>('industry');
  const building=s.buildings.find(b=>b.vertexId===s.selectedVertex);
  const factory=s.factories.find(f=>f.vertexId===s.selectedVertex);
  const mine=building?.playerId===me.id;
  const cap=factory?remainingCapacity(factory):0;
  return <div className="economy">
    <div className="tabs">{(['industry','market','tender'] as const).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t==='industry'?vi.industry:t==='market'?vi.trade:vi.industrialTender}</button>)}</div>
    {s.notice&&<div className="notice">{s.notice}<button onClick={s.clearNotice}>{vi.close}</button></div>}
    {tab==='industry'&&<Industry mine={!!mine} cap={cap}/>}
    {tab==='market'&&<Market/>}
    {tab==='tender'&&<Tender/>}
  </div>;
}

function costLabel(cost:ConstructionCost){return `${cost.gold} vàng · ${Object.entries(cost.resources).map(([r,n])=>`${n} ${vi.resources[r as Resource]}`).join(', ')}`}
function Industry({mine,cap}:{mine:boolean;cap:number}){
  const s=useGameStore(),me=s.players.find(p=>p.id===s.localPlayerId)??s.players[0],id=s.selectedVertex;
  const building=s.buildings.find(b=>b.vertexId===id);
  const factory=s.factories.find(f=>f.vertexId===id);
  const [product,setProduct]=useState<Product>('machinery'),[batches,setBatches]=useState(1);
  const quote=manufactureQuote(product,Number.isInteger(batches)?batches:0);
  if(!id||!building)return <p>{vi.chooseSite}</p>;
  if(!mine)return <p>Đây không phải khu định cư của doanh nghiệp đang lượt.</p>;
  const nextSettle=building.level<3?CONSTRUCTION_COSTS.upgrade[(building.level+1) as 2|3]:null;
  const nextFact=factory?factory.level<3?FACTORY_COSTS.upgrade[(factory.level+1) as 2|3]:null:FACTORY_COSTS.build;
  const busy=!canControl(s)||s.auction.status==='open'||s.ended||!s.rolled;
  return <>
    <h3>Khu định cư cấp {building.level}{factory?` · Nhà máy cấp ${factory.level}`:' · Chưa có nhà máy'}</h3>
    <p>{vi.capacity}: <b>{factory?`${cap} / ${FACTORY_CAPACITY[factory.level]} lô`:'Chưa có nhà máy — không hoạt động'}</b></p>
    {nextSettle&&<button className="secondary" disabled={busy} onClick={()=>s.upgradeSettlement(id)}>{vi.upgradeSettlement} · {costLabel(nextSettle)}</button>}
    {!factory&&<button className="secondary" disabled={busy} onClick={()=>s.buildFactory(id)}>{vi.buildFactory} · {costLabel(FACTORY_COSTS.build)}</button>}
    {factory&&nextFact&&<button className="secondary" disabled={busy} onClick={()=>s.upgradeFactory(id)}>{vi.upgradeFactory} · {costLabel(nextFact)}</button>}
    {factory&&<div className="produce-box">
      <div className="section-title"><span>{vi.produce}</span><small>{vi.capacity} {cap} lô</small></div>
      {PRODUCTS.map(p=>{
        const r=manufactureQuote(p,1);
        return <label key={p} className={product===p?'picked':''}><input type="radio" name="prod" checked={product===p} onChange={()=>setProduct(p)}/>
          <span><b>{vi.products[p]}</b>
            <small>{vi.recipe}: {Object.entries(r.inputs).map(([c,n])=>`${n} ${vi.commodities[c as Commodity]}`).join(' · ')} + {r.gold} vàng → {r.output}
              {' · '}{vi.owned}: {Object.entries(r.inputs).map(([c])=>`${qty(me,c as Commodity)} ${vi.commodities[c as Commodity]}`).join(', ')}</small>
          </span></label>;
      })}
      <p>Tổng lô: {quote.gold} vàng · {Object.entries(quote.inputs).map(([c,n])=>`${n} ${vi.commodities[c as Commodity]}`).join(' · ')} → {quote.output} {vi.products[product]} · tồn kho sau: {me.products[product]+(Number.isInteger(batches)&&batches>0?quote.output:0)}</p>
      <div className="qty-row"><input type="number" min={1} step={1} value={batches} onChange={e=>setBatches(Number(e.target.value))}/><button className="primary" disabled={busy||!Number.isInteger(batches)||batches<1||quote.capacity>cap||quote.gold>me.cash} onClick={()=>s.produce(id,product,batches)}>{vi.produce} {quote.output} {vi.products[product]}</button></div>
    </div>}
  </>;
}

function Market(){
  const s=useGameStore(),me=s.players.find(p=>p.id===s.localPlayerId)??s.players[0],[item,setItem]=useState<Resource>('metal'),[amount,setAmount]=useState(1);
  const owned=qty(me,item),n=amount,buy=getNpcQuote(s,item,'buy',n),sell=getNpcQuote(s,item,'sell',n);
  const last=s.priceHistory[0];
  return <>
    <div className="section-title"><span>{vi.trade}</span><small>{vi.priceMoves}</small></div>
    <div className="price-list">{(['metal','wood','wheat','cotton'] as const).map(r=>{
      const ch=s.priceHistory.find(x=>x.resource===r&&x.round===s.round);
      const prev=s.priceHistory.find(x=>x.resource===r);
      return <div key={r}><small>{vi.resources[r]}</small><b>{s.resourcePrices[r]}</b><em>{ch?`${ch.percent>=0?'+':''}${ch.percent.toFixed(0)}%`:prev?`${prev.to}`:'—'}</em></div>;
    })}</div>
    {s.priceHistory.length>0&&<p>{s.priceHistory.slice(0,4).map(c=>`${vi.resources[c.resource]} vòng ${c.round}: ${c.from}→${c.to} (${c.percent>=0?'+':''}${c.percent.toFixed(0)}%)`).join(' · ')}</p>}
    {RAW_MATERIALS.map(c=>{
      const q=qty(me,c);
      const bp=getNpcQuote(s,c,'buy',1).unitPrice,sp=getNpcQuote(s,c,'sell',1).unitPrice;
      return <button key={c} className={`pick ${item===c?'active':''}`} onClick={()=>setItem(c)}><b>{vi.commodities[c]}</b><span>Mua {bp} · Bán {sp} · {vi.stock} {q}</span></button>;
    })}
    <div className="qty-row"><input type="number" min={1} step={1} value={amount} onChange={e=>setAmount(Number(e.target.value))}/>
      <div><small>Tổng mua / nhận</small><b>{Number.isInteger(n)&&n>0?`${formatGold(buy.total)} / ${formatGold(sell.total)}`:'—'}</b></div></div>
    <div className="qty-row"><button className="secondary" disabled={!canControl(s)||s.auction.status==='open'||s.ended||!s.rolled||!Number.isInteger(n)||n<1||buy.total>me.cash} onClick={()=>s.buy(item,n)}>Mua từ NPC</button><button className="primary" disabled={!canControl(s)||s.auction.status==='open'||s.ended||!s.rolled||!Number.isInteger(n)||n<1||n>owned} onClick={()=>s.sell(item,n)}>{vi.confirmSell}</button></div>
    {s.trades.filter(t=>t.playerId===me.id).slice(0,4).map(t=><p key={t.id}>Vòng {t.round}: bán {t.amount} {vi.commodities[t.item]} · {formatGold(t.revenue)} · {vi.cogs} {Math.round(t.cogs)}</p>)}
    {last?null:null}
  </>;
}

function Tender(){
  const s=useGameStore(),me=s.players.find(p=>p.id===s.localPlayerId)??s.players[0],lot=s.auction.lot,[bid,setBid]=useState(lot?.referenceValue??1),[qtyD,setQtyD]=useState(1);
  const mine=visibleBids(s.auction,me.id);
  const latest=s.contracts[s.contracts.length-1];
  const active=s.contracts.filter(c=>c.status==='active');
  return <>
    <div className="section-title"><span>{vi.industrialTender}</span><small className={s.auction.status==='open'?'live':''}>{s.auction.status==='open'?'ĐANG ĐẤU THẦU':'CHỜ PHIÊN'}</small></div>
    {s.auction.status==='open'&&lot&&<>
      <h3>{lot.name}</h3>
      <div className="contract-grid">
        <span><small>{vi.requires}</small><b>{lot.quantity} {vi.products[lot.product]}</b></span>
        <span><small>Giá trị tham khảo</small><b>{formatGold(lot.referenceValue)}</b></span>
        <span><small>Trạng thái</small><b>Kín</b></span>
      </div>
      {mine.length===0&&s.seats[s.auction.bidSeat]===me.id&&<>
        <div className="qty-row"><input type="number" min={1} max={lot.referenceValue} value={bid} onChange={e=>setBid(Number(e.target.value)||0)}/><span>{vi.yourBid}</span></div>
        <div className="qty-row"><button className="primary" disabled={!canControl(s)||s.ended} onClick={()=>s.bid(bid)}>{vi.submitBid}</button><button className="secondary" disabled={!canControl(s)} onClick={s.skipBid}>Bỏ qua</button></div>
      </>}
      {mine.length>0&&<p>{vi.hidden} · {formatGold(mine[0].amount)}</p>}
      {s.seats[s.auction.bidSeat]!==me.id&&<p>Đang chờ công ty khác quyết định. Giá đối thủ được giữ kín.</p>}
    </>}
    {s.auction.status!=='open'&&latest&&latest.winnerId!=null&&<p>{vi.winner}: {s.players.find(p=>p.id===latest.winnerId)?.name} · {formatGold(latest.winningBid??0)} · {latest.status}</p>}
    <div className="section-title"><span>Hợp đồng đang thực hiện</span></div>
    {active.length===0&&<p>Chưa có hợp đồng đang giao.</p>}
    {active.map(c=>{
      const remaining=c.quantity-c.delivered,mineC=c.winnerId===me.id;
      return <div key={c.id} className="contract-grid">
        <span><small>{c.name}</small><b>{c.delivered}/{c.quantity} {vi.products[c.product]}</b></span>
        <span><small>{vi.deadline}</small><b>{vi.round} {c.deadlineRound}</b></span>
        {mineC&&<div className="qty-row"><input type="number" min={1} max={remaining} value={qtyD} onChange={e=>setQtyD(Number(e.target.value)||1)}/><button className="primary" disabled={!canControl(s)||s.auction.status==='open'||s.ended||!s.rolled} onClick={()=>s.deliver(c.id,qtyD)}>{vi.deliverContract}</button></div>}
      </div>;
    })}
    {s.contracts.filter(c=>c.status==='completed'||c.status==='failed').slice(-3).map(c=><p key={c.id}>{c.name}: {c.status==='completed'?`Hoàn thành · ${formatGold(c.winningBid??0)}`:'Thất bại · phạt 20%'}{c.paid?' · đã thanh toán':''}</p>)}
    {s.ended&&s.winnerId!=null&&<p>{vi.victoryTitle}: {s.players.find(p=>p.id===s.winnerId)?.name}</p>}
  </>;
}

export function FinanceStrip(){
  const s=useGameStore(),me=s.players.find(p=>p.id===s.localPlayerId)??s.players[0];
  return <div className="finance-more"><span>{vi.revenue} {formatGold(me.revenue)}</span><span>{vi.cogs} {formatGold(me.costs)}</span><span>{vi.opex} {formatGold(me.operatingCosts)}</span><span>{vi.capex} {formatGold(me.capitalExpenditure)}</span></div>;
}
