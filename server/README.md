# Merchant Empires — Task 06A

**Task 06B đã triển khai:** frontend hiện dùng multiplayer Socket.IO. Xem [kiến trúc realtime, kết quả kiểm thử và hướng dẫn Windows](TASK_06B_REPORT.md). Các đoạn mô tả frontend local và “còn lại Task 06B” dưới đây là lịch sử Task 06A; API/database nền tảng vẫn áp dụng.

## Kiến trúc

Giữ nguyên React/Vite trong `src/`. Express nằm trong `server/src/`, gọi trực tiếp các types và rules thuần TypeScript ở `src/rules/`; không tạo bản sao gameplay. Frontend vẫn là bản local hiện tại, chưa gọi API (phần kết nối thuộc Task 06B).

Luồng HTTP: Zod → RoomService → RoomRepository → PostgreSQL. `createApp` và service không phụ thuộc socket; Task 06B có thể dùng cùng service và `stateView` cho từng người nhận sau khi commit.

Mỗi transaction lấy `SELECT ... FOR UPDATE` trên GameRoom trước khi đọc snapshot. Lock được chia sẻ giữa mọi process backend. So sánh expectedVersion, ghi snapshot theo compare-and-swap, action và bid trong cùng transaction; exception rollback tất cả. Isolation `ReadCommitted` cho phép request chờ lock đọc version mới nhất. Unique `(roomId, stateVersion)` và `(roomId, playerId, idempotencyKey)` bảo vệ thêm. Hiện repository tải lịch sử action/bid của phòng vào bộ nhớ; trước khi vận hành lâu dài nên chuyển sang truy vấn idempotency theo key và chỉ tải dữ liệu cần thiết.

Reconnect token ngẫu nhiên 256 bit chỉ trả một lần khi tạo/tham gia phòng, database chỉ lưu SHA-256. Gửi lại token qua Bearer để khôi phục phiên; chưa có account/login hoặc endpoint cấp lại token bị mất. Không ghi token vào URL/log. GameState đầy đủ, action payload và AuctionBid là dữ liệu nội bộ; không có API đọc log trực tiếp. Snapshot JSONB giữ đầy đủ dữ liệu để khôi phục sau restart; không dùng cache làm nguồn dữ liệu.

Dice gọi lại `rollDice` hiện có với RNG từ `node:crypto.randomInt`; client không truyền seed/dice/playerId. Board seed do server tạo. RNG có thể inject deterministic trong test. Seed và board.seed không được xuất qua API; market/contract randomness vẫn theo rules hiện tại, không đổi cân bằng.

## PostgreSQL trên Windows

