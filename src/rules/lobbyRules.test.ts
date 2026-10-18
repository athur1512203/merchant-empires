import {describe,it,expect} from 'vitest';
import {startBlockReason,MULTIPLAYER_RULES_VERSION} from './lobbyRules';
describe('lobby target rules',()=>{
  it.each([0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])('rejects invalid target %s',target=>{
    const room={id:'r',roomCode:'ABCDEFGH',hostPlayerId:'h',version:0,status:'WAITING' as const,maxPlayers:4,players:[{id:'h',displayName:'H',companyId:0,seatIndex:0},{id:'g',displayName:'G',companyId:3,seatIndex:1}]};
    expect(startBlockReason({room,playerId:'h',connection:'connected',busy:false,rulesVersion:MULTIPLAYER_RULES_VERSION},target)).toContain('số nguyên dương');
  });
});
