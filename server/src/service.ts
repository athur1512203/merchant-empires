import {createHash,randomBytes,randomInt,randomUUID,timingSafeEqual} from 'node:crypto';
import {applyAction,createWaitingState} from '../../src/rules/gameState';
import {MULTIPLAYER_RULES_VERSION} from '../../src/rules/lobbyRules';
import {normalizeConstructionState} from '../../src/rules/constructionCompatibility';
import {rollDice} from '../../src/rules/diceRules';
import type {GameAction} from '../../src/rules/types';
import {ApiError,type Room,type Member,type RoomRepository} from './domain';
import {actionRequest,keySchema,memberSchema,startRequest} from './validation';
import {roomView,stateView} from './projection';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export class RoomService {
  private listeners=new Set<(code:string)=>void>();
  subscribe(listener:(code:string)=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener)}}
  private changed(code:string){for(const listener of this.listeners){try{listener(code)}catch{/* committed writes must not fail on notification */}}}
  async sessions(code:string,tokens:string[]){
    return this.repository.transact(code,room=>tokens.map(token=>{
      const player=this.member(room,token);
      return {rulesVersion:MULTIPLAYER_RULES_VERSION,room:roomView(room),...stateView(room,player),self:{playerId:player.id,companyId:player.companyId}};
    }));
  }
  async availability(code:string){
    return this.repository.transact(code,room=>({roomCode:room.roomCode,status:room.status,takenCompanyIds:room.players.map(p=>p.companyId),playerCount:room.players.length}));
  }
  constructor(private repository:RoomRepository,private rng:()=>number=()=>randomInt(0,0x100000000)/0x100000000,private mapSeed:()=>number=()=>randomInt(0,0x100000000)){}
  private member(room:Room,token:string|undefined):Member {
    if(!token||!/^[-\w]{43}$/.test(token))throw new ApiError(401,'INVALID_TOKEN');
    const digest=Buffer.from(hash(token),'hex');
    const player=room.players.find(p=>timingSafeEqual(digest,Buffer.from(p.reconnectTokenHash,'hex')));
    if(!player)throw new ApiError(403,'NOT_A_ROOM_MEMBER');
    return player;
  }
  private newMember(roomId:string,input:unknown,seatIndex:number){
    const data=memberSchema.parse(input),token=randomBytes(32).toString('base64url');
    return {token,player:{...data,id:randomUUID(),roomId,seatIndex,reconnectTokenHash:hash(token),joinedAt:new Date()}};
  }
  async create(input:unknown){
    const id=randomUUID(),{token,player}=this.newMember(id,input,0),now=new Date();
    const room:Room={id,roomCode:Array.from({length:8},()=>alphabet[randomInt(alphabet.length)]).join(''),hostPlayerId:player.id,status:'WAITING',maxPlayers:4,createdAt:now,updatedAt:now,players:[player],version:0,state:createWaitingState(id),actions:[],bids:[]};
    await this.repository.create(room);
    this.changed(room.roomCode);
    return {room:roomView(room),playerId:player.id,reconnectToken:token};
  }
  async join(code:string,input:unknown){
    const result=await this.repository.transact(code,room=>{
      const {token,player}=this.newMember(room.id,input,room.players.length);
      if(room.status!=='WAITING')throw new ApiError(409,'ROOM_ALREADY_STARTED');
      if(room.players.length>=4)throw new ApiError(409,'ROOM_FULL');
      if(room.players.some(p=>p.companyId===player.companyId))throw new ApiError(409,'COMPANY_TAKEN');
      room.players.push(player);
      return {room:roomView(room),playerId:player.id,reconnectToken:token};
    });
    this.changed(code);
    return result;
  }
  async get(code:string,token:string|undefined,state=false){
    return this.repository.transact(code,room=>{const player=this.member(room,token);return state?stateView(room,player):roomView(room)});
  }
  async execute(code:string,token:string|undefined,key:unknown,input:unknown,start=false){
    const idempotencyKey=keySchema.parse(key);
    const parsed=start?startRequest.parse(input):actionRequest.parse(input);
    const requestHash=hash(JSON.stringify({start,...parsed}));
    const result=await this.repository.transact(code,room=>{
      const player=this.member(room,token);
      if(start&&room.hostPlayerId!==player.id)throw new ApiError(403,'HOST_ONLY');
      const previous=room.actions.find(a=>a.playerId===player.id&&a.idempotencyKey===idempotencyKey);
      if(previous){
        if(previous.requestHash!==requestHash)throw new ApiError(409,'IDEMPOTENCY_KEY_REUSED');
        return {...stateView(room,player),appliedVersion:previous.stateVersion,replayed:true};
      }
      if(room.version!==parsed.expectedVersion)throw new ApiError(409,'STALE_STATE_VERSION');
      let action:GameAction;
      if('targetProfit' in parsed){
        if(room.status!=='WAITING')throw new ApiError(409,'ROOM_ALREADY_STARTED');
        if(room.players.length<2||room.players.length>4)throw new ApiError(409,'NEED_TWO_TO_FOUR_PLAYERS');
        action={type:'startMatch',targetProfit:parsed.targetProfit,seed:Math.floor(this.rng()*0x100000000),mapSeed:this.mapSeed(),roomId:room.id,companyIds:[...room.players].sort((a,b)=>a.seatIndex-b.seatIndex).map(p=>p.companyId)};
      }else{
        if(room.status!=='PLAYING')throw new ApiError(409,'ROOM_NOT_PLAYING');
        action={...parsed.action,playerId:player.companyId} as GameAction;
      }
      room.state=normalizeConstructionState(room.state);
      const result=action.type==='ROLL_DICE'?rollDice(room.state,player.companyId,this.rng):applyAction(room.state,action);
      if(!result.ok)throw new ApiError(422,'ILLEGAL_ACTION',result.error);
      if(action.type==='SUBMIT_BID')room.bids.push({id:randomUUID(),roomId:room.id,auctionId:room.state.auction.lot!.id,playerId:player.id,amount:action.amount,submittedAt:new Date()});
      room.state=result.state;
      room.version++;
      room.status=room.state.phase==='finished'?'FINISHED':'PLAYING';
      room.updatedAt=new Date();
      room.actions.push({id:randomUUID(),roomId:room.id,playerId:player.id,actionType:action.type,payload:action,idempotencyKey,requestHash,stateVersion:room.version,createdAt:new Date()});
      return {...stateView(room,player),appliedVersion:room.version,replayed:false};
    });
    this.changed(code);
    return result;
  }
}
