# 🚀 Deploy BKquiz lên Vercel + Supabase (staging)

> Cập nhật 27/11/2026 (Đợt 6, Task 6.7). Viết cho người **chưa có tài khoản** Vercel, Supabase và Google Cloud. Làm lần lượt từ bước 0 đến bước 7, mất khoảng 45–60 phút.

**Kiến trúc**

```
Trình duyệt ──► Vercel (Next.js, thư mục bkquiz-web)
                   ├─► Supabase Postgres  (qua Transaction pooler, cổng 6543)
                   ├─► Supabase Storage   (ảnh câu hỏi, API tương thích S3)
                   └─► Google OAuth       (đăng nhập)
Vercel Cron (1 lần/ngày) ──► /api/sessions/auto
```

Trong lúc làm, ghi các giá trị vào một file nháp **không commit**. Bước 5 sẽ nhập chúng vào Vercel:

| Biến | Lấy ở bước |
|---|---|
| `DATABASE_URL` | 2 |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_BASE_URL` | 3 |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | 4 |
| `AUTH_SECRET`, `CRON_SECRET` | 0 (tự tạo) |
| `ADMIN_EMAILS` | email Google của (các) quản trị viên, phân cách bằng dấu phẩy |
| `NEXT_PUBLIC_APP_URL` | 5 (domain Vercel) |

---

## Bước 0: Chuẩn bị

1. Đẩy code lên GitHub. Vercel deploy từ repo GitHub; repo được để riêng tư.
2. Máy cần Node.js 22+ để chạy migrate ở bước 2.
3. Tạo 2 chuỗi bí mật ngẫu nhiên, mỗi chuỗi chạy lệnh một lần:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   - chuỗi thứ nhất → `AUTH_SECRET` (khoá mã hoá phiên đăng nhập);
   - chuỗi thứ hai → `CRON_SECRET` (Vercel Cron gửi kèm khi gọi `/api/sessions/auto`).

---

## Bước 1: Tạo project Supabase

1. Vào https://supabase.com → **Start your project** → đăng nhập bằng GitHub.
2. **New project**:
   - **Name:** `bkquiz-staging`
   - **Database Password:** bấm *Generate a password*, **lưu lại**.
   - **Region:** *Southeast Asia (Singapore)*. Bước 5 sẽ chọn region Vercel cùng vùng.
3. Chờ khoảng 2 phút cho project khởi tạo xong.

> Gói Free tự **tạm dừng project sau 7 ngày không có truy cập**. Trước buổi demo, mở Supabase Dashboard để chắc project đang chạy. Nếu đang tạm dừng, bấm *Restore*.

---

## Bước 2: Database: chuỗi kết nối và migrate

Trong project: nút **Connect** (thanh trên cùng) → tab **ORMs** → chọn **Prisma**, hoặc tab *Connection string*. Có 2 chuỗi cần dùng:

| Dùng cho | Loại | Cổng | Dạng |
|---|---|---|---|
| App trên Vercel → `DATABASE_URL` | **Transaction pooler** | 6543 | `postgresql://postgres.<ref>:<mật-khẩu>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` |
| Chạy migrate từ máy mình | **Session pooler** | 5432 | `postgresql://postgres.<ref>:<mật-khẩu>@aws-0-<region>.pooler.supabase.com:5432/postgres` |

- `pgbouncer=true` tắt prepared statement, bắt buộc với Transaction pooler. `connection_limit=1` hợp với môi trường serverless.
- Mật khẩu có ký tự đặc biệt thì phải mã hoá: `node -e "console.log(encodeURIComponent('MẬT_KHẨU'))"`.
- Dùng *Session pooler* cho migrate vì *Direct connection* của gói Free chỉ có IPv6.

**Chạy migrate** (tạo bảng) từ thư mục `bkquiz-web`. Đặt `DATABASE_URL` tạm cho riêng lệnh này, không sửa `.env.local`:

```bash
cd bkquiz-web
npm ci
# Git Bash / macOS / Linux
DATABASE_URL="<chuỗi Session pooler 5432>" npx prisma migrate deploy
# PowerShell
$env:DATABASE_URL="<chuỗi Session pooler 5432>"; npx prisma migrate deploy; Remove-Item Env:DATABASE_URL
```

Kết quả phải là *All migrations have been successfully applied*. Danh sách gồm **17 migration**, trong đó có các migration mới:

| Migration | Đợt |
|---|---|
| `add_rate_limit`, `add_attempt_monitoring`, `add_attempt_events` | 5 |
| `add_attempt_result_counts` | điểm thang 10 |
| `add_classroom_archived`, `add_question_image` | 6 |

Sau này, mỗi lần có migration mới cũng chạy lại đúng lệnh này trước khi deploy.

---

## Bước 3: Storage cho ảnh câu hỏi

1. **Storage** → **New bucket**:
   - **Name:** `bkquiz-media`
   - **Public bucket:** bật (ai có link đều xem được ảnh, giống MinIO khi chạy local).
   - *Restrict file size:* `2 MB`; *Allowed MIME types:* `image/png, image/jpeg, image/webp`. Không bắt buộc vì server đã tự kiểm tra.
2. **Project Settings** → **Storage** → mục **S3 Connection**:
   - Ghi lại **Endpoint** → `S3_ENDPOINT`, dạng `https://<ref>.supabase.co/storage/v1/s3`.
   - Ghi lại **Region** → `S3_REGION`, ví dụ `ap-southeast-1`.
   - **New access key** → ghi **Access key ID** → `S3_ACCESS_KEY_ID` và **Secret access key** → `S3_SECRET_ACCESS_KEY`. Secret chỉ hiện một lần.
3. `S3_BUCKET=bkquiz-media`.
4. `S3_PUBLIC_BASE_URL=https://<ref>.supabase.co/storage/v1/object/public/bkquiz-media`.

> Không dùng `service_role` key làm khoá S3, vì khoá S3 của Supabase là cặp riêng ở bước 2. Bản hướng dẫn cũ ghi sai chỗ này.

---

## Bước 4: Google OAuth cho domain thật

Domain Vercel có sau bước 5, nên làm theo 2 lượt: tạo OAuth client ở đây, quay lại thêm domain sau bước 5.

1. Vào https://console.cloud.google.com → tạo project `BKquiz`.
2. **APIs & Services** → **OAuth consent screen**:
   - User type **External**; App name `BKquiz`; email hỗ trợ và email liên hệ.
   - **Test users:** thêm các tài khoản Google dùng để demo. Khi app còn ở chế độ *Testing*, chỉ những tài khoản này đăng nhập được.
3. **Credentials** → **Create credentials** → **OAuth client ID** → *Web application*:
   - **Authorized JavaScript origins:** `http://localhost:3000` (để trống domain Vercel, bổ sung sau bước 5).
   - **Authorized redirect URIs:** `http://localhost:3000/api/auth/callback/google`.
   - Ghi **Client ID** → `AUTH_GOOGLE_ID` và **Client secret** → `AUTH_GOOGLE_SECRET`.

Chi tiết có hình minh hoạ: [`bkquiz-web/GOOGLE_OAUTH_SETUP.md`](../bkquiz-web/GOOGLE_OAUTH_SETUP.md).

---

## Bước 5: Tạo project Vercel

1. Vào https://vercel.com → **Sign Up** bằng GitHub (gói Hobby, miễn phí).
2. **Add New… → Project** → **Import** repo BKquiz.
3. **Configure Project:**
   - **Root Directory:** `bkquiz-web` (bấm *Edit* để chọn).
   - **Framework Preset:** Next.js (tự nhận).
   - **Build Command:** để mặc định `npm run build`, tức `prisma generate` rồi `next build`.
