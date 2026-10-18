import type {RoomInfo} from '../network/protocol';
export const MULTIPLAYER_RULES_VERSION='human-2-4-buildings-v2';
export function startBlockReason(s:{room:RoomInfo|null;playerId:string|null;connection:string;busy:boolean;rulesVersion?:string|null},target:number):string|null{
  if(!s.room)return 'Bạn chưa tham gia phòng.';
  if(s.room.hostPlayerId!==s.playerId)return 'Chỉ chủ phòng được bắt đầu trận.';
  if(s.room.status!=='WAITING')return 'Trận đấu đã bắt đầu.';
  if(s.connection!=='connected')return s.connection==='replaced'?'Phiên điều khiển đã chuyển sang tab khác. Hãy kết nối lại.':s.connection==='syncing'?'Đang đồng bộ phòng với máy chủ.':'Chưa kết nối máy chủ. Hãy kết nối lại.';
  if(s.rulesVersion!==MULTIPLAYER_RULES_VERSION)return 'Frontend và backend chưa cùng phiên bản luật mới. Cần cập nhật cả hai và tải lại trang.';
  if(s.busy)return 'Đang xử lý yêu cầu trước. Vui lòng chờ xác nhận.';
  if(s.room.players.length<2)return 'Cần ít nhất 2 người tham gia để bắt đầu.';
  if(s.room.players.length>4)return 'Phòng chỉ hỗ trợ tối đa 4 người.';
  if(!Number.isSafeInteger(target)||target<=0)return 'Mục tiêu lợi nhuận phải là số nguyên dương an toàn.';
  return null;
}
