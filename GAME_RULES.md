# MERCHANT EMPIRES — GAME RULES V1

> Tài liệu luật chơi chuẩn cho Cursor/Codex và nhóm phát triển. Đồng bộ sau Task 02: 17/10/2026.
> **Ưu tiên áp dụng:** Quy tắc `ĐÃ CHỐT` trong tài liệu này thay thế mọi giá trị demo hoặc luật cũ còn sót trong code. Không được tự sửa các module đã hoàn thành nếu chưa phát hiện sai lệch cụ thể.
>
> **Quy ước:** `ĐÃ CHỐT` = yêu cầu bắt buộc; `ĐỀ XUẤT` = thông số cần thử nghiệm/cân bằng; `CHƯA CHỐT` = không tự ý coi là luật chính thức.

## 1. Tổng quan — ĐÃ CHỐT

- Game chiến lược kinh doanh theo lượt, bối cảnh công nghiệp thế kỷ XIX, lấy cảm hứng từ Catan.
- Một phòng có **2–4 người chơi thật**, mỗi người điều khiển một công ty trên trình duyệt/thiết bị riêng.
- Các công ty: **Iron Works** (đỏ), **Timber Guild** (xanh lá), **Golden Trade** (vàng), **Ocean Empire** (xanh dương).
- **Mục tiêu kiến trúc:** server-authoritative khi có multiplayer qua mạng. **Hiện trạng sau Task 02:** rules engine TypeScript chạy qua `applyAction` trong store phía client; chưa có backend mạng. Không được mô tả hiện trạng là đã có server-authoritative.
- Chủ phòng đặt **mục tiêu lợi nhuận tích lũy dương**. Người đầu tiên đạt mục tiêu thắng. **Không giới hạn số vòng**.
- Không có cơ chế đường, không có giao dịch trực tiếp giữa người chơi.

## 2. Trạng thái khởi đầu — ĐÃ CHỐT

- Mỗi công ty bắt đầu với **0 vàng**, **0 nguyên liệu**, **0 thành phẩm**, **0 lợi nhuận tích lũy**.
- Khi bắt đầu, những người tham gia lần lượt đặt **2 khu định cư cấp 1 miễn phí** theo thứ tự tham gia phòng lặp lại hai lượt, chỉ gồm các công ty đã được chọn khi bắt đầu.
- Không có đường miễn phí hay đường xây dựng.
- Sau khi tất cả công ty đã đặt đủ 2 khu định cư miễn phí (tổng 4–8 công trình), trận đấu bước vào vòng 1.

## 3. Bản đồ — ĐÃ CHỐT

- **60–80 ô lục giác** liền nhau, mặc định **61 ô**. Hình dạng axial phát triển vùng có kiểm soát, bất đối xứng, không có ô rời hoặc lỗ trống; hạn chế nhánh hẹp và tỉ lệ dài/rộng quá lớn.
- Server tạo hình học, tài nguyên và số xúc xắc một lần khi bắt đầu. Seed bản đồ độc lập với seed kinh tế, dữ liệu ô và đỉnh được đồng bộ và lưu snapshot; reconnect/khôi phục không sinh lại bản đồ. Trận cũ giữ nguyên bản đồ đã lưu.
- Bốn tài nguyên thô: **Kim loại (metal)**, **Gỗ (wood)**, **Lúa mì (wheat)**, **Bông (cotton)**; phân bố tương đối cân bằng.
- Các ô mang số xúc xắc từ 2 đến 12, **không có số 7**.
- Tránh cụm tài nguyên giống nhau và tránh ô số 6/8 nằm cạnh nhau trong quá trình sinh bản đồ.
- Khu định cư đặt trên **đỉnh** của ô lục giác. Các ô chung một đỉnh phải tham chiếu cùng một vertex ID.

## 4. Khu định cư — ĐÃ CHỐT

