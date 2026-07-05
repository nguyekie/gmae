# Cập nhật lần này — tóm tắt

## ⚠️ Việc cần làm trước khi chạy bản mới

1. Chạy lại `schema.sql` (an toàn, không mất dữ liệu cũ — chỉ thêm 1 bảng mới `boss_daily_attempts`):
   ```bash
   psql "$DATABASE_URL" -f server/db/schema.sql
   ```
2. Không cần seed lại (`npm run seed`) — không có dữ liệu mới cần nạp lần này.

---

## 1. Bug đã sửa

### Không bán được vật phẩm trang bị cho cửa hàng
Nút "Bán cho cửa hàng" ở Túi đồ gọi nhầm đường dẫn `/shop/sell` (số ít) trong khi backend chỉ có
`/api/shops/sell` (số nhiều, giống hệt các lỗi đường dẫn API đã gặp trước đây) — request luôn bị
404 nên bấm hoài không có phản hồi. Đã sửa đúng đường dẫn, đồng thời thêm:
- Chặn bán vật phẩm được đánh dấu "không thể giao dịch" (`tradable: false`, ví dụ vật phẩm thưởng
  cốt truyện huyền thoại) — trước đây có thể lách qua bằng cách bán cho shop dù không đăng bán chợ
  được.
- Hiện rõ số vàng nhận được ngay trên banner thông báo (trước đây bán xong không rõ được bao nhiêu).

### Icon vật phẩm nhìn không rõ hình
Icon "Trang sức" (nhẫn) trước đây vẽ bằng 1 khối hình thoi đặc — ở kích thước nhỏ trông giống hệt
dấu cộng thay vì cái nhẫn (đúng như ảnh chụp bạn gửi). Đã vẽ lại thành hình nhẫn rỗng ở giữa (thấy
rõ viên đá bên trong). Icon "Nguyên liệu" cũng được vẽ rõ hình cục quặng hơn thay vì 1 khối bầu dục
mơ hồ. Ngoài ra tăng kích thước icon (40→48px) và thêm nền có độ tương phản cao hơn để icon không
bị chìm vào nền tối.

---

## 2. Mua nhiều — Dùng nhiều cùng lúc (tính năng mới)

- **Cửa hàng:** mỗi vật phẩm còn hàng >1 giờ có bộ đếm số lượng (−/+/gõ tay), nút mua hiện luôn
  tổng giá tiền theo số lượng đã chọn, tự khoá nếu không đủ vàng hoặc vượt tồn kho.
- **Túi đồ:** vật phẩm tiêu hao có số lượng >1 giờ dùng bộ đếm tương tự (thay vì chỉ chọn được 1)
  để gộp vào "Sử dụng vật phẩm đã chọn" — ví dụ uống 1 lần 3 Bình Máu Nhỏ thay vì bấm 3 lần riêng
  lẻ.

---

## 3. Giới hạn 3 lượt đánh Boss / ngày + thưởng theo sát thương (tính năng mới)

Bảng `boss_daily_attempts` đếm số lượt 1 nhân vật đã đánh 1 boss trong ngày (theo ngày dương lịch
server), áp dụng cho **mọi** quái có `is_boss = true` (không riêng gì Hùng Giả Khổng Lồ — thêm boss
mới trong tương lai tự động có giới hạn này, không cần sửa code):

- Mỗi lượt bấm "Tấn công" vào boss tính là 1 lượt, tối đa **3 lượt/ngày** cho mỗi nhân vật với mỗi
  boss riêng biệt.
- **Không** tốn lượt nếu boss đang trong thời gian hồi sinh (bạn chưa kịp ra đòn thì không bị trừ).
- Hết lượt trong ngày sẽ hiện rõ thông báo, không cho tấn công tiếp cho đến hôm sau.
- Sau mỗi trận, màn hình hiện rõ "Lượt đánh hôm nay: x/3" để theo dõi.
- Phần thưởng theo sát thương gây ra (đã có sẵn từ bản trước, giữ nguyên): dù không hạ gục được vẫn
  nhận EXP/vàng "đóng góp" tỉ lệ theo sát thương đã gây; ai ra đòn kết liễu nhận thêm toàn bộ phần
  thưởng gốc + vật phẩm rơi mạnh.

---

## Việc nên cân nhắc tiếp theo

- Hiện giới hạn lượt đánh tính theo **giờ server** (UTC nếu deploy mặc định) — nếu muốn reset đúng
  nửa đêm giờ Việt Nam, cần đổi `CURRENT_DATE` trong `combat.ts` sang tính theo timezone Việt Nam
  (`(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`).
- Có thể thêm hiển thị "còn X/3 lượt hôm nay" ngay trước khi bấm tấn công (hiện chỉ thấy sau khi
  đánh xong) bằng cách mở rộng `GET /combat/boss/:monsterId` nhận thêm `characterId`.
