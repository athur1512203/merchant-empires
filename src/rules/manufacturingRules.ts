import type {Commodity,Factory,Player,Product,Resource} from '../types';
import {PRODUCTS} from './types';
import {FACTORY_CAPACITY,RAW_MATERIALS,RECIPES,roundGold,type Recipe} from './economyConfig';
import {actingOnTurn} from './constructionRules';
import {factoryOn} from './settlementRules';
import {remainingCapacity} from './factoryRules';
import type {ActionResult,GameState} from './types';

export function isValidBatchCount(batches:number){return Number.isFinite(batches)&&Number.isInteger(batches)&&batches>0}
export function recipeOf(product:Product):Recipe{return RECIPES[product]}
export function manufactureQuote(product:Product,batches:number){
  const recipe=recipeOf(product);
  const inputs=Object.fromEntries(Object.entries(recipe.inputs).map(([k,n])=>[k,(n??0)*batches])) as Recipe['inputs'];
  return{product,batches,inputs,gold:recipe.gold*batches,output:recipe.output*batches,capacity:batches};
}

function stock(player:Player,item:Commodity){return item in player.resources?player.resources[item as Resource]:player.products[item as Product]}
function consume(player:Player,item:Commodity,used:number){
  const owned=stock(player,item),basis=player.inventoryCost[item],cogs=owned?Math.min(basis,roundGold(basis*used/owned)):0;
  const inventoryCost={...player.inventoryCost,[item]:basis-cogs};
  if(RAW_MATERIALS.includes(item as Resource))return{player:{...player,resources:{...player.resources,[item]:owned-used},inventoryCost},cogs};
  return{player:{...player,products:{...player.products,[item]:owned-used},inventoryCost},cogs};
}

export function manufactureGoods(state:GameState,playerId:number,vertexId:string,product:Product,batches:number):ActionResult{
  const error=actingOnTurn(state,playerId,'sản xuất');
  if(error)return{ok:false,error};
  if(!PRODUCTS.includes(product))return{ok:false,error:'Thành phẩm không hợp lệ.'};
  if(!isValidBatchCount(batches))return{ok:false,error:'Số lô phải là số nguyên dương hữu hạn.'};
  const factory=factoryOn(vertexId,state.factories);
  if(!factory)return{ok:false,error:'Chưa có nhà máy tại khu định cư này.'};
  if(factory.playerId!==playerId)return{ok:false,error:'Bạn không sở hữu nhà máy này.'};
  const quote=manufactureQuote(product,batches);
  if(quote.capacity>remainingCapacity(factory))return{ok:false,error:'Vượt quá công suất còn lại của nhà máy.'};
  const player=state.players.find(p=>p.id===playerId);
  if(!player)return{ok:false,error:'Không tìm thấy người chơi.'};
  if(player.cash<quote.gold)return{ok:false,error:'Không đủ vàng để sản xuất.'};
  for(const [item,n] of Object.entries(quote.inputs))if(stock(player,item as Commodity)<(n??0))return{ok:false,error:'Không đủ nguyên liệu để sản xuất.'};
  let next=player,materialBasis=0;
  for(const [item,n] of Object.entries(quote.inputs)){
    const step=consume(next,item as Commodity,n??0);
    next=step.player;materialBasis+=step.cogs;
  }
  next={
    ...next,
    cash:next.cash-quote.gold,
    products:{...next.products,[product]:next.products[product]+quote.output},
    inventoryCost:{...next.inventoryCost,[product]:next.inventoryCost[product]+materialBasis+quote.gold}
  };
  const factories=state.factories.map(f=>f.vertexId===vertexId?{...f,usedCapacity:f.usedCapacity+quote.capacity}:f);
  return{ok:true,message:`Đã sản xuất ${quote.output} ${product}.`,state:{...state,players:state.players.map(p=>p.id===playerId?next:p),factories}};
}

export function idleMaintenanceCharge(_factory:Factory){return 0}
