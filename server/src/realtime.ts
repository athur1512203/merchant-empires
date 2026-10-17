import type {Server as HttpServer} from 'node:http';
import {Server} from 'socket.io';
import {z} from 'zod';
import {ApiError} from './domain';
import type {RoomService} from './service';
import {roomCodeSchema,keySchema,actionRequest,startRequest} from './validation';
import type {Ack,RoomUpdate} from '../../src/network/protocol';
import {allowedOrigins} from './origins';

const authentication=z.object({roomCode:roomCodeSchema,reconnectToken:z.string().min(1).max(128)}).strict();
const command=actionRequest.extend({idempotencyKey:keySchema});
const start=startRequest.extend({idempotencyKey:keySchema});
function failure(error:unknown):Extract<Ack,{ok:false}>{
  if(error instanceof ApiError)return{ok:false,error:error.code,message:error.message};
  if(error instanceof z.ZodError)return{ok:false,error:'INVALID_REQUEST',message:'Dữ liệu gửi không hợp lệ.'};
  return{ok:false,error:'INTERNAL_ERROR',message:'Không thể xử lý yêu cầu. Hãy kết nối lại.'};
}
export function attachRealtime(http:HttpServer,service:RoomService){
  const io=new Server(http,{maxHttpBufferSize:16_384,cors:{origin:allowedOrigins(),methods:['GET','POST']}});
  const pending=new Map<string,Promise<void>>();
  const controllers=new Map<string,string>();
  async function publish(code:string){
    const sockets=[...io.sockets.sockets.values()].filter(s=>s.data.roomCode===code);
    if(!sockets.length)return;
    try{
      const updates=await service.sessions(code,sockets.map(s=>s.data.token as string));
      const onlinePlayerIds=[...new Set(sockets.map(s=>s.data.playerId as string))];
      sockets.forEach((socket,i)=>{if(socket.connected)socket.emit('room:update',{...updates[i],onlinePlayerIds} satisfies RoomUpdate)});
    }catch{for(const socket of sockets)socket.emit('room:error',{error:'SYNC_FAILED',message:'Đồng bộ thất bại. Đang thử lại.'})}
  }
  function schedule(code:string){
    const next=(pending.get(code)??Promise.resolve()).then(()=>publish(code)).catch(()=>{});
    pending.set(code,next);
    void next.finally(()=>{if(pending.get(code)===next)pending.delete(code)});
    return next;
  }
  const unsubscribe=service.subscribe(code=>{void schedule(code)});
  io.use(async(socket,next)=>{
    try{
      const auth=authentication.parse(socket.handshake.auth);
      const [session]=await service.sessions(auth.roomCode,[auth.reconnectToken]);
      Object.assign(socket.data,{roomCode:auth.roomCode,token:auth.reconnectToken,playerId:session.self.playerId});
      next();
    }catch(error){const result=failure(error);const denied=new Error(result.error);Object.assign(denied,{data:result});next(denied)}
  });
  io.on('connection',socket=>{
    const code=socket.data.roomCode as string,playerId=socket.data.playerId as string;
    const controllerKey=`${code}:${playerId}`,old=controllers.get(controllerKey);
    controllers.set(controllerKey,socket.id);
    if(old){const previous=io.sockets.sockets.get(old);previous?.emit('session:replaced');previous?.disconnect(true)}
    void schedule(code);
    let busy=false;
    async function execute(input:unknown,ack:unknown,isStart:boolean){
      if(typeof ack!=='function')return;
      const reply=ack as (value:Ack)=>void;
      if(controllers.get(controllerKey)!==socket.id){reply({ok:false,error:'SESSION_REPLACED',message:'Phiên đã được mở ở nơi khác.'});return}
      if(busy){reply({ok:false,error:'REQUEST_IN_PROGRESS',message:'Đang xử lý yêu cầu trước.'});return}
      busy=true;
      try{
        const {idempotencyKey,...body}=(isStart?start:command).parse(input);
        const result=await service.execute(code,socket.data.token,idempotencyKey,body,isStart);
        reply({ok:true,appliedVersion:result.appliedVersion});
      }catch(error){reply(failure(error));void schedule(code)}finally{busy=false}
    }
    socket.on('game:action',(input,ack)=>{void execute(input,ack,false)});
    socket.on('game:start',(input,ack)=>{void execute(input,ack,true)});
    socket.on('room:sync',()=>{void schedule(code)});
    socket.on('disconnect',()=>{
      if(controllers.get(controllerKey)===socket.id)controllers.delete(controllerKey);
      void schedule(code);
    });
  });
  io.on('close',unsubscribe);
  // Unsubscribe explicitly when shutting down; no token/state is ever broadcast to a room.
  return {io,close:()=>{unsubscribe();io.close()}};
}
