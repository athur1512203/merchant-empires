import {ApiError,type Room,type RoomRepository} from '../src/domain';
// Test double only; production always uses PostgreSQL.
export class MemoryRepository implements RoomRepository {
  rooms=new Map<string,Room>();
  private tail:Promise<unknown>=Promise.resolve();
  async create(room:Room){this.rooms.set(room.roomCode,structuredClone(room))}
  transact<T>(code:string,work:(room:Room)=>T|Promise<T>):Promise<T>{
    const task=this.tail.then(async()=>{
      const stored=this.rooms.get(code);
      if(!stored)throw new ApiError(404,'ROOM_NOT_FOUND');
      const draft=structuredClone(stored),result=await work(draft);
      this.rooms.set(code,draft);
      return result;
    });
    this.tail=task.catch(()=>{});
    return task;
  }
}