- Mỗi công ty sở hữu tối đa **4 khu định cư**, gồm cả 2 công trình miễn phí.
- Có thể xây ở **bất kỳ đỉnh hợp lệ nào trên toàn bản đồ**, không yêu cầu kết nối với công trình hiện có.
- Chỉ cấm xây trùng một đỉnh đã bị chiếm. Khu định cư cùng hoặc khác công ty được phép liền kề, sát nhau hoặc đan xen.
- Khu định cư chỉ có cấp **1, 2**; không có cấp 3.
- Khi ô lục giác kề khu định cư được kích hoạt, khu định cư nhận lần lượt **1 / 2 đơn vị** tài nguyên của ô đó tùy cấp.
- Xây khu định cư mới sau giai đoạn khởi đầu và nâng cấp khu định cư phải trả **cả nguyên liệu và vàng**.
- Mỗi khu định cư sở hữu tối đa **1 nhà máy**.
- Phát triển tuần tự: **Khu định cư 1 → Khu định cư 2 → Nhà máy 1 → Nhà máy 2 → Nhà máy 3**. Không được bỏ cấp.
- Chỉ xây nhà máy trên khu định cư cấp 2. Nhà máy không thay thế hay xóa khu định cư; nền cấp 2 vẫn khai thác tài nguyên.
- Các chi phí hiện hành được giữ nguyên: xây khu định cư 40 vàng + 1 kim loại, 2 gỗ, 1 lúa mì; nâng cấp 2: 50 vàng + mỗi nguyên liệu 1; nhà máy cấp 1: 70 vàng + 2 kim loại, 1 gỗ, 1 bông; nâng nhà máy cấp 2: 110 vàng + 1 kim loại, 2 gỗ, 2 lúa mì, 1 bông; cấp 3: 180 vàng + 2 kim loại, 1 gỗ, 1 lúa mì, 2 bông.
- Xây/nâng cấp ghi nhận CAPEX, không trừ trực tiếp lợi nhuận. Công suất nhà máy giữ nguyên 1/2/3 lô theo cấp.

## 5. Lượt và khai thác — ĐÃ CHỐT

- Mỗi người có một lượt trong vòng chơi; một vòng hoàn chỉnh gồm lượt của tất cả công ty tham gia (2–4 lượt).
- Người đến lượt gieo **2 xúc xắc**. Tổng xúc xắc xác định các ô được kích hoạt.
- **Tất cả người chơi**, không chỉ người gieo, nhận tài nguyên từ khu định cư kề các ô có số tương ứng.
- Nếu một khu định cư kề nhiều ô được kích hoạt, tính sản lượng riêng cho từng ô.
- Mỗi người chỉ được gieo **một lần trong lượt của mình**; không thể kết thúc lượt trước khi gieo. Sau khi gieo, người chơi có thể thực hiện các hành động kinh doanh hợp lệ rồi kết thúc lượt.
- Thứ tự lượt theo các ghế đã chốt khi bắt đầu; sau công ty cuối cùng, tăng vòng và trở lại công ty đầu tiên. Trạng thái đã gieo được reset khi sang lượt mới.
- Khi tổng xúc xắc bằng **7**, **không ô nào sản xuất tài nguyên**. Không có cướp bóc hay mất tài nguyên.

## 6. Nhà máy và sản xuất — ĐÃ CHỐT PHẦN NGUYÊN TẮC

- Nhà máy **đa năng**: mỗi nhà máy có thể sản xuất cả 6 loại thành phẩm.
- Tối đa 1 nhà máy trên mỗi khu định cư, tức tối đa 4 nhà máy/công ty.
- Sản xuất tiêu hao nguyên liệu, công suất và **phí gia công cho từng mẻ**.
- Nhà máy không sản xuất thì **không mất phí duy trì theo vòng**.
- Sáu thành phẩm: **Máy móc (machinery), Đường ray (rail), Nội thất (furniture), Bột mì (flour), Vải dệt (fabric), Quần áo (clothing)**.
- Công thức nguyên liệu, mức công suất và phí gia công chi tiết trong Phụ lục A hiện là **ĐỀ XUẤT**, cần cân bằng qua chơi thử.

## 7. Thị trường NPC — ĐÃ CHỐT PHẦN NGUYÊN TẮC

- Chỉ mua/bán với **thị trường trung lập (NPC)**; không có trao đổi trực tiếp giữa các công ty.
- Cả 4 nguyên liệu thô có **giá tham chiếu khởi điểm 10 vàng/đơn vị**.
- Giá nguyên liệu thay đổi theo **cung/cầu và một yếu tố ngẫu nhiên nhỏ**.
- Người chơi có thể bán nguyên liệu thô từ đầu game để tạo dòng tiền khi vốn khởi đầu bằng 0.
- Cần thống nhất riêng: NPC có bán thành phẩm hay không; giá thành phẩm có biến động hay không; biên chênh lệch mua/bán và giới hạn nguồn cung.
- Công thức điều chỉnh giá trong Phụ lục A chỉ là **ĐỀ XUẤT**.

## 8. Đấu thầu và hợp đồng — ĐÃ CHỐT PHẦN CỐT LÕI

