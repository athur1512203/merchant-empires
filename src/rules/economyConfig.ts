import type {Commodity,Product,Resource} from '../types';
import {PRODUCTS,MAX_SETTLEMENTS_PER_PLAYER} from './types';
export const STARTING_GOLD=0;
export const RAW_MATERIALS:Resource[]=['metal','wood','wheat','cotton'];
export const REFERENCE_RAW_PRICES:Record<Resource,number>={metal:10,wood:10,wheat:10,cotton:10};
export const MAX_SETTLEMENTS=MAX_SETTLEMENTS_PER_PLAYER;
export const MAX_SETTLEMENT_LEVEL=2;
export const ROADS_ENABLED=false;
export type ConstructionCost={gold:number;resources:Partial<Record<Resource,number>>};
export const CONSTRUCTION_COSTS:{settlement:ConstructionCost;upgrade:Record<2,ConstructionCost>}={settlement:{gold:40,resources:{metal:1,wood:2,wheat:1}},upgrade:{2:{gold:50,resources:{metal:1,wood:1,wheat:1,cotton:1}}}};
export const MAX_FACTORY_LEVEL=3;
export const BALANCE_PROVISIONAL=true;
export const FACTORY_COSTS:{build:ConstructionCost;upgrade:Record<2|3,ConstructionCost>}={build:{gold:70,resources:{metal:2,wood:1,cotton:1}},upgrade:{2:{gold:110,resources:{metal:1,wood:2,wheat:2,cotton:1}},3:{gold:180,resources:{metal:2,wood:1,wheat:1,cotton:2}}}};
export const FACTORY_CAPACITY={1:1,2:2,3:3} as const;
export type Recipe={inputs:Partial<Record<Resource|'fabric',number>>;output:number;gold:number};
export const RECIPES:Record<Product,Recipe>={
  machinery:{inputs:{metal:3},output:1,gold:5},
  rail:{inputs:{metal:2,wood:1},output:1,gold:4},
  furniture:{inputs:{wood:3},output:1,gold:3},
  flour:{inputs:{wheat:3},output:2,gold:2},
  fabric:{inputs:{cotton:2},output:1,gold:3},
  clothing:{inputs:{fabric:1},output:1,gold:5}
};
export const MARKET_BALANCE={buyMultiplierBps:11_000,sellMultiplierBps:9_000,pressureBpsPerUnit:100,randomRangeBps:300,minPrice:5,maxPrice:20} as const;
export function roundGold(value:number){return Math.round(value)}
export const AUCTION_EVERY_ROUNDS=3;
export const DELIVERY_ROUNDS=3;
export const PENALTY_RATE_BPS=2_000;
export const TIE_BREAK:'earliest-submit'='earliest-submit';
export const CONTRACTS_PER_AUCTION=1;
export const MIN_BID=1;
export const PRODUCT_REFERENCE:Record<Product,number>={machinery:45,rail:38,furniture:32,flour:12,fabric:22,clothing:38};
export const FINISHED_CONTRACTS_UNLOCK_ROUND=31;
// Trial raw-contract balance; covered by BALANCE_PROVISIONAL above.
export const RAW_CONTRACT_CATALOG:{name:string;product:Resource;quantity:number;referenceValue:number}[]=[
  {name:"Kim loại cho công trường",product:"metal",quantity:5,referenceValue:75},
  {name:"Gỗ cho công trường",product:"wood",quantity:6,referenceValue:84},
  {name:"Lúa mì tiếp tế",product:"wheat",quantity:8,referenceValue:104},
  {name:"Bông cho xưởng dệt",product:"cotton",quantity:6,referenceValue:84}
];
export const FINISHED_CONTRACT_CATALOG:{name:string;product:Product;quantity:number}[]=[
  {name:'Lương thực công trường Bắc',product:'flour',quantity:6},
  {name:'Đồng phục xưởng dệt',product:'fabric',quantity:3},
  {name:'Nội thất dinh thự',product:'furniture',quantity:2},
  {name:'Ray tuyến phía Tây',product:'rail',quantity:2},
  {name:'Lễ phục Hoàng gia',product:'clothing',quantity:1},
  {name:'Máy móc xưởng trung tâm',product:'machinery',quantity:2}
];
export const CONTRACT_CATALOG=[...RAW_CONTRACT_CATALOG,...FINISHED_CONTRACT_CATALOG.map(t=>({...t,referenceValue:PRODUCT_REFERENCE[t.product]*t.quantity}))];
export function finishedContractsUnlocked(round:number){return round>=FINISHED_CONTRACTS_UNLOCK_ROUND}
export function isRawMaterial(value:string):value is Resource{return (RAW_MATERIALS as string[]).includes(value)}
export function contractKind(contract:Pick<GameContract,"product">){return isRawMaterial(contract.product)?"NGUYÊN LIỆU":"THÀNH PHẨM"}
export function contractCatalogForRound(round:number){return finishedContractsUnlocked(round)?CONTRACT_CATALOG:RAW_CONTRACT_CATALOG}
export const RETURN_DELIVERED_ON_FAIL=false;
export function maxBid(referenceValue:number){return referenceValue}
export function penaltyAmount(winningBid:number){return Math.round(winningBid*PENALTY_RATE_BPS/10_000)}
export function isFinishedGood(value:string):value is Product{return (PRODUCTS as string[]).includes(value)}
export type ContractStatus='auction'|'active'|'completed'|'failed'|'void';
export type GameContract={id:string;name:string;product:Commodity;quantity:number;referenceValue:number;deliveredCost?:number;status:ContractStatus;auctionRound:number;winnerId:number|null;winningBid:number|null;deadlineRound:number;delivered:number;paid:boolean;penaltyApplied:boolean};
export function generateContract(rng:()=>number,auctionRound:number,sequence:number):GameContract{
  const catalog=contractCatalogForRound(auctionRound);
  const template=catalog[Math.floor(rng()*catalog.length)];
  const quantity=template.quantity;
  if((!isFinishedGood(template.product)&&!isRawMaterial(template.product))||!Number.isInteger(quantity)||quantity<=0)throw new Error('Hợp đồng sinh ra không hợp lệ.');
  return{id:`IH-${auctionRound}-${sequence}-${template.product}`,name:template.name,product:template.product,quantity,referenceValue:template.referenceValue,deliveredCost:0,status:'auction',auctionRound,winnerId:null,winningBid:null,deadlineRound:0,delivered:0,paid:false,penaltyApplied:false};
}
export function remainingToDeliver(contract:GameContract){return Math.max(0,contract.quantity-contract.delivered)}
