import {useMemo,useRef,useState} from 'react';
import {RotateCcw,ZoomIn,ZoomOut} from 'lucide-react';
import {hexCorners} from '../engine/hexGrid';
import {useGameStore,canControl} from '../store/gameStore';
import {canPlaceSettlement} from '../rules';
import {ResourceIcon} from './ResourceIcon';
import {ConstructionPopover} from './ConstructionUI';
import {vi} from '../i18n/vi';
import type {Hex} from '../types';
const palette={metal:['#536272','#263642'],wood:['#38694f','#173b31'],wheat:['#b58b3b','#6e5222'],cotton:['#8b6e92','#4c3754']} as const;
const pts=(h:Hex)=>hexCorners(h).map(p=>`${p.x},${p.y}`).join(' ');
type Drag={x:number;y:number;vx:number;vy:number;moved:boolean};
export function Board(){
 const s=useGameStore(),[view,setView]=useState({x:470,y:325,z:1}),drag=useRef<Drag|null>(null),[popup,setPopup]=useState<{id:string;anchor:DOMRect}|null>(null);
 const hexes=s.hexes,topology={vertices:s.vertices,edges:s.edges};
 const color=(id:number)=>s.players.find(p=>p.id===id)?.color??'#ccc';
 const placing=!!s.setup&&canControl(s);
 const actor=s.players.find(p=>p.id===s.localPlayerId)??s.players[0];
 const validVs=useMemo(()=>new Set(s.vertices.filter(v=>canPlaceSettlement({board:s.board,buildings:s.buildings},v.id,actor.id).ok).map(v=>v.id)),[s.vertices,s.board,s.buildings,actor.id]);
 const hint=s.setup||s.mode==='settlement'?vi.chooseJunction:vi.surveyHint;
 const showVertices=canControl(s)&&(placing||s.mode==='settlement');
 return <><div className="board-shell" onWheel={e=>{e.preventDefault();setPopup(null);setView(v=>({...v,z:Math.max(.55,Math.min(1.8,v.z*(e.deltaY>0?.9:1.1)))}))}} onPointerDown={e=>{
  const el=e.target as Element;
  if(el.closest?.('.vertex,.map-tools,button'))return;
  setPopup(null);drag.current={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y,moved:false};
 }} onPointerMove={e=>{
  if(!drag.current)return;
  const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;
  if(!drag.current.moved&&dx*dx+dy*dy<36)return;
  drag.current.moved=true;
  setView(v=>({...v,x:drag.current!.vx+dx,y:drag.current!.vy+dy}));
 }} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}>
 <svg className="board" viewBox="0 0 940 650"><defs><filter id="shadow"><feDropShadow dx="0" dy="5" stdDeviation="5" floodOpacity=".55"/></filter><pattern id="grain" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="4" cy="7" r=".7" fill="#fff" opacity=".12"/><path d="M0 18 24 8" stroke="#fff" opacity=".04"/></pattern></defs><g transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
 {hexes.map((h,i)=><g key={h.id} className={`hex ${s.selectedHex===h.id?'selected':''} ${s.activeHexes.includes(h.id)?'active':''}`} style={{pointerEvents:s.setup?'none':'auto'}} onClick={e=>{e.stopPropagation();if(!s.setup)s.selectHex(h.id)}}><polygon points={pts(h)} fill={palette[h.resource][0]} stroke={palette[h.resource][1]} strokeWidth="3" filter="url(#shadow)"/><polygon points={pts(h)} fill="url(#grain)"/><foreignObject x={h.x-20} y={h.y-27} width="40" height="40" className="terrain-icon" style={{pointerEvents:'none'}}><div className={`res-icon ${h.resource}`}><ResourceIcon type={h.resource} size={29}/></div></foreignObject><g className="number-token"><circle cx={h.x} cy={h.y+24} r="15"/><text x={h.x} y={h.y+29}>{h.number}</text></g>{i%3===0&&<path d={`M${h.x-32} ${h.y+31} q18 -10 34 0 t34 0`} className="trail"/>}</g>)}
 {topology.vertices.map(v=>{const b=s.buildings.find(b=>b.vertexId===v.id),f=s.factories.find(x=>x.vertexId===v.id),ok=validVs.has(v.id),sel=s.selectedVertex===v.id;return <g key={v.id} className={`vertex ${ok&&showVertices?'valid':''} ${sel?'picked':''}`} onPointerDown={e=>e.stopPropagation()} role={b||ok&&showVertices?'button':undefined} tabIndex={b||ok&&showVertices?0:undefined} aria-label={b?(b.playerId===actor.id?'Công trình của bạn':'Công trình đối thủ')+' · Khu định cư cấp '+b.level+(f?' · Nhà máy cấp '+f.level:''):ok&&showVertices?'Xây tại giao điểm '+v.id:undefined} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.dispatchEvent(new MouseEvent('click',{bubbles:true}))}}} onClick={e=>{e.stopPropagation();if(showVertices&&ok){if(placing)s.buildSettlement(v.id);else setPopup({id:v.id,anchor:e.currentTarget.getBoundingClientRect()})}else if(b&&!s.setup){s.selectVertex(v.id);setPopup({id:v.id,anchor:e.currentTarget.getBoundingClientRect()})}}}>
  {showVertices&&<circle cx={v.x} cy={v.y} r="18" fill={ok?'#f1cc75':'transparent'} fillOpacity={ok?0.45:0} stroke={ok?'#fff2be':'transparent'} strokeWidth="2" pointerEvents="all"/>}
  {ok&&showVertices&&<circle cx={v.x} cy={v.y} r="7" fill="#f8e6a8" pointerEvents="none"/>}
  {b&&<g transform={`translate(${v.x-12} ${v.y-17})`} pointerEvents="all"><path d="M2 12 12 3l10 9v13H2Z" fill={color(b.playerId)} stroke={sel?'#fff':'#f8e3ac'} strokeWidth={sel?3:2}/><rect x="9" y="16" width="6" height="9" fill="#15262d"/><text x="12" y="11" textAnchor="middle" fill="#15262d" fontSize="8">{b.level}</text>{f&&<rect x="-4" y="14" width="8" height="8" fill="#c9a45a" stroke="#15262d"/>}</g>}
 </g>})}
 </g></svg><div className="map-label"><small>{vi.industrialFrontier}</small><strong>{vi.ironhavenBasin}</strong></div><div className="map-tools"><button title={vi.zoomIn} aria-label={vi.zoomIn} onClick={()=>{setPopup(null);setView(v=>({...v,z:Math.min(1.8,v.z+.15)}))}}><ZoomIn/></button><button title={vi.zoomOut} aria-label={vi.zoomOut} onClick={()=>{setPopup(null);setView(v=>({...v,z:Math.max(.55,v.z-.15)}))}}><ZoomOut/></button><button title={vi.resetCamera} aria-label={vi.resetCamera} onClick={()=>{setPopup(null);setView({x:470,y:325,z:1})}}><RotateCcw/></button></div><div className="mode-pill">{hint}</div></div>{popup&&!s.setup&&<ConstructionPopover key={popup.id} vertexId={popup.id} anchor={popup.anchor} onClose={()=>setPopup(null)}/>}</>}
