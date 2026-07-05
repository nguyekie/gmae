# Cập nhật lần này — tóm tắt

## ⚠️ Việc BẮT BUỘC phải làm trước khi chạy bản mới

1. **Chạy migration sửa lỗi cửa hàng** (1 lần duy nhất) — xem mục "Sửa lỗi Cửa hàng" bên dưới.
2. `cd server && npm install` rồi `npm run seed` lại — để nạp 2 nhiệm vụ mới + đảm bảo dữ liệu shop đúng.
3. `cd client && npm install` (đã thêm/sửa vài file, không có dependency mới nhưng cứ chạy cho chắc).

---

## 1. Sửa lỗi Cửa hàng (nguyên nhân "mua bị lỗi")

Có **2 lỗi** trong code cũ:

- **Lỗi chính:** bảng `shops` chưa có ràng buộc UNIQUE trên cột `name`, nên mỗi lần chạy `npm run seed` lại tạo ra một dòng "Cửa Hàng Thương Nhân" **mới hoàn toàn** thay vì cập nhật dòng cũ. Kết quả: nhiều shop trùng lặp, mỗi shop có `shop_items` riêng — Cửa hàng hiển thị lộn xộn, hoặc mua nhầm vào `shop_item` cũ đã hết hàng/không còn tồn tại đúng cách.
- **Lỗi rò rỉ kết nối:** route `POST /api/shops/buy` gọi `pool.connect()` nhưng **không bao giờ gọi `client.release()`** để trả kết nối về lại pool. Sau một số lần mua hàng, pool hết kết nối khả dụng (mặc định 10 kết nối) và toàn bộ API (không chỉ shop) bắt đầu bị treo/lỗi ngẫu nhiên.

**Cách sửa:** đã thêm ràng buộc UNIQUE cho `shops.name`, sửa seed dùng đúng `ON CONFLICT (name)`, và bọc `client.release()` trong khối `finally` ở route buy.

**Bạn cần chạy 1 lần** (dọn dữ liệu shop trùng đã lỡ tạo ra trước đó):

```bash
psql "$DATABASE_URL" -f server/db/002_fix_shops.sql
```

(Hoặc copy nội dung file đó dán vào SQL Editor của Neon rồi Run, nếu không có `psql`.)

Sau đó chạy lại `npm run seed` trong `server/` để đồng bộ giá/số lượng shop items.

Cửa hàng (frontend) cũng được viết lại để dùng đúng khung `ItemCard` như Túi đồ/Chợ (viền phát sáng theo độ hiếm, hiện số lượng còn lại), thay vì giao diện `alert()` cũ.

---

## 2. Chat — thiết kế lại hoàn toàn

- Trước: 1 ô nhập UUID người nhận + danh sách tin nhắn không style.
- Giờ: sidebar bên trái liệt kê **Kênh toàn cục** + **danh sách bạn bè** (bấm vào để chat riêng), khung chat bên phải hiển thị tin nhắn dạng bong bóng (bong bóng của mình màu vàng hổ phách, bong bóng người khác màu xám), tự cuộn xuống tin mới nhất.
- Có thể mở thẳng cuộc trò chuyện với 1 người bạn từ tab **Bạn bè** (nút "💬 Nhắn tin").
- Sửa 1 lỗi nhỏ: tin nhắn riêng trước đây có thể hiện trùng 2 lần ở phía người gửi — đã sửa bằng cách để server gửi kèm `toUserId` trong tin nhắn, thay vì client tự đoán.

## 3. Bạn bè — thêm bằng tên đăng nhập

- Trước: không có cách nào để gửi lời mời kết bạn từ giao diện (phải biết UUID).
- Giờ: có ô nhập **tên đăng nhập**, gửi lời mời trực tiếp. Thêm route backend `GET /api/friends/lookup/:username` để tìm user theo tên.
- Mỗi người bạn có 2 nút: **💬 Nhắn tin** (mở Chat riêng) và **⚔️ Thách đấu** (gửi lời mời PvP).

## 4. PvP — hoàn thiện, chưa từng hoạt động được trước đây

