import {useEffect,useState} from 'react';
import {motion} from 'framer-motion';
import {Factory,Landmark,Menu,Settings,X} from 'lucide-react';
import {Board} from './components/Board';
import {EconomyPanel} from './components/EconomyPanel';
import {PlayerDossier} from './components/PlayerDossier';
import {ConstructionRecipesButton} from './components/ConstructionUI';
import {useGameStore,restoreConnection,canControl} from './store/gameStore';
import {Lobby} from './components/Lobby';
import {SETUP_SETTLEMENTS_PER_PLAYER} from './rules/types';
import './multiplayer.css';
import {formatGold,vi} from './i18n/vi';


function App(){
 const s=useGameStore(),[settings,setSettings]=useState(false),[sidebarOpen,setSidebarOpen]=useState(false),[narrow,setNarrow]=useState(false);
 useEffect(()=>{const media=window.matchMedia('(max-width: 900px)'),update=()=>setNarrow(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!e.defaultPrevented)setSidebarOpen(false)};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[]);
 useEffect(()=>{if(s.mode==='settlement')setSidebarOpen(false)},[s.mode]);
 useEffect(()=>{restoreConnection()},[]);
 const actor=s.players.find(p=>p.id===s.seats[s.turn])??s.players[0];

 const sum=s.dice?s.dice[0]+s.dice[1]:null;
 const ranking=[...s.players].sort((a,b)=>b.profit-a.profit||a.id-b.id);
 const winner=s.winnerId!=null?s.players.find(p=>p.id===s.winnerId):undefined;
 const selected=s.hexes.find(h=>h.id===s.selectedHex);
 return <main className="game-app">
  <header className="game-header"><Factory className="header-crest"/><div className="game-brand">MERCHANT <span>EMPIRES</span></div><div className="header-round">Vòng <b>{s.round}</b></div><div className="header-active"><small>Đang đến lượt</small><b style={{color:actor.color}}>{actor.name}</b></div><span className="match-status">{s.ended?'Đã kết thúc':s.setup?'Chuẩn bị':s.auction.status==='open'?'Đấu thầu':s.started?'Đang chơi':'Phòng chờ'}</span><button className="icon-btn" title={vi.settings} aria-label={vi.settings} onClick={()=>setSettings(true)}><Settings/></button><button className="icon-btn sidebar-toggle" aria-label="Mở bảng điều hành" aria-expanded={sidebarOpen} aria-controls="game-sidebar" onClick={()=>setSidebarOpen(!sidebarOpen)}><Menu/></button></header>
  <div className="workspace"><section className="center" aria-label="Bản đồ Ironhaven"><Board/></section>
   {narrow&&sidebarOpen&&<button className="sidebar-scrim" aria-label="Đóng bảng điều hành" onClick={()=>setSidebarOpen(false)}/>}
   <aside id="game-sidebar" aria-label="Bảng điều hành công ty" className={'right panel game-sidebar '+(sidebarOpen?'is-open':'')} inert={narrow&&!sidebarOpen}>
    <div className="drawer-toolbar"><span>Điều hành công ty</span><button className="drawer-close icon-btn" aria-label="Đóng sidebar" onClick={()=>setSidebarOpen(false)}><X/></button></div><div className="sidebar-scroll"><PlayerDossier/>
    <div className="session-status" data-status={s.connection}><span>{s.room?'Phòng '+s.room.roomCode:'Multiplayer 2–4 người'} · {s.connection==='connected'?'Đã kết nối':s.connection==='replaced'?'Phiên ở tab khác':s.connection==='syncing'?'Đang đồng bộ':s.connection==='connecting'?'Đang kết nối':'Mất kết nối'}</span>{s.room&&<small>{s.onlinePlayerIds.length}/{s.room.players.length} trực tuyến</small>}{s.connection!=='connected'&&<button className="secondary" onClick={s.reconnect}>Kết nối lại</button>}</div>
    <ConstructionRecipesButton/><EconomyPanel/>{selected&&<section className="selected-district"><h3>{vi.resources[selected.resource]} · Số {selected.number}</h3><button className="text-btn" onClick={()=>s.selectHex(null)}>{vi.clearSelection}</button></section>}
    {s.setup&&<div className="setup-card"><div className="section-title"><span>{vi.setupBanner}</span></div><p>{vi.setupPlacing}: <b style={{color:actor.color}}>{s.room?.players.find(p=>p.companyId===actor.id)?.displayName??actor.name} · {actor.name}</b></p><p>{vi.setupSettlements}: {s.buildings.filter(b=>b.playerId===actor.id).length}/{SETUP_SETTLEMENTS_PER_PLAYER} khu định cư miễn phí</p><p>Hai lượt đặt theo thứ tự tham gia phòng. Được đặt sát nhau, chỉ không được trùng đỉnh.</p><ul>{s.seats.map(id=><li key={id} style={{color:s.players.find(p=>p.id===id)?.color}}>{s.room?.players.find(p=>p.companyId===id)?.displayName??s.players.find(p=>p.id===id)?.name} · {s.players.find(p=>p.id===id)?.name}: {s.buildings.filter(b=>b.playerId===id).length}/{SETUP_SETTLEMENTS_PER_PLAYER}{id===s.seats[s.turn]?" · Đang đặt":""}</li>)}</ul><p>{vi.setupHint}</p>{s.notice&&<p className="field-error">{s.notice}</p>}</div>}
    </div><div className="actions turn-actions"><div className="section-title"><span>{vi.operations}</span><small>{s.setup?vi.setupBanner.split('—')[0].trim():s.rolled?vi.diceResolved:vi.awaitingRoll}</small></div><button className="primary dice" onClick={s.roll} disabled={!canControl(s)||s.auction.status==='open'||s.rolled||!s.started||s.ended||s.setup}><span>{s.dice?`${s.dice[0]} + ${s.dice[1]} = ${sum}`:vi.rollDice}</span></button><button className="end-turn" onClick={s.endTurn} disabled={!canControl(s)||s.auction.status==='open'||!s.started||s.ended||s.setup||!s.rolled}>{vi.endTurn} <span>→</span></button></div></aside></div>
  {!s.started&&<Lobby/>}
  {s.ended&&winner&&<div className="start-overlay"><motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="start-card"><Landmark/><small>{vi.victoryTitle}</small><h1>{winner.name}</h1><p>{vi.cumulativeProfit}: <b>{formatGold(winner.profit)}</b><br/>{vi.targetProfit}: <b>{formatGold(s.targetProfit??0)}</b></p><div className="final-rank">{ranking.map((p,i)=><div key={p.id}><b>{i+1}</b><span>{p.name}</span><strong>{formatGold(p.profit)}</strong></div>)}</div><button className="primary" onClick={s.newMatch}>{vi.newMatch}</button></motion.div></div>}
  {settings&&<div className="modal" onClick={()=>setSettings(false)}><div onClick={e=>e.stopPropagation()}><button className="close" aria-label={vi.close} title={vi.close} onClick={()=>setSettings(false)}><X/></button><Settings/><h2>{vi.settings}</h2><p>{vi.settingsDescription}</p>{s.started&&s.targetProfit!=null&&<p>{vi.targetProfit}: <b>{formatGold(s.targetProfit)}</b> — không thể thay đổi trong trận.</p>}<label><input type="checkbox" defaultChecked/> {vi.subtleAnimations}</label><label><input type="checkbox" defaultChecked/> {vi.productionHighlights}</label></div></div>}
 </main>
}
export default App;