1. Cài Node.js 24 LTS và PostgreSQL bằng Windows installer từ [PostgreSQL](https://www.postgresql.org/download/windows/). Ghi nhớ mật khẩu quản trị và giữ dịch vụ PostgreSQL chạy trên cổng 5432.
2. Trong pgAdmin Query Tool, kết nối database `postgres`, chạy từng câu lệnh bằng tài khoản quản trị (thay mật khẩu mẫu):

```sql
CREATE ROLE merchant LOGIN PASSWORD 'your_local_password';
CREATE DATABASE merchant_empires OWNER merchant;
```

3. Mở PowerShell tại thư mục dự án:

```powershell
npm ci
Copy-Item server/.env.example server/.env
notepad server/.env
```

Sửa `DATABASE_URL` thành `postgresql://merchant:your_local_password@127.0.0.1:5432/merchant_empires?schema=public`. URL-encode ký tự đặc biệt trong mật khẩu. `.env` thật đã được ignore.

```powershell
npm run db:generate
npm run db:migrate
npm run server:dev
```

Migration ban đầu được lưu trong `server/prisma/migrations/202610170001_backend/`. `db:migrate` nạp `server/.env`, áp dụng migration bằng Prisma migrate deploy, không reset database. FK host có DEFERRABLE và các CHECK constraints nằm trong SQL thủ công; giữ chúng khi tạo migration sau này, không thay quy trình bằng `prisma db push`.

Mở terminal PowerShell thứ hai:

```powershell
npm run dev
```

Vite proxy `/api` đến `http://127.0.0.1:3001`; truy cập frontend theo URL Vite in ra. Backend mặc định chỉ bind loopback. `npm run server:start` chạy backend không watch; task này không deploy production.

## Prisma models

| Model | Dữ liệu / ràng buộc |
| --- | --- |
| GameRoom | roomCode unique; host FK thuộc cùng phòng; WAITING/PLAYING/FINISHED; maxPlayers bắt buộc 4 |
| RoomPlayer | displayName, companyId, seatIndex, hash token; unique company và seat trong phòng; CHECK company/seat 0–3 |
| GameSnapshot | một snapshot hiện tại/phòng; version; state JSONB; updatedAt |
| GameAction | actor FK cùng phòng; actionType/payload JSONB; stateVersion; idempotencyKey/requestHash; thời gian |
| AuctionBid | một giá/player/auction/phòng; amount > 0; submittedAt; actor FK cùng phòng |

Các unique index theo roomId cũng hỗ trợ truy vấn từng phòng. Unique seat cùng CHECK 0–3 bảo đảm database không thể chứa hơn bốn thành viên/phòng. `RoomPlayer.id` là UUID xác thực; `companyId` 0–3 là playerId dùng bên trong rules. Seats trong game theo thứ tự tham gia phòng, kể cả chủ phòng chọn công ty khác 0.

## API

Body là JSON. Các endpoint đọc phòng/state và start/actions yêu cầu `Authorization: Bearer <reconnectToken>`. Người ngoài không xem được phòng/state. Create/join chưa cần account; roomCode là lời mời tham gia khi phòng đang chờ.

| Method | Path | Body |
| --- | --- | --- |
| POST | `/api/rooms` | `{ "displayName": "An", "companyId": 0 }` |
| POST | `/api/rooms/:roomCode/join` | `{ "displayName": "Binh", "companyId": 1 }` |
| GET | `/api/rooms/:roomCode` | Không có |
| POST | `/api/rooms/:roomCode/start` | `{ "expectedVersion": 0, "targetProfit": 1000 }` |
| GET | `/api/rooms/:roomCode/state` | Không có |
| POST | `/api/rooms/:roomCode/actions` | `{ "expectedVersion": 1, "action": { "type": "placeSetupSettlement", "vertexId": "..." } }` |

Create/join trả HTTP 201: `{room, playerId, reconnectToken}`. `room.players` chỉ chứa id, displayName, companyId, seatIndex; không trả hash/token người khác. GET room trả room metadata và version, không trả state. Version khởi đầu 0, tăng khi start và mỗi action thành công; join không tăng state version.

Start/actions cần header `Idempotency-Key` dài 8–128 ký tự chữ/số/`_`/`-`, ví dụ `turn-01-roll-001`. Chỉ host được start, cần đủ bốn thành viên. Client không gửi playerId, vàng, tài nguyên, kết quả dice hoặc seed; Zod strict từ chối trường ngoài schema.

Actions hỗ trợ (ngoài type, chỉ gửi các trường dưới đây):

| type | Trường |
| --- | --- |
| placeSetupSettlement / BUILD_SETTLEMENT / UPGRADE_SETTLEMENT / BUILD_FACTORY / UPGRADE_FACTORY | vertexId |
| ROLL_DICE / END_TURN / SKIP_BID | Không có |
| BUY_RAW_MATERIAL / SELL_RAW_MATERIAL | resource, quantity |
| MANUFACTURE_GOODS | vertexId, product, batches |
| SUBMIT_BID | amount |
| DELIVER_CONTRACT | contractId, quantity |

Rules tự đóng auction sau quyết định thứ tư; không cho client gửi CLOSE_AUCTION. Số lượng và targetProfit là số nguyên 1–1.000.000, giới hạn đầu vào API. Resource/product dùng các enum hiện có.

Start/action trả `{version, state, appliedVersion, replayed}`; GET state trả `{version, state}`. `state` là DTO đã lọc, không phải GameState nội bộ nguyên vẹn. Retry cùng key và cùng request trả appliedVersion cũ, replayed=true, nhưng state/version là dữ liệu mới nhất đã lọc cho người gọi. Không áp dụng action lần hai. Khác request mà dùng lại key: 409. Nếu timeout không rõ commit chưa, retry đúng body/key; nếu STALE_STATE_VERSION, GET state và tạo quyết định mới với key mới.

HTTP errors: 400 INVALID_REQUEST/INVALID_JSON_BODY; 401 INVALID_TOKEN; 403 NOT_A_ROOM_MEMBER/HOST_ONLY; 404 ROOM_NOT_FOUND; 409 ROOM_FULL/COMPANY_TAKEN/NEED_FOUR_PLAYERS/ROOM_ALREADY_STARTED/ROOM_NOT_PLAYING/STALE_STATE_VERSION/IDEMPOTENCY_KEY_REUSED/CONFLICT; 422 ILLEGAL_ACTION. 500 không chứa thông tin Prisma hoặc payload riêng tư. Các response có Cache-Control: no-store.

Đấu thầu đang mở chỉ trả sealedBids của chính viewer; không trả danh sách giá đối thủ. Sau khi đóng, công bố winnerId/winningBid và trạng thái hợp đồng theo rules. Giá thua lưu nội bộ, không có endpoint công bố thêm.

## Kiểm thử

```powershell
npm run db:generate
npm run typecheck
npm test
npm run build
```

`api.test.ts` chạy Express thật qua Supertest với repository bộ nhớ chỉ dành cho test. Kiểm thử tạo/join, capacity, company trùng, host, setup/turn/ownership, chống client giả mạo, deterministic server dice, idempotency, concurrent action/join, rollback, projection đấu thầu và service mới đọc lại snapshot.

`postgres.test.ts` chạy hai PrismaClient riêng để kiểm tra database lock/CAS, constraints, idempotency, rollback và đọc snapshot bằng client khác sau disconnect. Để chạy, tạo database test riêng bằng pgAdmin, rồi trong PowerShell (thay URL mẫu):

```powershell
$env:DATABASE_URL='postgresql://merchant:your_local_password@127.0.0.1:5432/merchant_empires_test?schema=public'
npx prisma migrate deploy --schema server/prisma/schema.prisma
$env:TEST_DATABASE_URL=$env:DATABASE_URL
npm test
Remove-Item Env:TEST_DATABASE_URL
Remove-Item Env:DATABASE_URL
```

Integration test chỉ xóa các phòng chính nó tạo, không reset database. Không có TEST_DATABASE_URL thì test PostgreSQL được đánh dấu skipped.

### Kiểm thử với Neon hiện tại

Khi `server/.env` đã có DATABASE_URL của database được migrate:

```powershell
npm run test:neon
npm run typecheck
npm run build
```

`test:neon` đọc trực tiếp `server/.env` mà không in cấu hình, đặt TEST_DATABASE_URL cho tiến trình Vitest và chạy toàn bộ suite tuần tự. Output lỗi được lọc URL/password trước khi hiển thị. Không chạy migrate/reset và không sửa schema.

Ngoài integration test repository cũ, `neonRestart.test.ts` mở backend trên cổng loopback riêng, gọi đủ sáu endpoint, tạo phòng bốn người, đặt khu định cư và gieo xúc xắc, đọc trực tiếp các bản ghi PostgreSQL, dừng tiến trình backend rồi chạy tiến trình mới. Test so sánh toàn bộ state HTTP và snapshot database trước/sau restart, retry action để xác minh idempotency còn hiệu lực, rồi kết thúc lượt để xác nhận tiếp tục trận.

Phòng của test restart có tên thành viên `TASK06A-NEON-RESTART-*` và roomCode ngẫu nhiên riêng; được giữ lại để đối chiếu trong Neon. `server/neon-verification.json` chỉ chứa mã/ID phòng và kết quả kiểm tra, không chứa URL, mật khẩu, reconnect token hoặc GameState riêng tư. Integration test cũ chỉ dọn đúng phòng do nó tạo. Kiểm thử so sánh metadata/version snapshot của các phòng tồn tại trước test để phát hiện thay đổi ngoài phạm vi.

## Phát hiện từ source / phần còn lại

- Task 03–05 có code và test dù mục trạng thái trong GAME_RULES.md còn ghi chưa triển khai. Backend tái sử dụng code hiện tại, không sửa luật kinh tế.
- Task 05.2 chưa có: GameContract.product và catalog chỉ nhận Product thành phẩm; chưa hỗ trợ hợp đồng nguyên liệu thô. Backend hỗ trợ hợp đồng thành phẩm hiện có, không tự thêm luật/catalog.
- Một số thông số code khác Phụ lục A đề xuất (ví dụ công suất 1/2/3 lô), giữ nguyên. Các engine demo cũ không dùng làm nguồn thẩm quyền.
- Task 06B: kết nối frontend với API, lưu/reconnect token phía client, Socket.IO xác thực theo phòng, đồng bộ version sau commit, lọc state riêng cho từng socket, phục hồi khi mất kết nối. Không broadcast nguyên snapshot hoặc action/bid nội bộ. Không có Socket.IO trong Task 06A.
- Trước khi dùng thực tế, chạy migration và PostgreSQL integration test trên database hoạt động; xem `TASK_06A_REPORT.md` về những kiểm tra đã/chưa chạy tại máy này.

Tham khảo triển khai: [Prisma 6 transactions](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions), [Prisma 6 PostgreSQL/JSONB](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql).
