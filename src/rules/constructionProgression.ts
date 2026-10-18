import {CONSTRUCTION_COSTS,FACTORY_COSTS,type ConstructionCost} from './economyConfig';
import type {GameAction,GameState} from './types';
export type ConstructionStep={label:string;cost:ConstructionCost;type:'BUILD_SETTLEMENT'|'UPGRADE_SETTLEMENT'|'BUILD_FACTORY'|'UPGRADE_FACTORY'};
export const CONSTRUCTION_RECIPES:ConstructionStep[]=[
  {label:'Xây khu định cư cấp 1',cost:CONSTRUCTION_COSTS.settlement,type:'BUILD_SETTLEMENT'},
  {label:'Nâng khu định cư lên cấp 2',cost:CONSTRUCTION_COSTS.upgrade[2],type:'UPGRADE_SETTLEMENT'},
  {label:'Xây nhà máy cấp 1',cost:FACTORY_COSTS.build,type:'BUILD_FACTORY'},
  {label:'Nâng nhà máy lên cấp 2',cost:FACTORY_COSTS.upgrade[2],type:'UPGRADE_FACTORY'},
  {label:'Nâng nhà máy lên cấp 3',cost:FACTORY_COSTS.upgrade[3],type:'UPGRADE_FACTORY'}
];
export function nextConstructionStep(state:Pick<GameState,'buildings'|'factories'>,vertexId:string,playerId:number):ConstructionStep|null{
  const home=state.buildings.find(b=>b.vertexId===vertexId);
  if(!home)return CONSTRUCTION_RECIPES[0];
  if(home.playerId!==playerId)return null;
  if(home.level===1)return CONSTRUCTION_RECIPES[1];
  const factory=state.factories.find(f=>f.vertexId===vertexId);
  if(!factory)return CONSTRUCTION_RECIPES[2];
  if(factory.playerId!==playerId||factory.level>=3)return null;
  return CONSTRUCTION_RECIPES[factory.level+2];
}
export function constructionAction(step:ConstructionStep,playerId:number,vertexId:string):GameAction{return{type:step.type,playerId,vertexId}}