- Đấu thầu diễn ra **mỗi 3 vòng hoàn chỉnh**, mỗi phiên **một lô hợp đồng**.
- **Vòng 1–30:** lô mới chỉ gồm nguyên liệu thô: Metal, Wood, Wheat, Cotton.
- **Từ vòng 31:** cho phép cả nguyên liệu thô và sáu thành phẩm hiện tại; không loại nguyên liệu khỏi danh mục. Phiên đầu có thể xuất hiện thành phẩm là **cuối vòng 33**.
- Bốn mẫu nguyên liệu thử nghiệm (BALANCE_PROVISIONAL trong economyConfig): Metal 5 / 75 vàng; Wood 6 / 84 vàng; Wheat 8 / 104 vàng; Cotton 6 / 84 vàng. Giữ nguyên các mẫu thành phẩm.
- Backend quyết định lô mới theo vòng đã hoàn tất. Hợp đồng/lô đã tồn tại giữ nguyên loại hàng và điều khoản. Chỉ các công ty tham gia trận 2–4 người cần gửi giá hoặc bỏ lượt.
- Đấu thầu kín; **giá chào hợp lệ thấp nhất thắng**, hòa giá thì người gửi trước thắng.
- Công ty thắng phải giao hàng trong **3 vòng hoàn chỉnh** sau khi có kết quả.
- Có thể giao từng phần, trừ đúng kho nguyên liệu hoặc thành phẩm. Chỉ ghi nhận doanh thu và thanh toán giá trúng thầu sau khi giao đủ hàng.
- Giá vốn bình quân của từng phần giao được chuyển từ tồn kho sang giá vốn chờ ghi nhận trên hợp đồng. Khi hoàn tất, ghi nhận toàn bộ giá vốn đúng một lần. Khi thất bại và hàng đã giao không được hoàn lại theo cấu hình hiện hành, ghi nhận giá vốn phần đó cùng khoản phạt, không trừ vàng giá vốn lần nữa.
- **Không khóa tồn kho** khi nhận hợp đồng: người chơi vẫn có quyền bán hàng đang có cho NPC.
- Nếu không giao đủ đúng hạn, bị phạt **20% giá trị trúng thầu**.
- Nếu không đủ tiền trả phạt, phần còn lại là **công nợ phạt hợp đồng**, ưu tiên khấu trừ từ khoản thu tiếp theo. Đây **không phải khoản vay**, không phát sinh lãi vay.
- Tiền phạt làm giảm lợi nhuận tích lũy; việc thu tiền phạt không được tính trùng hai lần.
- Để V1 đơn giản, chỉ yêu cầu quản lý số lượng còn phải giao, thời hạn, thanh toán khi hoàn thành và phạt khi thất bại.
- **CHƯA CHỐT:** xử lý hàng đã giao khi hợp đồng thất bại, giới hạn hợp đồng đồng thời và hạn chế đầu tư khi có nợ; không tự bổ sung.

## 9. Tiền mặt, lợi nhuận và chiến thắng — ĐÃ CHỐT

- **Tiền mặt (gold)** khác **lợi nhuận tích lũy (cumulativeProfit)**.
- Mua nguyên liệu, xây dựng, nâng cấp làm giảm tiền mặt theo chi phí thực tế.
- Chi phí xây dựng/nâng cấp là **CAPEX**, **không trừ trực tiếp vào lợi nhuận tích lũy** trong V1.
- Lợi nhuận được ghi nhận khi có doanh thu thực hiện, sau khi trừ giá vốn liên quan và chi phí gia công tương ứng; tránh tính trùng phí sản xuất.
- Tiền phạt hợp đồng là chi phí làm giảm lợi nhuận tích lũy.
- Kiểm tra điều kiện thắng khi lợi nhuận tích lũy được cập nhật; mục tiêu do chủ phòng đặt và phải > 0.
- Nguyên liệu tự khai thác có giá vốn 0. Nguyên liệu mua từ NPC cộng giá mua vào giá trị tồn kho. Bán/sản xuất/xây dựng/giao hợp đồng phân bổ giá vốn bình quân gia quyền theo cơ chế làm tròn hiện tại; không tính trùng giá vốn đã xuất kho. Phí sản xuất được vốn hóa vào thành phẩm như hiện tại.

## 10. Giao diện — ĐÃ CHỐT

- Thanh bên **trái** chỉ hiển thị thông tin công ty của chính người chơi: tên/màu, vàng, 4 nguyên liệu, 6 thành phẩm, các khu định cư, nhà máy và cấp độ.
- Không đưa bảng xếp hạng hoặc thông tin đối thủ vào sidebar cá nhân.
- Trạng thái game được đồng bộ cho cả 4 trình duyệt; thao tác trái lượt/không hợp lệ phải bị từ chối ở server.

## 11. Phạm vi triển khai

### Task 01 — GameState + BoardRules — ĐÃ HOÀN THÀNH
- Kiểu dữ liệu game, người chơi, bản đồ, đỉnh và công trình.
- Sinh bản đồ 37 hex có seed và ánh xạ đỉnh chính xác.
- Kiểm tra vị trí đặt khu định cư.
- Đặt 2 khu định cư cấp 1 miễn phí/công ty, hai lượt theo thứ tự tham gia phòng.
- Chuyển từ `setup` sang `playing`.
- Viết kiểm thử tự động. **Không triển khai gieo xúc xắc, kinh tế, sản xuất, đấu thầu trong Task 01.**

