import {startBlockReason} from '../rules/lobbyRules';
import {API_ORIGIN} from '../network/config';
import {useEffect,useState} from 'react';
import {COMPANIES} from '../rules/types';
import {useGameStore} from '../store/gameStore';
export function Lobby(){
  const s=useGameStore(),[mode,setMode]=useState<'create'|'join'>('create'),[name,setName]=useState(''),[code,setCode]=useState(''),[company,setCompany]=useState(0),[target,setTarget]=useState('1000'),[taken,setTaken]=useState<number[]>([]),[lookup,setLookup]=useState('');
  useEffect(()=>{
    if(mode!=='join'||!/^[A-Z2-9]{8}$/.test(code)){setTaken([]);setLookup('');return}
    let live=true;const abort=new AbortController();
    async function refresh(){try{
      const response=await fetch(`${API_ORIGIN}/api/rooms/${code}/availability`,{signal:abort.signal});const result=await response.json() as {takenCompanyIds:number[];status:string};
      if(!live)return;
      if(!response.ok){setLookup('Không tìm thấy phòng.');setTaken([]);return}
      setTaken(result.takenCompanyIds);setLookup(result.status!=='WAITING'?'Trận đã bắt đầu.':result.takenCompanyIds.length===4?'Phòng đã đủ bốn người.':'Đã tìm thấy phòng.');
      setCompany(current=>result.takenCompanyIds.includes(current)?COMPANIES.find(c=>!result.takenCompanyIds.includes(c.id))?.id??current:current);
    }catch{if(live)setLookup('Không thể kiểm tra phòng.')}}
    void refresh();const timer=setInterval(()=>void refresh(),3000);return()=>{live=false;abort.abort();clearInterval(timer)};
  },[mode,code]);
  const connected=s.connection==='connected',startReason=startBlockReason(s,Number(target)),host=s.room?.hostPlayerId===s.playerId;
  return <div className="start-overlay lobby-overlay"><section className="start-card lobby-card" aria-label="Sảnh multiplayer">
    <small>MERCHANT EMPIRES · MULTIPLAYER</small><h1>{s.room?'Phòng chờ':'Thương trường'}</h1>
    {s.room?<>
      <p>Mã phòng <strong className="room-code">{s.room.roomCode}</strong> · {s.room.players.length}/4 người</p>
      <ul className="lobby-players">{s.room.players.map(p=><li key={p.id}><i style={{background:COMPANIES[p.companyId].color}}/><span><b>{p.displayName}{p.id===s.playerId?' (bạn)':''}</b><small>{COMPANIES[p.companyId].name}{p.id===s.room!.hostPlayerId?' · Chủ phòng':''}</small></span><em>{s.onlinePlayerIds.includes(p.id)?'Trực tuyến':'Mất kết nối'}</em></li>)}</ul>
      {host?<><label className="target-field"><span>Mục tiêu lợi nhuận</span><input type="number" min="1" step="1" value={target} onChange={e=>setTarget(e.target.value)}/></label><button className="primary" disabled={!!startReason} aria-describedby="start-reason" onClick={()=>s.start(Number(target))}>Bắt đầu trận</button><p id="start-reason" role="status">{startReason??"Sẵn sàng bắt đầu với "+s.room.players.length+" người."}</p></>:<p>Chờ chủ phòng bắt đầu khi có từ 2 đến 4 người.</p>}
    </>:<>
      <div className="lobby-tabs"><button className={mode==='create'?'active':''} onClick={()=>setMode('create')}>Tạo phòng</button><button className={mode==='join'?'active':''} onClick={()=>setMode('join')}>Tham gia phòng</button></div>
      <label className="target-field"><span>Tên người chơi</span><input autoComplete="nickname" maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="Nhập tên của bạn"/></label>
      {mode==='join'&&<label className="target-field"><span>Mã phòng</span><input maxLength={8} value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/\s/g,''))} placeholder="Mã 8 ký tự"/><small role="status">{lookup}</small></label>}
      <div className="company-choices" role="group" aria-label="Chọn công ty">{COMPANIES.map(c=><button key={c.id} style={{borderColor:c.color}} disabled={mode==='join'&&taken.includes(c.id)} aria-pressed={company===c.id} onClick={()=>setCompany(c.id)}>{c.name}<small>{mode==='join'&&taken.includes(c.id)?'Đã có người chọn':company===c.id?'Đang chọn':'Còn trống'}</small></button>)}</div>
      <button className="primary" disabled={s.busy||s.connection==='connecting'||s.connection==='syncing'||!name.trim()||(mode==='join'&&(!/^[A-Z2-9]{8}$/.test(code)||taken.includes(company)))} onClick={()=>void(mode==='create'?s.createRoom(name.trim(),company):s.joinRoom(code,name.trim(),company))}>{s.busy?'Đang xử lý…':mode==='create'?'Tạo phòng mới':'Tham gia phòng'}</button>
    </>}
    {s.notice&&<p role="alert" className="field-error">{s.notice}</p>}
    {(s.room||s.connection!=='offline')&&<p className="lobby-recovery"><button className="text-btn" disabled={s.busy&&connected} onClick={s.reconnect}>Kết nối lại</button><button className="text-btn" onClick={s.newMatch}>Về sảnh · bỏ phiên trên tab này</button></p>}
    <p className="lobby-hint">Mỗi tab giữ một công ty riêng. Làm mới trang sẽ khôi phục phiên hiện tại.</p>
  </section></div>;
}
