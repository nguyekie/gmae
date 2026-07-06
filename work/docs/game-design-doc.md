# Tài Liệu Định Hướng Game — RPG Nhập Vai Trên Web

## 1. Tổng quan dự án

**Thể loại:** RPG phiêu lưu/nhập vai, multiplayer nhẹ (không cần realtime combat đồng bộ tuyệt đối, chỉ cần đồng bộ trạng thái nhân vật, giao dịch, chat).

**Mục tiêu giai đoạn này:** Demo chơi được bởi nhiều người thật, không phải sản phẩm thương mại hoàn chỉnh. Nghĩa là:
- Ưu tiên tính "chơi được" và "vui" hơn là scale đến hàng chục nghìn người
- Có thể dùng kiến trúc đơn giản (1 server, 1 database) thay vì microservices
- Bảo mật ở mức "đủ dùng", chưa cần chống cheat cấp độ production

**Nền tảng:** Web (trình duyệt), không cần cài đặt.

---

## 2. Cốt truyện & Thế giới quan

### 2.1 Ý tưởng lõi (đề xuất — bạn có thể thay đổi)

**Tên tạm:** *Tàn Tích Etheria* (Ashes of Etheria)

**Bối cảnh:** Thế giới Etheria từng được cai trị bởi 5 Đại Tộc, mỗi tộc nắm giữ một "Lõi Nguyên Tố" (Lửa, Nước, Đất, Gió, Hư Không). 300 năm trước, một sự kiện gọi là **Đại Vỡ Vụn (The Sundering)** đã phá hủy sự cân bằng — các Lõi Nguyên Tố vỡ thành hàng ngàn mảnh nhỏ rải khắp thế giới, biến thành **vật phẩm mang sức mạnh nguyên tố** mà người chơi có thể tìm thấy, chế tạo, và giao dịch.

Người chơi vào vai một **Người Thức Tỉnh (Awakened)** — người mang trong mình một mảnh vỡ nhỏ của Lõi Nguyên Tố, cho họ khả năng sử dụng sức mạnh đặc biệt. Cốt truyện chính xoay quanh việc thu thập mảnh vỡ, khám phá lý do Đại Vỡ Vụn xảy ra, và chọn phe trong cuộc xung đột giữa các phe phái đang tranh giành quyền lực hậu-Vỡ Vụn.

### 2.2 Lý do thiết kế này phù hợp với hệ thống giao dịch
- Vật phẩm "mảnh vỡ nguyên tố" là lý do tự nhiên để có nền kinh tế giao dịch sôi động — chúng hiếm, có giá trị, và có thể kết hợp/nâng cấp.
- Việc "phe phái tranh giành quyền lực" tạo lý do cho PvP nhẹ, giao dịch ngầm, chợ đen — tăng chiều sâu cho hệ thống trade.

### 2.3 Cấu trúc nội dung đề xuất cho demo
- **1 vùng khởi đầu** (làng/thị trấn an toàn — nơi có chợ giao dịch, NPC nhiệm vụ, tạo nhân vật)
- **2–3 vùng phiêu lưu** (rừng, hầm ngục, phế tích) với quái, vật phẩm rơi ra, boss nhỏ
- **1 cốt truyện chính tuyến tính ngắn** (5–8 nhiệm vụ) dẫn dắt người chơi qua các hệ thống: chiến đấu → trang bị → giao dịch → boss
- **Nhánh phụ:** nhiệm vụ phe phái, dẫn đến các buff/danh hiệu khác nhau

*(Bạn có thể giữ nguyên ý tưởng này, đổi tên/chủ đề, hoặc mô tả một thế giới khác — mình sẽ điều chỉnh lại toàn bộ tài liệu này theo ý bạn.)*

---

## 3. Hệ thống nhân vật

| Thành phần | Đề xuất demo |
|---|---|
| Class khởi đầu | 3 class: Chiến Binh (cận chiến), Pháp Sư (phép nguyên tố), Xạ Thủ (tầm xa) |
| Chỉ số cơ bản | HP, MP, ATK, DEF, SPD, Nguyên tố Kháng/Cường |
| Leveling | EXP tuyến tính đơn giản (VD: cần EXP = 100 × level^1.5), tăng chỉ số tự động mỗi level |
| Kỹ năng | 3–4 skill mỗi class, mở khóa theo level, không cần skill tree phức tạp ở demo |
| Slot trang bị | Vũ khí, Giáp, Mũ, Găng, Giày, 2 Trang sức, 1 slot "Mảnh Nguyên Tố" (đặc trưng lore) |

---

## 4. Hệ thống vật phẩm & trang bị

