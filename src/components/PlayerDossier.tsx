import {useState} from 'react';
import {BookOpen,Banknote} from 'lucide-react';
import {PRODUCTS,RESOURCES} from '../config/economy';
import {formatGold,vi} from '../i18n/vi';
import {useGameStore,canControl} from '../store/gameStore';
import {ResourceIcon} from './ResourceIcon';
import {ProfitProgress} from './ProfitProgress';
import {GoodsRecipe} from './GoodsRecipe';
import type {Product} from '../types';
export function PlayerDossier(){
 const s=useGameStore(),self=s.players.find(p=>p.id===s.localPlayerId)??s.players[0];
 const [recipe,setRecipe]=useState<{product:Product;anchor:HTMLElement}|null>(null);
 return <div className="company-dossier"><section className="company-summary"><div className="company-identity"><span className="company-color" style={{background:self.color}}/><div><small>Công ty của bạn</small><h1>{self.name}</h1></div></div><div className="company-cash"><Banknote size={18}/><b>{formatGold(self.cash)}</b></div><span className="turn-status">{s.ended?'Trận đã kết thúc':s.busy?'Đang xử lý…':canControl(s)?'Đến lượt bạn':'Đang chờ người chơi khác'}</span></section>
 <ProfitProgress profit={self.profit} target={s.targetProfit} won={s.ended&&s.winnerId===self.id}/>
 <section className="inventory-section"><h2>Nguyên liệu</h2><div className="inventory-grid raw-grid">{RESOURCES.map(r=><div className={'inventory-item '+r} key={r}><ResourceIcon type={r} size={28}/><span>{vi.resources[r]}</span><b>{self.resources[r]}</b></div>)}</div></section>
 <section className="inventory-section"><h2>Thành phẩm</h2><div className="inventory-grid goods-grid">{PRODUCTS.map(product=><div className="inventory-item" key={product}><button className="recipe-book" aria-label={'Công thức '+vi.products[product]} aria-haspopup="dialog" aria-expanded={recipe?.product===product} onClick={e=>setRecipe(recipe?.product===product?null:{product,anchor:e.currentTarget})}><BookOpen size={13}/></button><ResourceIcon type={product} size={28}/><span>{vi.products[product]}</span><b>{self.products[product]}</b></div>)}</div></section>
 {recipe&&<GoodsRecipe product={recipe.product} anchor={recipe.anchor} player={self} onClose={()=>setRecipe(null)}/>}</div>;
}
