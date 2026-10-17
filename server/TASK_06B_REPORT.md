# Task 06B — Multiplayer realtime

## Kết quả

Frontend đã chuyển từ pass-and-play sang bốn người qua Socket.IO. GameStore chỉ giữ state do server gửi và UI selection; không còn gọi applyAction để xử lý gameplay tại client. Express/Prisma/Neon và toàn bộ rules Task 01–05 được tái sử dụng. Không thay đổi schema hoặc chạy migration, không có account/login, không deploy.

Lobby hỗ trợ tên, tạo phòng, nhập mã tham gia, chọn công ty còn trống, danh sách người chơi/presence, mục tiêu lợi nhuận và host start khi đủ bốn người. Bổ sung endpoint công khai `GET /api/rooms/:roomCode/availability` chỉ trả roomCode, trạng thái, số người và company IDs đã chọn, không trả tên, token, snapshot hoặc bid. Server vẫn quyết định company/room capacity trong transaction khi join.

Socket handshake nhận `{roomCode,reconnectToken}` qua auth, xác thực membership với database. Một UUID người chơi chỉ có một socket điều khiển trong process; socket mới chuyển quyền, socket cũ nhận `session:replaced` rồi bị disconnect. Người chơi không thể tự chọn actor trong payload; server ánh xạ token → member → companyId và kiểm tra lượt/luật. Join lại bằng token không tạo RoomPlayer mới.

`RoomService` thông báo sau khi transaction commit; cả HTTP mutations và socket mutations đều cập nhật các người chơi đang kết nối. Mỗi người nhận projection riêng, tuyệt đối không broadcast snapshot/action payload/bids nguyên bản. Socket.IO ACK chỉ chứa appliedVersion hoặc lỗi an toàn. Client không gửi seed/dice/vàng/tài nguyên/playerId.

Sau reconnect, server đọc lại snapshot từ Neon. Client lưu session và action đang chờ ACK trong **sessionStorage theo tab**; refresh giữ công ty. Action timeout được gửi lại cùng key/version; backend idempotency ngăn thực thi hai lần. Client bỏ snapshot cũ và khóa thao tác khi offline, đang xử lý hoặc chưa nhận state đã commit. Không dùng socket.id làm danh tính lâu dài.

## Protocol

| Hướng | Event | Nội dung |
| --- | --- | --- |
| Client → server | `game:start` | expectedVersion, idempotencyKey, targetProfit; host only |
| Client → server | `game:action` | expectedVersion, idempotencyKey, action không chứa actor |
| Client → server | `room:sync` | Yêu cầu tải lại room và state |
| Server → client | `room:update` | room metadata, state đã lọc, version, self identity, onlinePlayerIds |
| Server → client | `session:replaced` | Phiên điều khiển đã chuyển sang socket khác |
| Server → client | `room:error` | Lỗi đồng bộ an toàn, client thử tải lại |

Các action kinh doanh, dice, xây/nâng cấp, nhà máy, sản xuất, giao hợp đồng và đấu thầu dùng schema/rules cũ. Đấu thầu chỉ gửi giá của chính viewer khi mở; winner/winningBid công bố qua contracts sau khi đóng. Không thay đổi giới hạn hợp đồng thành phẩm hiện có từ Task 06A.

## Giao diện bàn cờ

Giữ bố cục, giao diện bản đồ, sidebar và các panel hiện tại; bổ sung lobby và thanh trạng thái phòng/kết nối. Sidebar, market, industry và tender dùng company của chính người chơi, không lấy người đang lượt làm người dùng. Turn header dùng seats → companyId để hỗ trợ thứ tự chọn công ty bất kỳ.

Trong UI test phát hiện lỗi hình học hiển thị có sẵn: `decorateVertices` dùng chỉ số góc SVG không đúng chiều so với axial logic, khiến hai vertex IDs khác nhau có thể trùng tọa độ và click nhầm công trình. Đã sửa **phép chiếu SVG**, không sửa board rules, adjacency, settlement validation hoặc dữ liệu công trình. Có regression test xác nhận mọi logical vertex có vị trí pixel riêng.

## Kiểm thử thực tế

Kết quả lượt cuối ngày 17/10/2026: **150/150 tests passed, 12/12 files passed, không skip** với `npm run test:neon`; `npm run typecheck` và `npm run build` đều thành công. Phòng bằng chứng restart cuối: **49DB3GYX**, snapshot version 7, 4 players/7 actions, 4 realtime clients reconnect thành công; 5 phòng đã tồn tại giữ nguyên metadata/version trong kiểm tra này. Không còn lỗi thất bại trong lượt xác nhận cuối.

- Mở **4 tab trình duyệt thật** tại `http://127.0.0.1:5173/`, tạo phòng **LHKYLYTT**, chọn bốn công ty khác nhau, hiển thị 4/4 trực tuyến. Chỉ host thấy nút bắt đầu.
- Cả bốn tab tự đặt settlement từ tài khoản của mình; hoàn tất setup. Tab 1 gieo và cả bốn tab cùng hiển thị `2 + 2 = 4`. Nút gieo/end turn của tab 2 disabled khi chưa tới lượt.
- Refresh tab 2 khôi phục đúng Timber Guild và snapshot, không join thêm người.
- Chơi ba vòng qua UI, không inject state. Bids 20 (Iron Works), 10 (Timber Guild), hai skip. UI tab 2 không chứa giá chào 20 của đối thủ; đóng phiên công bố Timber Guild thắng 10 vàng ở cả phòng, sang vòng 4.
- Socket test tự động có bốn clients, quyền truy cập/actor spoofing, host, capacity/company, state/resources/dice/buildings/turn đồng bộ, company không trùng seat, takeover/reconnect/idempotency, đấu thầu kín kể cả reconnect và công bố kết quả.
- Neon integration khởi động backend trong tiến trình riêng, kết nối **4 Socket.IO clients**, lưu snapshot thật, dừng process rồi khởi động PID khác, tự reconnect cả bốn, so khớp chính xác snapshot và tiếp tục trận. Dữ liệu phòng cũ được kiểm tra không đổi khi test chạy độc lập với thao tác UI.
- Frontend tests xác nhận không optimistic mutation, đúng company, chặn ngoài lượt, bỏ version cũ, session takeover và retry key còn trong storage sau refresh.

