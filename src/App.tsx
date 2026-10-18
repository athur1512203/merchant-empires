import {useEffect,useState} from 'react';
import {AnimatePresence,motion} from 'framer-motion';
import {Banknote,Factory,Landmark,Menu,Settings,ShieldCheck,TrendingUp,X} from 'lucide-react';
import {Board} from './components/Board';
import {EconomyPanel,FinanceStrip} from './components/EconomyPanel';
import {PlayerDossier} from './components/PlayerDossier';
import {ResourceIcon} from './components/ResourceIcon';
import {useGameStore,restoreConnection,canControl} from './store/gameStore';
import {Lobby} from './components/Lobby';
import './multiplayer.css';
import {formatGold,vi} from './i18n/vi';
import type {Resource} from './types';

function App(){
 const s=useGameStore(),[settings,setSettings]=useState(false);
 useEffect(()=>{restoreConnection()},[]);
 const actor=s.players.find(p=>p.id===s.seats[s.turn])??s.players[0];
 const hexes=s.hexes,topology={vertices:s.vertices};
 const selected=hexes.find(h=>h.id===s.selectedHex),sum=s.dice?s.dice[0]+s.dice[1]:null;
 const ranking=[...s.players].sort((a,b)=>b.profit-a.profit||a.id-b.id);
 const hasAdjacentBuilding=selected?s.buildings.some(b=>topology.vertices.find(v=>v.id===b.vertexId)?.hexIds.includes(selected.id)):false;
 const winner=s.winnerId!=null?s.players.find(p=>p.id===s.winnerId):undefined;
 const self=s.players.find(p=>p.id===s.localPlayerId)??s.players[0];
 return <main>
  <header><div className="brand-mark"><Factory/></div><div className="brand"><b>MERCHANT</b><span>EMPIRES</span></div><div className="header-rule"/><div className="location"><small>{vi.map}</small><b>IRONHAVEN</b></div><div className="turn-meta"><div><small>{vi.round}</small><b>{s.setup?vi.setupBanner.split('—')[0].trim():String(s.round).padStart(2,'0')}</b></div>{s.targetProfit!=null&&<div><small>{vi.targetProfit}</small><b>{formatGold(s.targetProfit)}</b></div>}<div><small>{vi.activeCompany}</small><b style={{color:actor.color}}>{actor.name}</b></div><button className="icon-btn" title={vi.settings} aria-label={vi.settings} onClick={()=>setSettings(true)}><Settings/></button></div></header>
  <div className="connection-bar" data-status={s.connection} role="status"><strong>{s.room?'Phòng '+s.room.roomCode:'Multiplayer 2–4 người'}</strong><span>{s.connection==='connected'?'Đã kết nối':s.connection==='replaced'?'Phiên ở tab khác':s.connection==='syncing'?'Đang đồng bộ':s.connection==='connecting'?'Đang kết nối':'Chưa kết nối'}</span>{s.room&&<span>{self.name} · {s.onlinePlayerIds.length}/{s.room.players.length} trực tuyến</span>}{s.started&&<span>{canControl(s)?'Đến lượt bạn':s.busy?'Đang xử lý…':'Đang chờ lượt'}</span>}{s.connection!=='connected'&&<button onClick={s.reconnect}>Kết nối lại</button>}{s.started&&s.notice&&<span>{s.notice}</span>}</div>
  <div className="workspace"><PlayerDossier/>
   <section className="center"><Board/><div className="bottom-bar">{(['metal','wood','wheat','cotton'] as Resource[]).map(r=><div className="resource" key={r}><span className={r}><ResourceIcon type={r}/></span><div><small>{vi.resources[r]}</small><b>{self.resources[r]}</b></div></div>)}<div className="financial"><div><Banknote/><span><small>{vi.cash}</small><b>{formatGold(self.cash)}</b></span></div><div><TrendingUp/><span><small>{vi.cumulativeProfit}</small><b>{formatGold(self.profit)}</b></span></div></div><button className="history-btn" onClick={s.toggleHistory}><Menu/> {vi.history}</button></div><FinanceStrip/></section>
   <aside className="right panel">
    <EconomyPanel/>
    <div className="inspector"><div className="section-title"><span>{selected?vi.districtDossier:vi.commandOffice}</span><ShieldCheck/></div>{selected?<><div className={`district-icon ${selected.resource}`}><ResourceIcon type={selected.resource} size={30}/></div><h3>{vi.district} {vi.resources[selected.resource]}</h3><p>{vi.productionRoll} <b>{selected.number}</b>. {hasAdjacentBuilding?vi.nearbyInfrastructure:''}</p><button className="text-btn" onClick={()=>s.selectHex(null)}>{vi.clearSelection}</button></>:<p>{vi.selectDistrict}</p>}</div>
    {s.setup&&<div className="setup-card"><div className="section-title"><span>{vi.setupBanner}</span></div><p>{vi.setupPlacing}: <b style={{color:actor.color}}>{actor.name}</b></p><p>{vi.setupSettlements}: {s.buildings.filter(b=>b.playerId===actor.id).length}/1</p><p>{vi.setupHint}</p>{s.notice&&<p className="field-error">{s.notice}</p>}</div>}
    <div className="actions"><div className="section-title"><span>{vi.operations}</span><small>{s.setup?vi.setupBanner.split('—')[0].trim():s.rolled?vi.diceResolved:vi.awaitingRoll}</small></div><button className="primary dice" onClick={s.roll} disabled={!canControl(s)||s.auction.status==='open'||s.rolled||!s.started||s.ended||s.setup}><span>{s.dice?`${s.dice[0]} + ${s.dice[1]} = ${sum}`:vi.rollDice}</span></button><button className="end-turn" onClick={s.endTurn} disabled={!canControl(s)||s.auction.status==='open'||!s.started||s.ended||s.setup||!s.rolled}>{vi.endTurn} <span>→</span></button></div></aside></div>
  {!s.started&&<Lobby/>}
  {s.ended&&winner&&<div className="start-overlay"><motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="start-card"><Landmark/><small>{vi.victoryTitle}</small><h1>{winner.name}</h1><p>{vi.cumulativeProfit}: <b>{formatGold(winner.profit)}</b><br/>{vi.targetProfit}: <b>{formatGold(s.targetProfit??0)}</b></p><div className="final-rank">{ranking.map((p,i)=><div key={p.id}><b>{i+1}</b><span>{p.name}</span><strong>{formatGold(p.profit)}</strong></div>)}</div><button className="primary" onClick={s.newMatch}>{vi.newMatch}</button></motion.div></div>}
  <AnimatePresence>{s.historyOpen&&<motion.div className="history-drawer" initial={{x:-380}} animate={{x:0}} exit={{x:-380}}><div className="section-title"><span>{vi.gazette}</span><button aria-label={vi.close} title={vi.close} onClick={s.toggleHistory}><X/></button></div>{s.logs.map(l=><div className={`log ${l.kind}`} key={l.id}><i/><p>{l.text}</p></div>)}</motion.div>}</AnimatePresence>
  {settings&&<div className="modal" onClick={()=>setSettings(false)}><div onClick={e=>e.stopPropagation()}><button className="close" aria-label={vi.close} title={vi.close} onClick={()=>setSettings(false)}><X/></button><Settings/><h2>{vi.settings}</h2><p>{vi.settingsDescription}</p>{s.started&&s.targetProfit!=null&&<p>{vi.targetProfit}: <b>{formatGold(s.targetProfit)}</b> — không thể thay đổi trong trận.</p>}<label><input type="checkbox" defaultChecked/> {vi.subtleAnimations}</label><label><input type="checkbox" defaultChecked/> {vi.productionHighlights}</label></div></div>}
 </main>
}
export default App;