Trước đây backend đã có khung xử lý PvP nhưng **hoàn toàn chưa có giao diện**, và có 1 lỗ hổng bảo mật: bất kỳ ai cũng có thể giả mạo "chấp nhận" một trận đấu giữa 2 người khác.

Đã làm:
- **Backend:** theo dõi lời mời đang chờ (`pendingChallenges`), chỉ đúng người bị mời mới được chấp nhận/từ chối, lời mời tự hết hạn sau 30 giây. Trận đấu luôn bắt đầu ở **full HP** (không dùng HP hiện tại, tránh bị lợi dụng thách đấu lúc đối thủ đang yếu máu từ PvE). Đây là **PvP giao hữu** — không mất vàng/vật phẩm, không trừ HP thật sau trận.
- **Frontend:** thách đấu từ tab Bạn bè → người nhận thấy **thông báo nổi (toast)** ở góc màn hình dù đang ở tab nào, có nút Chấp nhận/Từ chối → cả 2 bên thấy **màn hình trận đấu trực quan** (chân dung 2 nhân vật, thanh HP, nhật ký từng đòn đánh, kết quả thắng/thua).
- Sửa luôn 1 bug làm chat/PvP có thể bị mất kết nối khi rời khỏi tab Khám phá (kết nối realtime giờ được quản lý ở cấp toàn ứng dụng, không còn bị ngắt khi chuyển tab).

## 5. Hai bản đồ mới + tổng quát hóa hệ thống bản đồ

- Trước: chỉ có 1 vùng "Rừng Thì Thầm" (map còn lại ghi "Sắp mở").
- Giờ có **3 vùng nối với nhau qua cổng dịch chuyển** (ô tile phát sáng màu vàng, bước vào là sang vùng khác):
  1. **Làng Khởi Nguyên** (vùng an toàn, không có quái) — nơi 3 NPC nhiệm vụ chính đứng: Trưởng Làng Oris, Thợ Săn Lyra, và **Học Giả Ren (mới)**.
  2. **Rừng Thì Thầm** (giữ nguyên quái Nhớt Rừng/Sói Bóng Tối, chỉ di dời 2 NPC sang Làng cho hợp lý cốt truyện — làng mới là nơi an toàn để nhận nhiệm vụ, rừng là nơi chiến đấu).
  3. **Hầm Mộ Đá Vỡ (mới)** — có quái Vệ Thần Mộ Đá + Hồn Ma Tro Tàn, và NPC **Bia Đá Cổ (mới)** giao nhiệm vụ boss cuối.
- Thêm 2 nhiệm vụ mới nối tiếp cốt truyện: **Chương 3 — Con Đường Đến Hầm Mộ** (Học Giả Ren, cần đạt cấp 8) và **Chương 4 — Vệ Thần Cuối Cùng** (Bia Đá Cổ, đánh bại Vệ Thần Mộ Đá).
- Thêm sprite pixel-art mới: Học Giả Ren, Bia Đá Cổ, Vệ Thần Mộ Đá, Hồn Ma Tro Tàn — cùng phong cách pixel sẵn có, không dùng emoji.
- `MapExplorer` được tổng quát hóa để nhận `zoneId` bất kỳ thay vì cố định 1 vùng, nên sau này thêm bản đồ mới chỉ cần khai báo trong `client/src/data/mapData.ts`, không cần sửa lại component.

---

## Việc nên cân nhắc tiếp theo

- PvP hiện là "giao hữu" thuần túy — nếu muốn có cược vàng/hạng đấu (ranking), cần bọc trong DB transaction giống hệt cơ chế chợ giao dịch (xem `server/src/routes/marketplace.ts` làm mẫu) để tránh gian lận.
- Danh sách bạn bè hiện chưa có nút "hủy kết bạn" hoặc chặn — có thể thêm nếu cần.
- Bản đồ vẫn xử lý va chạm/di chuyển ở client (để mượt và đơn giản cho demo); nếu mở rộng thành sản phẩm thật, nên xác thực lại vị trí ở server trước khi cho phép chiến đấu/tương tác NPC để chống việc sửa code JS trên trình duyệt để "dịch chuyển" tới quái mạnh hơn cấp độ cho phép.
