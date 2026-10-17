import type {Building,Commodity,Contract,Factory,Player,PriceChange,Product,Resource} from '../types';
import {BASE_RESOURCE_PRICES,CONTRACT_TEMPLATES,FACTORY_CAPACITY,FACTORY_COST,PRODUCT_PRICES,RECIPES,SETTLEMENT_UPGRADE_COST,contractForRound,marketPrice} from '../config/economy';
export type Tx<T>={ok:true;value:T;message:string}|{ok:false;error:string};
const fail=<T>(error:string):Tx<T>=>({ok:false,error});
const ok=<T>(value:T,message:string):Tx<T>=>({ok:true,value,message});
export const qty=(p:Player,c:Commodity)=>c in p.resources?p.resources[c as Resource]:p.products[c as Product];
const setQty=(p:Player,c:Commodity,n:number)=>c in p.resources?{...p,resources:{...p.resources,[c]:n}}:{...p,products:{...p.products,[c]:n}};
const canPay=(p:Player,c:{resources:Partial<Record<Resource,number>>;cash:number})=>p.cash>=c.cash&&Object.entries(c.resources).every(([r,n])=>p.resources[r as Resource]>=(n??0));
const payBuild=(p:Player,c:{resources:Partial<Record<Resource,number>>;cash:number})=>({...p,cash:p.cash-c.cash,capitalExpenditure:p.capitalExpenditure+c.cash,resources:{...p.resources,...Object.fromEntries(Object.entries(p.resources).map(([r,n])=>[r,n-(c.resources[r as Resource]??0)]))} as Record<Resource,number>});
export const remainingCapacity=(f:Factory)=>FACTORY_CAPACITY[f.level]-f.usedCapacity;
export function upgradeSettlement(p:Player,b:Building):Tx<{player:Player;building:Building}>{
  if(b.playerId!==p.id)return fail('Bạn không sở hữu khu định cư này.');
  if(b.level===3)return fail('Khu định cư đã đạt cấp tối đa.');
  const level=(b.level+1) as 2|3,c=SETTLEMENT_UPGRADE_COST[level];
  if(!canPay(p,c))return fail('Không đủ tài nguyên hoặc tiền mặt.');
  return ok({player:payBuild(p,c),building:{...b,level}},`Đã nâng khu định cư lên cấp ${level}.`);
}
export function buildFactory(p:Player,b:Building,factories:Factory[]):Tx<{player:Player;factory:Factory}>{
  if(b.playerId!==p.id)return fail('Bạn không sở hữu khu định cư này.');
  if(factories.some(f=>f.vertexId===b.vertexId))return fail('Khu định cư này đã có nhà máy.');
  const c=FACTORY_COST[1];
  if(!canPay(p,c))return fail('Không đủ tài nguyên hoặc tiền mặt.');
  return ok({player:payBuild(p,c),factory:{vertexId:b.vertexId,playerId:p.id,level:1,usedCapacity:0}},'Đã xây nhà máy cấp 1.');
}
export function upgradeFactory(p:Player,f:Factory):Tx<{player:Player;factory:Factory}>{
  if(f.playerId!==p.id)return fail('Bạn không sở hữu nhà máy này.');
  if(f.level===3)return fail('Nhà máy đã đạt cấp tối đa.');
  const level=(f.level+1) as 2|3,c=FACTORY_COST[level];
  if(!canPay(p,c))return fail('Không đủ tài nguyên hoặc tiền mặt.');
  return ok({player:payBuild(p,c),factory:{...f,level}},`Đã nâng nhà máy lên cấp ${level}.`);
}
export function produce(p:Player,f:Factory,product:Product,batches:number):Tx<{player:Player;factory:Factory}>{
  if(f.playerId!==p.id||batches<1||!Number.isInteger(batches))return fail('Yêu cầu sản xuất không hợp lệ.');
  const recipe=RECIPES[product],output=recipe.output*batches,cashCost=recipe.productionCost*batches;
  if(f.usedCapacity+batches>FACTORY_CAPACITY[f.level])return fail('Vượt quá công suất còn lại của nhà máy.');
  if(p.cash<cashCost)return fail('Không đủ tiền mặt cho chi phí sản xuất.');
  for(const [c,n] of Object.entries(recipe.inputs))if(qty(p,c as Commodity)<(n??0)*batches)return fail('Không đủ nguyên liệu sản xuất.');
  let next={...p,resources:{...p.resources},products:{...p.products},inventoryCost:{...p.inventoryCost}};
  let transferred=0;
  for(const [c,n] of Object.entries(recipe.inputs)){
    const item=c as Commodity,used=(n??0)*batches,owned=qty(next,item),unit=owned?next.inventoryCost[item]/owned:0;
    transferred+=unit*used;
    next=setQty(next,item,owned-used);
    next.inventoryCost[item]-=unit*used;
  }
  const cost=transferred+cashCost;
  next=setQty(next,product,qty(next,product)+output);
  next.inventoryCost[product]+=cost;
  next.cash-=cashCost;
  return ok({player:next,factory:{...f,usedCapacity:f.usedCapacity+batches}},`Đã sản xuất ${output} sản phẩm.`);
}
export function sell(p:Player,item:Commodity,amount:number,resourcePrices:Record<Resource,number>):Tx<{player:Player;revenue:number;cogs:number;unitPrice:number}>{
  if(amount<1||!Number.isInteger(amount)||qty(p,item)<amount)return fail('Số lượng bán không hợp lệ.');
  const unitPrice=marketPrice(item,resourcePrices),owned=qty(p,item),unitCost=owned?p.inventoryCost[item]/owned:0,cogs=unitCost*amount,revenue=unitPrice*amount;
  let next=setQty({...p,inventoryCost:{...p.inventoryCost}},item,owned-amount);
  next.inventoryCost[item]-=cogs;
  next.cash+=revenue;
  next.revenue+=revenue;
  next.costs+=cogs;
  next.profit=next.revenue-next.costs-next.operatingCosts;
  return ok({player:next,revenue,cogs,unitPrice},`Đã bán ${amount} đơn vị, thu về ${revenue} vàng.`);
}
export function fluctuatePrices(prices:Record<Resource,number>,round:number,random=Math.random){
  const rs=(Object.keys(BASE_RESOURCE_PRICES) as Resource[]);
  const up=Math.floor(random()*4),down=(up+1+Math.floor(random()*3))%4;
  const upAmp=.1+random()*.2,downAmp=.1+random()*.2;
  const clamp=(r:Resource,v:number)=>Math.max(BASE_RESOURCE_PRICES[r]*0.5,Math.min(BASE_RESOURCE_PRICES[r]*2,Math.round(v)));
  const next={...prices};
  const fromUp=prices[rs[up]],fromDown=prices[rs[down]];
  next[rs[up]]=clamp(rs[up],prices[rs[up]]*(1+upAmp));
  next[rs[down]]=clamp(rs[down],prices[rs[down]]*(1-downAmp));
  const changes:PriceChange[]=[
    {round,resource:rs[up],from:fromUp,to:next[rs[up]],percent:fromUp?((next[rs[up]]-fromUp)/fromUp)*100:0},
    {round,resource:rs[down],from:fromDown,to:next[rs[down]],percent:fromDown?((next[rs[down]]-fromDown)/fromDown)*100:0}
  ];
  return{prices:next,changes};
}
export function makeContract(round:number):Contract{
  const t=contractForRound(round);
  return{...t,status:'announced',bids:[]};
}
export function announceIfNeeded(round:number,current:Contract):Contract{
  const t=contractForRound(round);
  if(current.id===t.id)return current;
  return{...t,status:'announced',bids:[]};
}
export function submitBid(c:Contract,playerId:number,amount:number):Tx<Contract>{
  if(c.status!=='open')return fail('Chưa đến giai đoạn nộp giá.');
  if(!Number.isInteger(amount)||amount<1||amount>c.budget)return fail('Giá dự thầu không hợp lệ.');
  if(c.bids.some(b=>b.playerId===playerId))return fail('Bạn đã nộp giá cho hợp đồng này.');
  return ok({...c,bids:[...c.bids,{playerId,amount,order:c.bids.length}]},'Đã nộp giá dự thầu bí mật.');
}
export function awardContract(c:Contract):Tx<Contract>{
  const valid=c.bids.filter(b=>b.amount>0&&b.amount<=c.budget).sort((a,b)=>a.amount-b.amount||a.order-b.order);
  if(!valid.length)return fail('Không có giá dự thầu hợp lệ.');
  return ok({...c,status:'awarded',winnerId:valid[0].playerId,winningBid:valid[0].amount},'Đã xác định doanh nghiệp trúng thầu.');
}
export function failContract(c:Contract):Contract{
  if(c.status==='delivered'||c.status==='failed')return c;
  return{...c,status:'failed'};
}
export function deliverContract(p:Player,c:Contract,round:number):Tx<{player:Player;contract:Contract}>{
  if(c.status!=='awarded'||c.winnerId!==p.id)return fail('Bạn không sở hữu hợp đồng này.');
  if(round>c.deadlineRound)return fail('Hợp đồng đã quá hạn.');
  if(p.products[c.product]<c.quantity)return fail('Chưa đủ sản phẩm để giao.');
  const sold=deliverInventory(p,c.product,c.quantity,c.winningBid??0);
  return ok({player:sold,contract:{...c,status:'delivered'}},'Đã giao hợp đồng và ghi nhận doanh thu.');
}
function deliverInventory(p:Player,item:Product,amount:number,revenue:number){
  const owned=p.products[item],unit=owned?p.inventoryCost[item]/owned:0,cogs=unit*amount;
  return{...p,products:{...p.products,[item]:owned-amount},inventoryCost:{...p.inventoryCost,[item]:p.inventoryCost[item]-cogs},cash:p.cash+revenue,revenue:p.revenue+revenue,costs:p.costs+cogs,profit:p.revenue+revenue-(p.costs+cogs)-p.operatingCosts};
}
export function isValidTargetProfit(n:number){return Number.isInteger(n)&&n>0}
export function hasReachedTarget(p:Player,targetProfit:number){return isValidTargetProfit(targetProfit)&&p.profit>=targetProfit}
export function winnerByProfit(players:Player[],targetProfit:number){return players.find(p=>hasReachedTarget(p,targetProfit))}
export{PRODUCT_PRICES,CONTRACT_TEMPLATES};
