import type {Building,Factory,Player,Product,Resource} from '../types';
import type {GameContract} from './economyConfig';

export type Phase='waiting'|'setup'|'playing'|'finished';
export const COMPANIES=[{id:0,name:'Iron Works',color:'#e05d44'},{id:1,name:'Timber Guild',color:'#55a87a'},{id:2,name:'Golden Trade',color:'#ddb74d'},{id:3,name:'Ocean Empire',color:'#4c8bd9'}] as const;
export const RESOURCES:Resource[]=['metal','wood','wheat','cotton'];
export const PRODUCTS:Product[]=['machinery','rail','furniture','flour','fabric','clothing'];
export const MAX_SETTLEMENTS_PER_PLAYER=4;
export const SETUP_SETTLEMENTS_PER_PLAYER=2;
export const HEX_NEIGHBORS:[number,number][]=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];

export type HexCell={id:string;q:number;r:number;resource:Resource;number:number};
export type LogicVertex={id:string;hexIds:string[];neighborIds:string[];corners:{q:number;r:number;i:number}[]};
export type BoardLogic={seed:number;hexes:HexCell[];vertices:LogicVertex[];adjacency:Record<string,string[]>};

export type GameAction=
  |{type:'startMatch';targetProfit:number;seed:number;roomId?:string;companyIds?:number[]}
  |{type:'placeSetupSettlement';playerId:number;vertexId:string}
  |{type:'ROLL_DICE';playerId:number}
  |{type:'END_TURN';playerId:number}
  |{type:'BUY_RAW_MATERIAL';playerId:number;resource:Resource;quantity:number}
  |{type:'SELL_RAW_MATERIAL';playerId:number;resource:Resource;quantity:number}
  |{type:'BUILD_SETTLEMENT';playerId:number;vertexId:string}
  |{type:'UPGRADE_SETTLEMENT';playerId:number;vertexId:string}
  |{type:'BUILD_FACTORY';playerId:number;vertexId:string}
  |{type:'UPGRADE_FACTORY';playerId:number;vertexId:string}
  |{type:'MANUFACTURE_GOODS';playerId:number;vertexId:string;product:Product;batches:number}
  |{type:'SUBMIT_BID';playerId:number;amount:number}
  |{type:'SKIP_BID';playerId:number}
  |{type:'CLOSE_AUCTION'}
  |{type:'DELIVER_CONTRACT';playerId:number;contractId:string;quantity:number};

export type SealedBid={playerId:number;amount:number;order:number};
export type AuctionState={status:'idle'|'open';openedAfterRound:number|null;bidSeat:number;sealedBids:SealedBid[];skipped:number[];lot:GameContract|null};
export type ActionResult={ok:true;state:GameState;message:string}|{ok:false;error:string};

export type GameState={
  constructionRulesVersion?:2;
  legacyConstruction?:{buildings:unknown[];factories:unknown[]};
  roomId:string;
  seed:number;
  phase:Phase;
  targetProfit:number;
  round:number;
  turnIndex:number;
  seats:number[];
  players:Player[];
  board:BoardLogic;
  buildings:Building[];
  factories:Factory[];
  winnerId:number|null;
  resourcePrices:Record<Resource,number>;
  marketPressure:Record<Resource,number>;
  auction:AuctionState;
  contracts:GameContract[];
  dice:[number,number]|null;
  rolled:boolean;
};

export function emptyResources():Record<Resource,number>{return{metal:0,wood:0,wheat:0,cotton:0}}
export function emptyProducts():Record<Product,number>{return{machinery:0,rail:0,furniture:0,flour:0,fabric:0,clothing:0}}
export function emptyCosts():Record<Resource|Product,number>{return{...emptyResources(),...emptyProducts()}}
export function hexId(q:number,r:number){return `${q},${r}`}