### 4.1 Phân loại
- **Equipment** (mặc vào nhân vật): ảnh hưởng trực tiếp chỉ số
- **Material** (nguyên liệu chế tạo): dùng để craft/upgrade
- **Consumable** (potion, scroll)
- **Currency item** (vàng, đá quý — có thể là tiền tệ phụ)

### 4.2 Độ hiếm (rarity) — dùng màu để dễ nhận diện
Thường (trắng) → Hiếm (xanh) → Quý (tím) → Sử thi (cam) → Huyền thoại (đỏ)

### 4.3 Thuộc tính vật phẩm (item stats)
Đề xuất lưu dạng JSON linh hoạt thay vì cột cứng trong DB, để dễ thêm loại thuộc tính mới:
```json
{
  "item_id": "sword_flame_01",
  "name": "Kiếm Lửa Tàn",
  "rarity": "epic",
  "slot": "weapon",
  "stats": { "atk": 45, "fire_dmg": 12 },
  "level_requirement": 15,
  "tradable": true,
  "stackable": false
}
```

---

## 5. Hệ thống giao dịch & tiền ảo — phần quan trọng nhất về kỹ thuật

Đây là phần rủi ro nhất (dễ bug, dễ bị lợi dụng/duplicate item), nên cần thiết kế cẩn thận.

### 5.1 Các hình thức giao dịch nên có ở demo
1. **Trade trực tiếp (P2P)** — 2 người chơi mở cửa sổ giao dịch, thêm item/vàng, cả hai xác nhận
2. **Chợ ký gửi (Auction House / Marketplace)** — đăng bán item với giá cố định, người khác mua bất kỳ lúc nào (không cần cả hai cùng online) — **nên làm cái này trước vì đơn giản hơn P2P realtime**
3. Không khuyến khích làm trade realtime P2P ở bản demo đầu — dễ phát sinh race condition (2 người sửa cùng giao dịch cùng lúc)

### 5.2 Nguyên tắc bắt buộc để chống bug/dupe item (rất quan trọng)
- **Toàn bộ giao dịch vật phẩm/tiền tệ phải chạy trong 1 database transaction** (SQL transaction hoặc MongoDB transaction) — không bao giờ tách rời "trừ tiền" và "cộng item" thành 2 bước riêng có thể fail giữa chừng.
- **Không bao giờ tin dữ liệu từ client.** Toàn bộ số lượng vàng, ID item phải được server xác thực lại với DB trước khi thực hiện giao dịch.
- **Item không được nhân bản (duplicate)**: mỗi item instance có `item_instance_id` duy nhất, không phải chỉ có `item_type_id`. Khi trade, ta chuyển quyền sở hữu `item_instance_id`, không "tạo item mới rồi xóa item cũ".
- **Idempotency**: nếu người dùng bấm nút mua 2 lần do lag mạng, hệ thống không được xử lý 2 lần.
- Ghi lại **log giao dịch** (ai, cái gì, khi nào) để có thể truy vết nếu có tranh chấp hoặc bug.

### 5.3 Tiền ảo (currency)
- 1 loại tiền chính (Vàng) là đủ cho demo. Đừng làm nhiều loại tiền tệ (soft/hard currency) ngay từ đầu — tăng độ phức tạp không cần thiết.
- Tiền lưu dưới dạng **số nguyên** (đơn vị nhỏ nhất), tránh số thực (float) để không bị lỗi làm tròn.

---

## 6. Đề xuất kiến trúc kỹ thuật (phù hợp kinh nghiệm JS/Node/React của bạn)

### 6.1 Stack đề xuất
| Lớp | Công nghệ | Lý do |
|---|---|---|
| Frontend | React + TypeScript, Zustand/Redux cho state | Bạn đã quen React |
| Giao tiếp realtime | Socket.IO (WebSocket) | Cho chat, thông báo giao dịch, trạng thái online |
| Backend API | Node.js + Express (hoặc Fastify) + TypeScript | Nhất quán ngôn ngữ FE/BE |
| Database | PostgreSQL | Có transaction mạnh, rất quan trọng cho hệ thống giao dịch (xem mục 5.2) |
| Cache/Session | Redis | Lưu session, hàng đợi matchmaking nhẹ, rate-limit |
| Auth | JWT (access token) + refresh token, bcrypt cho mật khẩu | Chuẩn, đủ dùng cho demo |
| Hosting demo | Railway / Render / Fly.io (backend + Postgres), Vercel (frontend) | Deploy nhanh, có free/cheap tier, phù hợp demo nhiều người chơi thử |

