# Task 06C — Audit & fix Render deployment

## A. Nguyên nhân

Local và GitHub main trước sửa cùng commit `ca982758397e1f4b08fb406285dc8dfbc3197739`. Đã kiểm tra tree được Git theo dõi, package/lockfile, TypeScript, Prisma, startup và cấu hình hosting. Không có package/workspace độc lập trong server.

```text
package.json                  # package duy nhất; dependencies cho cả frontend/backend
package-lock.json             # lockfile duy nhất; không có workspaces
tsconfig.app.json             # frontend + tests nằm trong src
render.yaml                   # backend
vercel.json                   # frontend
src/                          # React + types/rules dùng chung
server/src/index.ts           # backend entry
server/prisma/schema.prisma   # schema thực tế
server/prisma/migrations/     # migration hiện có, giữ nguyên
server/tsconfig.json          # kiểm tra backend và tests
```

1. **Sai vị trí schema:** `prisma/schema.prisma` không tồn tại ở gốc. Chạy Prisma không chỉ định schema trước đây có thể tìm ở đường dẫn mặc định này; đổi Root Directory không giải quyết cấu trúc package dùng chung. Script đúng chỉ rõ `--schema server/prisma/schema.prisma`; nay thêm `package.json#prisma.schema` để lệnh Prisma mặc định cũng tìm đúng trong Prisma 6.
2. **Sai build target:** root script `build` là `tsc -b && vite build`, dành cho Vercel. Log người dùng cung cấp khớp đúng script frontend này; Render backend không được gọi nó. Root Directory phải là repo root, không phải `server`, `src` hoặc `server/src`.
3. **Thiếu build dependencies:** frontend tsconfig bao gồm tests trong src, nên cần Vitest và các type declarations React DOM. Chúng nằm trong devDependencies; cài production-only sẽ thiếu. Build phải dùng `npm ci --include=dev` kể cả khi NODE_ENV=production. Backend build mới cũng loại frontend/tests khỏi chương trình typecheck và bundle.
4. **Thiếu artifact production rõ ràng:** trước đây `server:start` chạy TypeScript bằng tsx và chưa có backend production build. Nay backend có pipeline riêng, artifact thật và start bằng Node.

Kết luận về lệnh build được đối chiếu trực tiếp với source và log đã cung cấp; chưa truy cập/đọc dashboard Render nên không khẳng định các giá trị dashboard hiện đang được lưu. Với service tạo thủ công, sửa render.yaml không tự thay Build/Start/Root Directory trong dashboard.

## B. File sửa

- `package.json`, `package-lock.json`: scripts server:build/server:start/verify:render, engines Node 24.x, schema Prisma 6, esbuild khai báo trực tiếp đúng phiên bản 0.28.2 đã có trong lockfile. Không nâng major/resolved dependency versions.
- `.node-version`: Node 24.21.0; `render.yaml`: repo root, main, backend build/start, Node version dạng string, một instance, autoDeployTrigger off.
- `server/tsconfig.build.json`: typecheck production chỉ backend và các imports rules/types, không tests.
- `server/build.mjs`: esbuild bundle own code sang ESM Node 24, external npm dependencies, manifest liệt kê inputs; từ chối frontend/test inputs.
- `server/src/index.ts`: dotenv quiet; production yêu cầu FRONTEND_ORIGIN; mặc định bind 0.0.0.0 trong production, giữ PORT từ environment, log port không chứa credentials.
- `scripts/verify-render-clean.mjs`: tạo thư mục sạch, npm ci/build/tests và production smoke test; chỉ nạp bí mật qua process environment, lọc output; kiểm tra các bản ghi Neon đã tồn tại không đổi.
- `.gitignore`: bỏ qua `.render-verification/` chứa dependencies/artifacts/báo cáo kiểm thử sạch.
- `DEPLOYMENT.md`, `README.md`, `server/README.md`, báo cáo này: cập nhật chỉ dẫn deployment.

Không sửa gameplay, Prisma schema hoặc migration. Không đổi Vercel: `npm run build` vẫn là frontend, output `dist`.

## C. Cấu hình Render chính xác

| Setting | Giá trị |
| --- | --- |
| Service type | Web Service, Node |
| Repository | athur1512203/merchant-empires |
| Branch | main |
| Root Directory | Để trống trong dashboard (= repo root); nếu cần giá trị dùng `.` |
| Build Command | `npm ci --include=dev && npm run db:generate && npm run server:build` |
| Start Command | `npm run server:start` (chạy `node server/dist/index.mjs`) |
| Node.js | `24.21.0` |
| Health Check Path | `/api/health` |
| Instances | 1 |
| Auto Deploy | Off trong lúc chờ xác nhận |

Environment:

| Key | Cấu hình |
| --- | --- |
| DATABASE_URL | Bắt buộc, Neon PostgreSQL connection string có TLS; lưu secret trên Render |
| FRONTEND_ORIGIN | Bắt buộc trong production, URL HTTPS Vercel chính xác, không trailing slash; có thể comma separated |
| NODE_ENV | production |
| NODE_VERSION | 24.21.0 |
| HOST | 0.0.0.0 |
| PORT | Render tự cấp; không hardcode 3001 trên dashboard |

