import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {recipeOf} from '../rules/manufacturingRules';
import {qty} from '../engine/economyEngine';
import {vi} from '../i18n/vi';
import type {Commodity,Player,Product} from '../types';

export function GoodsRecipeDetails({product,player}:{product:Product;player:Player}){
  const recipe=recipeOf(product);
  return <><h3>{vi.products[product]}</h3><p>Công thức cho một lô · Nhà máy đa năng có công suất còn lại.</p>
    <table className="construction-cost"><thead><tr><th>Đầu vào</th><th>Cần</th><th>Đang có</th></tr></thead><tbody>
      {Object.entries(recipe.inputs).map(([item,amount])=><tr key={item} className={qty(player,item as Commodity)>=amount!?'enough':'shortage'}><th>{vi.commodities[item as Commodity]}</th><td>{amount}</td><td>{qty(player,item as Commodity)}</td></tr>)}
      <tr className={player.cash>=recipe.gold?'enough':'shortage'}><th>Phí chế tạo (vàng)</th><td>{recipe.gold}</td><td>{player.cash}</td></tr>
    </tbody></table><p>Đầu ra: <b>{recipe.output} {vi.products[product]}</b></p></>;
}
export function GoodsRecipe({product,player,anchor,onClose}:{product:Product;player:Player;anchor:HTMLElement;onClose:()=>void}){
  const box=useRef<HTMLElement>(null),[position,setPosition]=useState({left:12,top:12});
  useLayoutEffect(()=>{
    const place=()=>{const a=anchor.getBoundingClientRect(),b=box.current?.getBoundingClientRect();if(!b)return;setPosition({left:Math.max(12,Math.min(a.left-b.width-10,window.innerWidth-b.width-12)),top:Math.max(12,Math.min(a.top,window.innerHeight-b.height-12))})};
    place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true)};
  },[anchor,product]);
  useEffect(()=>{
    const dismiss=(e:PointerEvent)=>{if(!box.current?.contains(e.target as Node)&&!anchor.contains(e.target as Node))onClose()};
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();anchor.focus()}};
    document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',key,true);
    return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',key,true)};
  },[anchor,onClose]);
  return createPortal(<section ref={box} style={position} className="goods-recipe construction-popover" role="dialog" aria-label={`Công thức ${vi.products[product]}`}><button autoFocus className="construction-close" aria-label="Đóng công thức hàng hóa" onClick={()=>{onClose();anchor.focus()}}>×</button><GoodsRecipeDetails product={product} player={player}/></section>,document.body);
}