4. **Environment Variables**: nhập cho môi trường *Production*, và *Preview* nếu muốn.

   | Biến | Giá trị |
   |---|---|
   | `DATABASE_URL` | chuỗi **Transaction pooler 6543** (bước 2) |
   | `AUTH_SECRET` | bước 0 |
   | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | bước 4 |
   | `CRON_SECRET` | bước 0 |
   | `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_BASE_URL` | bước 3 |
   | `NEXT_PUBLIC_APP_URL` | `https://<tên-project>.vercel.app` (sửa lại nếu domain khác) |
   | `ADMIN_EMAILS` | email Google của quản trị viên (duyệt giáo viên), ví dụ `ban@gmail.com`; nhiều người thì phân cách bằng dấu phẩy |
   | `NEXT_PUBLIC_SENTRY_DISABLED` | `true` (khi chưa dùng Sentry; tránh build cố upload source map) |

   **Tuyệt đối không đặt:**
   - `DEV_BYPASS_AUTH`: bật thì **ai cũng vào được với quyền giáo viên** mà không cần đăng nhập.
   - `BKQUIZ_CHECKPOINT_SECONDS`: chỉ dành cho test e2e.
   - `RATE_LIMIT_DISABLED`: tắt chống spam API.
5. **Settings → Functions → Function Region:** chọn *Singapore (sin1)*, cùng vùng với Supabase. Mỗi request cần vài truy vấn DB nên đặt hai bên gần nhau giảm độ trễ rõ rệt.
6. Bấm **Deploy**, chờ khoảng 3 phút. Ghi lại domain, ví dụ `https://bkquiz-staging.vercel.app`.
7. **Quay lại Google Cloud (bước 4)**, thêm vào OAuth client:
   - origin `https://<domain>`;
   - redirect URI `https://<domain>/api/auth/callback/google`.

   Google cần vài phút để áp dụng.

> `trustHost: true` đã bật trong `src/auth.ts`, nên không cần đặt `AUTH_URL` / `NEXTAUTH_URL` trên Vercel.

---

## Bước 6: Cron và việc tự bắt đầu / kết thúc phiên

`bkquiz-web/vercel.json` khai báo cron gọi `/api/sessions/auto` **1 lần/ngày**, lúc 17:00 UTC (00:00 giờ Việt Nam). Gói Hobby chỉ cho cron chạy tối đa 1 lần/ngày, và có thể lệch tới 1 giờ.

- **Việc cron làm:** dọn bộ đếm rate limit cũ (bảng `RateLimit`), bắt đầu các phiên đã đến giờ hẹn và kết thúc các phiên đã hết giờ cộng thời gian chờ.
- Vercel gọi bằng `GET` kèm `Authorization: Bearer <CRON_SECRET>`. Gọi không có secret thì chỉ nhận trạng thái, không chạy gì.
- **Trong buổi kiểm tra, việc tự bắt đầu / kết thúc đúng giờ dựa vào màn chiếu của giáo viên.** Màn chiếu đang mở sẽ gọi `POST /api/sessions/auto` khi trạng thái thay đổi; endpoint nhận mọi người dùng đã đăng nhập. Hãy mở màn chiếu trong suốt buổi, hoặc bấm *Bắt đầu* / *Kết thúc* bằng tay.
- **Muốn chính xác từng phút mà không cần mở màn chiếu:** tạo job miễn phí trên https://cron-job.org:
  - URL `https://<domain>/api/sessions/auto`, method **GET**, mỗi 1 phút;
  - header `Authorization: Bearer <CRON_SECRET>`.

---

## Bước 7: Kiểm tra sau deploy

