# Cập nhật lần này — tóm tắt

## ⚠️ Việc cần làm trước khi chạy bản mới

1. Chạy lại `schema.sql` (an toàn, không mất dữ liệu cũ — chỉ thêm bảng/cột mới):
   ```bash
   psql "$DATABASE_URL" -f server/db/schema.sql
   ```
2. `cd server && npm install && npm run seed` — nạp vật phẩm/quái/quest mới.
3. `cd client && npm install`.
4. Giữ nguyên `server/.env` hiện có của bạn (zip không chứa file này).

---

## 1. Bug đã sửa

### Đồ hiếm rơi ra không thực sự mạnh hơn (bug nghiêm trọng nhất)
Khi đánh quái, vật phẩm epic/legendary rơi ra được gán 1 thuộc tính đặc biệt ngẫu nhiên
(`instance_stats.special`, ví dụ "+15 ATK") — nhưng **không có chỗ nào trong code thực sự cộng
thuộc tính này vào sức mạnh nhân vật**, cả khi hiển thị lẫn khi tính sát thương trong trận đấu.
Nghĩa là đồ hiếm rơi ra chỉ đẹp mã chứ không giúp ích gì. Đã sửa bằng cách tạo hàm dùng chung
`computeEquipmentBonus()` trong `character.ts`, dùng lại ở cả màn hình nhân vật lẫn `combat.ts`.

### Vùng "Hang Khổng Lồ" (boss) không thể đi tới được
Vùng chứa boss đã tồn tại trong code nhưng cổng dịch chuyển chỉ có chiều **đi ra**, không có
chiều **đi vào** — nghĩa là không ai vào được vùng đó từ trong game. Đã đổi tên vùng thành
**Vực Thẳm Hư Không**, vẽ lại bản đồ riêng (không dùng chung với Hầm Mộ như trước), và thêm cổng
2 chiều nối với Hầm Mộ Đá Vỡ.

### Boss chưa từng được đánh dấu là boss
Trong dữ liệu seed, quái `colossal_titan` đã có ý định là boss nhưng câu lệnh `INSERT` vào
database **không hề ghi cột `is_boss`**, nên trước đây nó chỉ là quái thường đội lốt boss —
máu vẫn tự đầy lại mỗi trận như bình thường. Đây là nguyên nhân gốc của yêu cầu "boss không hồi
máu" — giờ đã có cơ chế thật (xem mục 2 bên dưới).

---

## 2. Boss máu bền — không hồi/reset giữa các lượt đánh (tính năng mới)

Thêm bảng `boss_state` lưu máu hiện tại của từng boss, dùng chung cho **mọi người chơi**:

- Mỗi lượt tấn công boss, sát thương gây ra được **trừ thẳng vào máu chung**, lưu lại ngay
  (trong 1 DB transaction, không thể gian lận/mất đồng bộ dù nhiều người đánh cùng lúc).
- Máu boss **không tự hồi** giữa các lần đánh của bất kỳ ai — nếu bạn đánh boss từ 900 xuống
  700 HP rồi thoát ra, người tiếp theo (kể cả chính bạn quay lại) sẽ đánh tiếp từ 700 HP, không
  phải máu đầy.
- Ai ra đòn kết liễu sẽ nhận **toàn bộ phần thưởng gốc** (exp/vàng/vật phẩm rơi). Người đánh
  góp sức nhưng không kết liễu được vẫn nhận **thưởng đóng góp** nhỏ theo lượng sát thương đã
  gây ra — khuyến khích nhiều người cùng "cày" 1 boss thay vì chỉ ai ra đòn cuối mới có lợi.
- Sau khi bị hạ, boss **hồi sinh lại sau 15 phút** (`respawn_seconds`, có thể chỉnh trong seed).
- Toàn server nhận được **thông báo nổi (toast)** khi boss bị hạ gục, dù đang ở tab nào.

## 3. Giao diện Boss — khác hẳn quái thường

- Sprite boss to hơn ~40%, có hiệu ứng phát sáng vàng nhấp nháy liên tục trên bản đồ.
- Thẻ **"BOSS"** nổi bật phía trên đầu, kèm thanh máu thu nhỏ ngay trên bản đồ (ai cũng thấy
  máu boss hiện tại mà không cần tấn công trước).