Không thêm DATABASE_URL hoặc Neon credentials vào VITE_* hoặc Vercel frontend. Vercel chỉ cần VITE_API_URL là origin HTTPS công khai của backend.

Artifact backend là `server/dist/index.mjs` và `build-manifest.json`; runtime cần node_modules với Prisma Client đã generate. Việc dist/node_modules được gitignore là đúng: Render tạo lại chúng trong build, không lấy artifact local từ GitHub. Schema, migration, scripts và config cần thiết đều được Git theo dõi.

## D. Kiểm thử sạch

Chạy `npm run verify:render`. Script tạo thư mục mới dưới `.render-verification/`, copy source/config theo Git và file mới, không copy `.env`, .git, node_modules hoặc dist từ dự án. Credentials được nạp riêng từ server/.env vào environment mà không in giá trị.

Pipeline kiểm tra:

1. `NODE_ENV=production npm ci --include=dev` từ thư mục sạch.
2. Generate Prisma Client và validate schema qua default discovery.
3. `npm run server:build`; xác minh artifact, inputs và không có Vite trong output backend.
4. Chạy **artifact đã compile** bằng Node, HOST=0.0.0.0, PORT do environment cấp cho smoke test; connect Neon trước khi listen; HTTP health 200 và CORS preflight 204.
5. TypeScript toàn bộ frontend/backend/tests.
6. Toàn bộ Vitest, gồm integration Neon và reconnect qua restart; chỉ tạo/thao tác phòng mới thuộc test.
7. Frontend production build riêng để bảo đảm không ảnh hưởng Vercel.
8. So sánh digest từng row đã tồn tại trong 5 bảng ứng dụng trước/sau: không được xóa/sửa chúng. Không in/persist digest hoặc nội dung riêng tư.

**Kết quả thực tế 17/10/2026:** tất cả 8 bước pass. `npm ci` cài 281 packages từ lockfile; Prisma Client 6.19.3 generate và schema validate thành công; backend artifact `server/dist/index.mjs` tồn tại, 63.666 bytes, manifest 24 source inputs không có frontend/tests; compiled process khởi động và HTTP health/CORS pass; TypeScript pass; **150/150 tests, 12/12 test files pass, không skip** gồm Neon/restart; frontend production build pass. Digest các row đã tồn tại trong cả 5 bảng Neon trước/sau bằng nhau. Không sửa/xóa database, migration hoặc phòng đã tồn tại.

Summary máy đọc được tại `.render-verification/latest.json` (ignored, không chứa credentials). Đây là môi trường sạch trên Windows Node 24.21.0, không phải một Render Linux deployment thật. Chưa deploy hoặc kiểm tra dashboard Render; cần chủ dự án xác nhận rồi thực hiện các bước E.

`npm ci` báo 10 dependency vulnerabilities (2 moderate, 8 high) từ dependency tree hiện tại. Không chạy audit fix --force, không tự nâng major. Prisma 6 cảnh báo package.json#prisma sẽ bị bỏ ở Prisma 7; cấu hình này vẫn hoạt động với Prisma 6.19.3 đã khóa. Đây không phải build failures.

## E. Deploy lại — chỉ thực hiện sau khi chủ dự án xác nhận

1. Mở service backend Render hiện có → Settings. Xác nhận repo/main và Web Service/Node, không tạo Static Site.
2. Tắt Auto Deploy trong dashboard khi đang kiểm tra. Commit task này có `[skip render]` để push không tự trigger deploy; Blueprint cũng đặt autoDeployTrigger off. Không gọi API deploy/trigger từ task này.
3. Xóa Root Directory cũ như server/src hoặc server; để trống repo root. Sao chép đúng Build Command và Start Command từ bảng trên. Nếu dùng Blueprint, đồng bộ các giá trị tương ứng của render.yaml theo quy trình của chủ dự án.
4. Environment: giữ DATABASE_URL Neon hiện tại, đặt FRONTEND_ORIGIN đúng Vercel domain, NODE_ENV=production, NODE_VERSION=24.21.0 và HOST=0.0.0.0. PORT do Render cấp. Không dán secrets vào log/chat/GitHub.
5. Không thêm migrate reset, db push, seed hoặc pre-deploy database command để sửa lỗi build này. Schema hiện đã migrate nên không cần thay dữ liệu.
6. Sau khi xác nhận báo cáo, chọn **Manual Deploy → Clear build cache & deploy** cho main. Bước này do chủ dự án thực hiện, không được thực hiện trong task.
7. Log đúng phải hiện Prisma schema từ server/prisma/schema.prisma, `server:build`, artifact server/dist/index.mjs và `node server/dist/index.mjs`. Build backend không được xuất hiện `tsc -b && vite build`.
8. Kiểm tra `/api/health`, sau đó frontend Vercel với VITE_API_URL đúng. Kiểm tra CORS, 4 người, đấu thầu và reconnect. Vercel frontend vẫn build bằng `npm run build`.

Tài liệu đối chiếu: [Render build/start/root/auto deploy](https://render.com/docs/blueprint-spec), [Node version](https://render.com/docs/node-version), [skip deploy commit](https://render.com/docs/deploys), [npm ci include dev](https://docs.npmjs.com/cli/v11/commands/npm-ci/), [Prisma 6 schema location](https://www.prisma.io/docs/orm/v6/prisma-schema/overview/location).
