import {Banknote,Building2,Factory} from 'lucide-react';
import {MAX_SETTLEMENTS_PER_PLAYER,PRODUCTS,RESOURCES} from '../config/economy';
import {formatGold,vi} from '../i18n/vi';
import {useGameStore} from '../store/gameStore';
import {ResourceIcon} from './ResourceIcon';

export function PlayerDossier(){
  const s=useGameStore();
  const self=s.players.find(p=>p.id===s.localPlayerId)??s.players[0];
  const settlements=s.buildings.filter(b=>b.playerId===self.id);
  const factories=s.factories.filter(f=>f.playerId===self.id);
  return <aside className="left panel dossier">
    <div className="section-title"><span>{vi.myCompany}</span></div>
    <div className="player-card current" style={{'--player':self.color} as React.CSSProperties}>
      <div className="avatar">{self.name.split(' ').map(x=>x[0]).join('')}</div>
      <div className="player-main"><div><b>{self.name}</b><small>{vi.myCompany}</small></div></div>
    </div>
    <div className="section-title"><span>{vi.holdings}</span></div>
    <div className="stock-grid">
      {RESOURCES.map(r=><div className="stock" key={r}><span className={r}><ResourceIcon type={r} size={16}/></span><div><small>{vi.resources[r]}</small><b>{self.resources[r]}</b></div></div>)}
      {PRODUCTS.map(p=><div className="stock goods" key={p}><div><small>{vi.products[p]}</small><b>{self.products[p]}</b></div></div>)}
    </div>
    <div className="section-title"><span>{vi.cash}</span></div>
    <div className="cash-block"><Banknote/><b>{formatGold(self.cash)}</b></div>
    <div className="section-title"><span>{vi.structures}</span><small>{vi.settlementCount}: {settlements.length}/{MAX_SETTLEMENTS_PER_PLAYER}</small></div>
    <div className="asset-list">
      {settlements.length===0&&<p>{vi.noSettlements}</p>}
      {settlements.map((b,i)=>{
        const factory=factories.find(f=>f.vertexId===b.vertexId);
        return <button key={b.vertexId} className={`asset ${s.selectedVertex===b.vertexId?'picked':''}`} onClick={()=>s.locateAsset(b.vertexId)}>
          <Building2/><span>{vi.settlements} {i+1}<small>{vi.level} {b.level}{factory?` · ${vi.factories} ${vi.level} ${factory.level}`:''}</small></span>
        </button>;
      })}
      {factories.filter(f=>!settlements.some(b=>b.vertexId===f.vertexId)).map(f=><button key={f.vertexId} className={`asset ${s.selectedVertex===f.vertexId?'picked':''}`} onClick={()=>s.locateAsset(f.vertexId)}><Factory/><span>{vi.factories}<small>{vi.level} {f.level}</small></span></button>)}
    </div>
  </aside>;
}
