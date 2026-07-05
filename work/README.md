# Tàn Tích Etheria — RPG Web Demo

Demo RPG nhập vai trên trình duyệt: đăng ký/đăng nhập, tạo nhân vật, trang bị vật
phẩm, chiến đấu PvE, và giao dịch vật phẩm/vàng qua chợ giữa người chơi.

## ⚠️ Lưu ý quan trọng về Netlify trước khi bắt đầu

**Netlify chỉ phù hợp để host phần FRONTEND (React).** Backend của game này là một
server Node.js/Express có kết nối cơ sở dữ liệu PostgreSQL liên tục và dùng
Socket.IO (WebSocket) để thông báo realtime — đây là kiểu server "luôn chạy"
(long-running/stateful), trong khi Netlify Functions chỉ chạy serverless (mỗi
request một hàm ngắn hạn, không giữ kết nối WebSocket được). Vì vậy kiến trúc
đúng để deploy miễn phí là:

| Thành phần | Nơi deploy | Vì sao |
|---|---|---|
| `client/` (React) | **Netlify** | Đúng sở trường: host static site/SPA |
| `server/` (Express + Socket.IO) | **Railway** hoặc **Render** (free tier) | Cần server chạy liên tục + WebSocket |
| PostgreSQL | Railway/Render Postgres addon, hoặc **Neon**/**Supabase** (free tier) | Cần transaction ACID cho hệ thống giao dịch |

Nếu bạn chỉ đẩy `client/` lên Netlify mà chưa deploy `server/` ở đâu đó, trang
web sẽ hiện lên nhưng đăng nhập/tạo nhân vật sẽ báo lỗi vì không gọi được API.

---

## 1. Chạy thử ở máy local trước (khuyến nghị)

### 1.1. Cài PostgreSQL local (hoặc dùng free Postgres của Neon/Supabase luôn cho đỡ cài đặt)

```bash
createdb etheria
```

### 1.2. Backend

```bash
cd server
cp .env.example .env
# Mở .env, điền DATABASE_URL trỏ vào DB vừa tạo, và đổi JWT_SECRET

npm install
psql "$DATABASE_URL" -f db/schema.sql   # tạo toàn bộ bảng
npm run seed                             # nạp dữ liệu vật phẩm & quái vật mẫu & nhiệm vụ mẫu

> **Đã cập nhật bản đồ đi lại được + hệ thống nhiệm vụ:** `db/schema.sql` giờ có thêm bảng
> `quests` và `character_quests`. Nếu bạn đã tạo DB từ trước, chạy lại
> `psql "$DATABASE_URL" -f db/schema.sql` (các câu lệnh đều dùng `CREATE TABLE IF NOT EXISTS`
> nên an toàn khi chạy lại) rồi `npm run seed` để nạp 2 nhiệm vụ chương 1–2.
npm run dev                              # chạy tại http://localhost:4000
```

### 1.3. Frontend

```bash
cd client
npm install
npm run dev   # chạy tại http://localhost:5173, tự gọi API ở localhost:4000
```

Mở `http://localhost:5173`, đăng ký tài khoản, tạo nhân vật, và thử toàn bộ vòng
lặp: khám phá → nhặt đồ → mặc đồ → đăng bán → (đăng ký tài khoản thứ 2 ở trình
duyệt ẩn danh để thử mua bán chéo giữa 2 nhân vật).

---

## 2. Deploy backend lên Railway (ví dụ cụ thể)

1. Tạo tài khoản tại railway.app, **New Project → Deploy from GitHub repo**
   (đẩy code của bạn lên GitHub trước) → chọn thư mục `server`.
2. Trong Railway, **New → Database → PostgreSQL** để tạo DB, Railway sẽ tự cấp
   biến `DATABASE_URL`.
3. Vào tab **Variables** của service `server`, thêm:
   - `DATABASE_URL` → copy từ Postgres addon vừa tạo
   - `JWT_SECRET` → một chuỗi ngẫu nhiên dài (vd tạo bằng `openssl rand -hex 32`)
   - `CLIENT_ORIGIN` → domain Netlify của bạn, vd `https://ten-app-cua-ban.netlify.app`
   - `PORT` → `4000` (Railway thường tự set qua biến `PORT` sẵn có, không bắt buộc)
4. Vào tab **Settings → Networking**, bật **Generate Domain** để có URL public,
   vd `https://etheria-server-production.up.railway.app`.
5. Chạy migration + seed một lần: dùng tab **Shell** của Railway (hoặc kết nối
   `DATABASE_URL` từ máy bạn qua `psql`) để chạy:
   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   npm run seed
   ```
6. Railway sẽ tự chạy `npm run build && npm start` — kiểm tra log để chắc server
   khởi động thành công (dòng "Etheria server đang chạy tại...").

*(Render.com hoặc Fly.io hoạt động tương tự — tạo Web Service trỏ vào `server/`,
thêm Postgres, set các biến môi trường như trên.)*

---

## 3. Deploy frontend lên Netlify

1. Đẩy toàn bộ repo (gồm cả `client/`, `server/`, `netlify.toml` ở gốc) lên GitHub.
2. Vào app.netlify.com → **Add new site → Import an existing project** → chọn repo.
3. Netlify sẽ đọc sẵn `netlify.toml` ở gốc repo (đã cấu hình `base = "client"`,
   `command = "npm run build"`, `publish = "client/dist"`) — không cần chỉnh gì thêm.
4. Vào **Site configuration → Environment variables**, thêm:
   - `VITE_API_URL` → URL backend Railway/Render ở bước 2, vd
     `https://etheria-server-production.up.railway.app` (**không** có dấu `/`
     ở cuối)
5. Bấm **Deploy site**. Sau khi xong, quay lại Railway/Render và cập nhật biến
   `CLIENT_ORIGIN` của backend thành đúng domain Netlify vừa được cấp (bước
   này bắt buộc, nếu không backend sẽ chặn CORS).

Xong — mở domain Netlify là chơi được, và có thể chia sẻ link cho nhiều người
chơi thử cùng lúc vì dữ liệu đều lưu chung trên 1 database.

---

## 4. Cấu trúc thư mục

```
game-demo/
  server/            # Backend Node.js + Express + PostgreSQL + Socket.IO
    db/schema.sql     # Toàn bộ schema database
    src/
      routes/         # auth, character, inventory, marketplace, combat
      seed.ts         # dữ liệu vật phẩm & quái vật mẫu
  client/            # Frontend React + TypeScript + Vite
    src/
      pages/          # Login, Register, CharacterSelect, CreateCharacter, Dashboard
      pages/tabs/      # Nhân vật, Túi đồ, Chợ, Khám phá, Cốt truyện
      components/     # ShardBar (thanh HP/MP/EXP), ItemCard
  netlify.toml       # Cấu hình build cho Netlify (đặt ở gốc repo)
  docs/
    game-design-doc.md   # Tài liệu định hướng đầy đủ (cốt truyện, hệ thống, kiến trúc)
    wireframes.md         # Mô tả bố cục UI từng màn hình
```

## 5. Việc nên làm tiếp theo nếu muốn phát triển thêm

- Thêm trade P2P trực tiếp (2 người chơi cùng online) qua Socket.IO
- Thêm hệ thống chế tạo (dùng `material` items)
- Thêm rate-limit ở backend (vd `express-rate-limit`) trước khi mở public rộng rãi
- Thêm test tự động cho luồng giao dịch (mục rủi ro cao nhất — xem
  `docs/game-design-doc.md` mục 5.2)