- Màn hình chiến đấu với boss có viền vàng phát sáng riêng biệt, banner "BOSS THẾ GIỚI — MÁU
  KHÔNG HỒI GIỮA CÁC LƯỢT ĐÁNH", và hiển thị đúng máu thật từ server (không phải máu giả lập
  ở client).
- Nếu boss vừa bị người khác hạ gục ngay trước bạn, hoặc đang trong thời gian hồi sinh, màn
  hình sẽ báo rõ và hiện đếm ngược thời gian hồi sinh thay vì cho tấn công.

## 4. Hình ảnh cho vật phẩm trang bị (tính năng mới)

Trước đây thẻ vật phẩm (Túi đồ/Chợ/Cửa hàng) chỉ có chữ. Giờ mỗi vật phẩm có **icon pixel-art**
theo đúng phong cách sprite nhân vật/quái đã có sẵn (vẽ bằng lưới màu CSS, không cần file ảnh):
hình dạng icon theo loại trang bị (kiếm cho vũ khí, khiên cho giáp, nhẫn cho trang sức, bình
cho đồ tiêu hao, v.v.), màu sắc icon đổi theo độ hiếm (trắng/xanh dương/tím/vàng cam) để nhận
biết nhanh vật phẩm nào đáng chú ý.

## 5. Vùng bản đồ mới: Vực Thẳm Hư Không

- Bố cục dạng "đấu trường" (khoảng trống trung tâm quanh 2 cột trụ), khác hẳn phong cách rừng/
  hầm mộ trước đó.
- 2 quái thường mới: **Kẻ Rình Rập Hư Không**, **Đóm Lửa Vực Thẳm** (cấp 13-14).
- Boss **Hùng Giả Khổng Lồ** (cấp 15, 900 HP, máu bền — xem mục 2).
- NPC mới: **Lữ Khách Bí Ẩn**, giao nhiệm vụ chương 5.
- Nối 2 chiều với Hầm Mộ Đá Vỡ qua cổng dịch chuyển.

## 6. Nhiệm vụ mới

**Chương 5 — Sứ Giả Vực Thẳm**: Lữ Khách Bí Ẩn (Vực Thẳm Hư Không), yêu cầu đã hoàn thành
Chương 4 + đạt cấp 13, mục tiêu đánh bại Hùng Giả Khổng Lồ. Phần thưởng: 1000 EXP, 500 vàng,
và **Mảnh Vỡ Tĩnh Lặng** (trang sức legendary).

## 7. Vật phẩm trang bị mới

| Vật phẩm | Độ hiếm | Nguồn |
|---|---|---|
| Đại Kiếm Sắt / Cầu Pháp Bí Ẩn / Cung Gió Lốc | Hiếm | Mua ở Cửa hàng (180 vàng) — vũ khí tầm trung lấp khoảng trống cấp 5 |
| Linh Dược Sinh Lực | Hiếm | Mua ở Cửa hàng — hồi máu+mana mạnh hơn, hợp đánh boss |
| Găng Tay Titan / Mũ Thép Hư Không | Quý (epic) | Rơi từ quái Vực Thẳm Hư Không |
| Nanh Kiếm Vực Thẳm / Áo Giáp Khổng Lồ | Huyền thoại | Rơi từ Hùng Giả Khổng Lồ |
| Mảnh Vỡ Tĩnh Lặng | Huyền thoại | Phần thưởng Chương 5 (không giao dịch được) |
| Bụi Hư Không | Hiếm (nguyên liệu) | Rơi từ quái Vực Thẳm Hư Không |

---

## Việc nên cân nhắc tiếp theo

- Hiện chưa có hệ thống chế tạo (dùng nguyên liệu như Bụi Hư Không/Lõi Đá Nứt để nâng cấp đồ) —
  nếu muốn, đây là bước tự nhiên tiếp theo vì nguyên liệu đang chỉ nằm im trong túi đồ.
- Boss hiện chỉ có 1 con — có thể nhân rộng cơ chế `is_boss`/`boss_state` này cho nhiều boss
  khác ở các vùng tương lai mà không cần sửa code, chỉ cần thêm dữ liệu trong `seed.ts` +
  `mapData.ts`.
- Icon vật phẩm hiện theo loại slot (dùng chung hình cho mọi vũ khí, mọi giáp...) — nếu muốn mỗi
  vật phẩm có hình riêng biệt (vd Nanh Kiếm Vực Thẳm khác hình Đại Kiếm Sắt), cần vẽ thêm ma
  trận pixel riêng cho từng `item_type_id` thay vì theo `slot`.