| # | Việc | Kết quả đúng |
|---|---|---|
| 1 | Mở `https://<domain>/api/health` | `200` |
| 2 | Mở `https://<domain>/api/dev/role?role=teacher` | **`404`**. Nếu chuyển hướng vào dashboard thì `DEV_BYPASS_AUTH` đang bật: **xoá ngay rồi Redeploy** |
| 3 | `curl https://<domain>/api/sessions/auto -X POST` (không đăng nhập) | `401 UNAUTHORIZED` |
| 4 | Đăng nhập bằng **tài khoản Google A** (lần đầu) | Hiện trang chọn vai trò → chọn **Giáo viên**, nhập trường / đơn vị → vào dashboard sinh viên kèm ghi chú "đang chờ duyệt" |
| 5 | Đăng nhập bằng tài khoản **quản trị viên** (email trong `ADMIN_EMAILS`) → **Quản trị** → **Duyệt** yêu cầu của A. Nếu A chính là quản trị viên thì tự duyệt | A tải lại trang → menu giáo viên; ô chọn vai trò xuất hiện ở chân trang |
| 6 | Giáo viên: tạo lớp → nhập `docs/cau-hoi-mau.md` → tạo quiz (luật theo tag `so-hoc`) → tạo câu hỏi có **ảnh** | Ảnh hiện ở ngân hàng câu hỏi; URL ảnh là `…supabase.co/storage/v1/object/public/bkquiz-media/…` |
| 7 | **Tài khoản Google B** (cửa sổ ẩn danh): tham gia lớp bằng mã → vào phiên | Vào phòng chờ |
| 8 | A: mở màn chiếu → *Bắt đầu*; B làm bài, nhập token checkpoint từ màn chiếu, nộp bài | B thấy điểm thang 10 và số câu đúng |
| 9 | A: trang **Theo dõi** và **Thống kê** của phiên | Có bài của B, điểm đúng |
| 10 | Vercel → *Settings → Cron Jobs* → **Run** | Log của function `/api/sessions/auto` trả `200` |

**Vai trò giáo viên do quản trị viên duyệt (Đợt 7).**
- Lần đăng nhập đầu, người dùng chọn Sinh viên (dùng ngay) hoặc Giáo viên (gửi yêu cầu, chờ duyệt).
- Quản trị viên là các email trong `ADMIN_EMAILS`, duyệt / từ chối / thu hồi ở trang **Quản trị**. Không ai tự cấp quyền giáo viên được.
- **Phải đặt `ADMIN_EMAILS` trước khi demo.** Nếu không đặt, không ai duyệt được giáo viên.
- Chi tiết: `docs/security.md` mục 3.1c.

---

## Cập nhật bản deploy

1. Có migration mới (thư mục `bkquiz-web/prisma/migrations/`): chạy `prisma migrate deploy` như bước 2 **trước**.
2. Push lên nhánh `main`, Vercel tự build và deploy lại. Push nhánh khác thì Vercel tạo bản *Preview*.

---

## Lỗi thường gặp

| Triệu chứng | Nguyên nhân / cách sửa |
|---|---|
| Build lỗi `Environment variable not found: DATABASE_URL` hoặc lỗi `Env` | Thiếu biến trên Vercel hoặc đặt sai môi trường (Production / Preview) → thêm rồi *Redeploy* |
| `prepared statement "s0" already exists` | `DATABASE_URL` trên Vercel thiếu `?pgbouncer=true`, hoặc chạy migrate qua cổng 6543 → migrate dùng cổng 5432 |
| `invalid port number` khi kết nối | Mật khẩu có ký tự đặc biệt chưa mã hoá (`encodeURIComponent`) |
| Đăng nhập Google báo `redirect_uri_mismatch` | Chưa thêm `https://<domain>/api/auth/callback/google` (bước 5.7), hoặc domain sai |
| Đăng nhập Google báo *Access blocked / not a test user* | Thêm tài khoản vào *Test users* của OAuth consent screen |
| Tạo câu hỏi có ảnh báo "chưa cấu hình nơi lưu ảnh" | Thiếu một trong các biến `S3_*` |
| Upload ảnh lỗi `STORAGE_UNAVAILABLE` (502) | Sai khoá S3 / endpoint / region, hoặc bucket chưa tạo → xem log function trên Vercel |
| Ảnh tải lên được nhưng không hiện | Bucket chưa bật *Public*, hoặc `S3_PUBLIC_BASE_URL` sai |
| Phiên không tự kết thúc | Màn chiếu không mở và cron mới chạy 1 lần/ngày → bấm *Kết thúc*, hoặc dùng cron-job.org (bước 6) |
| Supabase báo project *paused* | Gói Free tạm dừng sau 7 ngày không dùng → *Restore project* |

Xem thêm checklist: [`PRE_DEPLOYMENT_CHECKLIST.md`](./PRE_DEPLOYMENT_CHECKLIST.md).
