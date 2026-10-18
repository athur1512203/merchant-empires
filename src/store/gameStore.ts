import {startBlockReason} from '../rules/lobbyRules';
import {API_ORIGIN} from '../network/config';
import {create} from 'zustand';
import {io,type Socket} from 'socket.io-client';
import {visualFromBoard} from '../engine/hexGrid';
import {createWaitingState} from '../rules/gameState';
import type {Product,Resource,PriceChange,Trade,Log} from '../types';
import type {Ack,ClientAction,RoomInfo,RoomUpdate,Session} from '../network/protocol';
const SESSION_KEY='merchant-empires-session-v1',PENDING_KEY='merchant-empires-pending-v1';
type Pending={event:'game:action'|'game:start';body:{idempotencyKey:string;expectedVersion:number;action?:ClientAction;targetProfit?:number}};
type Connection='offline'|'connecting'|'syncing'|'connected'|'replaced'|'error';
function read<T>(key:string):T|null{try{return JSON.parse(sessionStorage.getItem(key)??'null') as T|null}catch{return null}}
function save(key:string,value:unknown){try{if(value===null)sessionStorage.removeItem(key);else sessionStorage.setItem(key,JSON.stringify(value))}catch{/* storage may be unavailable */}}
const initial=createWaitingState(),initialView=visualFromBoard(initial.board);
const base=()=>({phase:initial.phase,seats:initial.seats,board:initial.board,...initialView,started:false,setup:false,ended:false,targetProfit:null as number|null,winnerId:null as number|null,localPlayerId:0,round:1,turn:0,dice:null as [number,number]|null,rolled:false,activeHexes:[] as string[],players:initial.players,buildings:initial.buildings,factories:initial.factories,resourcePrices:initial.resourcePrices,marketPressure:initial.marketPressure,auction:initial.auction,contracts:initial.contracts,priceHistory:[] as PriceChange[],trades:[] as Trade[],logs:[] as Log[],selectedHex:null as string|null,selectedVertex:null as string|null,mode:'inspect' as 'inspect'|'settlement',historyOpen:false,notice:null as string|null,room:null as RoomInfo|null,playerId:null as string|null,version:-1,connection:'offline' as Connection,busy:false,rulesVersion:null as string|null,onlinePlayerIds:[] as string[]});
type State=ReturnType<typeof base>&{
  createRoom:(displayName:string,companyId:number)=>Promise<void>;joinRoom:(code:string,displayName:string,companyId:number)=>Promise<void>;
  start:(targetProfit:number)=>void;newMatch:()=>void;reconnect:()=>void;
  roll:()=>void;endTurn:()=>void;setMode:(mode:'inspect'|'settlement')=>void;selectHex:(id:string|null)=>void;selectVertex:(id:string|null)=>void;locateAsset:(id:string)=>void;
  buildSettlement:(id:string)=>void;upgradeSettlement:(id:string)=>void;buildFactory:(id:string)=>void;upgradeFactory:(id:string)=>void;
  produce:(id:string,product:Product,batches:number)=>void;buy:(resource:Resource,quantity:number)=>void;sell:(resource:Resource,quantity:number)=>void;
  bid:(amount:number)=>void;skipBid:()=>void;deliver:(contractId:string,quantity:number)=>void;toggleHistory:()=>void;clearNotice:()=>void;
};
let active:Socket|undefined,session:Session|null=null,pending:Pending|null=null,sending=false;
let retryTimer:ReturnType<typeof setTimeout>|undefined;
export function canControl(s:Pick<State,'connection'|'busy'|'seats'|'turn'|'localPlayerId'|'ended'>){return s.connection==='connected'&&!s.busy&&!s.ended&&s.seats[s.turn]===s.localPlayerId}
function receive(update:RoomUpdate){
  const previous=useGameStore.getState();
  if(previous.room?.id===update.room.id&&update.version<previous.version)return;
  const next=update.state,board={...next.board,seed:next.board.mapSeed??0},vis=visualFromBoard(board),newVersion=update.version>previous.version;
  const prices=newVersion?Object.entries(next.resourcePrices).filter(([r,p])=>previous.resourcePrices[r as Resource]!==p).map(([resource,to])=>({resource:resource as Resource,from:previous.resourcePrices[resource as Resource],to,round:next.round,percent:(to/previous.resourcePrices[resource as Resource]-1)*100})):[];
  useGameStore.setState({room:update.room,rulesVersion:update.rulesVersion??null,playerId:update.self.playerId,localPlayerId:update.self.companyId,version:update.version,connection:'connected',onlinePlayerIds:update.onlinePlayerIds??[],
    phase:next.phase,seats:next.seats,board,...vis,started:next.phase!=='waiting',setup:next.phase==='setup',ended:next.phase==='finished',targetProfit:next.targetProfit||null,winnerId:next.winnerId,
    round:next.round,turn:next.turnIndex,dice:next.dice,rolled:next.rolled,players:next.players,buildings:next.buildings,factories:next.factories,resourcePrices:next.resourcePrices,marketPressure:next.marketPressure,auction:next.auction,contracts:next.contracts,
    activeHexes:next.dice&&next.dice[0]+next.dice[1]!==7?next.board.hexes.filter(h=>h.number===next.dice![0]+next.dice![1]).map(h=>h.id):[],
    mode:next.phase==='setup'?'settlement':newVersion?'inspect':previous.mode,priceHistory:[...prices,...previous.priceHistory].slice(0,100),
    logs:newVersion?[{id:update.version,text:`Vòng ${next.round} · ${next.phase==='setup'?'Đặt khu định cư':next.auction.status==='open'?'Đấu thầu kín':next.dice?`Xúc xắc ${next.dice.join(' + ')}`:'Đồng bộ lượt chơi'}`,kind:'event' as const},...previous.logs].slice(0,80):previous.logs,
  });
  if(pending&&!sending)void sendPending();
}
async function sendPending(){
  const socket=active,current=pending;
  if(!socket?.connected||!current||sending||useGameStore.getState().connection!=='connected')return;
  sending=true;
  try{
    const ack=await socket.timeout(20_000).emitWithAck(current.event,current.body) as Ack;
    if(active!==socket||pending!==current)return;
    pending=null;save(PENDING_KEY,null);useGameStore.setState({busy:false,connection:ack.ok&&useGameStore.getState().version>=ack.appliedVersion?'connected':'syncing'});
    if(!ack.ok)useGameStore.setState({notice:ack.message});
    socket.emit('room:sync');
  }catch{
    if(active===socket&&pending===current){
      useGameStore.setState({notice:'Chưa nhận xác nhận. Đang đồng bộ và thử lại yêu cầu cũ.'});
      clearTimeout(retryTimer);retryTimer=setTimeout(()=>{socket.emit('room:sync');void sendPending()},1500);
    }
  }finally{if(active===socket)sending=false}
}
function connect(value:Session){
  active?.disconnect();clearTimeout(retryTimer);sending=false;session=value;pending=read<Pending>(PENDING_KEY);
  useGameStore.setState({connection:'connecting',busy:!!pending});
  const socket=io(API_ORIGIN||undefined,{autoConnect:false,auth:value,reconnection:true,reconnectionDelay:500,reconnectionDelayMax:3000});active=socket;
  socket.on('connect',()=>{if(active===socket)useGameStore.setState({connection:'syncing'})});
  socket.on('room:update',(update:RoomUpdate)=>{if(active===socket)receive(update)});
  socket.on('room:error',()=>{if(active===socket){useGameStore.setState({connection:'syncing',notice:'Đang thử đồng bộ lại.'});clearTimeout(retryTimer);retryTimer=setTimeout(()=>socket.emit('room:sync'),2000)}});
  socket.on('disconnect',()=>{if(active===socket&&useGameStore.getState().connection!=='replaced')useGameStore.setState({connection:'offline'})});
  socket.on('connect_error',(error:Error&{data?:{error:string}})=>{if(active===socket)useGameStore.setState({connection:error.data?'error':'offline',notice:error.data?'Phiên không hợp lệ. Có thể quay lại sảnh để tham gia phòng khác.':'Mất kết nối máy chủ. Đang thử kết nối lại.'})});
  socket.on('session:replaced',()=>{if(active===socket){useGameStore.setState({connection:'replaced',notice:'Phiên điều khiển đã chuyển sang tab khác. Tab này chỉ giữ bản xem cuối.'});socket.disconnect()}});
  socket.connect();
}
export function restoreConnection(){if(!active){const stored=read<Session>(SESSION_KEY);if(stored?.roomCode&&stored?.reconnectToken)connect(stored)}}
async function enter(path:string,displayName:string,companyId:number){
  useGameStore.setState({busy:true,notice:null});
  try{
    const response=await fetch(`${API_ORIGIN}/api/rooms${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName,companyId}),signal:AbortSignal.timeout(20_000)});
    const data=await response.json() as {room:RoomInfo;reconnectToken:string;message?:string;error?:string};
    if(!response.ok)throw new Error(data.message??({COMPANY_TAKEN:'Công ty này đã có người chọn.',ROOM_FULL:'Phòng đã đủ bốn người.',ROOM_ALREADY_STARTED:'Trận đã bắt đầu.',ROOM_NOT_FOUND:'Không tìm thấy phòng.'}[data.error??'']??'Không thể tham gia phòng.'));
    save(PENDING_KEY,null);save(SESSION_KEY,{roomCode:data.room.roomCode,reconnectToken:data.reconnectToken});
    useGameStore.setState({...base(),room:data.room});connect({roomCode:data.room.roomCode,reconnectToken:data.reconnectToken});
  }catch(error){useGameStore.setState({busy:false,notice:error instanceof Error?error.message:'Không thể kết nối.'})}
}
function request(action:ClientAction){
  const s=useGameStore.getState();if(!canControl(s)){useGameStore.setState({notice:'Hãy chờ đến lượt của bạn và kết nối máy chủ.'});return}
  enqueue('game:action',{action});
}
function enqueue(event:Pending['event'],body:{action?:ClientAction;targetProfit?:number}){
  const s=useGameStore.getState();if(pending||s.busy||s.connection!=='connected')return;
  const idempotencyKey=typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
  pending={event,body:{...body,expectedVersion:s.version,idempotencyKey}};save(PENDING_KEY,pending);useGameStore.setState({busy:true,notice:null});void sendPending();
}
export const useGameStore=create<State>((set,get)=>({...base(),
  createRoom:(name,company)=>enter('',name,company),joinRoom:(code,name,company)=>enter(`/${encodeURIComponent(code)}/join`,name,company),
  reconnect:()=>{if(session)connect(session);else restoreConnection()},
  start:targetProfit=>{const s=get();const reason=startBlockReason(s,targetProfit);if(reason){set({notice:reason});return}enqueue('game:start',{targetProfit})},
  newMatch:()=>{const socket=active;active=undefined;socket?.disconnect();clearTimeout(retryTimer);pending=null;session=null;sending=false;save(SESSION_KEY,null);save(PENDING_KEY,null);set(base())},
  roll:()=>request({type:'ROLL_DICE'}),endTurn:()=>request({type:'END_TURN'}),
  setMode:mode=>{if(canControl(get()))set({mode,selectedVertex:null})},selectHex:selectedHex=>set({selectedHex}),selectVertex:selectedVertex=>set({selectedVertex}),locateAsset:selectedVertex=>set({selectedVertex}),
  buildSettlement:vertexId=>request({type:get().setup?'placeSetupSettlement':'BUILD_SETTLEMENT',vertexId}),upgradeSettlement:vertexId=>request({type:'UPGRADE_SETTLEMENT',vertexId}),
  buildFactory:vertexId=>request({type:'BUILD_FACTORY',vertexId}),upgradeFactory:vertexId=>request({type:'UPGRADE_FACTORY',vertexId}),
  produce:(vertexId,product,batches)=>request({type:'MANUFACTURE_GOODS',vertexId,product,batches}),buy:(resource,quantity)=>request({type:'BUY_RAW_MATERIAL',resource,quantity}),sell:(resource,quantity)=>request({type:'SELL_RAW_MATERIAL',resource,quantity}),
  bid:amount=>request({type:'SUBMIT_BID',amount}),skipBid:()=>request({type:'SKIP_BID'}),deliver:(contractId,quantity)=>request({type:'DELIVER_CONTRACT',contractId,quantity}),
  toggleHistory:()=>set(s=>({historyOpen:!s.historyOpen})),clearNotice:()=>set({notice:null}),
}));