### 6.2 Vì sao PostgreSQL thay vì MongoDB ở đây
Hệ thống giao dịch vật phẩm/tiền tệ **cần transaction ACID chuẩn** để tránh dupe item hoặc mất tiền khi lỗi giữa chừng. PostgreSQL xử lý việc này tự nhiên và an toàn hơn nhiều so với NoSQL cho loại dữ liệu quan hệ + giao dịch tài chính-trong-game này.

### 6.3 Cấu trúc bảng dữ liệu cốt lõi (rút gọn)

```
users (id, username, email, password_hash, created_at)
characters (id, user_id, name, class, level, exp, hp, mp, stats_json, created_at)
item_types (id, name, rarity, slot, base_stats_json, tradable, stackable)
item_instances (id, item_type_id, owner_character_id, location, — inventory/equipped/marketplace, instance_stats_json)
equipment_slots (character_id, slot_type, item_instance_id)
wallets (character_id, gold_balance)
transactions (id, type, from_character_id, to_character_id, item_instance_id, gold_amount, status, created_at)
marketplace_listings (id, item_instance_id, seller_id, price, status, created_at)
```

### 6.4 Luồng xử lý "mua item trên chợ" (ví dụ minh họa nguyên tắc an toàn)
1. Client gửi request mua `listing_id`
2. Server mở DB transaction
3. Kiểm tra listing còn tồn tại + còn `status = active` (lock row)
4. Kiểm tra người mua đủ vàng
5. Trừ vàng người mua, cộng vàng người bán, chuyển `owner_character_id` của item, đổi `status` listing thành `sold`
6. Commit transaction — nếu bất kỳ bước nào fail, rollback toàn bộ
7. Gửi thông báo realtime (Socket.IO) cho cả hai người chơi

### 6.5 Kiến trúc thư mục đề xuất (mức cao)
```
/client          → React app
/server
  /src
    /modules
      /auth
      /character
      /inventory
      /marketplace
      /combat
    /db (migrations, models)
    /sockets
```

---

## 7. Lộ trình xây dựng demo (đề xuất theo giai đoạn)

| Giai đoạn | Nội dung | Ước lượng |
|---|---|---|
| 1 | Auth (đăng ký/đăng nhập) + tạo nhân vật | Nền tảng bắt buộc |
| 2 | Inventory + trang bị (mặc/gỡ item), hiển thị chỉ số | Core gameplay loop |
| 3 | Chiến đấu PvE cơ bản (đánh quái, rơi item, nhận EXP) | Vòng lặp "cày" |
| 4 | Chợ giao dịch (marketplace) — mua/bán bằng vàng | Hệ thống kinh tế |
| 5 | Trade P2P trực tiếp (nếu còn thời gian) | Nâng cao |
| 6 | Cốt truyện: NPC, dialogue, quest tuyến tính | Nội dung/narrative |
| 7 | Polish: UI/UX, âm thanh, hiệu ứng, cân bằng số liệu | Trải nghiệm |

**Gợi ý:** Làm theo thứ tự 1 → 4 trước để có một vòng lặp gameplay + kinh tế hoàn chỉnh có thể test với người thật, rồi mới bổ sung cốt truyện và nội dung sâu hơn.

---

## 8. Rủi ro cần lưu ý sớm

- **Cân bằng kinh tế (inflation):** nếu vàng rơi ra quá nhiều mà không có "money sink" (nơi tiêu tiền — sửa đồ, mua NPC, phí chợ), giá cả sẽ lạm phát nhanh. Nên có phí giao dịch nhỏ (VD 5%) trên chợ.
- **Chống bot/spam:** rate-limit request, CAPTCHA khi đăng ký nếu mở public.
- **Không cần chống cheat phức tạp ở demo**, nhưng tối thiểu: mọi tính toán sát thương/exp/rơi item phải tính ở **server**, không phải client — nếu không người chơi có thể sửa code JS trên trình duyệt để gian lận.

---

## 9. Bước tiếp theo

Mình có thể giúp bạn theo hướng nào tiếp theo — chọn 1 hoặc nói mình biết bạn muốn gì:
1. Thiết kế chi tiết database schema (SQL migration thật) cho toàn bộ hệ thống trên
2. Dựng khung code Node.js + Express backend (auth + character + inventory) chạy được luôn
3. Viết chi tiết cốt truyện & lời thoại NPC/quest cho vùng khởi đầu
4. Thiết kế UI/UX (wireframe) cho các màn hình chính (nhân vật, inventory, chợ)

---

## 10. Bổ sung cốt truyện: Rạn Nứt và Cỗ Máy

