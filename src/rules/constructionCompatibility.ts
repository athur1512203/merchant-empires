import type {GameState} from './types';
// Read compatibility only; no bulk rewrite. The next accepted action persists the
// normalized view and its original construction records in the existing JSONB snapshot.
export function normalizeConstructionState(state:GameState):GameState{
  if(state.constructionRulesVersion===2)return state;
  const buildings=state.buildings.map(b=>{
    const level=Number(b.level)>2||state.factories.some(f=>f.vertexId===b.vertexId&&f.playerId===b.playerId)?2:b.level;
    return level===b.level?b:{...b,level:level as 1|2};
  });
  const changed=buildings.some((b,i)=>b!==state.buildings[i]);
  return{...state,constructionRulesVersion:2,buildings,...(changed?{legacyConstruction:state.legacyConstruction??{buildings:structuredClone(state.buildings),factories:structuredClone(state.factories)}}:{})};
}
