# 📊 Trạng thái dự án BKQuiz hiện tại

> Rà soát lần đầu: 28/10/2026 — toàn bộ 46 API route, Prisma schema, UI, test và tài liệu trong `docs/`.
> Cập nhật gần nhất: 27/11/2026 — **lập Đợt 8** (xuất / nhập Excel, giao diện bớt "trẻ con"; đã làm 8.3). Trước đó cùng ngày: **xong Đợt 7** (gỡ trợ giảng, giáo viên do quản trị viên duyệt, nhập .zip kèm ảnh). Trước đó cùng ngày: **xong Đợt 6** (code + tài liệu; còn chạy thật trên Vercel) và sửa điểm thang 10 (xem nhật ký). Trước đó 26/11/2026: xong Đợt 5 (chống gian lận, giám sát phiên thi, thống kê câu hỏi, rate limit, unit test + e2e) và chốt Đợt 6 (xem [Nhật ký thay đổi](#nhật-ký-thay-đổi) và [ke-hoach.md](./ke-hoach.md)).

**Tóm tắt:** Lõi nghiệp vụ (token 45 s, làm bài, chấm điểm, báo cáo) đã hoạt động đầy đủ, giao diện hỗ trợ trọn vẹn vi/en theo hệ thiết kế bảng đen.

Đợt 5 đã bổ sung:
- trang **Theo dõi phiên thi** (mở khoá, gia hạn riêng, thu bài);
- **gắn cờ bài làm nghi vấn**;
- **thống kê câu hỏi**;
- **rate limit API**;
- 149 unit test và 1 test e2e toàn luồng.

Đợt 6 (27/11/2026) đã bổ sung:
- **nhân bản quiz**, **lưu trữ lớp**, vai trò trợ giảng (đã gỡ ở Đợt 7);
- **câu Đúng/Sai**, **ảnh trong câu hỏi** (MinIO / Supabase Storage);
- **sửa tên hiển thị**;
- **điểm thang 10**;
- **CI** (lần đầu thực sự chạy);
- **hướng dẫn deploy** Vercel + Supabase.

Đợt 7 (27/11/2026):
- **gỡ vai trò trợ giảng**;
- **chọn vai trò ở lần đăng nhập đầu**, giáo viên do **quản trị viên** (`ADMIN_EMAILS`) duyệt trên trang Quản trị, không ai tự cấp quyền được;
- ô chọn vai trò chỉ hiện khi có cả 2 vai trò;
- **nhập `.zip` kèm thư mục ảnh**.

Đợt 8 (27/11/2026, đang làm):
- ✅ **giao diện bớt "trẻ con"**: chữ thường, nút, bảng, số liệu dùng Inter; phông viết tay chỉ còn ở tiêu đề và logo; bỏ chi tiết xoay nghiêng; khung gỗ mỏng ở điện thoại;
- ⏳ **xuất điểm ra Excel** đúng chuẩn + bảng điểm cả lớp;
- ⏳ **nhập câu hỏi từ Excel / CSV**.

Hiện có 192 unit test và test e2e luồng thi. Việc còn lại là deploy thật lên staging theo [DEPLOYMENT_SUPABASE.md](./DEPLOYMENT_SUPABASE.md) (cần tài khoản), cùng các mục "để sau" ở mục 3.

---

## 1. Các chức năng đã làm được

### Tài khoản & phân quyền
- Đăng nhập Google (NextAuth), 2 vai trò teacher/student, chuyển vai trò (`api/user/switch-role`).
- Kiểm tra quyền phía server cho lớp, quiz, pool, session, attempt (`src/server/authz.ts`, `src/server/poolAuthz.ts`); proxy chặn `/dashboard` khi chưa đăng nhập.
- Trang dev đổi role chỉ bật khi có `DEV_BYPASS_AUTH=1`.

### Lớp học
- Tạo lớp, danh sách lớp, join bằng class code / QR (có màn hình xem trước trước khi join).
- Xem thành viên, xem session của lớp, gắn tag cho lớp.
- Đổi tên lớp; xoá lớp (phải gõ lại tên lớp để xác nhận, không xoá được khi có session đang chạy).
- Chủ lớp thêm thành viên bằng email, xoá hoặc chặn thành viên; sinh viên tự rời lớp. Người bị chặn không join lại bằng mã lớp được.
- Trang chi tiết lớp riêng cho giáo viên và sinh viên.

### Ngân hàng câu hỏi
- CRUD pool và câu hỏi (`mcq_single`, `mcq_multi`).
- Import / export pool bằng Markdown.
- Chia sẻ pool với giáo viên khác theo quyền `view` / `use` / `edit`.
- Gắn tag cho pool và câu hỏi.

### Quiz
- Tạo quiz, sinh đề theo rule dựa trên tag (số câu chung, câu biến thể, % câu dư).
- Cài thời lượng, trạng thái draft / published / archived, xem trước đề.
- Đổi tên quiz; lưu trữ / khôi phục quiz (quiz lưu trữ không tạo session mới được); xoá quiz chưa từng dùng cho session.
- Xoá pool (chỉ chủ pool).

### Session (buổi kiểm tra)
- Tạo session: giờ bắt đầu, thời lượng, buffer tự đóng, thời gian cho xem lại đáp án.
- Lobby → start → end; tự động bắt đầu/kết thúc qua cron (`api/sessions/auto`).
- Gia hạn +5 / +10 / +15 phút khi session đang chạy (tổng tối đa 120 phút); áp dụng cho mọi sinh viên và cả mốc tự đóng.
- Huỷ session đang ở phòng chờ; xoá session đã kết thúc (gõ lại tên để xác nhận, xoá kèm toàn bộ bài làm). Session đang chạy không xoá được.
- Snapshot đề theo session; mỗi sinh viên nhận đề có trộn câu; với câu biến thể mỗi sinh viên nhận một tập con câu và chỉ được chấm trên các câu đó.
- **Token TOTP đổi mỗi 45 giây** trên màn hình giáo viên, kèm QR.

### Làm bài (sinh viên)
- Checkpoint ngẫu nhiên mỗi 4–5 phút yêu cầu nhập token.
- Sai 3 lần → chờ 30 giây; sai 6 lần → khoá 5 phút; mọi lần nhập được ghi vào `CheckpointLog`.
- Lưu đáp án, có dự phòng localStorage khi mạng yếu.
- Kiểm tra giới hạn thời gian phía server; xem lại bài sau khi nộp trong khoảng thời gian cho phép.

### Chấm điểm & báo cáo
- 3 chế độ chấm: `all_or_nothing`, `partial` (EDC / chia đôi), `penalty` (`api/attempts/[attemptId]/submit`); giáo viên chọn chế độ trong trang chi tiết quiz (Bước 1 - Cài đặt quiz).
- Cache điểm từng câu vào `Attempt.questionScores`.
- Bảng điểm, token log, danh sách sinh viên đã join; **xuất CSV** (`?format=csv`).
- **Giáo viên xem chi tiết bài làm từng sinh viên** (mở từ bảng điểm): từng câu được giao, phương án đã chọn so với đáp án đúng, điểm từng câu, lọc câu sai / chưa trả lời, nhật ký checkpoint. Xem được cả khi sinh viên đang làm.
- Trang Performance cho sinh viên.

### Đa ngôn ngữ (i18n)
- Toàn bộ giao diện hỗ trợ vi/en qua next-intl: landing, đăng nhập, dashboard, lớp học, ngân hàng câu hỏi, quiz, session, màn hình giáo viên, làm bài, hồ sơ.
- 763 key/ngôn ngữ trong `src/locales/en.json` và `vi.json`, hai file khớp nhau hoàn toàn.
- Ngày giờ định dạng theo ngôn ngữ đang chọn (không còn cố định `'vi-VN'`); tiêu đề tab trình duyệt và badge trạng thái được dịch.

### Khác
- Health check, Sentry, Arcjet chặn bot, tài liệu deploy Vercel/Supabase.

---

## 2. Các chức năng đang làm dở / chưa hoàn thiện

| # | Chức năng | Tình trạng |
|---|---|---|
| 1 | ~~**i18n**~~ ✅ | **Đã hoàn thành (04/11/2026)** — chi tiết ở mục 1 và [Nhật ký thay đổi](#nhật-ký-thay-đổi). Đã chạy thật (27/11/2026): 12 trang giáo viên + 6 trang sinh viên ở cả vi và en, không có key chưa dịch hay lỗi console. |
| 2 | ~~**Cấu hình chế độ chấm điểm**~~ ✅ | **Đã hoàn thành (04/11/2026)** — API `settings` nhận/trả `scoring`, trang chi tiết quiz có ô chọn chế độ. Đã chạy thật (27/11/2026): lưu `partial` / chia đôi rồi đọc lại đúng; cả 3 chế độ chấm có unit test. |
| 3 | ~~**Thêm thành viên vào lớp**~~ ✅ | **Đã hoàn thành (06/11/2026)** — thêm bằng email. |
| 4 | ~~**Danger Zone của lớp**~~ ✅ | Xoá lớp (06/11/2026); **lưu trữ / bỏ lưu trữ lớp** (27/11/2026, Đợt 6 Task 6.2). |
| 5 | ~~**Vai trò TA**~~ ❌ | Làm ở Đợt 6 Task 6.3, **đã gỡ ở Đợt 7** theo yêu cầu: lớp chỉ còn chủ lớp và sinh viên. Bảng quyền ở `security.md` mục 3.1b; ai được làm giáo viên ở mục 3.1c. |
| 6 | ~~**Trang hồ sơ**~~ ✅ | Sửa tên hiển thị (27/11/2026, Đợt 6 Task 6.6). |
| 7 | **Checkpoint theo phase** | `RA.md` thiết kế theo phase (câu 1–5, 6–10…); code dùng mốc thời gian ngẫu nhiên 240–300s. Hợp lý nhưng cần ghi rõ trong báo cáo. |
| 8 | **Checklist trước deploy** | Phần code đã xong (27/11/2026, Đợt 6 Task 6.7): `vercel.json`, `.env.example`, đo 200 câu, sửa `/api/sessions/auto` cho cron. **Còn lại:** các bước làm trên Vercel / Supabase / Google Cloud (mục 0 của `PRE_DEPLOYMENT_CHECKLIST.md`). |
| 9 | ~~**Phần thừa & code chết**~~ ✅ (đã gỡ khi thiết kế lại giao diện bảng đen) | Trang `counter`, `portfolio`, `about`, test Counter và namespace i18n tương ứng. Các file không được import ở đâu (theo knip): `ClassroomPanel.tsx`, `MobileSidebarProvider.tsx`, `DemoBanner.tsx`, `Hello.tsx`, `Sponsors.tsx` — chưa dịch vì không hiển thị, nên cân nhắc xoá. |
| 10 | ~~**Môi trường test**~~ ✅ | CI mới ở `.github/workflows/ci.yml` (gốc repo; các workflow cũ trong `bkquiz-web/.github` chưa từng chạy): type check, i18n, unit test, e2e với Postgres (27/11/2026, Đợt 6 Task 6.0). Project test trên trình duyệt của vitest vẫn cần `npx playwright install chromium`. |

---

## 3. Các chức năng chưa được thực hiện

- ~~**Sửa / xoá lớp**~~ ✅ (06/11/2026) — còn thiếu archive lớp.
- ~~**Quản lý thành viên**~~ ✅ (06/11/2026) — còn thiếu đổi vai trò (gán TA → **Đợt 6, Task 6.3**) và danh sách người bị chặn để bỏ chặn (để sau; hiện bỏ chặn bằng cách thêm lại qua email).
- ~~**Sửa thông tin quiz, xoá quiz / pool**~~ ✅ (06/11/2026).
- ~~**Huỷ / xoá session**, gia hạn thời gian khi session đang chạy~~ ✅ (13/11/2026) — còn thiếu nút xoá ngay trong danh sách session của trang lớp (để sau, đã xoá được từ màn chiếu).
- ~~**Nhân bản quiz**~~ ✅ (27/11/2026, Đợt 6 Task 6.1).
- ~~**Giáo viên xem chi tiết bài làm từng sinh viên**~~ ✅ (13/11/2026).
- ~~**Thống kê theo câu hỏi** và **biểu đồ**~~ ✅ (26/11/2026, Đợt 5 Task 5.5) — trang Thống kê của phiên. Trang Performance của sinh viên vẫn chưa có biểu đồ (để sau).
- ~~**Rate limit cho API**~~ ✅ (26/11/2026, Đợt 5 Task 5.2) — bộ đếm trong Postgres, áp dụng cho 37 handler. Trước đó `src/proxy.ts` loại trừ `/api` khỏi matcher nên Arcjet không bảo vệ API.
- ~~**Phát hiện hành vi bất thường**~~ ✅ (26/11/2026, Đợt 5 Task 5.4) — gắn cờ bài làm nghi vấn (RA mục 6.2).
- ~~**Loại câu hỏi khác**~~: **câu Đúng/Sai** ✅ và **ảnh trong câu hỏi** ✅ (27/11/2026, Đợt 6 Task 6.4, 6.5); công thức LaTeX đã hiển thị được qua KaTeX. **Để sau:** câu điền ngắn; nhập `.zip` có thư mục `assets/` (tự tải ảnh trong zip lên).
- **Xuất điểm ra Excel đúng chuẩn** — CSV hiện tại không có BOM (Excel lỗi dấu tiếng Việt), điểm dùng dấu chấm thập phân, cột tiếng Anh; chưa có bảng điểm tổng hợp cả lớp → **Đợt 8, Task 8.1**.
- **Nhập câu hỏi từ Excel / CSV** (hiện chỉ Markdown / `.zip`) → **Đợt 8, Task 8.2**.
- **Lời giải cho câu hỏi** (hiện sinh viên chỉ thấy đáp án đúng / sai khi được xem lại) — để sau.
- **Đăng nhập khác Google** (email/mật khẩu, Microsoft cho tài khoản trường) — để sau.
- ~~**Test cho nghiệp vụ**~~ ✅ (26/11/2026, Đợt 5 Task 5.1 + 5.6) — 149 unit test + e2e toàn luồng thi.
- **Tài liệu người dùng** cho giáo viên / sinh viên (đã nêu trong `MISSING_DOCS.md`) — để sau.
- **Deploy staging** (Vercel + Supabase, Google OAuth production): hướng dẫn và cấu hình đã xong (Đợt 6 Task 6.7). **Còn lại:** tạo tài khoản và deploy thật theo [DEPLOYMENT_SUPABASE.md](./DEPLOYMENT_SUPABASE.md).

---

## 4. Đề xuất chức năng nên bổ sung

> **26/11/2026 — đã chốt Đợt 6** (chi tiết: [ke-hoach.md](./ke-hoach.md#-kế-hoạch-thực-hiện--đợt-6-hoàn-thiện-chức-năng-còn-thiếu--sẵn-sàng-deploy)). Ưu tiên **thêm các chức năng còn thiếu**, deploy làm cuối:
> 0. Dọn nợ nhỏ: dịch "Scoreboard", sửa a11y phương án, chạy e2e trên CI (Task 6.0).
> 1. **Nhân bản quiz** để dùng lại cho lớp khác / học kỳ sau (Task 6.1).
> 2. **Lưu trữ lớp** đã kết thúc (Task 6.2).
> 3. **Vai trò trợ giảng (TA)**: gán / bỏ vai trò, bảng quyền rõ ràng (Task 6.3).
> 4. **Câu Đúng/Sai** bằng mẫu soạn câu và cú pháp import (Task 6.4).
> 5. **Ảnh trong câu hỏi**: upload lên MinIO / Supabase Storage, chép vào snapshot của phiên (Task 6.5).
> 6. **Sửa hồ sơ** (tên hiển thị) (Task 6.6).
> 7. **Hướng dẫn deploy staging** Vercel + Supabase cho người chưa có tài khoản (Task 6.7).
>
> Ước lượng 23–28 giờ, 2 migration.

> **26/11/2026 — đã chốt Đợt 5** (chi tiết: [ke-hoach.md](./ke-hoach.md#-kế-hoạch-thực-hiện--đợt-5-chống-gian-lận-giám-sát-phiên-thi-độ-tin-cậy)), 5 chức năng ưu tiên cao nhất:
> 1. **Gắn cờ bài làm nghi vấn** — ghi nhận rời tab, đổi thiết bị, một thiết bị cho nhiều tài khoản, nộp quá nhanh, đoán token; giáo viên xem cờ kèm lý do (Task 5.4).
> 2. **Giám sát phiên thi + can thiệp** — trang riêng cho giáo viên: ai đang làm / bị khoá / mất kết nối / đã nộp; mở khoá, gia hạn riêng, thu bài từng sinh viên (Task 5.3).
> 3. **Rate limit API** (Task 5.2).
> 4. **Phân tích câu hỏi + biểu đồ** (Task 5.5).
> 5. **Test nghiệp vụ lõi** — unit test TOTP, khoá checkpoint, chấm điểm, thời gian, phân quyền + 1 e2e toàn luồng (Task 5.1, 5.6).
>
> Danh sách cũ bên dưới giữ để tham khảo.

Xếp theo mức độ đáng làm cho đồ án tốt nghiệp:

1. **Test cho luồng cốt lõi** — TOTP (lệch ±1 window), khoá sau 6 lần sai, 3 chế độ chấm điểm. Ít công, tăng độ tin cậy khi bảo vệ.
2. **Gắn cờ bài làm nghi vấn** — log rời tab / mất focus, nộp quá nhanh, verify token sát lúc hết hạn, nhiều tài khoản cùng IP; giáo viên xem danh sách bị gắn cờ. Phát triển tự nhiên từ ý tưởng chống gian lận của đề tài.
3. **Phân tích câu hỏi sau session** — tỉ lệ đúng, độ phân biệt, phương án nhiễu được chọn nhiều nhất, kèm biểu đồ. Dữ liệu `questionScores` đã có sẵn.
4. **Bảng theo dõi realtime cho giáo viên** — số sinh viên đang làm / đã verify / bị khoá / đã nộp; dùng SSE thay cho polling `setInterval`.
5. ~~**UI chọn chế độ chấm điểm**~~ ✅ đã làm (04/11/2026).
6. **Nhân bản quiz/session** giữa các lớp, và **sinh câu hỏi bằng AI** từ tài liệu bài giảng, xuất ra định dạng Markdown import sẵn có.

---

## Lộ trình đề xuất

1. ~~Hoàn thành **i18n**~~ ✅ (04/11/2026).
2. ~~**UI chọn chế độ chấm điểm**~~ ✅ (04/11/2026) + ~~**quản lý lớp/thành viên**~~ ✅ (06/11/2026).
3. ~~**Đợt 4 — quản lý session & phân tích kết quả**~~ ✅: sửa chấm đề biến thể, gia hạn, huỷ/xoá session, chi tiết bài làm từng sinh viên (13/11/2026, chạy thật 27/11/2026). Rate limit và thống kê câu hỏi chuyển sang Đợt 5.
4. ~~**Test** + **gắn cờ nghi vấn**~~ ✅ — làm trong Đợt 5 (Task 5.1, 5.4, 5.6).
5. ~~**Đợt 5 — chống gian lận, giám sát phiên thi, độ tin cậy**~~ ✅ (26/11/2026): 5.1 unit test → 5.2 rate limit → 5.3 giám sát + can thiệp → 5.4 gắn cờ nghi vấn → 5.5 thống kê câu hỏi → 5.6 e2e + tài liệu. 3 migration. Chưa commit.
6. ~~**Đợt 6 — hoàn thiện chức năng còn thiếu & sẵn sàng deploy**~~ ✅ (27/11/2026, xem [ke-hoach.md](./ke-hoach.md)): 6.0 dọn nợ nhỏ → 6.1 nhân bản quiz → 6.2 lưu trữ lớp → 6.3 vai trò TA → 6.4 câu Đúng/Sai → 6.5 ảnh trong câu hỏi → 6.6 sửa hồ sơ → 6.7 hướng dẫn deploy. 2 migration. Chưa commit.
7. ~~**Đợt 7 — gỡ trợ giảng, giáo viên do quản trị viên duyệt, nhập .zip kèm ảnh**~~ ✅ (27/11/2026, xem [ke-hoach.md](./ke-hoach.md)). 2 migration. Chưa commit.
8. **Đợt 8 — xuất / nhập Excel, giao diện bớt "trẻ con"** (xem [ke-hoach.md](./ke-hoach.md)): ~~8.3 chỉnh phông chữ~~ ✅ (27/11/2026) → 8.1 xuất Excel → 8.2 nhập Excel / CSV. Không migration.
9. **Deploy staging** thật theo DEPLOYMENT_SUPABASE.md (cần tài khoản Vercel / Supabase / Google Cloud), chạy kịch bản demo với 2 tài khoản Google.

---

## Nhật ký thay đổi

### 27/11/2026 — Đợt 8, Task 8.3: giao diện bớt "trẻ con" (chưa commit)
- **Lập Đợt 8** sau khi đối chiếu với nhu cầu thực tế của giảng viên / sinh viên: 8.1 xuất Excel, 8.2 nhập Excel / CSV (chưa làm), 8.3 giao diện.
- **Phông chữ** (`src/components/chalk/chalk.module.css`): mặt bảng, hộp thoại, nút, nhãn, tag, bảng, menu dùng Inter; con số dùng `tabular-nums`. Patrick Hand chỉ cho tiêu đề (`.title`, `.modalTitle`, lớp mới `.heading`); Dancing Script (`.script`) chỉ cho logo. Thêm lớp `.num` cho số liệu.
- **Màn làm bài**: câu hỏi và phương án chuyển từ Dancing Script sang Inter; bỏ mọi `rotate` (phương án, chữ cái được chọn, ô điều hướng, đồng hồ); đồng hồ và điểm dùng số đều độ rộng.
- **Bỏ xoay nghiêng** khi rê chuột ở nút / thẻ và ở mục đang chọn trên sidebar (đổi hình elip thành viền bo tay như nút).
- **Điện thoại**: khung gỗ và lề tường mỏng lại (dưới 768 px).
- **Sửa lỗi**: trang chi tiết bộ câu hỏi hiện "Cập nhật:" trống (API `GET /api/pools/:id` không trả `updatedAt`); nhãn `private` / `view` / `use` / `edit` chưa dịch (thêm key `QuestionBank.detail.perm_*`).
- **Kiểm tra**: `check:types`, `check:i18n:ci`, 192 unit test, e2e luồng thi đạt; chụp màn hình 1280 / 360 px (tổng quan giáo viên, ngân hàng câu hỏi, thống kê, màn làm bài), không lỗi console.

### 27/11/2026 — Đợt 7: gỡ trợ giảng, giáo viên do quản trị viên duyệt, nhập .zip kèm ảnh (chưa commit) — **Đợt 7 hoàn thành**
Chi tiết ở [ke-hoach.md](./ke-hoach.md).
- **7.0:** gỡ vai trò trợ giảng: enum `ClassroomRole` bỏ `ta` (migration `remove_classroom_ta_role`), xoá API gán TA, nút, key dịch, test.
- **7.1:** chọn vai trò lần đầu (`/onboarding`); yêu cầu làm giáo viên (`TeacherRequest`, migration `add_teacher_requests`); trang Quản trị (`ADMIN_EMAILS`) để duyệt / từ chối / thu hồi.
  - `switch-role` không còn tự cấp vai trò.
  - Sửa 6 route trả 500 thay vì 403 khi sai vai trò.
- **7.2:** ô chọn vai trò chỉ hiện khi có ≥ 2 vai trò.
- **7.3:** nhập `.zip` kèm thư mục `assets/`: ảnh được kiểm tra, tải lên kho ảnh, thay bằng URL.
- **Kiểm tra:**
  - 192 unit test, `tsc`, `check:i18n:ci`, e2e đạt;
  - chạy thật 29/29 (vai trò, không dev bypass) và 11/11 (zip + MinIO);
  - đã chụp 1280 / 360 px.

### 27/11/2026 — Đợt 6: chức năng còn thiếu & sẵn sàng deploy (chưa commit) — **Đợt 6 hoàn thành**
Chi tiết từng task ("Đã làm") ở [ke-hoach.md](./ke-hoach.md).
- **6.0:**
  - dịch 238 chuỗi vi còn tiếng Anh hoặc lẫn Anh – Việt, cùng các chữ viết cứng trong TSX; thống nhất thuật ngữ phiên / nộp / bộ câu hỏi / luật;
  - bỏ `aria-label="option:N"`, thay bằng `data-order`;
  - CI mới ở gốc repo (CI cũ nằm sai chỗ nên chưa từng chạy).
- **6.1:** nhân bản quiz. Sửa lỗ hổng xoá được luật của quiz người khác.
- **6.2:** lưu trữ lớp (`Classroom.archivedAt`), 4 chỗ chặn `CLASS_ARCHIVED`.
- **6.3:** trợ giảng; siết tạo / xoá phiên và sửa tag lớp về chủ lớp; các trang giáo viên của phiên chặn theo quyền trong lớp, không theo vai trò hệ thống.
- **6.4:** câu Đúng/Sai (form + import). Sửa lỗi nhập lại file đã xuất làm câu đầu dính `# QUESTION:`, và lỗi file CRLF.
- **6.5:** ảnh trong câu hỏi.
  - upload qua server, kiểm tra magic bytes, ≤ 2 MB;
  - MinIO local đổi sang `bitnamilegacy/minio` vì image chính thức không còn kéo được;
  - ảnh được chép vào snapshot, hiện ở 6 màn.
- **6.6:** sửa tên hiển thị. Sửa lỗi chế độ dev ghi đè tên ở mọi request.
- **6.7:**
  - viết lại `DEPLOYMENT_SUPABASE.md` cho người chưa có tài khoản;
  - thêm `vercel.json` (cron), viết lại `.env.example`, cập nhật checklist;
  - sửa `/api/sessions/auto`: cron gọi GET; màn chiếu bị 401 khi có `CRON_SECRET`.
- **Migration:** `add_classroom_archived`, `add_question_image`.
- **Kiểm tra:**
  - 185 unit test, `tsc`, `check:i18n:ci`, e2e `ExamFlow` đạt;
  - chạy thật từng task trên DB local với dữ liệu tạm đã xoá: 11 + 17 + 27 + 7 + 22 + 8 phép thử, cùng phép thử `/api/sessions/auto` với `CRON_SECRET`;
  - đo 200 câu.

### 27/11/2026 — Điểm thang 10 + số câu đúng (chưa commit)
- **Lỗi:** điểm lưu theo kiểu 1 câu = 1 điểm (tối đa = số câu), nhưng trang Thống kê của sinh viên ghi cứng "/ 10". Bài 5 câu đúng hết hiện 5/10; bài 20 câu đúng hết sẽ hiện 20/10.
- **Sửa:** mọi nơi hiển thị điểm đều quy về thang 10: điểm = điểm thô / số câu được giao × 10 (5 câu → mỗi câu 2 điểm, 20 câu → 0,5 điểm). Áp dụng cho:
  - kết quả sau khi nộp và xem lại từng câu;
  - danh sách phiên, Thống kê và dashboard của sinh viên;
  - màn chiếu, trang Theo dõi, chi tiết bài làm, trang Thống kê câu hỏi (trung bình / trung vị / thấp – cao) và CSV.
- **Thêm "Đúng a/b câu"** ở trang Thống kê của sinh viên, màn kết quả, danh sách phiên, trang Theo dõi và màn chiếu.
- **Migration** `add_attempt_result_counts`: `Attempt.correctCount`, `Attempt.totalQuestions`, điền lại cho bài đã nộp. `score` vẫn là điểm thô (thống kê câu hỏi, cờ nghi vấn dùng).
- **Kiểm tra:** 154 unit test, `tsc`, `next build`; chạy thật trên phiên tạm (đúng 9/10 → 9/10, đã xoá phiên). Test e2e `ExamFlow` đã sửa theo chuỗi mới và chạy lại đạt (27/11, kiểm tra cả `grade` = 10 và "Điểm 10/10 (đúng 3/3 câu)" trên trang Theo dõi).

### 26/11/2026 — Đợt 5, Task 5.5 + 5.6: thống kê câu hỏi, test e2e, tài liệu (chưa commit) — **Đợt 5 hoàn thành**
- **Trang "Thống kê câu hỏi"** (`dashboard/sessions/[id]/stats`, mở từ màn chiếu và trang Theo dõi):
  - Điểm trung bình, trung vị, thấp nhất – cao nhất (theo %).
  - Biểu đồ phân bố điểm, có kèm dạng bảng.
  - Từng câu: tỉ lệ đúng, độ phân biệt (nhóm 27% cao trừ nhóm 27% thấp; cần ≥ 10 bài), tỉ lệ bỏ trống, lượt chọn từng phương án (đánh dấu đáp án đúng và nhiễu được chọn nhiều nhất), nhãn Khó / Dễ / Cần xem lại.
  - Sắp xếp được theo độ khó và độ phân biệt.
- **Test e2e toàn luồng thi** (`tests/e2e/ExamFlow.e2e.ts`): chạy trên server và database riêng (`bkquiz_e2e`, cổng 3300). Chạy 2 lần liên tiếp đều qua; mỗi lần khoảng 44 s.
- **Sửa cấu hình Playwright:** trước đây gọi script không tồn tại nên e2e không chạy được.
- **Tài liệu:** `api.md` mục 9, `database.md` mục 5, README phần test.
- **Kiểm tra:** 149/149 unit test qua; kiểm tra kiểu sạch; không thiếu key i18n; 2034 câu ICU parse không lỗi.
- **Còn lại:**
  - CI chưa chạy được e2e (cần thêm service Postgres vào workflow).
  - Tiêu đề "Scoreboard" trên màn chiếu chưa được dịch.
  - Các phương án trên trang làm bài có `aria-label="option:N"` ghi đè nội dung đối với trình đọc màn hình (lỗi a11y có sẵn).

### 26/11/2026 — Đợt 5, Task 5.4: gắn cờ bài làm nghi vấn (chưa commit)
- **Ghi nhận khi sinh viên làm bài:** rời tab hoặc chuyển cửa sổ (kèm thời lượng), copy / paste (không gửi nội dung), đổi thiết bị. Mã thiết bị là chuỗi ngẫu nhiên lưu trong trình duyệt. Sinh viên được thông báo trước ở phòng chờ.
- **6 cờ, chỉ để gợi ý cho giáo viên, không tự trừ điểm:**
  - rời trang nhiều lần hoặc lâu
  - nộp nhanh bất thường mà điểm cao
  - đổi thiết bị
  - một thiết bị làm bài cho nhiều tài khoản (mức cao)
  - nhập sai token ≥ 3 lần
  - dán nội dung
  
  Không dùng IP, vì cả lớp chung IP Wi-Fi trường.
- **Nơi hiển thị cờ:**
  - trang Theo dõi (cột Nghi vấn và bộ lọc)
  - chi tiết bài làm (mục "Hành vi khi làm bài", mỗi cờ có lý do bằng lời và dòng thời gian sự kiện)
  - màn chiếu (chỉ dấu ⚑)
  - file CSV bảng điểm (cột `flags`)
- **Migration** `add_attempt_events`. Cờ được tính lúc đọc nên luôn khớp dữ liệu mới nhất.
- **Kiểm tra:** 139/139 unit test qua; chạy thật 25/25 bước qua (API + Chrome thật; dữ liệu tạm đã xoá).
- **Còn lại phát hiện thêm:** tiêu đề "Scoreboard" trên màn chiếu chưa được dịch trong `vi.json`.

### 26/11/2026 — Đợt 5, Task 5.3: giám sát phiên thi + sửa `classes/preview` (chưa commit)
- **Trang mới "Theo dõi phiên thi"** (`dashboard/sessions/[id]/monitor`, mở từ nút **Theo dõi** trên màn chiếu, ở tab riêng):
  - Hiện trạng thái từng sinh viên, tự cập nhật mỗi 3 s: chưa vào phiên, chưa bắt đầu, đang làm, chờ nhập token, đang chờ vì nhập sai, bị khoá, mất kết nối, hết giờ chưa nộp, đã nộp.
  - Mỗi sinh viên có số câu đã làm, thời gian còn lại, số lần nhập token sai, tín hiệu gần nhất.
  - Thao tác trên từng sinh viên: **mở khoá**, **gia hạn riêng** (+5/+10/+15 phút, tổng tối đa 60 phút), **thu bài**.
  - Mỗi thao tác được ghi vào nhật ký checkpoint của bài làm.
- **Migration** `add_attempt_monitoring` (`Attempt.lastSeenAt`, `Attempt.extraSeconds`, 3 loại sự kiện `teacher_*`).
- **Cron** không tự đóng phiên khi còn sinh viên đang trong giờ gia hạn riêng.
- **Sửa lỗi:**
  - Attempt không tồn tại trả 404 thay vì 403.
  - `classes/preview` bắt buộc đăng nhập và không còn trả email giáo viên (chỉ tên và email đã che bớt).
- **Kiểm tra:** 122/122 unit test qua; chạy thật 28/28 bước qua (phiên tạm đã xoá); chụp màn hình ở 1280 px / 360 px / tiếng Anh, không cuộn ngang.

### 26/11/2026 — Đợt 5, Task 5.2: rate limit API (chưa commit)
- **Bảng mới `RateLimit`** (migration `add_rate_limit`): bộ đếm theo cửa sổ cố định lưu trong Postgres, logic ở `src/server/rateLimit.ts`. Lỗi DB thì cho request đi qua. Tắt bằng `RATE_LIMIT_DISABLED=1`.
- **Áp dụng cho 37 handler API**, giới hạn theo tài khoản:

| Endpoint | Giới hạn |
|---|---|
| Nhập token | 10 / phút |
| Tham gia lớp | 10 / phút (thêm 200 / phút theo IP) |
| Vào phiên thi, bắt đầu làm bài | 20 / phút |
| Lưu đáp án | 180 / phút |
| Nộp bài | 10 / phút |
| Import pool | 5 / 10 phút |
| Các thao tác ghi khác | 60 / phút |

  Không áp dụng cho các API được poll liên tục. Vượt giới hạn trả 429 kèm `Retry-After`.
- **Cron** `sessions/auto` dọn bộ đếm cũ hơn 1 ngày.
- **Màn sinh viên** hiện thông báo "Bạn thao tác quá nhanh. Thử lại sau N giây." (vi/en).
- **Kiểm tra:** 15 unit test mới (tổng 103/103 qua); build qua; chạy thật đúng như thiết kế (lần thứ 11 thì bị 429, API poll không bị chặn, chế độ tắt hoạt động).
- **Phát hiện:** `classes/preview` không cần đăng nhập nhưng trả về email giáo viên. Chưa sửa.

### 26/11/2026 — Đợt 5, Task 5.1: unit test nghiệp vụ lõi (chưa commit)
- **Tách logic thành hàm thuần**, không đổi hành vi:
  - `src/server/scoring.ts`: 3 chế độ chấm, `scoreAttempt`.
  - `src/server/submitAttempt.ts`: nộp và chấm bài, dùng lại được cho tính năng giáo viên thu bài hộ.
  - `src/server/checkpointPolicy.ts`: 3 lần sai thì chờ 30 s, 6 lần sai thì khoá 5 phút; checkpoint mỗi 240–300 s, ân hạn 5 s.
  - Các route `submit`, `verifyToken`, `state`, `join` gọi các module trên.
- **86 unit test mới** trong `src/server/*.test.ts`: chấm điểm (kể cả đề biến thể), luật khoá và checkpoint, TOTP 45 s lệch ±1 bước, thời gian làm bài và gia hạn, phân quyền (mock Prisma). `npx vitest run --project unit` chạy 88/88 test, tất cả qua.
- **Kiểm tra không đổi hành vi:**
  - So logic chấm cũ với mới trên 20 000 bài ngẫu nhiên.
  - Chấm lại 3 bài thật trong DB local: trùng điểm đã lưu.
  - Build qua; gọi thử các route đã sửa trên server thật.
- **Lỗi có sẵn phát hiện thêm:** attempt không tồn tại trả 403 thay vì 404, do so sánh `err.message` với mã lỗi. Sẽ sửa ở Task 5.3.

### 13/11/2026 — Giáo viên xem chi tiết bài làm từng sinh viên (chưa commit)
- **API** `GET api/sessions/[sessionId]/attempts/[attemptId]` (mới) — chỉ giáo viên của session. Trả thông tin sinh viên, trạng thái, điểm / điểm tối đa (= số câu được giao), các câu được giao theo thứ tự trong đề của sinh viên, từng phương án (đúng/sai, đã chọn hay chưa), điểm từng câu (từ `questionScores`, trống nếu chưa nộp), nhật ký checkpoint, chế độ chấm. Attempt cũ không có `AttemptQuestion` thì lấy toàn bộ câu của session. Attempt thuộc session khác → 404.
- **UI** trang mới `dashboard/sessions/[sessionId]/attempts/[attemptId]` (sinh viên mở sẽ bị chuyển về dashboard):
  - 4 ô tổng quan: điểm + chế độ chấm, số câu đúng hoàn toàn / chưa trả lời, thời gian làm, số lần nhập token sai.
  - Danh sách câu: ✓ chọn đúng (xanh), ✗ chọn sai (đỏ), đáp án đúng bị bỏ sót (viền xanh nét đứt), điểm từng câu; lọc Tất cả / Sai hoặc thiếu / Chưa trả lời.
  - Dòng thời gian checkpoint (lên lịch, token đúng/sai, bị khoá, token đã nhập).
  - Bài chưa nộp vẫn xem được, có dòng nhắc.
- **Màn hình giáo viên:** cột Attempt trong bảng điểm thành link **Xem bài làm** (mở tab mới).
- **i18n:** namespace mới `AttemptDetail` (49 key) + `TeacherScreen.view_attempt` (892 key/ngôn ngữ).
- **Kiểm tra:** TypeScript 0 lỗi; key en/vi khớp; 1784 message ICU parse không lỗi; ESLint các file mới sạch, `teacherScreen.tsx` không thêm lỗi. Chưa chạy thật vì database không chạy.

### 13/11/2026 — Huỷ / xoá session (chưa commit)
- **API** `DELETE api/sessions/[sessionId]` (mới) — giáo viên của session. Chỉ xoá được session `lobby` (huỷ) hoặc `ended`; session `active` trả 409 `SESSION_ACTIVE`. Điều kiện trạng thái nằm ngay trong câu lệnh xoá nên nếu cron vừa tự bắt đầu session thì không xoá nhầm. Bài làm, câu trả lời, snapshot đề và log checkpoint bị xoá theo (cascade trong schema). Trả `classroomId` để điều hướng.
- **UI** (màn hình giáo viên):
  - Phòng chờ: nút **Huỷ session** cạnh nút Bắt đầu, xác nhận bằng hộp thoại.
  - Đã kết thúc: thẻ **Vùng nguy hiểm** cuối màn hình tổng kết, ghi số bài làm sẽ mất và nhắc tải CSV trước; phải gõ đúng tên session (hoặc tên quiz) mới xoá được.
  - Xoá xong chuyển về trang chi tiết lớp.
- **Chưa làm:** nút xoá ngay trong danh sách session của trang lớp (`SessionsList.tsx`).
- **i18n:** 8 key mới trong `TeacherScreen` (843 key/ngôn ngữ).
- **Kiểm tra:** TypeScript 0 lỗi; key en/vi khớp; message ICU parse không lỗi; ESLint file API mới sạch. `teacherScreen.tsx` thêm lỗi `style/indent` ở thẻ Vùng nguy hiểm vì nằm trong khối màn hình tổng kết vốn đã thụt lề sai sẵn (giữ thống nhất với code xung quanh). Chưa chạy thật vì database không chạy.

### 13/11/2026 — Sửa chấm điểm đề biến thể + gia hạn thời gian session (chưa commit)
- **Sửa lỗi chấm điểm** (`api/attempts/[attemptId]/submit`): trước đây chấm trên toàn bộ câu của session, nên với quiz có câu biến thể (% câu dư > 0) các câu sinh viên không được giao bị tính 0 điểm và lọt vào `questionScores`. Nay chỉ chấm các câu trong `AttemptQuestion` của bài làm (attempt cũ không có `AttemptQuestion` thì giữ cách cũ). Bài đã nộp trước đó **không được chấm lại**.
- **Gia hạn thời gian**:
  - `POST api/sessions/[sessionId]/extend` (mới) — giáo viên của session, body `{ minutes }` 1–60, chỉ khi session `active` và có giới hạn thời gian. Cộng dồn vào `QuizSession.settings.extensionSeconds`, tổng tối đa 120 phút (`EXTENSION_LIMIT`). Chống ghi đè khi bấm đồng thời bằng khoá lạc quan theo `updatedAt` (`SESSION_CHANGED`).
  - `src/server/attemptTimeLimit.ts`: thêm `getEffectiveDurationSeconds`, `calculateSessionEndTime`; `calculateAttemptEndTime` và cron `api/sessions/auto` đều tính theo thời lượng đã cộng gia hạn.
  - `api/sessions/[sessionId]/status` trả thêm `durationSeconds`, `bufferMinutes`, `extensionSeconds`, `sessionEndTime`.
  - Màn hình giáo viên: nút **+5 / +10 / +15 phút** khi session đang chạy; thanh thông tin hiện "Kết thúc lúc HH:mm (+N phút)". Đồng hồ sinh viên tự cập nhật vì đã poll `state` mỗi 1,5 s.
  - Lưu ý: gia hạn áp dụng cho mọi sinh viên, kể cả bài đã hết giờ nhưng chưa nộp.
- **i18n:** 6 key mới trong `TeacherScreen` (835 key/ngôn ngữ).
- **Kiểm tra:** TypeScript 0 lỗi; key en/vi khớp; unit test pass; ESLint file mới sạch. Chưa chạy thật vì database không chạy (Docker Desktop tắt).

### 06/11/2026 — Quản lý lớp, thành viên, quiz và pool (chưa commit)
- **Lớp** (`api/classes/[classId]`): thêm `PATCH` (đổi tên) và `DELETE` (chỉ chủ lớp; trả `CLASS_HAS_ACTIVE_SESSION` nếu có session đang chạy; xoá kèm session và bài làm). `memberCount` chỉ đếm thành viên đang hoạt động.
- **Thành viên**:
  - `POST api/classes/[classId]/members` — chủ lớp thêm bằng email (người đó phải đã đăng nhập ít nhất một lần); thêm lại người đã rời / bị chặn sẽ kích hoạt lại.
  - `DELETE api/classes/[classId]/members/[userId]` (mới) — chủ lớp xoá (`left`) hoặc chặn (`?ban=1` → `banned`); thành viên tự rời bằng `members/me`. Không xoá được chủ lớp. Membership được giữ lại, không xoá hẳn.
  - `api/classes/join`: người bị chặn nhận `CLASS_BANNED`, không tự join lại được.
- **Quiz** (`api/quizzes/[quizId]`): thêm `PATCH` (đổi tên) và `DELETE` (trả `QUIZ_HAS_SESSIONS` nếu quiz đã dùng cho session — vì xoá sẽ kéo theo bài làm). `POST api/sessions` từ chối quiz `archived` (`QUIZ_ARCHIVED`).
- **Pool** (`api/pools/[poolId]`): thêm `DELETE` (chỉ chủ pool). Session cũ không ảnh hưởng vì dùng bản snapshot câu hỏi.
- **UI**:
  - Trang lớp (giáo viên): form thêm thành viên, nút Xoá / Chặn ở từng thành viên, đổi tên lớp trong tab Cài đặt, Danger Zone xoá lớp (gõ lại tên lớp).
  - Trang lớp (sinh viên): nút Rời lớp.
  - Trang quiz: đổi tên (✏️ cạnh tiêu đề), Danger Zone lưu trữ / khôi phục và xoá quiz. Modal tạo session ẩn quiz đã lưu trữ.
  - Trang pool: nút Xoá pool trong chế độ sửa (chỉ chủ pool).
- **i18n:** 51 key mới, bỏ `danger_zone_hint` không còn dùng (829 key/ngôn ngữ).
- **Kiểm tra:** TypeScript 0 lỗi; key en/vi khớp; 1658 message ICU parse không lỗi; unit test pass. Chưa chạy thật vì database không chạy. ESLint: file mới sạch; chỉ thêm lỗi `no-alert` do dùng `window.confirm` giống code cũ.

### 04/11/2026 — UI chọn chế độ chấm điểm (chưa commit)
- **API** `api/quizzes/[quizId]/settings`: `PATCH` nhận thêm `scoring` (`mode`, `partialCreditMethod`, `penaltyPerWrongOption` trong khoảng 0–1) và gộp vào `Quiz.settings.scoring`; `GET` trả `scoring` với giá trị mặc định giống logic trong `submit` (`all_or_nothing`, `edc`, `0.25`). Sửa luôn thụt lề sai sẵn trong file.
- **UI** `QuizRulesPanel.tsx` (Bước 1 - Cài đặt quiz): chọn chế độ; nếu `partial` thì chọn EDC / chia đôi, nếu `penalty` thì nhập mức trừ; có giải thích cách tính cho từng chế độ.
- **Lưu ý:** `submit` đọc cấu hình chấm tại thời điểm nộp → đổi chế độ chỉ ảnh hưởng bài nộp sau đó, bài đã nộp không được chấm lại (đã ghi chú trên UI).
- **i18n:** 16 key mới trong `Quizzes.detail` (779 key/ngôn ngữ).
- **Kiểm tra:** TypeScript 0 lỗi, key en/vi khớp; chưa chạy thật vì database không chạy.

### 04/11/2026 — Hoàn thành i18n (chưa commit)
- **Dịch các file còn sót:** `ClassHeader`, `StatsCards`, `StudentClassDetail`, `SessionsList`, `MembersList`, `QuestionsView`, `teacherScreen`, `QuizRulesPanel`, `GoogleSignInButton` (kể cả thông báo lỗi OAuth), `SignOutClient`, trang `user-profile`, `TagInput`, nút menu mobile.
- **Trang landing** (`(marketing)/page.tsx`): trước đây viết cứng tiếng Việt kể cả khi chọn tiếng Anh — nay dịch toàn bộ, gồm 5 câu FAQ.
- **Chữ sót trong các file đã dịch trước đó:** `ClassesPanel`, `TeacherClassDetail`, `QuestionBankPanel`, `StudentDashboard`, `studentAttempt`.
- **Ngày giờ:** bỏ 11 chỗ cố định `'vi-VN'`; `formatDate` trong `classes/[classId]/types.ts` nhận thêm tham số `locale`.
- **Tiêu đề trang:** dịch tiêu đề tab của các trang Classes, Chi tiết lớp, Sessions, Performance, Câu hỏi trong session.
- **Badge trạng thái** session (`lobby`/`active`/`ended`) và quiz (`draft`/`published`/`archived`) được dịch thay vì hiện giá trị thô.
- **Namespace mới:** `SessionQuestions`, `TeacherScreen`, `TagInput`, `Quizzes.detail`; bổ sung key cho `Classes`, `Classes.detail`, `Index`, `SignIn`, `UserProfile`, `DashboardLayout`, `Dashboard.student`, `Sessions`, `QuestionBank`, `Attempt`.
- **Thuật ngữ:** đổi "Chủ lớp" → **"Chủ sở hữu"** (key `Classes.detail.role_owner` và `owner_label`; bản tiếng Anh giữ "Owner").
- **Kiểm tra:** TypeScript 0 lỗi; mọi key được gọi trong code có trong cả `en` và `vi`; 1526 message parse ICU không lỗi; unit test pass; landing và đăng nhập render đúng ở cả hai ngôn ngữ khi chạy thật. ESLint không thêm lỗi mới ngoài 5 lỗi thụt lề trong `teacherScreen` (khối code vốn đã thụt lề sai sẵn).