Bằng chứng: `server/multiplayer-lobby.png`, `server/multiplayer-board.png`, `server/neon-verification.json`. Phòng UI và các phòng restart test được giữ để đối chiếu; integration repository chỉ dọn đúng phòng do nó tạo, không reset/xóa dữ liệu ngoài test.

Trong quá trình chuyển đổi, bốn legacy tests còn gọi local GameStore nên thất bại theo kiến trúc cũ; đã giữ nguyên các assertion gameplay và chuyển chúng sang rules dùng tại server. Một lượt kiểm tra bất biến dữ liệu cũ bị ảnh hưởng bởi UI đang chơi đồng thời; lượt cuối chạy sau khi dừng thao tác UI. Các lỗi kiểu TypeScript trong test socket được sửa bằng helper event phù hợp Socket.IO.

## File thay đổi

Tạo mới:

```text
server/src/realtime.ts
server/tests/realtime.test.ts
server/TASK_06B_REPORT.md
server/multiplayer-lobby.png
server/multiplayer-board.png
src/network/protocol.ts
src/components/Lobby.tsx
src/multiplayer.css
src/store/gameStore.test.ts
```

Chỉnh sửa:

```text
package.json / package-lock.json — Socket.IO dependencies
vite.config.ts — proxy /socket.io và WebSocket upgrade
server/src/index.ts — HTTP server dùng chung Express + Socket.IO
server/src/service.ts — commit notifications, authenticated projections và availability
server/src/app.ts — public company availability endpoint
server/tests/neonRestart.test.ts — 4 clients reconnect qua restart thật
server/neon-verification.json — kết quả database mới nhất, không có secrets
src/store/gameStore.ts — network-only gameplay, per-tab session và pending command
src/App.tsx — lobby, connection bar, turn ownership
src/components/Board.tsx — chỉ cho người đến lượt đặt công trình
src/components/EconomyPanel.tsx — company cá nhân, chặn controls ngoài lượt
src/engine/hexGrid.ts — sửa projection vertex SVG
src/engine/gameEngine.test.ts — setup assertions server rules và projection regression
README.md / server/README.md — hướng dẫn multiplayer
```

Không sửa các file `src/rules/*` hoặc Prisma schema/migration.

## Chạy multiplayer trên Windows

Node.js 24; `server/.env` giữ DATABASE_URL Neon hiện tại, không đưa vào frontend hoặc git.

```powershell
npm ci
npm run db:generate
npm run server:dev
```

Terminal thứ hai:

```powershell
npm run dev
```

Mở URL Vite trong **bốn tab mới riêng biệt**. Tab 1 tạo phòng; ba tab kia nhập mã và chọn công ty khác. Host đặt targetProfit và bắt đầu. Từng người click đỉnh sáng để đặt settlement miễn phí, rồi chơi theo lượt. Refresh tab vẫn giữ phiên. Nếu duplicate một tab đã tham gia, browser có thể sao chép sessionStorage; phiên mới sẽ chuyển quyền cùng công ty và tab cũ bị ngắt. Để tạo người chơi mới, mở tab mới rồi nhập URL thay vì duplicate tab đã có phiên.

Khi backend restart, giữ nguyên tab; Socket.IO tự nối lại và server đọc snapshot Neon. “Kết nối lại” cho phép thử thủ công. “Về sảnh · bỏ phiên trên tab này” chỉ bỏ token trên tab, không xóa room/member trong database. Nếu đóng hẳn tab hoặc xóa sessionStorage, token không có cơ chế account để cấp lại; giữ tab và dùng refresh khi cần khôi phục.

Để dùng thiết bị khác cùng LAN, chạy frontend bằng `npm run dev -- --host 0.0.0.0`, mở `http://<IP-máy-chạy-Vite>:5173` trên thiết bị đó. Vite proxy HTTP/socket tới backend loopback; không cần đổi DATABASE_URL hay đưa Neon credentials cho trình duyệt. Cần mạng và Windows Firewall cho phép cổng Vite; task này không tự thay đổi firewall hoặc triển khai hosting. Kiểm thử LAN nhiều thiết bị chưa được chạy; đã kiểm tra bốn tab cùng máy.

```powershell
npm run typecheck
npm run test:neon
npm run build
```

`npm test` chạy local suite và skip hai test Neon khi không có TEST_DATABASE_URL; `npm run test:neon` đọc `.env` riêng tư và chạy toàn bộ suite với database thật. Không thao tác cùng phòng UI trong lúc chạy test bất biến database.

Kiến trúc hiện tại dùng một backend process cho presence/controller/publish. Neon vẫn kiểm soát dữ liệu khi restart; nếu cần chạy nhiều backend instances trong tương lai phải bổ sung adapter/bus chia sẻ và session coordination. Chưa triển khai scaling/deploy trong Task 06B.

Tham khảo: [Socket.IO middleware](https://socket.io/docs/v4/middlewares/), [delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/), [client reconnect](https://socket.io/docs/v4/client-options/). Retry qua refresh dùng persistence/idempotency của ứng dụng vì Socket.IO mặc định không bảo đảm lưu pending message qua refresh.
