import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CONSTRUCTION_RECIPES,constructionAction,nextConstructionStep} from '../rules/constructionProgression';
import {applyAction} from '../rules/gameState';
import {actingOnTurn,affordability} from '../rules/constructionRules';
import {CONSTRUCTION_COSTS,type ConstructionCost} from '../rules/economyConfig';
import {useGameStore} from '../store/gameStore';
import {formatGold,vi} from '../i18n/vi';
import type {Player,Resource} from '../types';
import type {GameState} from '../rules/types';
import './construction.css';

export function CostTable({cost,player}:{cost:ConstructionCost;player:Player}){
  const rows=[{name:'Vàng',need:cost.gold,owned:player.cash},...Object.entries(cost.resources).map(([r,n])=>({name:vi.resources[r as Resource],need:n!,owned:player.resources[r as Resource]}))];
  return <table className="construction-cost"><thead><tr><th>Chi phí</th><th>Cần</th><th>Đang có</th></tr></thead><tbody>{rows.map(r=><tr key={r.name} className={r.owned<r.need?'shortage':''}><th>{r.name}</th><td>{r.need}</td><td>{r.owned}</td></tr>)}</tbody></table>;
}
export function ConstructionRecipes({onClose}:{onClose:()=>void}){
  const s=useGameStore(),me=s.players.find(p=>p.id===s.localPlayerId)!;
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[onClose]);
  return createPortal(<div className="construction-backdrop" onClick={onClose}><section className="construction-dialog" role="dialog" aria-modal="true" aria-label="Công thức xây dựng" onClick={e=>e.stopPropagation()}><button autoFocus className="construction-close" aria-label="Đóng công thức" onClick={onClose}>×</button><h2>Công thức xây dựng</h2><p>Khu định cư 1 → 2 → Nhà máy 1 → 2 → 3</p><p>Hai khu định cư cấp 1 ban đầu được đặt miễn phí trong setup.</p><p>Tối đa 4 khu định cư/công ty, 1 nhà máy/khu. Nhà máy cần khu định cư cấp 2 và không thay thế khu định cư.</p>{CONSTRUCTION_RECIPES.map(step=><section key={step.label}><h3>{step.label}</h3><CostTable cost={step.cost} player={me}/></section>)}</section></div>,document.body);
}
export function constructionState(s:ReturnType<typeof useGameStore.getState>):GameState{
  return{...s,roomId:s.room?.id??'local',seed:0,turnIndex:s.turn,targetProfit:s.targetProfit??0};
}
export function constructionUnavailable(s:ReturnType<typeof useGameStore.getState>){
  if(s.connection!=='connected')return 'Chưa kết nối máy chủ. Hãy kết nối lại.';
  if(s.busy)return 'Đang chờ máy chủ xác nhận.';
  return actingOnTurn(constructionState(s),s.localPlayerId);
}
export function SettlementControls(){
  const s=useGameStore(),[recipes,setRecipes]=useState(false),me=s.players.find(p=>p.id===s.localPlayerId)!;
  const reason=s.setup?'Giai đoạn chuẩn bị: đặt 2 khu định cư miễn phí trên bản đồ theo lượt.':constructionUnavailable(s)??(s.buildings.filter(b=>b.playerId===me.id).length>=4?'Bạn đã đạt giới hạn 4 khu định cư.':affordability(me,CONSTRUCTION_COSTS.settlement));
  return <div className="construction-controls">
    <button className="secondary" disabled={s.setup} aria-pressed={s.mode==='settlement'} onClick={()=>{if(reason)useGameStore.setState({notice:reason});s.setMode(s.mode==='settlement'?'inspect':'settlement')}}>Xây khu định cư</button>
    <button className="secondary" onClick={()=>setRecipes(true)}>Công thức xây dựng</button>
    <p>{reason??(s.mode==='settlement'?'Chọn giao điểm sáng trên bản đồ để xem chi phí và xác nhận.':'Chọn công trình của bạn trên bản đồ để nâng cấp.')}</p>
    <p>{s.setup?'Hai khu định cư ban đầu không tốn vàng hoặc nguyên liệu.':'Chi phí: '+formatGold(CONSTRUCTION_COSTS.settlement.gold)+' · 1 kim loại · 2 gỗ · 1 lúa mì.'}</p>{!s.setup&&s.mode==='settlement'&&<CostTable cost={CONSTRUCTION_COSTS.settlement} player={me}/>}
    {recipes&&<ConstructionRecipes onClose={()=>setRecipes(false)}/>}
  </div>;
}
export function ConstructionPopover({vertexId,anchor,onClose}:{vertexId:string;anchor:DOMRect;onClose:()=>void}){
  const s=useGameStore(),[confirm,setConfirm]=useState(false),box=useRef<HTMLElement>(null),[position,setPosition]=useState({left:anchor.right+10,top:anchor.top});
  const me=s.players.find(p=>p.id===s.localPlayerId)!,home=s.buildings.find(b=>b.vertexId===vertexId),factory=s.factories.find(f=>f.vertexId===vertexId);
  const mine=!home||home.playerId===me.id,step=nextConstructionStep(s,vertexId,me.id);
  const action=step?constructionAction(step,me.id,vertexId):null;
  const preview=action?applyAction(constructionState(s),action):null;
  const reason=constructionUnavailable(s)??(preview&&!preview.ok?preview.error:null);
  useLayoutEffect(()=>{
    const place=()=>{const rect=box.current?.getBoundingClientRect();if(!rect)return;setPosition({left:Math.max(12,Math.min(anchor.right+10,window.innerWidth-rect.width-12)),top:Math.max(12,Math.min(anchor.top,window.innerHeight-rect.height-12))})};
    place();const observer=new ResizeObserver(place);if(box.current)observer.observe(box.current);window.addEventListener('resize',place);return()=>{observer.disconnect();window.removeEventListener('resize',place)};
  },[anchor,confirm]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[onClose]);
  useEffect(()=>setConfirm(false),[step?.label]);
  return createPortal(<section ref={box} className="construction-popover" style={position} role="dialog" aria-label="Phát triển công trình">
    <button className="construction-close" aria-label="Đóng công trình" onClick={onClose}>×</button>
    <h3>{home?'Khu định cư cấp '+home.level:'Vị trí khu định cư mới'}{factory?' · Nhà máy cấp '+factory.level:''}</h3>
    {!mine?<p>Đây là công trình đối thủ. Bạn không thể nâng cấp.</p>:!step?<p role="status">Đã đạt cấp tối đa — Nhà máy cấp 3.</p>:<>
      {!confirm?<button autoFocus className="primary" onClick={()=>setConfirm(true)}>{step.label}</button>:<><h4>{step.label}</h4><CostTable cost={step.cost} player={me}/><button className="primary" disabled={!!reason} onClick={()=>{if(reason||!action)return;const current=useGameStore.getState();if(action.type==='BUILD_SETTLEMENT')current.buildSettlement(vertexId);else if(action.type==='UPGRADE_SETTLEMENT')current.upgradeSettlement(vertexId);else if(action.type==='BUILD_FACTORY')current.buildFactory(vertexId);else if(action.type==='UPGRADE_FACTORY')current.upgradeFactory(vertexId);onClose()}}>Xác nhận {step.label.toLowerCase()}</button></>}
      {reason&&<p className="construction-reason" role="status">{reason}</p>}
    </>}
    {s.notice&&<p role="status">{s.notice}</p>}
  </section>,document.body);
}
