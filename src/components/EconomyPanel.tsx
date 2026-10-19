import {contractKind,DELIVERY_ROUNDS,finishedContractsUnlocked} from '../rules/economyConfig';
import {SettlementControls} from './ConstructionUI';
import {useState} from 'react';
import {Market} from './Market';
import {PRODUCTS} from '../config/economy';
import {FACTORY_CAPACITY,manufactureQuote,remainingCapacity,visibleBids} from '../rules';
import {qty} from '../engine/economyEngine';
import {formatGold,vi} from '../i18n/vi';
import {useGameStore,canControl} from '../store/gameStore';
import type {Commodity,Product} from '../types';

export function EconomyPanel(){
  const s=useGameStore(),me=s.players.find(p=>p.id===s.localPlayerId)??s.players[0],[tab,setTab]=useState<'industry'|'market'|'tender'>('industry');
  const building=s.buildings.find(b=>b.vertexId===s.selectedVertex);
  const factory=s.factories.find(f=>f.vertexId===s.selectedVertex);
  const mine=building?.playerId===me.id;
  const cap=factory?remainingCapacity(factory):0;
  return <div className="economy">
    <div className="tabs" role="tablist" aria-label="Chức năng công ty">{(['industry','market','tender'] as const).map(t=><button role="tab" aria-selected={tab===t} aria-controls="economy-content" id={"tab-"+t} key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t==='industry'?vi.industry:t==='market'?vi.trade:vi.industrialTender}</button>)}</div>
    {s.notice&&<div className="notice" role="status">{s.notice}<button onClick={s.clearNotice}>{vi.close}</button></div>}
    <div id="economy-content" role="tabpanel" aria-labelledby={"tab-"+tab}>{tab==='industry'&&<Industry mine={!!mine} cap={cap}/>}
    {tab==='market'&&<Market/>}
    {tab==='tender'&&<Tender/>}</div>
  </div>;
}

function Industry({mine,cap}:{mine:boolean;cap:number}){
  const s=useGameStore(),me=s.players.find(p=>p.id===s.localPlayerId)??s.players[0],id=s.selectedVertex;
  const building=s.buildings.find(b=>b.vertexId===id);
  const factory=s.factories.find(f=>f.vertexId===id);
  const [product,setProduct]=useState<Product>('machinery'),[batches,setBatches]=useState(1);
  const quote=manufactureQuote(product,Number.isInteger(batches)?batches:0);
  if(!id||!building)return <><SettlementControls/><p>{vi.chooseSite}</p></>;
  if(!mine)return <><SettlementControls/><p>Chọn công trình của bạn để sản xuất.</p></>;
  const busy=!canControl(s)||s.auction.status==='open'||s.ended||!s.rolled;
  return <><SettlementControls/>
    <h3>Khu định cư cấp {building.level}{factory?` · Nhà máy cấp ${factory.level}`:' · Chưa có nhà máy'}</h3>
    <p>{vi.capacity}: <b>{factory?`${cap} / ${FACTORY_CAPACITY[factory.level]} lô`:'Chưa có nhà máy — không hoạt động'}</b></p>
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

function Tender(){
  const s=useGameStore(),me=s.players.find(p=>p.id===s.localPlayerId)??s.players[0],lot=s.auction.lot,[bid,setBid]=useState(lot?.referenceValue??1),[qtyD,setQtyD]=useState(1);
  const mine=visibleBids(s.auction,me.id);
  const latest=s.contracts[s.contracts.length-1];
  const active=s.contracts.filter(c=>c.status==='active');
  return <>
    <div className="section-title"><span>{vi.industrialTender}</span><small className={s.auction.status==='open'?'live':''}>{s.auction.status==='open'?'ĐANG ĐẤU THẦU':'CHỜ PHIÊN'}</small></div>
    <p role="status">{finishedContractsUnlocked(s.round)?'Đã mở khóa hợp đồng thành phẩm từ vòng 31. Nguyên liệu và thành phẩm cùng tham gia đấu thầu.':'Vòng 1–30: chỉ đấu thầu nguyên liệu. Thành phẩm mở khóa từ vòng 31, phiên đầu có thể xuất hiện là cuối vòng 33.'}</p>
    {s.auction.status==='open'&&lot&&<>
      <small className="contract-kind">{contractKind(lot)}</small><h3>{lot.name}</h3>
      <div className="contract-grid">
        <span><small>{vi.requires}</small><b>{lot.quantity} {vi.commodities[lot.product]}</b></span>
        <span><small>Giá trị tham khảo</small><b>{formatGold(lot.referenceValue)}</b></span>
        <span><small>{vi.deadline}</small><b>{DELIVERY_ROUNDS} vòng sau phiên · hết vòng {(s.auction.openedAfterRound??s.round)+DELIVERY_ROUNDS}</b></span><span><small>Trạng thái</small><b>Kín</b></span>
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
        <span><small>{contractKind(c)} · {c.name}</small><b>{c.delivered}/{c.quantity} {vi.commodities[c.product]}</b></span>
        <span><small>{vi.deadline}</small><b>Hết {vi.round.toLowerCase()} {c.deadlineRound}</b></span><span><small>Giá tham chiếu</small><b>{formatGold(c.referenceValue)}</b></span>
        {mineC&&<div className="qty-row"><input aria-label={"Số lượng giao "+vi.commodities[c.product]} type="number" min={1} max={remaining} value={qtyD} onChange={e=>setQtyD(Number(e.target.value)||1)}/><button className="primary" disabled={!canControl(s)||s.auction.status==='open'||s.ended||!s.rolled||!Number.isInteger(qtyD)||qtyD<1||qtyD>remaining} onClick={()=>s.deliver(c.id,qtyD)}>{vi.deliverContract}</button></div>}
      </div>;
    })}
    {s.ended&&s.winnerId!=null&&<p>{vi.victoryTitle}: {s.players.find(p=>p.id===s.winnerId)?.name}</p>}
  </>;
}
