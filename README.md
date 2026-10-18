# Merchant Empires V1 — Multiplayer

Production preparation: [Render + Vercel configuration and environment setup](DEPLOYMENT.md).

Task 06C: [Render audit, clean build verification and exact dashboard commands](server/TASK_06C_REPORT.md). Backend production: `npm run db:generate`, `npm run server:build`, `npm run server:start`; frontend uses `npm run build` separately.

Task 06A backend/database: [Windows setup, API và kiến trúc](server/README.md), [báo cáo kiểm thử và phạm vi](server/TASK_06A_REPORT.md).

Task 06B: [Multiplayer realtime, kiểm thử bốn tab, reconnect và hướng dẫn Windows](server/TASK_06B_REPORT.md).

Industrial-revolution strategy prototype built with React, TypeScript, Vite, Tailwind CSS, Zustand, SVG, Lucide and Framer Motion.

## Run locally

Giữ DATABASE_URL Neon trong `server/.env`. Backend (terminal PowerShell thứ nhất):

```powershell
npm ci
npm run db:generate
npm run server:dev
```

Frontend (terminal thứ hai):

```powershell
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).

Mở 2–4 tab riêng, tạo/tham gia cùng mã phòng và chọn các công ty khác nhau. Chủ phòng có thể bắt đầu từ 2 người; danh sách công ty được chốt khi bắt đầu. Người mất kết nối giữ ghế để kết nối lại; người ngoài không thể vào trận đã bắt đầu. Mỗi tab điều khiển công ty của mình; refresh giữ phiên bằng sessionStorage. Express + Socket.IO xác thực/tính gameplay, PostgreSQL lưu snapshot; frontend chỉ nhận state từ server.

## Verify

```powershell
npm run typecheck
npm run test:neon
npm run build
```

`npm test` có thể chạy không cần Neon (hai database tests được skip); `test:neon` đọc cấu hình riêng tư từ `server/.env` và chạy toàn bộ suite. Kết quả Task 06B: 150 tests passed, TypeScript và production build thành công.

Đã có board 37 hex, setup, dice/production cho tất cả người chơi, turn/round, thị trường NPC, settlements, factories, manufacturing, hợp đồng thành phẩm và đấu thầu kín. Không có đường, account login, thương mại P2P hoặc deploy production.
