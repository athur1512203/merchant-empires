# Báo cáo Task 06A — 17/10/2026

## Cập nhật xác minh Neon — 21:36, 17/10/2026 (Asia/Saigon)

**Đã xác minh thành công trên Neon thật.** Kết quả cập nhật này thay thế các mục “chưa chạy/skipped” của lần kiểm tra ban đầu bên dưới.

- Đọc DATABASE_URL trực tiếp từ `server/.env`; không in URL/password. File `.env` vẫn được git ignore.
- Đọc PostgreSQL xác nhận đủ 5 bảng ứng dụng và `_prisma_migrations`, có 1 migration hoàn tất. Không chạy lại migration, reset schema hoặc xóa database.
- Integration test trước đây bị skip đã pass: foreign keys/CHECK constraints, giới hạn bốn người, company trùng, transaction rollback (kể cả lỗi ghi DB sau cập nhật snapshot), hai PrismaClient gửi đồng thời, stale version, idempotency và giá thầu kín lưu thật trong AuctionBid.
- Test HTTP với tiến trình backend riêng đã pass: create, join, GET room, start, actions, GET state. Tạo bốn người, đặt bốn khu định cư và gieo xúc xắc bằng rules hiện tại.
- Truy vấn trực tiếp Neon xác nhận GameRoom PLAYING, 4 RoomPlayer với hash token, GameSnapshot version 6 và 6 GameAction trước restart.
- Dừng tiến trình backend và khởi chạy tiến trình khác (PID khác). Toàn bộ HTTP state và snapshot PostgreSQL sau restart bằng chính xác dữ liệu trước restart; retry action không tăng version hoặc số action. END_TURN sau restart thành công, snapshot lên version 7, turnIndex=1, rolled=false và có 7 actions.
- Phòng bằng chứng của lượt full suite: **TZEKP6RM**, ID `1a514f50-30eb-4070-a26d-d76423f55160`; giữ lại trong Neon. Test restart được chạy hai lần, mỗi lần tạo phòng riêng và giữ lại. Integration test repository chỉ xóa phòng chính nó tạo. Metadata/version snapshot của các phòng tồn tại trước test restart được kiểm tra không đổi.
- **Toàn bộ suite với Neon bật: 140/140 tests passed, 10/10 test files passed, không skip.** `npm run typecheck` và `npm run build` đều thành công.
- Không có lỗi backend/database còn lại trong các kiểm tra này. Trong lúc bổ sung test có lỗi TypeScript do `response.json()` là unknown; đã sửa kiểu dữ liệu và chạy typecheck thành công. Không sửa gameplay hoặc triển khai Task 06B.

File mới: `server/tests/neonRestart.test.ts`, `server/tests/run-neon-tests.mjs`, `server/neon-verification.json`. File chỉnh sửa: `server/tests/postgres.test.ts` (timeout cho kết nối cloud), `package.json` (script `test:neon`), README backend và báo cáo này. Backend runtime/rules không thay đổi trong lượt xác minh.

Chạy lại bằng `npm run test:neon`, sau đó `npm run typecheck` và `npm run build`. Script đọc `.env` riêng tư, lọc thông tin kết nối khỏi output và chạy test files tuần tự để tránh xung đột phép kiểm tra dữ liệu tồn tại trước đó. Bằng chứng máy đọc được ở [neon-verification.json](neon-verification.json).

## Báo cáo triển khai ban đầu (lịch sử)

Đã tạo backend Express + TypeScript, Prisma/PostgreSQL schema và migration, validation Zod, bộ kiểm thử Vitest/Supertest. Tái sử dụng trực tiếp types/rules hiện có. Không thay đổi gameplay, giao diện chính hoặc triển khai realtime/deploy.

## Kiến trúc và tính toàn vẹn

- `app.ts`: sáu API HTTP, validation và xử lý lỗi không tiết lộ dữ liệu nội bộ.
- `service.ts`: xác thực membership/host, ánh xạ UUID người chơi sang companyId, luật chơi tại server, xúc xắc crypto, idempotency và version.
- `prismaRepository.ts`: PostgreSQL row lock theo phòng, snapshot compare-and-swap, lưu action/bid/snapshot trong cùng transaction; rollback nếu bất kỳ ghi nào lỗi. Không dùng bộ nhớ làm nguồn dữ liệu production.
- `projection.ts`: chỉ xuất metadata cần thiết, lọc sealedBids theo viewer, ẩn seed nội bộ. Task 06B phải tái sử dụng projection cho từng người nhận.
- Database có FK host/player cùng phòng; unique roomCode/company/seat/idempotency/version/bid; CHECK seat/company 0–3 và maxPlayers=4. Token chỉ lưu SHA-256.

