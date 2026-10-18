import type {Commodity,Product,Resource} from '../types';
import {PRODUCTS as RULE_PRODUCTS} from '../rules/types';
import {CONSTRUCTION_COSTS,FACTORY_CAPACITY as RULE_FACTORY_CAPACITY,FACTORY_COSTS,MAX_SETTLEMENTS,RECIPES as RULE_RECIPES,REFERENCE_RAW_PRICES,STARTING_GOLD} from '../rules/economyConfig';
// Alias tương thích cho các module Task 04/05 cũ; nguồn chính thức nằm trong rules/economyConfig.
export const STARTING_CASH=STARTING_GOLD;
export const MAX_SETTLEMENTS_PER_PLAYER=MAX_SETTLEMENTS;
export const BASE_RESOURCE_PRICES:Record<Resource,number>={...REFERENCE_RAW_PRICES};
export const PRODUCT_NAMES:Record<Product,string>={machinery:'Máy móc',rail:'Đường ray',furniture:'Nội thất',flour:'Bột mì',fabric:'Vải dệt',clothing:'Quần áo'};
export const RESOURCE_NAMES:Record<Resource,string>={metal:'Kim loại',wood:'Gỗ',wheat:'Lúa mì',cotton:'Bông'};
export const COMMODITY_NAMES:Record<Commodity,string>={...RESOURCE_NAMES,...PRODUCT_NAMES};
export const PRODUCT_PRICES:Record<Product,number>={machinery:45,rail:38,furniture:32,flour:12,fabric:22,clothing:55};
export const PRODUCTS=RULE_PRODUCTS;
export const RESOURCES=(Object.keys(BASE_RESOURCE_PRICES) as Resource[]);
export const MARKET_ITEMS=(Object.keys(COMMODITY_NAMES) as Commodity[]);
export const RECIPES:Record<Product,{inputs:Partial<Record<Commodity,number>>;output:number;productionCost:number}>=Object.fromEntries(PRODUCTS.map(p=>[p,{inputs:RULE_RECIPES[p].inputs,output:RULE_RECIPES[p].output,productionCost:RULE_RECIPES[p].gold}])) as Record<Product,{inputs:Partial<Record<Commodity,number>>;output:number;productionCost:number}>;
export const SETTLEMENT_BUILD_COST={resources:CONSTRUCTION_COSTS.settlement.resources,cash:CONSTRUCTION_COSTS.settlement.gold};
export const SETTLEMENT_UPGRADE_COST={2:{resources:CONSTRUCTION_COSTS.upgrade[2].resources,cash:CONSTRUCTION_COSTS.upgrade[2].gold}} as const;
export const FACTORY_COST={1:{resources:FACTORY_COSTS.build.resources,cash:FACTORY_COSTS.build.gold},2:{resources:FACTORY_COSTS.upgrade[2].resources,cash:FACTORY_COSTS.upgrade[2].gold},3:{resources:FACTORY_COSTS.upgrade[3].resources,cash:FACTORY_COSTS.upgrade[3].gold}} as const;
export const FACTORY_CAPACITY=RULE_FACTORY_CAPACITY;
export const CONTRACT_TEMPLATES=[
  {id:'IH-01',name:'Lương thực công trường Bắc',product:'flour' as Product,quantity:6,budget:90,grace:4},
  {id:'IH-02',name:'Đồng phục xưởng dệt',product:'fabric' as Product,quantity:3,budget:80,grace:4},
  {id:'IH-03',name:'Nội thất dinh thự',product:'furniture' as Product,quantity:2,budget:85,grace:4},
  {id:'IH-04',name:'Ray tuyến phía Tây',product:'rail' as Product,quantity:2,budget:95,grace:4},
  {id:'IH-05',name:'Lễ phục Hoàng gia',product:'clothing' as Product,quantity:1,budget:70,grace:2}
];
export function contractForRound(round:number){
  const cycle=Math.floor((Math.max(1,round)-1)/3);
  const t=CONTRACT_TEMPLATES[cycle%CONTRACT_TEMPLATES.length];
  const start=cycle*3+1;
  return{id:`${t.id}-C${cycle+1}`,name:t.name,product:t.product,quantity:t.quantity,budget:t.budget,deadlineRound:start+t.grace};
}
export function marketPrice(item:Commodity,resourcePrices:Record<Resource,number>){return item in resourcePrices?resourcePrices[item as Resource]:PRODUCT_PRICES[item as Product]}
