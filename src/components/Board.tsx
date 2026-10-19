import {useEffect,useId,useMemo,useRef,useState} from 'react';
import {RotateCcw,ZoomIn,ZoomOut} from 'lucide-react';
import {HEX_SIZE,hexCorners} from '../engine/hexGrid';
import {buildingLabelPositions} from '../engine/buildingLabels';
import {fitBoardView,resizeBoardView} from '../engine/boardCamera';
import {useGameStore,canControl} from '../store/gameStore';
import {canPlaceSettlement} from '../rules';
import {tileImages} from '../config/gameAssets';
import {BuildingIcon} from './BuildingIcon';
import {ConstructionPopover} from './ConstructionUI';
import {vi} from '../i18n/vi';
import type {Hex} from '../types';
const palette={metal:['#536272','#263642'],wood:['#38694f','#173b31'],wheat:['#b58b3b','#6e5222'],cotton:['#8b6e92','#4c3754']} as const;
const pts=(h:Hex)=>hexCorners(h).map(p=>`${p.x},${p.y}`).join(' ');
type Drag={x:number;y:number;vx:number;vy:number;moved:boolean};
export function Board(){
 const s=useGameStore(),[view,setView]=useState({x:470,y:325,z:1}),drag=useRef<Drag|null>(null),[popup,setPopup]=useState<{id:string;anchor:DOMRect}|null>(null);
 const shell=useRef<HTMLDivElement>(null),[viewport,setViewport]=useState({width:940,height:650});
 const shapeKey=(s.room?.id??'')+':'+(s.board.mapSeed??0)+':'+s.hexes.map(h=>h.id).join(';');
 const manual=useRef(false),lastFrame=useRef({key:shapeKey,viewport});
 const fitted=fitBoardView(s.hexes,viewport.width,viewport.height);
 useEffect(()=>{
  const element=shell.current;if(!element)return;
  const resize=new ResizeObserver(([entry])=>setViewport({width:entry.contentRect.width,height:entry.contentRect.height}));
  resize.observe(element);return()=>resize.disconnect();
 },[]);
 useEffect(()=>{const previous=lastFrame.current;if(previous.key!==shapeKey)manual.current=false;const fitted=fitBoardView(s.hexes,viewport.width,viewport.height);setView(view=>resizeBoardView(view,fitted,previous.viewport,viewport,manual.current));lastFrame.current={key:shapeKey,viewport};setPopup(null)},[shapeKey,viewport.width,viewport.height]);
 const minZoom=Math.min(.3,fitted.z*.6);
 const clipPrefix=useId().replaceAll(':','');
 const hexes=s.hexes,topology={vertices:s.vertices,edges:s.edges};
 const color=(id:number)=>s.players.find(p=>p.id===id)?.color??'#ccc';
 const placing=!!s.setup&&canControl(s);
 const actor=s.players.find(p=>p.id===s.localPlayerId)??s.players[0];
 const validVs=useMemo(()=>new Set(s.vertices.filter(v=>canPlaceSettlement({board:s.board,buildings:s.buildings},v.id,actor.id).ok).map(v=>v.id)),[s.vertices,s.board,s.buildings,actor.id]);
 const numberPositions=useMemo(()=>buildingLabelPositions(s.hexes,s.vertices,s.buildings,s.factories,view.z,fitted.z),[s.hexes,s.vertices,s.buildings,s.factories,view.z,fitted.z]);
 const hint=s.setup||s.mode==='settlement'?vi.chooseJunction:vi.surveyHint;
 const showVertices=canControl(s)&&(placing||s.mode==='settlement');
 return <><div ref={shell} className="board-shell" onWheel={e=>{e.preventDefault();manual.current=true;setPopup(null);setView(v=>({...v,z:Math.max(minZoom,Math.min(1.8,v.z*(e.deltaY>0?.9:1.1)))}))}} onPointerDown={e=>{
  const el=e.target as Element;
  if(el.closest?.('.vertex,.map-tools,button'))return;
  setPopup(null);drag.current={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y,moved:false};
 }} onPointerMove={e=>{
  if(!drag.current)return;
  const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;
  if(!drag.current.moved&&dx*dx+dy*dy<36)return;
  drag.current.moved=true;manual.current=true;
  setView(v=>({...v,x:drag.current!.vx+dx,y:drag.current!.vy+dy}));
 }} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}>
 <svg className="board" viewBox={`0 0 ${viewport.width} ${viewport.height}`}><defs><filter id="shadow"><feDropShadow dx="0" dy="5" stdDeviation="5" floodOpacity=".55"/></filter>{hexes.map((h,i)=><clipPath key={h.id} id={`${clipPrefix}-hex-${i}`} clipPathUnits="userSpaceOnUse"><polygon points={pts(h)}/></clipPath>)}</defs><g transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
 {hexes.map((h,i)=><g key={h.id} className={`hex ${s.selectedHex===h.id?'selected':''} ${s.activeHexes.includes(h.id)?'active':''}`} style={{pointerEvents:s.setup?'none':'auto'}} onClick={e=>{e.stopPropagation();if(!s.setup)s.selectHex(h.id)}}><polygon points={pts(h)} fill={palette[h.resource][0]} stroke={palette[h.resource][1]} strokeWidth="3" filter="url(#shadow)"/><image className="hex-art" href={tileImages[h.resource]} x={h.x-HEX_SIZE} y={h.y-HEX_SIZE} width={HEX_SIZE*2} height={HEX_SIZE*2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipPrefix}-hex-${i})`}/><polygon className="hex-outline" points={pts(h)} fill="none" stroke={palette[h.resource][1]} strokeWidth="3"/></g>)}
 {[...topology.vertices].sort((a,b)=>Number(s.buildings.some(x=>x.vertexId===b.id))-Number(s.buildings.some(x=>x.vertexId===a.id))).map(v=>{const b=s.buildings.find(b=>b.vertexId===v.id),f=s.factories.find(x=>x.vertexId===v.id),ok=validVs.has(v.id),sel=s.selectedVertex===v.id;return <g key={v.id} className={`vertex ${ok&&showVertices?'valid':''} ${sel?'picked':''}`} onPointerDown={e=>e.stopPropagation()} role={b||ok&&showVertices?'button':undefined} tabIndex={b||ok&&showVertices?0:undefined} aria-label={b?(b.playerId===actor.id?'Công trình của bạn':'Công trình đối thủ')+' · Khu định cư cấp '+b.level+(f?' · Nhà máy cấp '+f.level:''):ok&&showVertices?'Xây tại giao điểm '+v.id:undefined} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.dispatchEvent(new MouseEvent('click',{bubbles:true}))}}} onClick={e=>{e.stopPropagation();if(showVertices&&ok){if(placing)s.buildSettlement(v.id);else setPopup({id:v.id,anchor:e.currentTarget.getBoundingClientRect()})}else if(b&&!s.setup){s.selectVertex(v.id);setPopup({id:v.id,anchor:e.currentTarget.getBoundingClientRect()})}}}>
  {ok&&showVertices&&<circle className="build-marker-target" cx={v.x} cy={v.y} r={Math.min(12/view.z,HEX_SIZE*.45)} fill="transparent" stroke="transparent" strokeWidth="2" pointerEvents="all"/>}
  {ok&&showVertices&&<circle className="build-marker-dot" cx={v.x} cy={v.y} r={3/view.z} fill="#f8e6a8" pointerEvents="none"/>}
  {b&&<g transform={`translate(${v.x} ${v.y})`}><BuildingIcon companyId={b.playerId} settlementLevel={b.level} factoryLevel={f?.level} color={color(b.playerId)} selected={sel} scale={Math.min(1,view.z/fitted.z)/view.z}/></g>}
 </g>})}
 {hexes.map(h=><g key={`number-${h.id}`} className="number-token" pointerEvents="none" transform={`translate(${numberPositions.get(h.id)!.x} ${numberPositions.get(h.id)!.y}) scale(${Math.max(1,.7/view.z)})`}><circle r="15"/><text y="5">{h.number}</text></g>)}
 <g className="building-anchor-targets" aria-hidden="true">{!s.setup&&topology.vertices.filter(v=>s.buildings.some(b=>b.vertexId===v.id)).map(v=><circle key={v.id} data-vertex-id={v.id} cx={v.x} cy={v.y} r={7/view.z} fill="transparent" pointerEvents="all" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();s.selectVertex(v.id);setPopup({id:v.id,anchor:e.currentTarget.getBoundingClientRect()})}}/>)}</g>
 </g></svg><div className="map-label"><small>{vi.industrialFrontier}</small><strong>{vi.ironhavenBasin}</strong>{s.board.mapSeed!==undefined&&<small>Seed {s.board.mapSeed} · {s.hexes.length} ô</small>}</div><div className="map-tools"><button title={vi.zoomIn} aria-label={vi.zoomIn} onClick={()=>{manual.current=true;setPopup(null);setView(v=>({...v,z:Math.min(1.8,v.z+.15)}))}}><ZoomIn/></button><button title={vi.zoomOut} aria-label={vi.zoomOut} onClick={()=>{manual.current=true;setPopup(null);setView(v=>({...v,z:Math.max(minZoom,v.z-.15)}))}}><ZoomOut/></button><button title={vi.resetCamera} aria-label={vi.resetCamera} onClick={()=>{manual.current=false;setPopup(null);setView(fitted)}}><RotateCcw/></button></div><div className="mode-pill">{hint}</div></div>{popup&&!s.setup&&<ConstructionPopover key={popup.id} vertexId={popup.id} anchor={popup.anchor} onClose={()=>setPopup(null)}/>}</>}