### Task 02 — Dice & Resource Production — ĐÃ HOÀN THÀNH
- Gieo xúc xắc và phân phối tài nguyên cho **tất cả** người chơi đủ điều kiện.
- Luân phiên lượt, đếm vòng.
- Báo cáo Codex: 63/63 Vitest passed, TypeScript và production build thành công (chưa xác minh mã nguồn độc lập).

### Task 03 — EconomyRules — CHƯA TRIỂN KHAI
- Mua/bán NPC, tiền mặt, giá thị trường, xây dựng và nâng cấp.

### Task 04 — FactoryRules — CHƯA TRIỂN KHAI
- Nhà máy, công suất, công thức chế tạo, phí gia công.

### Task 05 — ContractRules + Victory — CHƯA TRIỂN KHAI
- Đấu thầu, giao hàng, hạn giao, phạt 20%, công nợ tối giản và thắng trận.

## Phụ lục A — THÔNG SỐ ĐỀ XUẤT, CHƯA CHỐT

### A1. Chi phí đầu tư (Kim loại / Gỗ / Lúa mì / Bông / Vàng)

| Hạng mục | Kim loại | Gỗ | Lúa mì | Bông | Vàng |
|---|---:|---:|---:|---:|---:|
| Khu định cư mới | 1 | 2 | 1 | 0 | 40 |
| Khu định cư cấp 1 → 2 | 1 | 1 | 1 | 1 | 50 |
| Khu định cư cấp 2 → 3 | 2 | 2 | 2 | 2 | 100 |
| Nhà máy cấp 1 | 2 | 1 | 0 | 1 | 70 |
| Nhà máy cấp 1 → 2 | 1 | 2 | 2 | 1 | 110 |
| Nhà máy cấp 2 → 3 | 2 | 1 | 1 | 2 | 180 |

### A2. Công suất nhà máy

- Cấp 1: 2 điểm công suất/vòng.
- Cấp 2: 4 điểm công suất/vòng.
- Cấp 3: 6 điểm công suất/vòng.

### A3. Công thức sản xuất (mỗi mẻ)

| Thành phẩm | Đầu vào | Đầu ra | Phí vàng | Điểm công suất | Giá tham chiếu/đơn vị |
|---|---|---|---:|---:|---:|
| Máy móc | 3 Kim loại | 1 Máy móc | 5 | 2 | 45 |
| Đường ray | 2 Kim loại + 1 Gỗ | 1 Đường ray | 4 | 2 | 38 |
| Nội thất | 3 Gỗ | 1 Nội thất | 3 | 1 | 32 |
| Bột mì | 3 Lúa mì | 2 Bột mì | 2 | 1 | 12 |
| Vải dệt | 2 Bông | 1 Vải dệt | 3 | 1 | 22 |
| Quần áo | 1 Vải dệt | 1 Quần áo | 5 | 2 | 38 |

### A4. Biến động giá NPC

- Cập nhật sau mỗi vòng hoàn chỉnh.
- Có thể giới hạn giá trong khoảng 50%–200% giá tham chiếu và biến động tối đa 15%/vòng.
- Có thể áp dụng chênh lệch giá mua/bán 10% để hạn chế mua đi bán lại kiếm lời vô hạn.
- **Chưa chốt công thức chính xác.**

## 12. Nguyên tắc làm việc với Cursor/Codex

1. Đọc file này trước mỗi task.
2. Không tự ý đổi luật `ĐÃ CHỐT`.
3. Không biến thông số `ĐỀ XUẤT` thành luật chính thức khi chưa được duyệt.
4. Không thêm cơ chế phức tạp (đường, vay vốn, phá sản, thuế, khấu hao, thương mại P2P).
5. Ưu tiên rules engine TypeScript độc lập UI và kiểm thử được.
6. Không tự động làm task tiếp theo sau khi hoàn thành task được giao.
7. Không tạo lại cơ chế xúc xắc/phân phối tài nguyên của Task 02; tái sử dụng `src/rules/diceRules.ts`, `productionRules.ts`, `turnRules.ts` và `applyAction`.
8. Nếu code hiện tại có `loans` hoặc các cơ chế vay vốn cũ, không xem đó là luật V1: chỉ duy trì dữ liệu tương thích nếu cần; nợ phạt hợp đồng phải được phân biệt với khoản vay.
9. Trước Task 03, đối chiếu code với các luật `ĐÃ CHỐT` ở mục 2, 4, 7, 9; báo cáo mọi xung đột và không tự thay đổi luật.
