import {normalizeConstructionState} from '../../src/rules/constructionCompatibility';
import type {Room,Member} from './domain';
export function roomView(room:Room){
  return {id:room.id,roomCode:room.roomCode,hostPlayerId:room.hostPlayerId,status:room.status,maxPlayers:room.maxPlayers,version:room.version,
    players:room.players.map(({id,displayName,companyId,seatIndex})=>({id,displayName,companyId,seatIndex}))};
}
export function stateView(room:Room,viewer:Member){
  const state=structuredClone(normalizeConstructionState(room.state));
  state.auction.sealedBids=state.auction.sealedBids.filter(b=>b.playerId===viewer.companyId);
  // Seed drives future contract generation and market movement; never publish it.
  const {seed:_seed,legacyConstruction:_legacyConstruction,board,...rest}=state;
  const {seed:_boardSeed,...publicBoard}=board;
  return {version:room.version,state:{...rest,board:publicBoard}};
}
