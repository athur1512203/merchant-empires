import type {GameState} from '../../src/rules/types';

export class ApiError extends Error {
  constructor(public status:number, public code:string, message=code){super(message)}
}
export type Member={id:string;roomId:string;displayName:string;companyId:number;seatIndex:number;reconnectTokenHash:string;joinedAt:Date};
export type RecordedAction={id:string;roomId:string;playerId:string;actionType:string;payload:unknown;idempotencyKey:string;requestHash:string;stateVersion:number;createdAt:Date};
export type Bid={id:string;roomId:string;auctionId:string;playerId:string;amount:number;submittedAt:Date};
export type Room={id:string;roomCode:string;hostPlayerId:string;status:'WAITING'|'PLAYING'|'FINISHED';maxPlayers:number;createdAt:Date;updatedAt:Date;players:Member[];version:number;state:GameState;actions:RecordedAction[];bids:Bid[]};
// Implementations must isolate, commit atomically, and roll back the entire callback.
export interface RoomRepository {
  create(room:Room):Promise<void>;
  transact<T>(code:string, work:(room:Room)=>T|Promise<T>):Promise<T>;
}