Prisma models: **GameRoom**, **RoomPlayer**, **GameSnapshot**, **GameAction**, **AuctionBid**. Snapshot hiện tại có version; action log giữ lịch sử hành động, chưa tạo snapshot riêng cho mọi version.

## API đã triển khai

1. `POST /api/rooms`
2. `POST /api/rooms/:roomCode/join`
3. `GET /api/rooms/:roomCode`
4. `POST /api/rooms/:roomCode/start`
5. `GET /api/rooms/:roomCode/state`
6. `POST /api/rooms/:roomCode/actions`

Chi tiết body, headers, action types, lỗi và retry có trong [server/README.md](README.md).

## File tạo mới

```text
.gitignore
server/.env.example
server/tsconfig.json
server/README.md
server/TASK_06A_REPORT.md
server/prisma/schema.prisma
server/prisma/migrations/migration_lock.toml
server/prisma/migrations/202610170001_backend/migration.sql
server/src/domain.ts
server/src/validation.ts
server/src/projection.ts
server/src/service.ts
server/src/prismaRepository.ts
server/src/app.ts
server/src/index.ts
server/tests/memoryRepository.ts
server/tests/api.test.ts
server/tests/postgres.test.ts
```

File chỉnh sửa: `package.json`, `package-lock.json` (dependencies/scripts), `vite.config.ts` (proxy API), `README.md` (liên kết tài liệu backend). Build tái tạo `dist/` và TypeScript build cache; các artifact này đã được ignore. Không sửa file gameplay trong `src/`.

## Kết quả xác minh

| Kiểm tra | Kết quả thực tế |
| --- | --- |
| Prisma generate | Thành công, Prisma Client 6.19.3 |
| Prisma validate | Schema hợp lệ |
| Prisma migrate diff từ schema rỗng | Tạo migration SQL thành công; bổ sung CHECK và deferrable FK thủ công |
| `npm run typecheck` | Thành công cho frontend + backend + tests |
| `npm test` | **138 passed, 1 skipped**; 8 test files passed, 1 skipped |
| `npm run build` | Production frontend build thành công |
| PostgreSQL migration deploy | **Chưa chạy** trên database thật |
| PostgreSQL integration test | **Skipped**, chưa có TEST_DATABASE_URL |

9 test API mới bao phủ tạo/join, bốn người tối đa, company trùng, host/start, seat mapping, valid/invalid actions, spoofing, quyền sở hữu, idempotency/retry đồng thời, stale version/concurrent action/join, bí mật giá thầu, kết quả trúng thầu và đọc lại state qua service mới. Các test còn lại là gameplay hiện có.

Test bộ nhớ không chứng minh PostgreSQL locking hoặc persistence qua restart process. Đã viết test integration với hai PrismaClient cho constraints, concurrent writes, rollback sau lỗi database, idempotency và khôi phục snapshot khi client đầu tiên disconnect; chưa chạy nên không tuyên bố các phần đó đã được xác minh bằng database thật.

Kiểm tra TCP ngoài sandbox không xác nhận listener tại `127.0.0.1:5432`. `prisma migrate status` không thành công, trả `Schema engine error` không có chi tiết. Không tìm thấy lệnh psql/docker trong PATH; không tạo `.env` thật, không cài PostgreSQL hoặc thay đổi dịch vụ/dữ liệu máy.

## Chạy trên Windows

Sau khi cài PostgreSQL và tạo database/role như [hướng dẫn](README.md):

```powershell
npm ci
Copy-Item server/.env.example server/.env
notepad server/.env
npm run db:generate
npm run db:migrate
npm run server:dev
```

Terminal thứ hai chạy `npm run dev`. Dùng `npm run typecheck`, `npm test`, `npm run build` để xác minh. Hướng dẫn database test và TEST_DATABASE_URL có trong README.

## Việc còn lại trước Task 06B

- Chạy migration và integration test trên PostgreSQL thật, xác minh restart backend với database đó.
- Xác nhận phạm vi Task 05.2: hiện source chỉ có hợp đồng **thành phẩm**, chưa có hợp đồng nguyên liệu thô. Không tự thêm luật mới trong task này.
- Frontend vẫn dùng local GameStore; Task 06B cần nối API, quản lý token/reconnect, đồng bộ version và Socket.IO sau commit. Mọi state gửi tới từng socket phải được lọc; không broadcast snapshot/action log/bid nội bộ.
- Cập nhật trạng thái Task 03–05 trong tài liệu luật khi nhóm xác nhận: source đã có các module/test dù GAME_RULES.md vẫn đánh dấu chưa triển khai. Giữ nguyên thông số cân bằng hiện tại.

Không triển khai tài khoản, Task 06B, hợp đồng nguyên liệu thô hoặc deploy production.
