import {Banknote} from 'lucide-react';
import {PRODUCTS,RESOURCES} from '../config/economy';
import {formatGold,vi} from '../i18n/vi';
import {useGameStore} from '../store/gameStore';
import {ResourceIcon} from './ResourceIcon';

export function PlayerDossier(){
  const s=useGameStore();
  const self=s.players.find(p=>p.id===s.localPlayerId)??s.players[0];
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
  </aside>;
}
