# Wireframe / Bố cục UI

Bản demo đã hiện thực hóa trực tiếp các layout dưới đây thành React thật (không
chỉ là mockup) — chạy `npm run dev` trong `client/` để xem đúng như mô tả.

## Design tokens đã áp dụng
- **Nền:** obsidian tối (#14161C) gợi không khí "hư không" hậu-Vỡ Vụn
- **Màu tín hiệu (signature):** vàng hổ phách #C9A24B — đại diện cho ánh sáng
  mảnh vỡ Lõi Nguyên Tố, dùng cho viền, glow, số liệu quan trọng
- **Màu nguyên tố:** Lửa #E4572E (thanh HP), Nước #2E86AB (thanh MP) — chỉ số
  sinh mệnh mượn màu nguyên tố Lửa/Nước theo đúng lore
- **Độ hiếm vật phẩm:** Thường (xám) → Hiếm (xanh dương) → Quý (tím) → Huyền
  thoại (vàng cam) — thể hiện qua viền glow của item card
- **Typeface:** Cinzel (tiêu đề, chất fantasy khắc đá) + Work Sans (nội dung,
  dễ đọc) + JetBrains Mono (chỉ số, số liệu)
- **Chi tiết signature:** item card có góc vát như mảnh tinh thể vỡ
  (`clip-path`), gợi liên tưởng trực tiếp đến "mảnh vỡ Lõi Nguyên Tố" trong lore

## Màn hình Đăng nhập / Đăng ký
```
┌─────────────────────────────┐
│      TÀN TÍCH ETHERIA        │
│   Đăng nhập để tiếp tục...   │
│                               │
│   [ Tên đăng nhập        ]   │
│   [ Mật khẩu              ]   │
│   [      Đăng nhập        ]   │
│                               │
│   Chưa có tài khoản? Tạo →   │
└─────────────────────────────┘
```
Card căn giữa màn hình, nền tối với glow nhẹ vàng hổ phách góc trên-trái.

## Màn hình Chọn nhân vật
```
┌───────────┐ ┌───────────┐ ┌───────────┐
│  Aria     │ │  Kael     │ │    +      │
│ Pháp Sư   │ │ Chiến Binh│ │ Tạo nhân  │
│  Cấp 5    │ │  Cấp 2    │ │ vật mới   │
│[Vào game] │ │[Vào game] │ │           │
└───────────┘ └───────────┘ └───────────┘
```
Grid các thẻ nhân vật, thẻ cuối luôn là "+" để tạo mới.

## Màn hình chính (Dashboard) — layout 2 cột cố định

```
┌──────────────┬──────────────────────────────────────┐
│ TÀN TÍCH      │  [Tab đang chọn — vd: Khám phá]        │
│ ETHERIA       │                                        │
│               │  ┌─────────────┐  ┌─────────────┐      │
│ ┌───────────┐ │  │ Rừng Thì    │  │ Hầm Mộ      │      │
│ │ Kael      │ │  │ Thầm        │  │ Đá Vỡ       │      │
│ │ Chiến Binh│ │  └─────────────┘  └─────────────┘      │
│ │ Cấp 4     │ │                                        │
│ │ HP ▓▓▓░░  │ │  Nhớt Rừng · Cấp 2      [Tấn công]     │
│ │ MP ▓▓░░░  │ │  Sói Bóng Tối · Cấp 4   [Tấn công]     │
│ │ 💰 240    │ │                                        │
│ └───────────┘ │  ┌─ Nhật ký chiến đấu ────────────┐   │
│               │  │ Bạn gây 12 sát thương...        │   │
│ 🧍 Nhân vật    │  │ Sói gây 7 sát thương lên bạn... │   │
│ 🎒 Túi đồ      │  └──────────────────────────────────┘  │
│ 🏪 Chợ         │                                        │
│ ⚔️ Khám phá    │                                        │
│ 📜 Cốt truyện  │                                        │
│               │                                        │
│ [Đổi nhân vật]│                                        │
│ [Đăng xuất]   │                                        │
└──────────────┴──────────────────────────────────────┘
```

Sidebar trái (240px, cố định) luôn hiển thị: tên/class/level nhân vật, thanh
HP/MP dạng "shard bar" phát sáng theo nguyên tố, số vàng, và menu điều hướng 5
tab. Nội dung chính bên phải thay đổi theo tab, layout dùng lại 3 pattern:
- **Grid thẻ vật phẩm** (Túi đồ, Chợ) — thẻ góc vát, viền glow theo độ hiếm
- **Danh sách slot trang bị** (Nhân vật) — 7 ô, viền đứt nét khi trống
- **Danh sách hàng ngang** (Khám phá — quái vật, Cốt truyện — nhiệm vụ)

## Tab Túi đồ — thẻ vật phẩm
```
┌──────────────────┐
│ HIẾM      Vũ khí │
│ Dao Găm Nanh Sói  │
│ [ATK +9] [SPD +2] │
│ [Mặc vào][Đăng bán]│
└──────────────────┘
```
Góc trên-phải/dưới-trái bị vát chéo (clip-path) mô phỏng hình dạng mảnh vỡ tinh
thể — chi tiết signature riêng của game này, không phải khung bo tròn mặc định.

## Tab Chợ giao dịch
Giống grid thẻ vật phẩm ở Túi đồ, nhưng mỗi thẻ có thêm tên người bán và nút
"Mua — [giá] vàng" (disable nếu không đủ vàng).

## Tab Cốt truyện
Card lore thế giới ở đầu trang → grid 3 thẻ phe phái → danh sách dọc các
chương nhiệm vụ chính, chương chưa đủ cấp bị làm mờ (opacity 45%) và chỉ hiện
tên chương + yêu cầu cấp độ, ẩn nội dung thoại để tạo cảm giác "chưa mở khóa".