Gần đây trong thế giới Etheria xuất hiện những vùng *Rạn Nứt* — các vết nứt không gian-linh-hồn do ảnh hưởng của Đại Vỡ Vụn. Những cánh đồng rạn thường đi kèm với các "Cỗ Máy Rạn Nứt" (golem/labor constructs) do năng lượng rạn kích hoạt; chúng canh giữ lõi rạn, tấn công cả người lẫn kẻ thù.

Hai NPC quan trọng liên quan:
- **Lữ Khách Bí Ẩn (`npc_wanderer`)**: xuất hiện ở lối vào vùng Hư Không, dẫn dắt người chơi tới manh mối đầu tiên.
- **Học Giả Rạn (`npc_rift_scribe`)**: xuất hiện ngay trong `rift_fields`, giao nhiệm vụ thám hiểm, thu thập `rift_core` và hạ Cỗ Máy Rạn Nứt.

Mục tiêu cốt truyện mở rộng:
- Thực hiện chuỗi nhiệm vụ phụ dẫn vào `rift_fields` (Thu thập Lõi Rạn, phá hủy Cỗ Máy), từ đó hé lộ manh mối về nguồn năng lượng mới có thể dẫn đến một con boss cấp cao hơn.

## 11. Thiết kế vật phẩm: thuộc tính "tùy biến" của vũ khí

Quyết định thiết kế: **mọi vũ khí có độ hiếm từ "quý" (rare) trở lên sẽ luôn có một dòng `instance_stats.special` khi xuất hiện dưới dạng instance** (rơi, nhận nhiệm vụ, hoặc mua). Dòng này mô tả một thuộc tính ngẫu nhiên (ví dụ `atk`, `def`, hoặc `spd`) với mức tăng tỉ lệ thuận với cấp độ hiếm của vũ khí.

Quy tắc tóm tắt:
- `rare`: special bonus ngẫu nhiên nhỏ (ví dụ +3–6)
- `epic`: bonus trung bình (+6–12)
- `legendary`: bonus lớn (+12–20)

Ví dụ JSON instance:
```json
{
  "item_type_id": "iron_greatsword",
  "owner_character_id": "...",
  "instance_stats": { "special": { "stat": "atk", "bonus": 7 }, "note": "dropped_from_tomb_guardian" }
}
```

Lý do:
- Tăng độ độc đáo và giá trị của từng món trang bị (mỗi instance khác nhau).
- Giúp hệ thống trade/market trở nên thú vị hơn: người bán có thể mô tả và mua/bán item theo attribute instance.

Gợi ý triển khai:
- Khi seed/thuật toán rơi item tạo `item_instances`, server sẽ tự gán `instance_stats.special` cho các vũ khí rare+ theo quy tắc trên. Khi tính chỉ số nhân vật, hàm `computeEquipmentBonus` đã có sẵn để cộng `instance_stats.special` vào tổng chỉ số.

---

Nếu bạn muốn điều chỉnh mức tăng cụ thể (ví dụ rare = +1–4 thay vì +3–6), tôi có thể cập nhật nhanh trong code và re-seed/test. Tôi cũng có thể thêm hiển thị rõ ràng trong UI (Item tooltip) để hiển thị `instance_stats.special` và cho phép lọc/search trong marketplace theo thuộc tính instance.
## 12. Mở khóa vùng đất bằng nhiệm vụ

Quyết định thiết kế mới: màn Khám phá không hiển thị danh sách map để chọn trực tiếp. Người chơi chỉ di chuyển giữa các vùng bằng cổng trong bản đồ, và mỗi cổng sang vùng kế tiếp kiểm tra nhiệm vụ đã hoàn thành.

Chuỗi mở khóa:
- Hầm Mộ Đá Vỡ: hoàn thành Chương 2.
- Vực Thẳm Hư Không: hoàn thành Chương 4.
- Cánh Đồng Rạn Nứt: hoàn thành Chương 5.
- Đồng Bằng Tro Tàn: hoàn thành Chương 7.
- Lò Rèn Lời Thề: hoàn thành một nhánh Chương 8.
- Vùng Đất Lửa: hoàn thành một nhánh Chương 9.
- Vùng Đất Băng: hoàn thành Chương 10.
- Vùng Đất Nước: hoàn thành Chương 11.

Ba vùng đất nguyên tố cuối game có tạo hình và quái biểu tượng riêng:
- Vùng Đất Lửa: dung nham, tro nóng, Khổng Tượng Dung Nham, Phượng Hoàng Tro Đỏ.
- Vùng Đất Băng: nền băng, tinh thể, Chấp Chính Băng Phong, Cự Nhân Pha Lê Băng.
- Vùng Đất Nước: nước nông/sâu, Giao Long Triều Sâu, Manta Vực Triều.
