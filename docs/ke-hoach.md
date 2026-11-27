# 📋 Kế hoạch thực hiện — Đợt 8: Xuất / nhập Excel, giao diện bớt "trẻ con"

> Lập ngày 27/11/2026, sau khi đối chiếu BKquiz với nhu cầu thực tế của giảng viên và sinh viên: tạo đề nhanh, chống gian lận "đủ dùng", chấm tự động và xuất điểm, không mất bài, dùng tốt trên điện thoại.
> Hai lỗ hổng giảng viên gặp ngay:
> - file điểm CSV mở bằng Excel có thể lỗi dấu tiếng Việt;
> - chưa nhập được câu hỏi từ Excel / CSV.
>
> Giao diện bảng đen giữ nguyên làm nhận diện, nhưng phông viết tay đang dùng cho cả số liệu, bảng và nút bấm.

## Tiến độ

| # | Task | Migration | Trạng thái |
|---|---|---|---|
| 8.1 | Xuất điểm ra Excel đúng chuẩn + bảng điểm tổng hợp cả lớp | Không | ⏳ Chưa làm (≈ 2–3 giờ) |
| 8.2 | Nhập câu hỏi từ Excel / CSV theo file mẫu | Không | ⏳ Chưa làm (≈ 4–5 giờ) |
| 8.3 | Chỉnh phông chữ, bỏ chi tiết xoay nghiêng, khung gỗ mỏng ở điện thoại; sửa 2 lỗi nhỏ ở ngân hàng câu hỏi | Không | ✅ Xong (27/11) |

## 8.1 — Xuất điểm ra Excel đúng chuẩn

**Hiện trạng** (`GET /api/sessions/:id/report/scoreboard?format=csv`):
- File UTF-8 **không có BOM**, nên Excel trên Windows hiển thị sai tên tiếng Việt.
- Điểm dùng dấu chấm thập phân; Excel cài định dạng Việt Nam dùng dấu phẩy nên có thể đọc thành chữ hoặc ngày.
- Tên cột tiếng Anh, có cột thừa (`userId`, `attemptId`), giờ nộp dạng ISO theo UTC.
- Mới xuất được **từng phiên**; giảng viên muốn một bảng điểm cả lớp để nhập vào hệ thống của trường.

**Việc cần làm:**
- **Xuất `.xlsx`** cho bảng điểm của phiên. Ô điểm là số thật (định dạng `0.00`), nên Excel nào cũng đọc đúng, không phụ thuộc dấu thập phân.
  - Cột tiếng Việt / tiếng Anh theo ngôn ngữ đang dùng: STT, Họ tên, Email, Trạng thái, Điểm (/10), Số câu đúng, Tổng số câu, Giờ nộp (giờ Việt Nam), Cờ nghi vấn (lý do dạng chữ, không phải mã).
  - Dòng đầu ghi tên lớp, tên phiên, ngày thi.
  - Thư viện: `exceljs` (ghi được định dạng ô), hoặc tự sinh bằng `jszip` đã có sẵn nếu muốn tránh thêm phụ thuộc.
- **Giữ CSV** cho người cần, nhưng thêm BOM, đổi tên cột như trên, giờ theo `Asia/Ho_Chi_Minh`.
- **Bảng điểm tổng hợp cả lớp** (API mới, ví dụ `GET /api/classes/:classId/gradebook?format=xlsx`): mỗi sinh viên một dòng, mỗi phiên đã kết thúc một cột điểm, thêm cột điểm trung bình. Chỉ chủ lớp xem được (`requireClassroomOwnership`).
- **Giao diện:** nút "Xuất Excel" ở màn chiếu / trang Thống kê của phiên và ở trang lớp (tab Phiên).
- **Test:** unit test cho hàm dựng bảng (tên cột, sắp xếp, ô trống khi chưa nộp, giờ Việt Nam); chạy thật: mở file bằng Excel / LibreOffice, kiểm tra tiếng Việt và cột điểm là số.

## 8.2 — Nhập câu hỏi từ Excel / CSV

**Hiện trạng:** chỉ nhận Markdown (`# QUESTION:` …) hoặc `.zip`. Giảng viên phải học cú pháp, trong khi họ thường có sẵn câu hỏi trong Excel / Word.

**Việc cần làm:**
- **File mẫu** tải được từ hộp thoại nhập (`.xlsx` và `.csv`), một câu một dòng:

  | Câu hỏi | A | B | C | D | E | F | Đáp án đúng | Tag | Ảnh |
  |---|---|---|---|---|---|---|---|---|---|
  | 1 + 1 = ? | 1 | 2 | 3 | 4 | | | B | chương 1, dễ | |
  | Chọn số chẵn | 1 | 2 | 3 | 4 | | | B, D | chương 1 | |

  - "Đáp án đúng" một chữ cái → câu một đáp án; nhiều chữ cái → câu nhiều đáp án. Câu Đúng/Sai: A = Đúng, B = Sai.
  - Tag phân cách bằng dấu phẩy; ảnh là URL (giống dòng ảnh của Markdown).
- **Parser** `src/server/import/tablePool.ts`: đọc `.xlsx` (sheet đầu) và `.csv` (có / không BOM, dấu phẩy hoặc chấm phẩy), nhận tên cột tiếng Việt hoặc tiếng Anh. Kết quả cùng kiểu với `parsePoolMarkdown`, để dùng lại luồng lưu câu hỏi, tag và kiểm tra ảnh hiện có.
- **Báo lỗi theo dòng:** "Dòng 7: thiếu đáp án đúng", "Dòng 12: đáp án E nhưng cột E trống". Dòng lỗi bị bỏ qua, các dòng khác vẫn nhập (giống `skippedQuestions` hiện nay).
- **`POST /api/pools/import`** nhận thêm `.xlsx` / `.csv`; ô chọn file ở `QuestionBankPanel.tsx` đổi thành `accept=".md,.zip,.xlsx,.csv"`.
- **Copy từ Word:** không làm parser `.docx` riêng. Hướng dẫn trong hộp thoại: dán bảng từ Word vào file mẫu Excel.
- **Tài liệu:** `docs/import.md` thêm mục định dạng bảng.
- **Test:** unit test parser (tên cột vi / en, CSV chấm phẩy, BOM, nhiều đáp án, Đúng/Sai, dòng lỗi, ô có xuống dòng); chạy thật: nhập file mẫu rồi xem ở ngân hàng câu hỏi.

## 8.3 — Giao diện bớt "trẻ con" (✅ 27/11/2026)

Giữ nhận diện bảng đen (màu, khung gỗ, nền phấn), chỉ đổi cách dùng phông và bỏ chi tiết trang trí:
- **Inter** cho chữ thường, nút, nhãn, tag, bảng, ô nhập, menu và mọi con số (dùng số đều độ rộng — `tabular-nums`).
- **Patrick Hand** (phấn) chỉ cho tiêu đề trang, tiêu đề hộp thoại và tiêu đề trong màn làm bài.
- **Dancing Script** chỉ cho logo BKquiz.
- **Màn làm bài:** câu hỏi và phương án chuyển sang Inter (trước đây là Dancing Script, khó đọc dấu tiếng Việt); bỏ xoay nghiêng ở phương án, chữ cái được chọn, ô điều hướng câu hỏi và đồng hồ; đồng hồ dùng số đều độ rộng.
- **Bỏ xoay nghiêng khi rê chuột** ở nút, thẻ và mục đang chọn trên sidebar.
- **Khung gỗ mỏng lại ở điện thoại** (dưới 768 px) để nhường chỗ cho nội dung.
- **Sửa 2 lỗi nhỏ** ở trang chi tiết bộ câu hỏi: dòng "Cập nhật:" để trống, nhãn `private` / `edit` chưa dịch.

---

# 📋 Kế hoạch thực hiện — Đợt 7: Gỡ trợ giảng, giáo viên do quản trị viên duyệt, nhập .zip kèm ảnh

> Lập và làm ngày 27/11/2026, sau Đợt 6. Xuất phát từ 3 vấn đề còn lại của Đợt 6:
> - ai cũng tự chuyển sang vai trò giáo viên được;
> - màn chiếu hiện nút Huỷ / Xoá phiên cho TA;
> - nhập `.zip` kèm ảnh chưa làm.
>
> Thêm yêu cầu: **bỏ toàn bộ chức năng trợ giảng**. Không phân định giáo viên theo đuôi email, vì giáo viên có thể ở trường khác hoặc là giáo viên cấp 3.

**Đã chốt:**
- Lần đăng nhập đầu, người dùng **chọn vai trò**. Sinh viên dùng ngay. Giáo viên gửi yêu cầu (trường / đơn vị, ghi chú) và chờ **quản trị viên** (`ADMIN_EMAILS`) duyệt.
- Không ai tự cấp quyền được.
- "Nút thừa": nút Huỷ / Xoá phiên với TA, và ô chọn vai trò với người chỉ có 1 vai trò.

## Tiến độ

| # | Task | Migration | Trạng thái |
|---|---|---|---|
| 7.0 | Gỡ vai trò trợ giảng (TA) | `remove_classroom_ta_role` | ✅ Xong (27/11) |
| 7.1 | Chọn vai trò lần đầu + quản trị viên duyệt giáo viên | `add_teacher_requests` | ✅ Xong (27/11) — chạy thật 29/29 (không dev bypass) |
| 7.2 | Ẩn nút thừa | Không | ✅ Xong (27/11) |
| 7.3 | Nhập `.zip` kèm thư mục ảnh | Không | ✅ Xong (27/11) — chạy thật với MinIO 11/11 |

## 7.0 — Gỡ trợ giảng
- **Migration** `20261127160000_remove_classroom_ta_role`: chuyển thành viên `ta` (nếu có) về `student`, rồi tạo lại enum `ClassroomRole` = `student, teacher` (Postgres không xoá được một giá trị enum). DB `bkquiz` không có thành viên TA nào.
- `authz.ts`: `requireTeacherInClassroom` và `requireSessionAccess` chỉ còn nhận `teacher`. Giữ `requireSessionOwner` và `canTeachSession` (chủ lớp / chủ quiz).
- Xoá `PATCH /api/classes/[classId]/members/[userId]` (giờ trả 405).
- Bỏ nút Gán / Bỏ trợ giảng, các nhánh `ta`, kiểu `'ta'` và 6 key i18n.
- `authz.test.ts` viết lại phần TA: chủ lớp / giáo viên khác / chủ quiz / sinh viên / thành viên đã rời.
- **Nút Huỷ / Xoá phiên với TA tự hết**, vì không còn ai ngoài chủ lớp và chủ quiz vào được màn chiếu.

## 7.1 — Chọn vai trò + quản trị viên duyệt
- **Migration** `20261127170000_add_teacher_requests`:
  - thêm `User.onboardedAt` (điền cho mọi user có sẵn);
  - enum `TeacherRequestStatus` và bảng `TeacherRequest` (mỗi người 1 yêu cầu).
- **Server:**
  - `src/server/admin.ts`: `parseAdminEmails`, `isAdminEmail`, `requireAdmin`; 2 unit test.
  - `src/server/teacherRequest.ts`: schema `OnboardingInput`, `TeacherRequestInput`.
  - `POST /api/user/switch-role`: **không còn tự cấp vai trò**, vai trò chưa có → `403 ROLE_NOT_GRANTED`. Chế độ dev giữ nguyên.
  - API mới: `POST /api/user/onboarding`, `GET|POST /api/user/teacher-request`, `GET /api/admin/teacher-requests`, `POST /api/admin/teacher-requests/[id]`, `GET /api/admin/teachers`, `DELETE /api/admin/teachers/[userId]`.
  - User dev được đánh dấu đã chọn vai trò ngay khi tạo.
- **Giao diện:**
  - Trang `/onboarding` dùng khung bảng nhỏ của trang đăng nhập; `proxy` bảo vệ đường dẫn này.
  - Dashboard chuyển hướng sang `/onboarding` khi `onboardedAt` trống.
  - Trang **Quản trị** (`/dashboard/admin`): tab Chờ duyệt / Đã xử lý / Giáo viên; từ chối kèm lý do (Modal); thu hồi có xác nhận.
  - Sidebar có link "Quản trị (n)", chỉ quản trị viên thấy.
  - Dashboard sinh viên có ghi chú "đang chờ duyệt / chưa được duyệt".
  - Trang Hồ sơ có khối "Đăng ký làm giáo viên" (trạng thái, lý do từ chối, gửi lại).
- **Sửa thêm (lỗi có sẵn):** 6 route gọi `requireTeacher` / `requireStudent` ngoài khối `try`, nên sai vai trò thành 500 thay vì 403:
  - `POST /api/classes`, `/api/pools`, `/api/quizzes`, `/api/quizzes/:id/preview`, `/api/pools/import`, `/api/students/performance`.
  - Thêm helper `checkAuthz` trong `authzHelpers.ts`.
- **Chạy thật (29/29 đạt)** trên server **không** có dev bypass (cổng 3209). Dùng 2 user tạm và phiên đăng nhập Auth.js tạo bằng SQL; đã xoá sau khi chạy.
  - User mới bị chuyển sang `/onboarding`.
  - `switch-role` tự cấp → 403.
  - Form chọn giáo viên → chờ duyệt; vẫn không tạo được lớp (403); người không phải admin → 403 / chuyển hướng.
  - Admin từ chối kèm lý do → Hồ sơ hiện lý do → gửi lại → duyệt → tạo được lớp. Duyệt lần 2 → 409.
  - Người có 1 vai trò không thấy ô chọn vai trò; có 2 vai trò thì thấy.
  - Thu hồi → không tạo lớp được nhưng vẫn giữ lớp cũ. Admin không tự thu hồi được.
  - `PATCH` gán TA → 405; enum chỉ còn `{student, teacher}`.

## 7.2 — Ẩn nút thừa
- Ô chọn vai trò chỉ hiện khi tài khoản có ≥ 2 vai trò (chế độ dev luôn hiện); lựa chọn lấy từ vai trò thật của tài khoản.
- Nút Huỷ / Xoá phiên với TA: hết cùng 7.0.

## 7.3 — Nhập `.zip` kèm ảnh
- `src/utils/questionImage.ts`: tách `parseImageLineRaw`; `parseImageLine` giữ nguyên hành vi.
- `src/server/import/zipAssets.ts`:
  - `normalizeAssetPath` chặn URL, đường dẫn tuyệt đối, `..`;
  - `collectAssetRefs`, `rewriteAssetRefs`, `questionsMdPath`;
  - `uploadZipAssets`: tìm ảnh theo thư mục chứa `questions.md`, kiểm tra magic bytes và ≤ 2 MB, tối đa 100 ảnh, lỗi kho ảnh thành cảnh báo.
  - 7 unit test, dùng JSZip tạo zip trong bộ nhớ.
- `POST /api/pools/import`: với file zip thì tải ảnh lên rồi mới parse. Response thêm `uploadedImages` và `assetWarnings`.
- Trang Ngân hàng câu hỏi: toast "Đã nhập N câu hỏi, M ảnh"; cảnh báo đã dịch (trước là chuỗi viết cứng "Imported with warnings").
- **Chạy thật với MinIO (11/11 đạt):**
  - zip 4 câu: 2 ảnh hợp lệ (có `./` và `%20`), 1 GIF, 1 file thiếu;
  - 2 ảnh lên MinIO và đọc công khai được;
  - 2 cảnh báo; câu GIF / thiếu ảnh vẫn nhập và giữ dòng ảnh trong đề;
  - ảnh hiện ở ngân hàng câu hỏi.

## Kiểm tra Đợt 7
- 192 unit test, `check:types`, `check:i18n:ci` đạt.
- E2E `ExamFlow` đạt (43,6 s). Đã sửa kiểm tra tên đọc được của ô chọn: thứ tự câu được xáo nên không giả định câu đầu là "1 + 1".
- Chụp 1280 px và 360 px: trang chọn vai trò, Quản trị (Chờ duyệt / Giáo viên), Hồ sơ (bị từ chối / chờ duyệt), dashboard chờ duyệt, tab Thành viên sau khi gỡ TA.
- **Lưu ý khi chạy local:** `.env.local` đã thêm `ADMIN_EMAILS=dev.teacher@bkquiz.local`.

---

# 📋 Kế hoạch thực hiện — Đợt 6: Hoàn thiện chức năng còn thiếu & sẵn sàng deploy

> Lập ngày: 26/11/2026, sau khi xong Đợt 5. Dựa trên mục 2–3 của [trang-thai-du-an-hien-tai.md](./trang-thai-du-an-hien-tai.md), các mục "Còn lại" của Đợt 5 và việc đọc lại code (`schema.prisma`, `authz.ts`, `quizSnapshot.ts`, `user-profile`, `.env`, `DEPLOYMENT_SUPABASE.md`).
> Đợt 5 và Đợt 4 (bên dưới) giữ làm lịch sử.

**Đã chốt (26/11/2026):**
- Ưu tiên **thêm các chức năng còn thiếu**.
- Chưa có tài khoản Vercel / Supabase, nên đợt này có thêm **hướng dẫn deploy staging**.

## Tiến độ

| # | Task | Migration | Ước lượng | Trạng thái |
|---|---|---|---|---|
| 6.0 | Dọn nợ nhỏ (dịch "Scoreboard", a11y phương án, e2e trên CI) | Không | 2 giờ | ✅ Xong (27/11) — e2e local qua; CI chạy khi push |
| 6.1 | Nhân bản quiz | Không | 2 giờ | ✅ Xong (27/11) — chạy thật 11/11 |
| 6.2 | Lưu trữ (archive) lớp | `add_classroom_archived` | 3 giờ | ✅ Xong (27/11) — chạy thật 17/17 |
| 6.3 | Vai trò trợ giảng (TA) | Không | 3–4 giờ | ❌ Đã gỡ bỏ ở Đợt 7 (theo yêu cầu) |
| 6.4 | Câu Đúng/Sai | Không | 2 giờ | ✅ Xong (27/11) — chạy thật 7/7 |
| 6.5 | Ảnh trong câu hỏi | `add_question_image` | 8–10 giờ | ✅ Xong (27/11) — chạy thật với MinIO 22/22 |
| 6.6 | Sửa hồ sơ (tên hiển thị) | Không | 1–2 giờ | ✅ Xong (27/11) — chạy thật 8/8 |
| 6.7 | Hướng dẫn deploy staging (Vercel + Supabase + Google OAuth) | Không | 2–3 giờ | ✅ Xong (27/11) — còn chạy thật trên Vercel (cần tài khoản của bạn) |
| | **Tổng** | **2 migration** | **23–28 giờ** | |

**Thứ tự:** các việc nhỏ mà giáo viên dùng được ngay làm trước (6.0–6.4, 6.6), việc lớn (6.5) làm sau, deploy (6.7) làm cuối. Lý do để deploy cuối: hướng dẫn deploy phải có đủ mọi migration và biến môi trường của các task trước.

## Phạm vi

**Để sau:**
- Đăng nhập khác Google (email/mật khẩu, Microsoft).
- Câu điền ngắn (cần chấm tự luận / so khớp chuỗi, thay đổi lớn).
- Sinh câu hỏi bằng AI.
- Danh sách người bị chặn để bỏ chặn (hiện bỏ chặn bằng cách thêm lại qua email).
- Nút xoá phiên trong `SessionsList` (đã xoá được từ màn chiếu).
- Tài liệu hướng dẫn người dùng cho giáo viên / sinh viên.

### Phát hiện khi đọc code (ảnh hưởng thiết kế)
- **Quiz không gắn với lớp**, chỉ phiên mới gắn với lớp. `Quiz` gồm `settings` (JSON), `rules` (`QuizRule`: `tagId`, `count`, `commonCount`, `variantCount`, `extraPercent`, `filters`) và `tags`. Vì vậy "dùng lại quiz cho lớp khác / học kỳ sau" chỉ cần **nhân bản quiz**; tạo phiên vốn đã cho chọn lớp.
- **`Classroom` chưa có cột trạng thái** → archive cần migration.
- **Enum `ClassroomRole` đã có `ta`.**
  - `requireTeacherInClassroom` nhận cả `teacher` lẫn `ta`.
  - `requireSessionAccess` coi `ta` là giáo viên của phiên, nên TA đã vào được màn chiếu, Theo dõi, Thống kê và các thao tác mở khoá / gia hạn / thu bài.
  - Còn thiếu: API/giao diện gán vai trò, và rà lại các chỗ chỉ dành cho chủ lớp (`requireClassroomOwnership`).
- **Thêm một `QuestionType` mới sẽ phải sửa 13 file** (chấm điểm, snapshot, import/export, trang làm bài, chi tiết bài làm, thống kê…). Câu Đúng/Sai bản chất là `mcq_single` có 2 phương án, nên làm bằng **mẫu soạn câu**, không thêm loại câu.
- **Chưa có dòng code nào dùng S3** (không có `@aws-sdk`, không có API upload), dù `.env` và `docker-compose.yml` đã có MinIO + bucket `bkquiz-media`. Ảnh trong câu hỏi phải làm từ đầu: lưu trữ, upload, migration, hiển thị ở 6 màn, import/export.
- **Snapshot câu hỏi của phiên** (`SessionQuestionSnapshot`) chép `prompt` và `type` lúc tạo phiên → ảnh cũng phải được chép vào snapshot. Nếu không, sửa ảnh trong ngân hàng sẽ làm đổi đề của phiên đã thi.
- **Chưa có `vercel.json`** → chưa có cron gọi `/api/sessions/auto` (tự bắt đầu / kết thúc phiên, dọn bộ đếm rate limit).
  - Gói Hobby của Vercel chỉ cho cron chạy 1 lần / ngày.
  - Khi màn chiếu đang mở, nó đã tự gọi `auto`; cần ghi rõ điều này trong hướng dẫn.
- **`DEPLOYMENT_SUPABASE.md` có từ trước Đợt 5:**
  - thiếu 3 migration mới;
  - thiếu `RATE_LIMIT_DISABLED`;
  - thiếu cảnh báo **không được đặt `DEV_BYPASS_AUTH`** trên production;
  - thiếu Google OAuth production.
- **Nợ còn lại từ Đợt 5:**
  - `vi.json` vẫn để "Scoreboard".
  - Phương án trên trang làm bài có `aria-label="option:N"` nên trình đọc màn hình đọc "option:1" thay vì nội dung.
  - CI dùng script boilerplate không tồn tại nên không chạy được e2e.

---

## Task 6.0 — Dọn nợ nhỏ
- `vi.json`: dịch `TeacherScreen.scoreboard` (và rà các key tiếng Anh còn sót trong `TeacherScreen`).
- `studentAttempt.tsx`:
  - Đổi `aria-label` của `<label>` phương án thành `t('option_label', { letter })`, ví dụ "Phương án A". Nội dung phương án vẫn được đọc vì nằm trong label.
  - Thêm `data-order={o.order}` để test vẫn chọn được đúng phương án gốc.
  - Giao diện không đổi.
- `tests/e2e/ExamFlow.e2e.ts`: đổi selector `label[aria-label="option:N"]` → `label[data-order="N"]`.
- `.github/workflows/CI.yml`: job e2e có service `postgres:16` (cổng 5433, user/db `bkquiz`), env `E2E_DATABASE_URL`, chạy `npm run test:e2e:exam`. Bỏ các bước gọi `build-local` / `db-server:memory`.
- **Xong khi:** e2e local vẫn qua; trình đọc màn hình đọc được "Phương án A, 21"; workflow CI hợp lệ (`act` hoặc chạy thử trên nhánh).

### ✅ Đã làm (27/11/2026)
- **Dịch `vi.json`:** không chỉ "Scoreboard" mà toàn bộ 238 chuỗi còn tiếng Anh hoặc lẫn Anh – Việt, thống nhất thuật ngữ:
  - session → phiên, join → tham gia / vào, submit → nộp, import / export → nhập / xuất, pool → bộ câu hỏi, rule → luật, lobby → phòng chờ, attempt → bài làm;
  - giữ nguyên: quiz, tag, token, QR, Markdown, checkpoint, Email;
  - nút "Verify" → "Xác nhận"; 4 câu dùng `{n, plural, other {…}}` cho khớp cấu trúc với bản en.
  - Chỗ placeholder / thẻ HTML của mỗi chuỗi được so khớp tự động trước khi ghi.
- **A11y phương án:** bỏ hẳn `aria-label="option:N"`, thay vì đổi thành "Phương án A". Ô chọn nằm trong `<label>` nên tên đọc được lấy từ nội dung label ("B 2" = chữ cái + nội dung); một `aria-label` riêng sẽ làm mất phần nội dung. Thêm `data-order` cho test; giao diện không đổi.
- **E2E:** selector `label[data-order="N"]`, nút "Xác nhận", thêm kiểm tra tên đọc được của ô chọn (`toHaveAccessibleName`). Chạy lại đạt (45 s).
- **CI:**
  - Phát hiện: các workflow cũ nằm ở `bkquiz-web/.github/workflows/`, nhưng gốc repo git là `bkquiz/`. GitHub chỉ đọc `.github/` ở gốc, nên **CI chưa từng chạy**.
  - Thêm `.github/workflows/ci.yml` ở gốc repo, 2 job:
    - `checks`: `check:types`, `check:i18n:ci`, unit test.
    - `e2e`: service `postgres:16` (cổng 5433), `npm run test:e2e:exam -- --project=chromium`, tải `test-results` khi lỗi.
  - Script mới `check:i18n:ci`: bỏ `fr.json` (thừa từ boilerplate, app chỉ có en / vi) và bỏ kiểm tra key không dùng (khoảng 1000 key cũ, chưa dọn). Script `check:i18n` gốc vẫn báo đủ.
  - Chưa thêm `npm run lint` vào CI: các file cũ còn lỗi ESLint (ví dụ `api/sessions/route.ts` có 57 lỗi thụt lề từ trước).
  - Các bước trong workflow đã chạy thử trên máy và đều đạt. Workflow thật chạy khi push lên GitHub.

## Task 6.1 — Nhân bản quiz
- **API** `POST /api/quizzes/[quizId]/duplicate`:
  - Chỉ chủ quiz (`requireQuizOwnership`); rate limit `write`.
  - Trong một transaction, tạo quiz mới gồm:
    - `title`: "<tên> (bản sao)"
    - `status`: `draft`
    - `settings`: chép từ quiz gốc
    - `rules`: chép (`tagId`, `count`, `commonCount`, `variantCount`, `extraPercent`, `filters`)
    - `QuizTag`: chép
  - Trả `{ id }`.
- **Giao diện:** nút **Nhân bản** ở mỗi quiz trong `QuizzesPanel` và ở trang chi tiết quiz. Xong thì chuyển tới quiz mới, kèm toast.
- **i18n** vi/en.
- **Test:** unit test hàm chép (tách thành `buildQuizCopy` thuần). Chạy thật: nhân bản quiz-1 → luật và chế độ chấm giống hệt; tạo phiên từ bản sao được.
- **Xong khi:** bản sao là bản nháp độc lập; sửa luật của bản sao không ảnh hưởng quiz gốc.

### ✅ Đã làm (27/11/2026)
- `src/server/quizCopy.ts`: hàm thuần `buildQuizCopy`, 3 unit test.
  - Chép `settings`, luật chọn câu (kể cả `filters` / bộ câu hỏi đã chọn) và tag.
  - Trạng thái `draft`; tiêu đề cắt về tối đa 200 ký tự.
- API `POST /api/quizzes/[quizId]/duplicate`:
  - Chỉ chủ quiz; rate limit `write`; trả 201 `{ quiz }`.
  - Client gửi tiêu đề đã dịch: "<tên> (bản sao)" / "(copy)".
- Nút **Nhân bản** ở danh sách quiz và trang chi tiết quiz; xong thì chuyển tới bản sao.
- **Sửa thêm:**
  - Danh sách quiz: hàng quiz xếp dọc trên điện thoại (trước bị vỡ ở 360 px); trạng thái hiện bằng chữ đã dịch thay vì `draft` / `published`.
  - Đầu trang chi tiết quiz xuống dòng được ở màn hẹp.
  - **Lỗ hổng phân quyền:** `DELETE /api/quizzes/[quizId]/rules?ruleId=` chỉ kiểm tra quyền trên `quizId` rồi xoá `ruleId` bất kỳ → giáo viên xoá được luật trong quiz của người khác. Nay xoá theo `{ id: ruleId, quizId }`, không khớp thì 404 `RULE_NOT_FOUND`.
- **Chạy thật (11/11 đạt):**
  - sinh viên → 403;
  - bản sao là nháp, luật / cài đặt (so cột `settings`) / tag giống hệt;
  - xoá luật của bản sao không đụng quiz gốc;
  - xoá luật của quiz khác qua quiz mình → 404;
  - tạo phiên được từ bản sao;
  - dọn sạch bản sao.

## Task 6.2 — Lưu trữ lớp
- **Migration** `add_classroom_archived`: thêm `Classroom.archivedAt DateTime?`.
- **API** `PATCH /api/classes/[classId]` nhận thêm `{ archived: boolean }`, chỉ chủ lớp.
- **Chặn khi lớp đã lưu trữ:**
  - tạo phiên (`POST /api/sessions` → `CLASS_ARCHIVED`)
  - tham gia bằng mã / xem trước lớp (`classes/join`, `classes/preview` → `CLASS_ARCHIVED`)
  - thêm thành viên
- **Vẫn làm được:** xem lớp, bảng điểm, chi tiết bài làm, thống kê; bỏ lưu trữ.
- **Giao diện:**
  - `ClassesPanel`: lớp đã lưu trữ nằm trong mục thu gọn "Đã lưu trữ (N)", có tag `neutral`.
  - Trang lớp: nút **Lưu trữ / Bỏ lưu trữ** cạnh Vùng nguy hiểm, có xác nhận bằng `Modal`.
  - Sinh viên vẫn thấy lớp nhưng có ghi chú "Lớp đã kết thúc".
- **Xong khi:** lớp đã lưu trữ không tạo được phiên và sinh viên không tham gia được; bỏ lưu trữ thì mọi thứ trở lại bình thường.

### ✅ Đã làm (27/11/2026)
- **Migration** `20261127120000_add_classroom_archived` (`Classroom.archivedAt`), đã chạy trên DB `bkquiz`.
- **API:**
  - `PATCH /api/classes/[classId]` nhận `{ name?, archived? }` (ít nhất một). Không lưu trữ được khi lớp đang có phiên chạy (409 `CLASS_HAS_ACTIVE_SESSION`, giống xoá lớp).
  - `GET` lớp và danh sách lớp trả `archivedAt`.
  - Trả 409 `CLASS_ARCHIVED` ở: tạo phiên, `classes/join`, `classes/preview`, thêm thành viên.
- **Giao diện:**
  - Danh sách lớp: nhóm thu gọn "Đã lưu trữ (N)" (`<details>`), tag "Đã lưu trữ". Tag vai trò đã dịch (trước ghi cứng Owner / TA / Student).
  - Trang lớp: tag + ghi chú vàng dưới tiêu đề (giáo viên: cách bỏ lưu trữ; sinh viên: "Lớp đã kết thúc"); ẩn nút tạo phiên.
  - Tab Cài đặt: khối Lưu trữ / Bỏ lưu trữ đặt trên Vùng nguy hiểm; lưu trữ cần xác nhận bằng `Modal`.
  - Thông báo lỗi khi tham gia lớp đã lưu trữ.
- **Sửa thêm:**
  - Chữ tiếng Anh viết cứng trong TSX: "Dashboard / Classes / Teacher / Join" ở trang lớp, breadcrumb trang câu hỏi của phiên, link "Dashboard" ở trang chủ.
  - Đầu trang lớp xuống dòng được ở 360 px (trước tên lớp bị cắt còn "Lớ…").
- **Chạy thật (17/17 đạt)** trên lớp tạm, đã xoá sau khi chạy:
  - chặn lưu trữ khi có phiên chạy; sinh viên → 403;
  - 4 chỗ trả `CLASS_ARCHIVED`;
  - vẫn xem được bảng điểm / thống kê; đổi tên giữ trạng thái lưu trữ;
  - bỏ lưu trữ thì tạo phiên và tham gia lại được.
- Đã chụp 1280 px và 360 px: danh sách lớp, trang lớp, tab Cài đặt, hộp xác nhận, góc nhìn sinh viên.

## Task 6.3 — Vai trò trợ giảng (TA)

> **Đã gỡ bỏ ở Đợt 7 (27/11/2026)** theo yêu cầu: lớp chỉ còn chủ lớp và sinh viên. Nội dung dưới đây giữ làm lịch sử.

- **API** `PATCH /api/classes/[classId]/members/[userId]` nhận `{ roleInClass: 'ta' | 'student' }`:
  - Chỉ chủ lớp được gọi.
  - Không đổi được vai trò của chủ lớp.
  - Thành viên phải đang `active`.
- **Bảng quyền** (rà và ghi vào `docs/security.md`):

| Việc | Chủ lớp | TA | Sinh viên |
|---|---|---|---|
| Xem màn chiếu, Theo dõi, Thống kê, chi tiết bài làm | ✓ | ✓ | ✗ |
| Mở khoá / gia hạn riêng / thu bài | ✓ | ✓ | ✗ |
| Bắt đầu / kết thúc / gia hạn chung phiên | ✓ | ✓ | ✗ |
| Tạo / xoá phiên | ✓ | ✗ | ✗ |
| Thêm / xoá / chặn thành viên, gán TA | ✓ | ✗ | ✗ |
| Đổi tên / lưu trữ / xoá lớp | ✓ | ✗ | ✗ |

- Rà các route tạo / xoá phiên và quản lý thành viên: những việc chỉ chủ lớp được làm phải dùng `requireClassroomOwnership`, không dùng `requireTeacherInClassroom`.
- **Giao diện:**
  - `MembersList`: tag vai trò (TA: `info`); nút **Gán TA / Bỏ TA** (chỉ chủ lớp thấy).
  - `ClassesPanel` / dashboard: lớp mà người dùng là TA hiện cùng nhóm lớp đang dạy, kèm tag "Trợ giảng".
- **Test:** thêm vào `authz.test.ts` (TA được vào phiên với quyền giáo viên; TA bị chặn ở các việc chỉ chủ lớp làm). E2E hoặc script chạy thật: gán TA cho tài khoản dev sinh viên → mở được trang Theo dõi.
- **Xong khi:** đúng bảng quyền trên, có test.

### ✅ Đã làm (27/11/2026)
- **API** `PATCH /api/classes/[classId]/members/[userId]` `{ roleInClass: 'ta' | 'student' }`:
  - chỉ chủ lớp, rate limit `write`;
  - đổi vai trò chủ lớp → 400 `CANNOT_CHANGE_OWNER`;
  - thành viên không `active` / không tồn tại → 404.
- **Siết quyền theo bảng** (bảng đã ghi ở `docs/security.md` mục 3.1b). Trước đây TA làm được 3 việc dành cho chủ lớp:
  - tạo phiên: `requireTeacherInClassroom` → `requireClassroomOwnership`;
  - huỷ / xoá phiên: `requireSessionAccess` → `requireSessionOwner` (mới);
  - sửa tag lớp: → `requireClassroomOwnership`.
- **Trang theo quyền trong lớp, không theo vai trò hệ thống.** TA thường là tài khoản sinh viên, nhưng các trang Theo dõi, Thống kê, chi tiết bài làm, câu hỏi của phiên trước đây chặn theo `getUserRole === 'teacher'`.
  - Nay dùng `canTeachSession` (mới, trong `authz.ts`).
  - Trang màn chiếu trước không chặn gì, nay cũng dùng `canTeachSession`.
  - Trang lớp chọn giao diện giáo viên / sinh viên theo `roleInClass` (chủ lớp và TA → giáo viên).
- **Giao diện:**
  - Tab Thành viên: nút **Gán trợ giảng / Bỏ trợ giảng** (chỉ chủ lớp thấy), kèm toast; hàng thành viên xếp dọc trên điện thoại.
  - Với TA: tag "Trợ giảng" ở breadcrumb; không có tab Cài đặt, không có nút tạo phiên.
- **Test:** 3 unit test mới trong `authz.test.ts` (`requireSessionOwner`, `canTeachSession`, TA không phải chủ lớp).
- **Chạy thật (27/27 đạt)** trên lớp tạm, dev sinh viên làm TA:
  - trước khi gán: 403 và trang Theo dõi chuyển hướng về dashboard;
  - TA vào được monitor / bảng điểm / thống kê / token / trang Theo dõi, Thống kê, màn chiếu, trang lớp; bắt đầu, gia hạn, kết thúc phiên được;
  - TA bị từ chối: tạo phiên, thêm thành viên, lưu trữ / đổi tên lớp, sửa tag, xoá phiên;
  - bỏ TA → mất quyền ngay.
- **Còn lại:** màn chiếu vẫn hiện nút Huỷ / Xoá phiên cho TA. Server từ chối (403) nhưng nút chưa được ẩn.

## Task 6.4 — Câu Đúng/Sai
- **Form soạn câu** (`QuestionPoolDetail`): thêm lựa chọn **Đúng/Sai** bên cạnh "Một đáp án" / "Nhiều đáp án".
  - Tự tạo 2 phương án "Đúng" / "Sai" (theo ngôn ngữ giao diện), chọn đáp án bằng 2 nút.
  - Lưu dưới dạng `mcq_single`.
  - Không thêm `QuestionType` (xem phần Phát hiện).
- **Import Markdown** (`src/server/import/markdownPool.ts`): cú pháp rút gọn `Đáp án: Đúng` / `Answer: True` cho câu không liệt kê phương án → tạo 2 phương án. Cập nhật `docs/import.md` và thêm ví dụ vào `docs/cau-hoi-mau.md`.
- **Không đổi** chấm điểm, snapshot, thống kê.
- **Test:** unit test cho parser import (2 cú pháp vi/en, câu thiếu đáp án báo lỗi).
- **Xong khi:** tạo được câu Đúng/Sai bằng form và bằng import; làm bài và chấm như câu một đáp án.

### ✅ Đã làm (27/11/2026)
- `src/utils/trueFalse.ts` (dùng chung cho form và import):
  - `trueFalseOptions`: 2 phương án, "Đúng" đứng trước.
  - `parseTrueFalseAnswer`: nhận `Đúng` / `Sai` / `True` / `False`, có thể kèm `Đáp án:` / `Answer:`, không phân biệt hoa thường.
- **Form soạn câu:**
  - Ô "Loại câu" có 3 lựa chọn đã dịch: Một đáp án / Nhiều đáp án / Đúng / Sai (trước hiện `mcq_single` / `mcq_multi`).
  - Chọn Đúng / Sai thì ẩn ô phương án, thay bằng 2 nút chọn đáp án và một dòng giải thích.
  - Thẻ loại câu trong danh sách cũng đã dịch.
- **Import:** phần `## ANSWER:` chỉ có 1 dòng đáp án Đúng/Sai → câu một đáp án với 2 phương án. Có thể viết ngay trên dòng `## ANSWER:`.
- **Sửa thêm 2 lỗi có sẵn của parser:**
  - Câu **đầu tiên** của file do chức năng xuất Markdown tạo ra (không có gì giữa front-matter và `# QUESTION:`) bị dính chuỗi `# QUESTION:` vào đề bài khi nhập lại. Lỗi này xảy ra mỗi lần dùng "Sửa bằng Markdown → Nhập lại". File mẫu không gặp vì có dòng comment ở trước.
  - File xuống dòng kiểu Windows (CRLF) không tách được câu.
- **Tài liệu:**
  - `docs/import.md`: thêm mục 2.6 mô tả định dạng hệ thống thực sự đọc (`# QUESTION:` / `## TAGS:` / `## ANSWER:`) kèm cú pháp Đúng/Sai. Các mục 2.1–2.4 cũ mô tả front-matter cho từng câu, không khớp code; nay có ghi chú ở đầu mục 2.
  - `docs/cau-hoi-mau.md`: thêm câu 51–52 (Đúng/Sai).
- **Test:** `src/server/import/markdownPool.test.ts`, 15 test:
  - cú pháp vi / en và cùng dòng; đáp án lạ bị bỏ qua kèm cảnh báo; câu nhiều lựa chọn vẫn đúng;
  - xuất → nhập lại giữ nguyên mọi câu; CRLF;
  - file mẫu nhập đủ 52 câu.
- **Chạy thật (7/7 đạt):**
  - nhập file mẫu (pool tạm): 52 câu, câu Đúng/Sai lưu là `mcq_single` với đúng đáp án;
  - xuất rồi nhập lại vào cùng pool: không còn đề bài nào dính `# QUESTION:`;
  - tạo câu Đúng/Sai bằng form trên trình duyệt;
  - pool tạm đã xoá.

## Task 6.5 — Ảnh trong câu hỏi
- **Migration** `add_question_image`:
  - `Question.imageUrl String?`, `Question.imageAlt String?`
  - `SessionQuestionSnapshot.imageUrl String?`, `SessionQuestionSnapshot.imageAlt String?`
  - `quizSnapshot.ts` chép ảnh sang snapshot.
- **Lưu trữ** `src/server/storage.ts`:
  - Dùng `@aws-sdk/client-s3` và `@aws-sdk/s3-request-presigner` với `S3_ENDPOINT` tuỳ chỉnh: MinIO khi chạy local, Supabase Storage khi chạy production (cả hai tương thích S3).
  - Hàm thuần `validateImageUpload({ contentType, size })` nhận `image/png | image/jpeg | image/webp`, ≤ 2 MB.
- **API** `POST /api/uploads/question-image`:
  - Chỉ giáo viên; rate limit `write`.
  - Body `{ contentType, size }` → trả `{ uploadUrl, publicUrl }` (presigned PUT, hết hạn 5 phút).
  - Key `questions/<userId>/<cuid>.<ext>`.
- **Giao diện:**
  - Form câu hỏi: chọn ảnh → xem trước → upload; **bắt buộc nhập mô tả ảnh (`alt`)**; xoá ảnh được.
  - Hiển thị ảnh (giới hạn chiều cao, giữ tỉ lệ, nền giấy như ô QR) ở: trang làm bài và xem lại bài, `QuestionsView`, `AttemptDetailView`, `SessionStatsView`, `QuestionPoolDetail`.
- **Import / export Markdown:** cú pháp `![alt](url)` trên dòng ngay sau đề bài.
- **CSP / domain ảnh:** dùng `<img>` (không dùng `next/image`, khỏi cấu hình `remotePatterns`); kiểm tra `next.config.ts` không chặn.
- **Test:** unit test `validateImageUpload` và parser `![alt](url)`. Chạy thật với MinIO (`docker compose up -d`, bucket `bkquiz-media` đã được `minio-init` tạo, cho đọc công khai): tạo câu có ảnh → tạo phiên → sinh viên thấy ảnh → sửa ảnh trong ngân hàng không làm đổi đề của phiên đã tạo.
- **Xong khi:** ảnh hiển thị đúng ở 6 màn, có `alt`, snapshot giữ ảnh cũ.

### ✅ Đã làm (27/11/2026)
- **Migration** `20261127140000_add_question_image`: `imageUrl` / `imageAlt` cho `Question` và `SessionQuestionSnapshot`. `quizSnapshot.ts` chép ảnh vào đề của phiên.
- **`src/server/storage.ts`** (`@aws-sdk/client-s3`, path-style, `S3_ENDPOINT` tuỳ chỉnh):
  - `detectImageType` nhận dạng PNG / JPEG / WebP theo **magic bytes**;
  - `validateImageUpload` (≤ 2 MB);
  - `storageConfig` (thêm `S3_PUBLIC_BASE_URL` cho Supabase);
  - `putPublicObject`.
- **Khác kế hoạch — server upload thay vì presigned URL:** `POST /api/uploads/question-image` nhận multipart rồi tự đưa lên S3. Lý do:
  - không phải cấu hình CORS trên bucket (Supabase);
  - kiểm tra được nội dung thật của file (chặn SVG có script hay file đổi đuôi `.png`);
  - 2 MB vẫn dưới giới hạn body 4,5 MB của Vercel.
  - Rate limit nhóm mới `imageUpload` (30 / 10 phút); chỉ giáo viên.
- **`src/utils/questionImage.ts`:** cú pháp `![mô tả](url)` (parse bằng thao tác chuỗi), chỉ nhận URL `http(s)` (chặn `javascript:` và đường dẫn tương đối), `extractPromptImage`, `imageMarkdown`.
- **Import / export / "Sửa bằng Markdown":** dòng ảnh riêng trong đề bài ↔ `imageUrl` / `imageAlt`; xuất ghi lại dòng ảnh nên sửa bằng Markdown giữ được ảnh.
- **API câu hỏi:**
  - `POST pools/:id/questions` nhận `imageUrl` + `imageAlt` (bắt buộc khi có ảnh).
  - Sửa thêm lỗi có sẵn: dữ liệu sai trước đây trả 500, nay 400 `INVALID_INPUT`.
  - Trả ảnh ở 5 API hiển thị.
- **Giao diện:**
  - Component `QuestionImage`: khung "giấy" giống ô QR trên màn chiếu, giữ tỉ lệ, cao tối đa 18rem (bản nhỏ 10rem); `loading="lazy"`, `referrerPolicy="no-referrer"`.
  - Hiện ở 6 màn: làm bài và xem lại bài (cùng component), câu hỏi của phiên, chi tiết bài làm, thống kê, ngân hàng câu hỏi.
  - Form soạn câu: chọn ảnh → tải lên → xem trước → **bắt buộc nhập mô tả**; có nút bỏ ảnh.
- **MinIO local:** image `minio/minio` và `minio/mc` không còn kéo được từ Docker Hub (MinIO ngừng phát hành image công khai năm 2025; tag `minio/mc` trong compose cũng không tồn tại). Đổi sang `bitnamilegacy/minio:2025.1.20`; `MINIO_DEFAULT_BUCKETS=bkquiz-media:download` tự tạo bucket cho đọc công khai, nên bỏ container `minio-init`.
- **Test:** `storage.test.ts` 10 test (loại ảnh, kích thước, cấu hình MinIO / Supabase, cú pháp ảnh).
- **Chạy thật với MinIO (22/22 đạt):**
  - upload PNG → URL công khai đọc được (`image/png`);
  - bị chặn: GIF, SVG đội lốt `.png`, ảnh > 2 MB (413), sinh viên (403);
  - API: ảnh thiếu mô tả / URL `javascript:` → 400;
  - xuất Markdown có dòng ảnh;
  - quiz → phiên → sinh viên nhận ảnh;
  - **sửa ảnh trong ngân hàng → đề của phiên vẫn giữ ảnh cũ**;
  - ảnh hiện ở 6 màn; form chặn ảnh thiếu mô tả rồi lưu được;
  - dữ liệu tạm đã xoá. File ảnh thử nghiệm vẫn còn trong MinIO local.
- **Còn lại:** nhập `.zip` có thư mục `assets/` (tự tải ảnh trong zip lên) chưa làm; ghi ở `docs/import.md` mục 2.6.

## Task 6.6 — Sửa hồ sơ
- **API** `PATCH /api/user/profile` nhận `{ name: 1..80 ký tự }`; rate limit `write`.
- **Giao diện:** trang `dashboard/user-profile`: form đổi tên hiển thị (`Input` + `Button` lưu, kèm toast); email chỉ đọc.
- **Kiểm tra:** `src/lib/customPrismaAdapter.ts` / callback của NextAuth không ghi đè `name` mỗi lần đăng nhập Google. Nếu có ghi đè thì chỉ đặt `name` khi tạo user lần đầu.
- **Xong khi:** đổi tên → tên mới hiện ở danh sách thành viên, bảng điểm, trang Theo dõi; đăng nhập lại vẫn giữ tên mới.

### ✅ Đã làm (27/11/2026)
- **API** `PATCH /api/user/profile` `{ name }`:
  - bỏ khoảng trắng đầu / cuối, gộp các khoảng trắng liền nhau;
  - 1–80 ký tự, sai thì 400 `INVALID_NAME`;
  - rate limit `write`; chỉ đổi tên của chính người gọi.
- **Trang Hồ sơ:** form `ProfileForm` (client) gồm email chỉ đọc kèm giải thích, ô tên hiển thị, nút Lưu (tắt khi tên chưa đổi), toast.
- **Đăng nhập Google không ghi đè tên:** đã đọc `@auth/core/lib/actions/callback/handle-login.js`. Với OAuth, khi tài khoản đã tồn tại thì chỉ tạo phiên đăng nhập; `updateUser` chỉ được gọi cho provider email. Không cần sửa `customPrismaAdapter.ts`.
- **Sửa lỗi chế độ dev:** `getOrCreateDevUserId` (`authz.ts`, chỉ chạy khi `DEV_BYPASS_AUTH=1`) ghi lại tên "Dev Student" / "Dev Teacher" ở mọi request. Hậu quả: đổi tên bị mất ngay ở request kế tiếp, và mỗi request tốn một lệnh ghi DB. Nay chỉ đặt tên khi tạo user dev lần đầu.
- **Chạy thật (8/8 đạt):**
  - tên trống, 81 ký tự, thiếu trường → 400;
  - chuẩn hoá khoảng trắng;
  - giáo viên thấy tên mới trong danh sách thành viên;
  - lưu bằng form ở 1280 px và 360 px, tên vẫn giữ sau các request tiếp theo;
  - đã khôi phục tên "Dev Student".

## Task 6.7 — Hướng dẫn deploy staging (Vercel + Supabase)
- **Cập nhật `docs/DEPLOYMENT_SUPABASE.md`** theo từng bước cho người **chưa có tài khoản**:
  1. Tạo project Supabase:
     - Lấy **chuỗi pooler** (`…:6543/postgres?pgbouncer=true`) cho `DATABASE_URL`.
     - Lấy **chuỗi kết nối trực tiếp** (cổng 5432) để chạy migrate.
     - Tạo bucket Storage `bkquiz-media` (công khai) cho ảnh câu hỏi (6.5), lấy khoá S3.
  2. Chạy `npx prisma migrate deploy` bằng chuỗi kết nối trực tiếp, cho đủ mọi migration, kể cả `add_rate_limit`, `add_attempt_monitoring`, `add_attempt_events`, `add_attempt_result_counts` (điểm thang 10, 27/11) và 2 migration của Đợt 6.
  3. Google OAuth production: tạo OAuth client, redirect URI `https://<domain>/api/auth/callback/google` (đối chiếu `GOOGLE_OAUTH_SETUP.md`).
  4. Tạo project Vercel (root directory `bkquiz-web`, build command `npm run build:vercel`) và nhập env:
     - `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`
     - `S3_*` (endpoint Supabase Storage)
     - **Không đặt** `DEV_BYPASS_AUTH`, `BKQUIZ_CHECKPOINT_SECONDS`, `RATE_LIMIT_DISABLED`.
  5. Kiểm tra sau deploy: `/api/health`; đăng nhập bằng 2 tài khoản Google thật; chạy kịch bản demo (tạo lớp → phiên → làm bài → Theo dõi → Thống kê); `/api/dev/role` phải trả 404.
- **Thêm `bkquiz-web/vercel.json`**: cron gọi `/api/sessions/auto` (gói Hobby: 1 lần / ngày, đủ để dọn bộ đếm). Ghi rõ:
  - Tự bắt đầu / kết thúc phiên đúng giờ dựa vào màn chiếu đang mở (màn chiếu gọi `auto`).
  - Nếu cần chính xác hơn khi không mở màn chiếu, dùng cron ngoài (ví dụ cron-job.org) kèm header `Authorization: Bearer <CRON_SECRET>`.
- **Cập nhật `docs/PRE_DEPLOYMENT_CHECKLIST.md`:**
  - Tick các mục đã xong: `.env.example`, migrations, `maxDuration` ở `submit`/`import`, unit test, e2e.
  - Thêm nhóm "Đợt 5–6": rate limit bật, cron dọn bộ đếm, `DEV_BYPASS_AUTH` không tồn tại, bucket ảnh, Google OAuth production.
- **Xong khi:** người chưa có tài khoản làm theo được từ đầu đến khi chạy xong kịch bản demo trên URL staging.

### ✅ Đã làm (27/11/2026)
- **`docs/DEPLOYMENT_SUPABASE.md` viết lại**, gồm bước 0–7 và bảng lỗi thường gặp:
  - bảng biến cần ghi lại;
  - tạo Supabase: chuỗi Transaction pooler 6543 cho app, Session pooler 5432 cho migrate (Direct connection của gói Free chỉ có IPv6); cảnh báo project tự tạm dừng sau 7 ngày;
  - lệnh migrate cho Git Bash và PowerShell (17 migration);
  - Storage: bucket công khai và **khoá S3 riêng** (bản cũ ghi sai là project-ref + `service_role`);
  - Google OAuth 2 lượt (domain có sau khi deploy) và *Test users*;
  - Vercel: Root Directory, bảng env, danh sách **không được đặt**, function region Singapore;
  - cron;
  - 10 bước kiểm tra sau deploy, gồm `/api/dev/role` phải 404 và cron không có secret phải 401;
  - lưu ý vai trò giáo viên là tự phục vụ.
- **`bkquiz-web/vercel.json`:** cron `0 17 * * *` (00:00 giờ VN) gọi `/api/sessions/auto`; gói Hobby chỉ cho 1 lần / ngày.
- **Sửa `/api/sessions/auto` — trước đây sẽ hỏng khi deploy:**
  - Vercel Cron gọi bằng `GET`, mà `GET` chỉ là health check, nên cron không làm gì. Nay `GET` kèm `Bearer <CRON_SECRET>` chạy job.
  - Khi đặt `CRON_SECRET`, `POST` từ màn chiếu (không có header) bị 401, tức việc tự bắt đầu / kết thúc phiên mất luôn. Nay người đã đăng nhập gọi được; endpoint chỉ xử lý phiên đã đến giờ.
  - Bỏ kiểm tra user-agent `vercel-cron/1.0` (giả mạo được).
  - Đã thử với `CRON_SECRET`: không quyền / giả user-agent / sai secret → 401; GET không secret → health check; GET có secret → chạy job; người đăng nhập POST → chạy job.
- **`.env.example` viết lại** theo biến thật (bỏ Clerk / Neon của boilerplate), có chú thích và cảnh báo `DEV_BYPASS_AUTH`.
- **`docs/PRE_DEPLOYMENT_CHECKLIST.md`:**
  - thêm mục 0 "Đợt 5–6" (đã sẵn sàng / phải làm khi deploy);
  - tick `.env.example`, `maxDuration`, các phép thử 100+ câu;
  - sửa khối biến S3 sai.
- **Đo với 200 câu (DB local):** nhập 0,6 s; xuất 51 ms; tạo đề 24 ms; nộp + chấm 47 ms; thống kê 48 ms. Tất cả dưới giới hạn 10 s của Vercel Hobby.
- `bkquiz-web/README.md`: mục Deployment trỏ tới hướng dẫn mới, sửa tên biến cũ (`NEXTAUTH_*`, `GOOGLE_CLIENT_*`).
- **Chưa làm (cần tài khoản của bạn):** chạy thật trên Vercel + Supabase theo bước 7 của hướng dẫn.

## Kiểm tra Đợt 6
- Sau mỗi task: `npm run check:types`, ESLint các file đã sửa, `npx vitest run --project unit`, `npm run check:i18n`, `PW_CHANNEL=chrome npm run test:e2e:exam`.
- Chạy thật (`DEV_BYPASS_AUTH=1`, 2 cửa sổ): kịch bản của từng task như mục "Xong khi"; ảnh (6.5) thử với MinIO.
- Giao diện mới theo hệ bảng đen (`docs/uiux/guidelines.md`): chụp 360 px và 1280 px, vi/en, chỉ dùng bàn phím.
- Mỗi task 1 commit (migration đi cùng commit của task).

---

# 📋 Kế hoạch thực hiện — Đợt 5: Chống gian lận, giám sát phiên thi, độ tin cậy

> Lập ngày: 26/11/2026 — dựa trên [trang-thai-du-an-hien-tai.md](./trang-thai-du-an-hien-tai.md) và đọc lại code (`verifyToken`, `state`, `submit`, `attemptTimeLimit.ts`, `teacherScreen.tsx`, `studentAttempt.tsx`, `schema.prisma`).
> Đợt 4 (bên dưới) giữ làm lịch sử; Task 4 (thống kê) và Task 6 (rate limit) của Đợt 4 được chuyển sang đợt này.

## Tiến độ

| # | Task | Chức năng | Migration | Trạng thái |
|---|---|---|---|---|
| 5.1 | Tách hàm thuần + unit test nghiệp vụ lõi | Test | Không | ✅ Xong (26/11) — 86 test mới, đã chạy thật |
| 5.2 | Rate limit API (= Đợt 4 Task 6) | Bảo mật | `add_rate_limit` | ✅ Xong (26/11) — 37 handler, đã chạy thật |
| 5.3 | Giám sát phiên thi + can thiệp từng sinh viên | Giám sát | `add_attempt_monitoring` | ✅ Xong (26/11) — chạy thật 28/28 bước |
| 5.4 | Gắn cờ bài làm nghi vấn | Chống gian lận | `add_attempt_events` | ✅ Xong (26/11) — chạy thật 25/25 (API + Chrome) |
| 5.5 | Phân tích câu hỏi + biểu đồ (= Đợt 4 Task 4) | Thống kê | Không | ✅ Xong (26/11) |
| 5.6 | Test e2e luồng thi + tài liệu | Test | Không | ✅ Xong (26/11) — e2e qua 2/2 lần chạy |

**Thứ tự** theo phụ thuộc: 5.1 tách logic chấm điểm / checkpoint ra hàm thuần — 5.3 (thu bài hộ) và 5.5 (thống kê) dùng lại; 5.2 cung cấp `getClientIp` cho 5.4; 5.4 hiển thị trên trang giám sát của 5.3.

## Phạm vi

1. **Gắn cờ bài làm nghi vấn** — hiện thực RA mục 6.2 ("flag bài làm có pattern bất thường"), phát triển từ cơ chế token/checkpoint.
2. **Giám sát phiên thi theo thời gian thực + xử lý sự cố** — giáo viên thấy ai đang làm / bị khoá / mất kết nối / đã nộp và mở khoá, gia hạn riêng, thu bài từng sinh viên.
3. **Rate limit API** — vá lỗ hổng `/api/*` không được Arcjet bảo vệ (thiết kế có sẵn ở Đợt 4 Task 6).
4. **Phân tích câu hỏi sau phiên** — tỉ lệ đúng, độ phân biệt, phân bố phương án, biểu đồ điểm (thiết kế có sẵn ở Đợt 4 Task 4).
5. **Test nghiệp vụ lõi** — unit test TOTP, khoá checkpoint, 3 chế độ chấm, thời gian làm bài, phân quyền; 1 test e2e toàn luồng.

**Không làm trong đợt này:** SSE/WebSocket (giữ polling 3 s — xem lý do ở 5.3), chặn cứng khi rời tab (chỉ ghi nhận, giáo viên quyết định), loại câu hỏi mới, ảnh trong câu hỏi, archive lớp, vai trò TA.

### Phát hiện khi đọc code (ảnh hưởng thiết kế)
- **Chấm điểm nằm trong route** `api/attempts/[attemptId]/submit/route.ts` (các hàm `computeAllOrNothing`, `computeEDC`, `computeByHalves`, `computePenalty`, `roundScore` không export) → không test được, và "giáo viên thu bài hộ" không gọi lại được. Phải tách trước (5.1).
- **Luật khoá checkpoint viết cứng** trong `verifyToken/route.ts` (3 lần sai → chờ 30 s, 6 lần → khoá 5 phút; mốc checkpoint kế tiếp ngẫu nhiên 240–300 s) và luật cảnh báo / đến hạn (ân hạn 5 s) trong `state/route.ts`.
- `src/server/totp.ts` gán `authenticator.options` toàn cục mỗi lần gọi → test phải cố định giờ bằng `vi.setSystemTime`, không chạy song song với giá trị `step` khác.
- `attemptTimeLimit.ts` đã có hàm thuần (`getEffectiveDurationSeconds`, `calculateSessionEndTime`, `calculateAttemptEndTime`) → test được ngay.
- **Không có dấu vết "lần cuối online"**: `Attempt` không có `lastSeenAt`; sinh viên poll `state` mỗi 1,5 s nhưng route chỉ đọc. → 5.3 ghi `lastSeenAt` có giới hạn tần suất.
- **Đổi máy đã làm được sẵn:** đáp án lưu ở server, `Attempt` gắn theo `(sessionId, userId)` → sinh viên chỉ cần đăng nhập ở máy khác. Không cần chức năng "cho vào lại"; thay vào đó 5.4 ghi nhận việc đổi thiết bị.
- **Màn hình `teacherScreen.tsx` được chiếu lên lớp** → không hiển thị danh sách sinh viên bị khoá / nghi vấn ở đây; trang giám sát là **trang riêng** mở trên máy giáo viên.
- **IP trong lớp thường giống nhau** (Wi-Fi trường qua NAT) → luật "nhiều tài khoản cùng IP" cho kết quả sai hàng loạt; dùng **mã thiết bị** (sinh ngẫu nhiên, lưu `localStorage`) thay cho IP.
- `playwright.config.ts` gọi script `db-server:memory` **không tồn tại** (script thật là `boilerplate:db-server:memory`, dùng drizzle chứ không phải Prisma) → e2e hiện không chạy được (sửa ở 5.6).
- Giao diện đã chuyển sang hệ thiết kế bảng đen (`src/components/chalk/`, `docs/uiux/guidelines.md`) → mọi màn mới dùng `ChalkRoom`, `Card`, `Table`, `Badge`, `Modal`, màu phấn có nghĩa (vàng = cảnh báo, hồng = lỗi/khoá, xanh lá = xong, xanh dương = thông tin).

---

## Task 5.1 — Tách hàm thuần + unit test nghiệp vụ lõi

**Mục tiêu:** chứng minh được tính đúng của token, khoá, chấm điểm, thời gian, phân quyền; tạo hàm dùng lại cho 5.3 và 5.5. **Không đổi hành vi.**

### Tách code
| File mới | Nội dung | Ai gọi |
|---|---|---|
| `src/server/scoring.ts` | Chuyển nguyên các hàm chấm từ `submit/route.ts` + `normalizeSelected`; thêm `scoreAttempt({ questions, answers, settings }) => { score, correctCount, questionScores }` | `submit/route.ts`, `submitAttempt.ts` (5.3), thống kê (5.5) |
| `src/server/submitAttempt.ts` | Phần thân của `submit` (lấy câu được giao → snapshot → answers → `scoreAttempt` → cập nhật `Attempt`) thành `submitAttempt(attemptId, { by: 'student' \| 'teacher' })` | `submit/route.ts`, action `submit` (5.3) |
| `src/server/checkpointPolicy.ts` | Hằng `COOLDOWN_AFTER_FAILS = 3`, `COOLDOWN_SECONDS = 30`, `LOCK_AFTER_FAILS = 6`, `LOCK_SECONDS = 300`, `GRACE_SECONDS_BEFORE_BLOCK = 5`, `CHECKPOINT_MIN/MAX_SECONDS = 240/300`; `applyFailedVerify(failedCount, now)`, `nextCheckpointDueAt(now, rand)`, `getCheckpointPhase(nextDueAt, now) => 'ok' \| 'warning' \| 'due'` | `verifyToken`, `state` |

### Test (`vitest` project `unit`, môi trường node, file `src/server/*.test.ts`)
| File | Trường hợp |
|---|---|
| `scoring.test.ts` | Mỗi chế độ × `mcq_single` / `mcq_multi`: đúng hết, sai hết, bỏ trống, chọn thừa, chọn thiếu; EDC & chia đôi (0/1/2/≥3 lỗi); penalty không âm, `penaltyPerWrongOption` tuỳ chỉnh; chỉ số phương án ngoài phạm vi / trùng lặp bị bỏ qua; làm tròn `round_2`; **đề biến thể**: chỉ chấm câu được giao, `questionScores` không chứa câu khác |
| `totp.test.ts` | Token cùng bước khớp; lệch ±1 bước (±45 s) vẫn đúng; lệch 2 bước sai; `expiresInSeconds` đúng tại đầu / giữa / cuối bước (`vi.setSystemTime`) |
| `checkpointPolicy.test.ts` | Sai lần 1–2 không chờ; lần 3–5 chờ 30 s; lần 6 khoá 5 phút, `status = locked`; mốc checkpoint trong [240, 300] s; pha `warning` trong 5 s ân hạn, sau đó `due` |
| `attemptTimeLimit.test.ts` | Không giới hạn → `null`; buffer mặc định 5 phút; gia hạn cộng vào cả mốc attempt và session; sinh viên vào muộn bị cắt bởi mốc session (lấy `min`) |
| `authz.test.ts` | `vi.mock('@/server/prisma')`: giáo viên chủ lớp được, sinh viên cùng lớp bị chặn ở quyền `teacher`, người ngoài lớp bị chặn, thành viên `banned` / `left` bị chặn, attempt của người khác → `FORBIDDEN` |

- Sửa môi trường: thêm vào README bước `npx playwright install chromium` để project `ui` của vitest chạy được.
- **Xong khi:** `npm test` xanh; `submit` trả kết quả giống hệt trước khi tách (so trên 1 bài làm mẫu cho cả 3 chế độ).
- **Ước lượng:** 4–5 giờ.

### ✅ Đã làm (26/11/2026)
- **Tách code** đúng như bảng trên:
  - `scoring.ts` có thêm `resolveScoringSettings` (điền mặc định cho cấu hình chấm) và `scoreQuestion` (trả `score` + `isFullyCorrect`).
  - `submitAttempt.ts` trả kết quả dạng union `{ ok: true, … } | { ok: false, error, status }`; route `submit` giờ chỉ còn kiểm tra quyền rồi gọi hàm này. Response giữ nguyên định dạng cũ.
  - `checkpointPolicy.ts` có thêm `isInCooldown`, `isAttemptLocked` và `randomInt` nhận hàm `random` để test được.
  - `verifyToken`, `state` và `join` đều dùng module này. `join` trước đây có một bản `randomInt` riêng, nay đã bỏ.
- **Test:** 5 file, 86 test mới. Cộng 2 test cũ, `npx vitest run --project unit` chạy 88 test, tất cả qua.
  - scoring 28, checkpointPolicy 15, totp 11, attemptTimeLimit 11, authz 21.
  - `authz.test.ts` mock `@/server/prisma`, `@/auth` và `next/headers`.
  - `totp.test.ts` cố định giờ bằng `vi.useFakeTimers` + `vi.setSystemTime`, chọn mốc chia hết cho 45 s.
- **Xác nhận không đổi hành vi:**
  1. Test tạm (đã xoá) chép nguyên logic chấm cũ của route `submit`, so với `scoreAttempt` trên 20 000 bài ngẫu nhiên, đủ mọi chế độ, có cả dữ liệu rác: kết quả trùng khớp.
  2. Chấm lại 3 bài đã nộp trong DB local, chỉ đọc. Có 1 bài đề biến thể, được giao 10/12 câu. Kết quả trùng `score` và `questionScores` đã lưu.
  3. `next build` qua. Chạy server rồi gọi `state`, `submit`, `verifyToken`, `join` trên phiên đã kết thúc: mã lỗi như cũ, log không có lỗi.
  4. Kiểm tra lại độ nhạy của test: đổi ngưỡng khoá 6 → 7 và làm sai công thức EDC thì 5 test báo đỏ.
- README (`bkquiz-web/README.md`, mục Testing): thêm lệnh chỉ chạy test nghiệp vụ và bước `npx playwright install chromium`.
- **Phát hiện lỗi có sẵn, chưa sửa:** `requireAttemptAccess` ném `AuthorizationError` với `message = 'Attempt not found'`, nhưng các route attempt so sánh `err.message === 'ATTEMPT_NOT_FOUND'`. Vì vậy attempt không tồn tại trả **403 `FORBIDDEN`** thay vì 404. Nên sửa khi làm 5.3, khi viết route action mới (so theo `err.code`).

---

## Task 5.2 — Rate limit API

Làm **đúng thiết kế [Đợt 4 Task 6](#task-6--rate-limit-api--chưa-làm)** (bảng `RateLimit` trong Postgres, cửa sổ cố định, 1 câu SQL nguyên tử, fail-open, `RATE_LIMIT_DISABLED=1`). Bổ sung:
- Thêm nhóm `proctorEvents: { limit: 60, windowSeconds: 60 }` cho endpoint ghi sự kiện của 5.4, và đưa các action của 5.3 vào nhóm `write`.
- `getClientIp` đặt trong `src/server/rateLimit.ts`, 5.4 dùng lại.
- Thông báo 429 hiện bằng `Toast` (`type="error"`), chữ theo i18n: "Bạn thao tác quá nhanh, thử lại sau {seconds} giây."
- **Ước lượng:** 3–4 giờ.

### ✅ Đã làm (26/11/2026)
- **Migration** `20261126…_add_rate_limit`: chỉ tạo bảng `RateLimit` với khoá `(key, windowStart)` và index `windowStart`. `schema.prisma` chỉ thêm đúng 10 dòng của model này.
- **`src/server/rateLimit.ts`:**
  - Có các hàm `RATE_LIMITS`, `getWindowStart`, `getRetryAfterSeconds`, `evaluateCount`, `getClientIp`, `checkRateLimit`, `enforceRateLimit(name, id, ...[name, id])` (kiểm tra nhiều bộ đếm cùng lúc), `rateLimitedResponse` và `cleanupRateLimits`.
  - Bộ đếm được tăng bằng 1 câu `INSERT … ON CONFLICT DO UPDATE … RETURNING`.
  - Lỗi DB thì cho qua (fail-open). `RATE_LIMIT_DISABLED=1` tắt toàn bộ (đã thêm vào `.env.example`).
- **Khác thiết kế ban đầu:**
  - `classes/preview` **không yêu cầu đăng nhập** nên chỉ giới hạn được theo IP.
  - Giới hạn theo IP tách thành nhóm riêng `classJoinIp`, **200 / phút**. Lý do: cả lớp dùng chung IP Wi-Fi trường và thường tham gia lớp cùng lúc; với mức 10 / phút theo IP thì chỉ 5 sinh viên đầu vào được. Mã lớp 8 ký tự trên bảng chữ 32 ký tự (~10¹² tổ hợp) nên không dò được kể cả ở mức 200 / phút.
  - `answers` nâng từ 120 lên **180 / phút**. Client debounce 500 ms nên bấm liên tục có thể chạm đúng 120. Nếu vẫn bị 429, đáp án được giữ ở trạng thái `dirty` và localStorage rồi gửi lại sau.
  - `attempts/[id]/start` thuộc nhóm `sessionJoin`; `user/switch-role` (POST) thuộc nhóm `write`.
- **Đã áp dụng cho 37 handler:**

| Nhóm | Số handler |
|---|---|
| `write` | 29 |
| `sessionJoin` | 2 |
| `verifyToken` | 1 |
| `submit` | 1 |
| `answers` | 1 |
| `poolImport` | 1 |
| `classJoin` + `classJoinIp` | 1 (`classes/join`) |
| `classJoinIp` | 1 (`classes/preview`) |

- **Không áp dụng:** các GET poll liên tục, `auth`, `health`, `dev`, `sessions/auto`.
- **Cron** `sessions/auto`: xoá bộ đếm cũ hơn 24 giờ; response có thêm `rateLimitCleaned`.
- **Giao diện:** hiện thông báo "Bạn thao tác quá nhanh. Thử lại sau {seconds} giây." (key `rate_limited` trong `Attempt`, `SessionLobby`, `Classes`, đủ vi/en) ở các màn sinh viên có thể chạm giới hạn: nhập token, bắt đầu làm bài, nộp bài, vào phòng chờ, tham gia lớp, xem trước lớp. Các form giáo viên giữ cách hiện mã lỗi như hiện nay (`RATE_LIMITED`), vì 60 thao tác ghi / phút không thể chạm tới khi thao tác tay.
- **Test:** `rateLimit.test.ts` (15 test, mock `$queryRaw` bằng bộ đếm giả) kiểm tra:
  - cửa sổ cố định, cách tính `Retry-After`, đọc IP;
  - mỗi key đếm riêng; sang cửa sổ mới thì đếm lại từ đầu;
  - fail-open và chế độ tắt;
  - bị chặn theo IP dù tài khoản chưa vượt giới hạn;
  - 60 sinh viên sau cùng một NAT vẫn tham gia lớp được.

  `npx vitest run --project unit`: 103/103 qua.
- **Chạy thật** (`next start`, DB Docker):
  - `classes/join` lần 1–10 trả 404 (mã giả), lần 11–12 trả **429** kèm `Retry-After`.
  - `verifyToken` lần 11 trả 429.
  - Gọi `state` 40 lần liên tiếp: không lần nào bị 429.
  - `classes/preview` 15 lần: không bị chặn.
  - Bảng `RateLimit` có đúng các key `classJoin:user:…`, `classJoinIp:ip:…`, `verifyToken:user:…`.
  - Cron trả `rateLimitCleaned`.
  - Khi `RATE_LIMIT_DISABLED=1`: 14 lần `classes/join` liên tiếp đều không bị chặn.
- **Lint:** chỉ tự sửa thứ tự import trong các file đã chạm. Các lỗi thụt lề và khoảng trắng có sẵn trong những file đó được giữ nguyên, để diff không lẫn thay đổi định dạng.
- **Phát hiện thêm, chưa sửa:** `classes/preview` không cần đăng nhập mà trả về **email của giáo viên** chủ lớp, nên ai có mã lớp cũng thấy email này. Nên cân nhắc yêu cầu đăng nhập hoặc bỏ email khỏi response.

---

## Task 5.3 — Giám sát phiên thi + can thiệp từng sinh viên

**Mục tiêu:** trong giờ thi, giáo viên biết ngay ai gặp sự cố và xử lý không cần huỷ bài.

### Schema (`npx prisma migrate dev --name add_attempt_monitoring`)
```prisma
model Attempt {
  // ...
  lastSeenAt   DateTime?          // lần cuối client gọi state/answers
  extraSeconds Int      @default(0) // gia hạn riêng cho sinh viên này
}
enum CheckpointEventType {
  // ... scheduled, verify_ok, verify_fail, locked
  teacher_unlock
  teacher_extend
  teacher_submit
}
```
Các hành động của giáo viên ghi vào `CheckpointLog` → tự hiện trong dòng thời gian của trang chi tiết bài làm (Đợt 4 Task 3) mà không cần bảng mới.

### Server
- **`lastSeenAt`**: trong `state` (GET) và `answers` (PUT), `updateMany({ where: { id, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: now - 10s } }] }, data: { lastSeenAt: now } })` → tối đa 1 lần ghi / 10 s / sinh viên.
- **Gia hạn riêng**: `calculateAttemptEndTime` cộng `extraSeconds` vào cả mốc attempt và mốc session của riêng attempt đó. `api/sessions/auto` **không tự đóng** session khi còn attempt `active` có `attemptEndTime > now` (lấy `max`).
- **Hàm thuần** `src/server/liveStatus.ts`: `deriveLiveStatus(attempt, now)` → `not_started | working | checkpoint_due | cooldown | locked | offline | submitted | time_up` (`offline` = `lastSeenAt` cũ hơn 20 s khi đang làm). Có unit test.

### API
| Endpoint | Mô tả |
|---|---|
| `GET api/sessions/[sessionId]/monitor` | Giáo viên của session. Trả `summary` (đếm theo trạng thái) + `students[]`: `attemptId`, tên, email, `liveStatus`, `answeredCount` / `assignedCount`, `failedCount`, `lockedUntil`, `timeRemaining`, `extraSeconds`, `lastSeenAt`, `flags` (từ 5.4, rỗng trước khi làm 5.4). Sinh viên trong lớp nhưng chưa vào phiên → `not_joined`. |
| `POST api/sessions/[sessionId]/attempts/[attemptId]/actions` | Body zod dạng union theo `action`: |
| | `unlock` — `failedCount = 0`, xoá `cooldownUntil` / `lockedUntil`, `status: active`, `nextDueAt` = mốc mới; chỉ khi đang khoá hoặc chờ. |
| | `extend { minutes: 1..30 }` — cộng `extraSeconds`, tổng tối đa 60 phút / sinh viên; chỉ khi session `active` và có giới hạn thời gian. |
| | `submit` — gọi `submitAttempt(attemptId, { by: 'teacher' })` (5.1); chỉ khi attempt `active` / `locked`. |
| | Mọi action: kiểm tra `attempt.sessionId === sessionId` (khác → 404), ghi `CheckpointLog`, khoá lạc quan theo `updatedAt` như `extend` session. |

### UI
- **Trang mới** `dashboard/sessions/[sessionId]/monitor/page.tsx` + `SessionMonitorView.tsx` (chỉ giáo viên, giống `questions/page.tsx`), poll `monitor` mỗi 3 s (cùng nhịp các bảng hiện có của `teacherScreen`).
- Hàng tag tổng: Đang làm · Chờ checkpoint (vàng) · Bị khoá (hồng) · Mất kết nối (vàng) · Đã nộp (xanh lá) · Chưa vào (dim). Bấm tag để lọc.
- Bảng (`TableWrap` + `Table`): Sinh viên · Trạng thái (`Badge`) · Tiến độ `12/30` · Còn lại · Sai token · Nghi vấn · Hành động.
- Hành động (`Button size="sm"`): **Mở khoá** (chỉ hiện khi khoá), **Gia hạn** (Modal chọn +5 / +10 / +15), **Thu bài** (Modal xác nhận, `variant="danger"`), **Xem bài làm** (link trang Đợt 4 Task 3).
- `teacherScreen.tsx`: thêm nút "Theo dõi" mở trang này ở tab mới (không hiện danh sách sinh viên trên màn chiếu).
- Phía sinh viên: không đổi giao diện; sau khi được mở khoá, `state` trả `isLocked = false` và màn khoá tự đóng ở lần poll kế tiếp.

**Vì sao không dùng SSE:** route API trên Vercel bị giới hạn `maxDuration` (dự án đang để 10 s cho Hobby) → kết nối SSE bị cắt liên tục; polling 3 s đủ cho 1 lớp 50–100 sinh viên và dùng lại được hạ tầng hiện có.

- **Xong khi:** khoá 1 sinh viên bằng cách nhập sai 6 lần → trang giám sát hiện "Bị khoá" trong ≤ 3 s → bấm Mở khoá → sinh viên làm tiếp được; gia hạn riêng chỉ đổi đồng hồ của sinh viên đó; thu bài → điểm xuất hiện trên bảng điểm.
- **Ước lượng:** 6–8 giờ.

### ✅ Đã làm (26/11/2026)
- **Migration** `add_attempt_monitoring`:
  - `Attempt.lastSeenAt`, `Attempt.extraSeconds` (mặc định 0).
  - 3 giá trị enum `teacher_unlock`, `teacher_extend`, `teacher_submit`.
- **Server:**
  - `src/server/liveStatus.ts` (hàm thuần):
    - `deriveLiveStatus` trả 9 trạng thái: `not_joined`, `not_started`, `working`, `checkpoint_due`, `cooldown`, `locked`, `offline`, `time_up`, `submitted`.
    - `canUnlock`.
    - `LIVE_STATUS_ORDER`: bị khoá và mất kết nối xếp lên đầu.
  - `src/server/attemptPresence.ts`:
    - `touchAttemptLastSeen` ghi tối đa 1 lần / 10 s, được gọi trong `state` và `answers`.
    - Quá 20 s không có tín hiệu thì coi là mất kết nối.
  - `attemptTimeLimit.ts`:
    - `calculateAttemptEndTime` cộng `extraSeconds` vào cả mốc kết thúc của bài lẫn mốc kết thúc chung, nhưng chỉ cho riêng bài đó.
    - Thêm hằng `MAX_ATTEMPT_EXTRA_SECONDS = 60 phút`.
  - Cron `sessions/auto`: không tự đóng phiên khi còn bài đang làm trong giờ gia hạn riêng (`hasAttemptInExtraTime`).
- **API:**
  - `GET sessions/[id]/monitor` (chỉ giáo viên):
    - Trả `summary` theo trạng thái và `students[]`, kể cả sinh viên trong lớp chưa vào phiên.
    - Số câu đã làm đếm bằng 1 câu SQL cho cả phiên.
  - `POST sessions/[id]/attempts/[attemptId]/actions` nhận `unlock` / `extend { minutes 1..30 }` / `submit`:
    - Thu bài dùng `submitAttempt(…, { by: 'teacher' })` của 5.1.
    - Mỗi thao tác ghi một dòng `CheckpointLog`.
- **Khác thiết kế:**
  - Khoá lạc quan **không dùng `updatedAt`**, vì cột `Attempt.updatedAt` không có `@updatedAt` nên các route khác không cập nhật nó. Thay vào đó, câu `updateMany` đặt điều kiện theo giá trị vừa đọc: `failedCount` + `status` cho mở khoá, `extraSeconds` cho gia hạn. Xung đột trả 409 `ATTEMPT_CHANGED`.
  - Mở khoá áp dụng cả khi sinh viên đang trong thời gian chờ (cooldown), không chỉ khi bị khoá hẳn.
  - Không thể thu bài của sinh viên chưa bắt đầu làm (`ATTEMPT_NOT_STARTED`). Thu bài **vẫn làm được sau khi phiên đã kết thúc**, để thu những bài chưa nộp.
  - Hành vi có sẵn cần biết: `join` vào phiên đang chạy sẽ tự bắt đầu bài, nên sinh viên chuyển thẳng sang "Đang làm".
- **Giao diện:**
  - Trang mới `dashboard/sessions/[id]/monitor`:
    - Tự làm mới mỗi 3 s, tạm dừng khi tab ẩn.
    - Có ghi chú "Cần xử lý: N bị khoá, M mất kết nối".
    - Bộ lọc theo trạng thái; nút đang chọn dùng `primary`.
    - Bảng gồm các cột: sinh viên, trạng thái, đã làm x/y, còn lại (kèm "+N phút riêng"), token sai, tín hiệu gần nhất, thao tác (Mở khoá / Gia hạn / Thu bài / Xem bài làm).
    - Hộp thoại gia hạn: nút +5/+10/+15; nút nào làm vượt giới hạn thì bị tắt.
    - Hộp thoại thu bài: nút xác nhận màu hồng; focus mặc định nằm ở nút Huỷ.
  - `teacherScreen.tsx`: nút **Theo dõi**, mở ở tab mới.
  - `AttemptDetailView`: hiện 3 sự kiện của giáo viên trong dòng thời gian; lần gia hạn có thêm "kết thúc lúc HH:MM".
  - i18n: namespace mới `SessionMonitor` (59 key), cộng `TeacherScreen.open_monitor` và 4 key `AttemptDetail`, đủ vi/en.
- **Sửa lỗi có sẵn:** các route attempt (`answers`, `questions`, `start`, `state`, `submit`, `verifyToken`) so sánh `AuthorizationError.code` thay cho `message`. Attempt không tồn tại nay trả **404 `ATTEMPT_NOT_FOUND`** thay vì 403.
- **Sửa bảo mật `classes/preview`:**
  - Bắt buộc đăng nhập (chưa đăng nhập trả 401) và giới hạn theo tài khoản + IP.
  - Không trả id và email đầy đủ của giáo viên, chỉ tên và email đã che bớt (`src/utils/maskEmail.ts`, ví dụ `de***@bkquiz.local`).
  - Lưu ý: khi `DEV_BYPASS_AUTH=1` thì mọi request đều coi là đã đăng nhập.
- **Test:**
  - `liveStatus.test.ts` (15 test), `maskEmail.test.ts` (3 test), thêm 1 test gia hạn riêng trong `attemptTimeLimit.test.ts`.
  - `npx vitest run --project unit`: 122/122 qua.
- **Chạy thật** (`next start` + DB Docker; script tạo phiên tạm rồi xoá sau khi chạy): 28/28 bước qua.
  - Preview che email; attempt không tồn tại trả 404.
  - Trạng thái trên trang giám sát: chưa vào phiên → đang làm 1/10 → bị khoá.
  - Thao tác: Mở khoá thì sinh viên hết khoá, `failedCount` về 0; gia hạn +5 phút thì đồng hồ sinh viên tăng từ 599 lên 899 s; gia hạn riêng chặn ở 60 phút; số phút không hợp lệ trả `INVALID_INPUT`.
  - Cron giữ phiên mở khi còn giờ gia hạn riêng, và đóng phiên sau khi đã thu bài.
  - 25 s không có tín hiệu thì hiện "Mất kết nối".
  - Phân quyền và thu bài: sinh viên gọi `monitor` / `actions` nhận 403; attempt của phiên khác trả 404; thu bài ra điểm; thu lần 2 trả `ATTEMPT_ALREADY_SUBMITTED`; trang chi tiết có đủ 3 sự kiện của giáo viên.
- **Ảnh chụp** 1280 px, 360 px và tiếng Anh: trang không cuộn ngang (bảng cuộn bên trong `TableWrap`), không có lỗi trên trang. Hộp thoại gia hạn đặt focus vào nút +5; nút "Theo dõi" có trên màn chiếu.

---

## Task 5.4 — Gắn cờ bài làm nghi vấn

**Nguyên tắc:** chỉ **ghi nhận và gợi ý**, không tự trừ điểm hay khoá bài; giáo viên là người quyết định. Sinh viên được thông báo trước ở phòng chờ: "Hệ thống ghi nhận việc rời khỏi trang làm bài và đổi thiết bị."

### Schema (`npx prisma migrate dev --name add_attempt_events`)
```prisma
model AttemptEvent {
  id         String           @id @default(cuid())
  attemptId  String
  type       AttemptEventType
  at         DateTime         // thời điểm phía client (đã kẹp trong khoảng làm bài)
  durationMs Int?             // thời gian rời tab
  deviceId   String?
  ip         String?
  createdAt  DateTime         @default(now())
  attempt    Attempt          @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  @@index([attemptId, at])
}
enum AttemptEventType { tab_hidden window_blur copy paste device_changed }
model Attempt {
  // ...
  deviceId String? // thiết bị đầu tiên làm bài
  flags    Json?   // [{ code, severity, detail }] — tính lại bởi evaluateFlags
}
```

### Thu thập (client `studentAttempt.tsx`)
- `visibilitychange`: ghi lúc ẩn, khi hiện lại tạo sự kiện `tab_hidden` kèm `durationMs`. `blur` không kèm ẩn tab (chuyển sang cửa sổ khác) → `window_blur`. Bỏ qua sự kiện < 1 s.
- `copy` / `paste` trong vùng câu hỏi → sự kiện tương ứng (không gửi nội dung).
- Mã thiết bị: `crypto.randomUUID()` lưu `localStorage` key `bkquiz_device_id`, gửi qua header `x-bkquiz-device` ở các request `state` / `answers` / `events`.
- Hàng đợi sự kiện lưu `localStorage` (giống cơ chế đáp án offline), gửi theo lô ≤ 50 khi tab hiện lại hoặc mỗi 10 s: `POST api/attempts/[attemptId]/events`. Mất mạng → gửi sau, không làm phiền sinh viên.

### Server
- `POST api/attempts/[attemptId]/events`: chủ attempt, attempt `active`; zod mảng ≤ 50; kẹp `at` trong `[attemptStartedAt, now]`; rate limit `proctorEvents`.
- `state` / `answers`: lần đầu có header thiết bị → lưu `Attempt.deviceId`; khác thiết bị đã lưu → tạo `device_changed` (tối đa 1 lần / thiết bị mới).
- **Hàm thuần** `src/server/suspicion.ts` → `evaluateFlags({ events, attempt, assignedCount, checkpointLogs, sharedDeviceUserIds })`:

| Mã | Điều kiện (hằng số chỉnh được) | Mức |
|---|---|---|
| `TAB_AWAY` | ≥ 3 lần rời tab **hoặc** tổng rời tab ≥ 60 s | cảnh báo; ≥ 10 lần hoặc ≥ 5 phút → cao |
| `FAST_SUBMIT` | Nộp sau < max(60 s, 10 s × số câu) và điểm ≥ 80% | cảnh báo |
| `DEVICE_CHANGED` | Có ≥ 2 thiết bị trong 1 bài | cảnh báo |
| `SHARED_DEVICE` | Cùng mã thiết bị làm bài cho ≥ 2 tài khoản trong cùng phiên | cao |
| `TOKEN_GUESSING` | ≥ 3 lần nhập token sai trong cả bài | cảnh báo |
| `COPY_PASTE` | Có sự kiện `paste` | cảnh báo |

- Tính lại và lưu `Attempt.flags` khi nhận lô sự kiện, khi đổi thiết bị và khi nộp bài; `SHARED_DEVICE` tính ở mức session trong `monitor`.
- Unit test `suspicion.test.ts` cho từng luật và ngưỡng biên.

### UI
- Trang giám sát (5.3): cột **Nghi vấn** — `Badge` vàng (cảnh báo) / hồng (cao) kèm mã ngắn; lọc "Chỉ bài nghi vấn".
- Trang chi tiết bài làm (Đợt 4 Task 3): mục mới **Hành vi khi làm bài** — danh sách cờ kèm lý do bằng lời ("Rời trang 4 lần, tổng 2 phút 10 giây"), dòng thời gian gộp `AttemptEvent` với `CheckpointLog`.
- `teacherScreen.tsx` bảng điểm: chỉ thêm dấu ⚑ cạnh tên (không ghi lý do vì đang chiếu); CSV thêm cột `flags`.
- **Ước lượng:** 6–8 giờ.

### ✅ Đã làm (26/11/2026)
- **Khác thiết kế:**
  - **Không lưu cột `Attempt.flags`**: cờ được **tính lúc đọc** (`computeSessionFlags` trong `src/server/suspicionData.ts`).
    - Chỉ cần 5 truy vấn gộp cho cả phiên (`groupBy` sự kiện và nhật ký checkpoint, danh sách thiết bị), đủ rẻ để gọi mỗi 3 s.
    - Cờ luôn khớp dữ liệu mới nhất, không phải nhớ tính lại ở các chỗ ghi dữ liệu (nhận sự kiện, nộp bài, nhập token sai).
  - **Bỏ cột `ip`** khỏi `AttemptEvent`, vì luật dựa trên IP đã bị loại; bớt được dữ liệu cá nhân phải lưu.
  - `deviceId` chỉ lưu với sự kiện `device_changed`. Unique `(attemptId, type, deviceId)` + `createMany skipDuplicates` → mỗi thiết bị mới ghi đúng 1 lần dù client poll mỗi 1,5 s.
  - Client **không được** gửi `device_changed`: sự kiện này chỉ do server tạo, từ header thiết bị.
  - `TOKEN_GUESSING` đếm `verify_fail` + `locked` trong `CheckpointLog`. Không dùng `failedCount`, vì giá trị này bị đặt về 0 khi nhập đúng hoặc khi giáo viên mở khoá.
  - `TAB_AWAY` gộp cả rời tab (`tab_hidden`) và chuyển cửa sổ (`window_blur`).
- **Migration** `add_attempt_events`: model `AttemptEvent`, enum `AttemptEventType` (`tab_hidden`, `window_blur`, `copy`, `paste`, `device_changed`), cột `Attempt.deviceId`.
- **Server:**
  - `src/server/suspicion.ts` (hàm thuần): `evaluateFlags`, `THRESHOLDS`, `countSharedDeviceAccounts`, `parseDeviceId`.
  - `src/server/suspicionData.ts`: `computeSessionFlags` và `recordAttemptDevice` (được gọi trong `state`, `answers`, `events`).
  - API mới `POST attempts/[id]/events`:
    - Nhận lô ≤ 50 sự kiện; `durationMs` tối đa 3 giờ.
    - Thời điểm do client gửi được kẹp vào khoảng [lúc bắt đầu làm bài, bây giờ].
    - Bài đã nộp trả 409 (client bỏ hàng đợi).
    - Rate limit nhóm mới `proctorEvents` (60 / phút).
  - `monitor` trả thêm `flags`, `flaggedCount`. `report/scoreboard` trả thêm `flagged`, CSV có thêm cột `flags`. Chi tiết bài làm trả thêm `events`, `flags`.
- **Client:**
  - `src/utils/deviceId.ts`: mã thiết bị 32 ký tự hex, tạo bằng `crypto.getRandomValues` (chạy được cả trên http qua LAN, nơi `randomUUID` không có).
  - `attempt/[attemptId]/useAttemptProctoring.ts`:
    - Ghi rời tab / chuyển cửa sổ kèm thời lượng; bỏ qua lần < 1 s.
    - Ghi copy / paste, không gửi nội dung.
    - Hàng đợi trong localStorage (tối đa 500 sự kiện), gửi theo lô mỗi 10 s, khi có mạng trở lại và khi rời trang (`keepalive`).
    - Chỉ chạy khi đang làm bài trong phiên đang chạy.
  - `studentAttempt.tsx`: header `x-bkquiz-device` cho `state` và `answers`.
- **Giao diện:**
  - Phòng chờ có thông báo minh bạch, nói rõ những gì được ghi nhận và rằng nội dung sao chép không được gửi đi.
  - Trang giám sát: cột **Nghi vấn** (tag vàng = cảnh báo, hồng = mức cao), bộ lọc "Nghi vấn N".
  - Chi tiết bài làm, mục **Hành vi khi làm bài**:
    - Mỗi cờ là một câu bằng lời, ví dụ "Rời trang làm bài 4 lần, tổng 1 phút 14 giây."
    - Dòng nhắc "chỉ là gợi ý, không tự trừ điểm".
    - Dòng thời gian sự kiện kèm thời lượng.
  - Màn chiếu: dấu ⚑ cạnh tên trong bảng điểm, không ghi lý do.
  - i18n đủ vi/en (thêm 41 key; tiếng Anh dùng plural). Toàn bộ 1946 message ICU parse không lỗi.
- **Test:** `suspicion.test.ts` 17 test (ngưỡng biên của từng luật, thứ tự cờ, dùng chung thiết bị, kiểm tra mã thiết bị). `npx vitest run --project unit`: 139/139 qua.
- **Chạy thật** (`next start` + DB Docker). Script tạo phiên tạm và một tài khoản sinh viên thứ hai tạm, rồi xoá hết sau khi chạy.
  - **API, 17/17 qua:**
    - Lưu thiết bị đầu tiên.
    - Nhận lô sự kiện; thời điểm lệch bị kẹp lại.
    - Từ chối `device_changed` do client gửi và lô > 50 sự kiện.
    - Cờ `TAB_AWAY` + `COPY_PASTE`.
    - Đổi thiết bị ghi đúng 1 lần dù poll 3 lần → `DEVICE_CHANGED`.
    - 3 lần nhập token sai → `TOKEN_GUESSING`.
    - Tài khoản thứ hai dùng cùng thiết bị → `SHARED_DEVICE` (mức cao) trên cả hai tài khoản.
    - Bảng điểm và CSV có cờ.
    - Sinh viên đọc chi tiết bài làm nhận 403; gửi sự kiện sau khi nộp nhận 409.
    - Trả lời đúng 10/10 rồi nộp sau 2 s → `FAST_SUBMIT`.
  - **Chrome thật, 8/8 qua:**
    - Trình duyệt tự gửi mã thiết bị.
    - Rời tab 2,5 s và chuyển cửa sổ 1,5 s được ghi kèm thời lượng; lần chớp tắt < 1 s bị bỏ qua; paste tới được server.
    - Hàng đợi được gửi hết.
    - Màn chiếu hiện ⚑; phòng chờ hiện thông báo.
    - Không có lỗi trên trang.
    - Do Chrome headless luôn báo trang "visible", trạng thái hiển thị được giả lập bằng cách ghi đè `document.visibilityState`, rồi phát sự kiện thật cho hook xử lý.

---

## Task 5.5 — Phân tích câu hỏi + biểu đồ

Làm theo **thiết kế [Đợt 4 Task 4](#task-4--thống-kê-câu-hỏi--biểu-đồ--tạm-hoãn)** (hàm thuần `questionStats.ts`, API `report/questionStats`, trang `dashboard/sessions/[sessionId]/stats`). Điều chỉnh:
- Dùng `scoring.ts` (5.1) thay vì đọc lại logic chấm; bài thu hộ (5.3) được tính như bài nộp.
- Giao diện theo hệ bảng đen: thẻ tổng quan `Card`, số lớn `font-script`; histogram điểm bằng cột CSS màu `chalk-blue`; thanh phương án: đáp án đúng `chalk-green`, nhiễu được chọn nhiều nhất `chalk-yellow`; nhãn "Khó" / "Dễ" / "Cần xem lại" là `Badge` (hồng / xanh lá / vàng) kèm chữ, không chỉ dựa vào màu.
- Mở từ nút "Thống kê" trên `teacherScreen.tsx` và trên trang giám sát.
- Unit test `questionStats.test.ts`: độ phân biệt `null` khi < 10 bài, nhóm 27% cao/thấp, câu biến thể chỉ đếm bài được giao.
- **Ước lượng:** 4–5 giờ.

### ✅ Đã làm (26/11/2026)
- **`src/server/questionStats.ts`** (hàm thuần): `computeQuestionStats({ questions, attempts })` trả về:
  - `summary`: số bài nộp, điểm trung bình / trung vị / thấp nhất / cao nhất, tính theo % điểm trên số câu được giao.
  - `histogram`: 10 khoảng; bài đạt 100% được xếp vào khoảng cuối.
  - Cho từng câu: `n`, `avgScore` (lấy từ `questionScores` đã chấm), `correctRate`, `unansweredRate`, `discrimination`, lượt chọn từng phương án, `topDistractor`, nhãn `hard` (< 30% đúng), `easy` (> 85% đúng), `review` (độ phân biệt < 0,2).
  - `correctRate` dùng `scoreQuestion(...).isFullyCorrect` của 5.1, tức là phải chọn đúng chính xác tập đáp án đúng, không phụ thuộc chế độ chấm. Ở chế độ chấm từng phần, `avgScore` có thể cao hơn `correctRate`.
- **API** `GET sessions/[id]/report/questionStats` (chỉ giáo viên). Kết quả tính trên bài `submitted`, trong đó có cả bài giáo viên thu hộ.
- **Trang** `dashboard/sessions/[id]/stats`:
  - 4 ô tổng quan, số hiển thị bằng chữ viết tay `font-script` như `.scoreBig`.
  - Phân bố điểm bằng cột CSS:
    - Chỉ một chuỗi dữ liệu nên chỉ dùng một màu `chalk-blue`, không cần chú giải.
    - Cột cách nhau 2px, đầu cột bo 4px, mọc từ đường đáy.
    - Có tooltip `title`, văn bản cho trình đọc màn hình (`sr-only`) và bảng số liệu "Xem dạng bảng".
  - Danh sách câu có thể sắp xếp theo thứ tự / khó nhất / độ phân biệt thấp nhất. Mỗi câu là một `<details>` (khung `.box`) chứa thanh tỉ lệ chọn từng phương án:
    - đáp án đúng màu `chalk-green`, kèm tag "Đáp án đúng";
    - nhiễu được chọn nhiều nhất màu `chalk-yellow`, kèm tag;
    - các phương án còn lại màu `chalk-dim`.
  - Chú thích giải nghĩa các chỉ số; ghi chú khi phiên chưa kết thúc.
  - Nút **Thống kê** có ở màn chiếu (mở tab mới) và trang Theo dõi.
- Màu dùng đúng token phấn có sẵn, không thêm thư viện biểu đồ. Nguyên tắc biểu đồ theo skill dataviz.
- i18n: namespace mới `SessionStats` (44 key), cộng `open_stats` trong `TeacherScreen` và `SessionMonitor`, đủ vi/en.
- **Test:** `questionStats.test.ts` 8 test (không có bài nộp, đếm lượt chọn, phân bố điểm, đề biến thể, ngưỡng 10 bài cho độ phân biệt, độ phân biệt, nhãn, chấm từng phần).
- **Giao diện:** chụp ở 1280 px và 360 px, trang không cuộn ngang. Bản đầu ở 360 px bị bóp tiêu đề và nội dung câu hỏi; đã sửa bằng `min-w` để phần thừa xuống dòng (sửa luôn tiêu đề trang Theo dõi).

---

## Task 5.6 — Test e2e luồng thi + tài liệu

- Sửa `playwright.config.ts`: bỏ `db-server:memory` (không tồn tại); e2e chạy với Postgres Docker, database riêng `bkquiz_test` (`DATABASE_URL` trong `.env.test`, `prisma migrate deploy` trước khi chạy), `DEV_BYPASS_AUTH=1`.
- `tests/e2e/ExamFlow.e2e.ts` — 2 browser context (giáo viên / sinh viên, cookie `bkquiz_dev_role` riêng):
  1. Giáo viên tạo lớp, pool (import Markdown từ `docs/cau-hoi-mau.md`), quiz, session qua API; bắt đầu session.
  2. Sinh viên join lớp bằng mã → phòng chờ → làm bài, chọn vài đáp án.
  3. Lấy token từ `teacherToken`, sinh viên nhập ở checkpoint (rút ngắn mốc bằng env `CHECKPOINT_TEST_SECONDS` chỉ khi `NODE_ENV=test`).
  4. Sinh viên nhập sai 6 lần → trang giám sát hiện "Bị khoá" → giáo viên mở khoá → sinh viên nộp bài.
  5. Bảng điểm có điểm đúng; trang thống kê hiện đúng số bài.
- Cập nhật `docs/trang-thai-du-an-hien-tai.md` (mục 1, 3, nhật ký), `docs/api.md` (endpoint mới), `docs/database.md` (bảng / cột mới); i18n đủ vi/en cho mọi chuỗi mới (namespace `SessionMonitor`, `SessionStats`, key mới trong `AttemptDetail`, `TeacherScreen`, `Attempt`).
- **Ước lượng:** 3–4 giờ.

### ✅ Đã làm (26/11/2026)
- **`playwright.config.ts`:**
  - Bỏ script `db-server:memory` (không tồn tại).
  - Server e2e chạy riêng ở **cổng 3300** (`E2E_PORT`) với **database riêng `bkquiz_e2e`** (`E2E_DATABASE_URL`) trên Postgres Docker. Lệnh khởi động là `prisma migrate deploy` (tự tạo database nếu chưa có) → `build:next` → `next start`.
  - Không dùng `next dev` vì Next 16 chỉ cho chạy 1 dev server mỗi thư mục, sẽ đụng dev server của người dùng. Không dùng cổng 3000 vì `reuseExistingServer` sẽ dùng nhầm dev server đang nối với DB thật.
  - Env của server: `DEV_BYPASS_AUTH=1`, `BKQUIZ_CHECKPOINT_SECONDS=10`, `RATE_LIMIT_DISABLED=1`.
  - Đặt `PW_CHANNEL=chrome` thì chạy bằng Chrome đã cài trên máy, khỏi phải `npx playwright install`.
- **`checkpointPolicy.ts`:** `checkpointIntervalOverride` đọc `BKQUIZ_CHECKPOINT_SECONDS` (5–300 s). Biến này **chỉ có tác dụng khi `DEV_BYPASS_AUTH=1`**, nên không thể bật nhầm trên bản chạy thật. Có 2 unit test.
- **`tests/e2e/ExamFlow.e2e.ts`** — 2 browser context (giáo viên / sinh viên):
  1. Dựng dữ liệu qua API: giáo viên tạo lớp, sinh viên tham gia bằng mã lớp; tạo pool 3 câu có tag; tạo quiz đã xuất bản kèm luật; tạo phiên 15 phút.
  2. Giáo viên bấm **Bắt đầu** trên màn chiếu.
  3. Sinh viên vào phòng chờ (kiểm tra có thông báo minh bạch), bấm **Vào làm bài**, chọn đáp án.
  4. Hộp thoại checkpoint hiện ra; nhập sai 3 lần thì hiện "Sai: 1/2/3" và ô nhập bị khoá (cooldown).
  5. Giáo viên mở trang **Theo dõi**, thấy "Đang chờ (nhập sai)", bấm **Mở khoá**, có toast xác nhận; hộp thoại bên sinh viên đóng lại.
  6. Checkpoint tiếp theo: nhập token đúng lấy từ màn chiếu (API `teacherToken`), hộp thoại đóng.
  7. Sinh viên trả lời 2 câu còn lại, **Nộp bài**, xác nhận.
  8. Bảng điểm có 3/3. Trang Theo dõi hiện "Đã nộp · Điểm 3". Trang **Thống kê** có 1 bài nộp và 3 câu. Trang chi tiết bài làm có sự kiện "Giáo viên mở khoá".
  9. Sinh viên gọi `monitor` / `questionStats` nhận 403.
  10. Dọn dẹp: kết thúc rồi xoá phiên. Lớp / pool / quiz được giữ lại, tên có dấu thời gian nên các lần chạy không đụng nhau.
- **Kết quả:** chạy 2 lần liên tiếp đều qua, test mất khoảng 44 s, cộng khoảng 1 phút build. DB `bkquiz` của người dùng không bị ghi gì (đã kiểm tra bằng truy vấn).
- **Lệnh:** `PW_CHANNEL=chrome npm run test:e2e:exam` (script mới), cần `docker compose up -d`.
- **Chưa làm:**
  - **CI** (`.github/workflows/CI.yml`) vẫn dùng các script của boilerplate (`build-local`, `db-server:memory`) nên job e2e trên CI vốn đã hỏng. Muốn chạy được cần thêm service Postgres vào workflow.
  - Các file e2e cũ (`I18n`, `Sanity`, `Visual`) chưa được rà lại theo giao diện mới.
- **Tài liệu:** `docs/api.md` mục 9 (endpoint mới của Đợt 5), `docs/database.md` mục 5 (bảng / cột / enum mới), `bkquiz-web/README.md` (cách chạy test).

---

## Ước lượng tổng
| # | Task | Ước lượng |
|---|---|---|
| 5.1 | Hàm thuần + unit test | 4–5 giờ |
| 5.2 | Rate limit | 3–4 giờ |
| 5.3 | Giám sát + can thiệp | 6–8 giờ |
| 5.4 | Gắn cờ nghi vấn | 6–8 giờ |
| 5.5 | Thống kê câu hỏi | 4–5 giờ |
| 5.6 | E2E + tài liệu | 3–4 giờ |
| | **Tổng** | **26–34 giờ** |

Mỗi task xong: `npm run check:types`, ESLint file đã sửa, `npm test`, `npm run check:i18n`, chạy thật với Docker Postgres rồi mới sang task sau. Mỗi task 1 commit (migration đi cùng commit của task).

## Kiểm tra Đợt 5 (chạy thật, 1 giáo viên + 2 sinh viên — 2 cửa sổ ẩn danh)
1. (5.1) `npm test` xanh; nộp 1 bài ở cả 3 chế độ chấm → điểm giống trước khi tách code.
2. (5.2) Như mục 8 phần Kiểm tra của Đợt 4.
3. (5.3) Sinh viên A tắt mạng (DevTools → Offline) → "Mất kết nối" sau ~20 s; B nhập sai 6 lần → "Bị khoá" → Mở khoá → B làm tiếp; gia hạn A +5 phút → chỉ đồng hồ A đổi; thu bài B → có điểm, `CheckpointLog` có `teacher_submit`; session không tự đóng khi A còn giờ gia hạn.
4. (5.4) A chuyển tab 3 lần → cờ `TAB_AWAY`; A mở bài trên trình duyệt thứ hai → `DEVICE_CHANGED`; B đăng nhập tài khoản thứ hai trên cùng trình duyệt của A → `SHARED_DEVICE`; tắt mạng khi rời tab rồi bật lại → sự kiện vẫn tới server.
5. (5.5) Số lượt chọn từng phương án khớp với đáp án đã làm thủ công; histogram đúng số bài.
6. (5.6) `npm run test:e2e` chạy xanh trên máy có Docker.
7. Sinh viên gọi `monitor`, `actions`, `questionStats` → 403; giáo viên lớp khác → 403.
8. Giao diện các trang mới: 360 px và 1280 px, vi/en, chỉ dùng bàn phím, `prefers-reduced-motion`.

---

# 📋 Kế hoạch thực hiện — Đợt 4: Quản lý session & phân tích kết quả cho giáo viên

> Lập ngày: 12/11/2026 · Chi tiết hoá: 13/11/2026 · Cập nhật tiến độ: 27/11/2026 (đã chạy thật Task 0–3) — dựa trên [trang-thai-du-an-hien-tai.md](./trang-thai-du-an-hien-tai.md).

## Tiến độ

| # | Task | Trạng thái |
|---|---|---|
| 0 | Sửa chấm điểm theo câu được giao | ✅ Xong, đã chạy thật (27/11): đề biến thể giao 10/12 câu, điểm tối đa = 10 |
| 1 | Gia hạn thời gian | ✅ Xong, đã chạy thật (27/11): +5 phút → giờ kết thúc của sinh viên lùi đúng 300 s |
| 2 | Xoá / huỷ session | ✅ Xong, đã chạy thật (27/11): huỷ phiên lobby, xoá phiên đã kết thúc, phiên đang chạy → 409 `SESSION_ACTIVE`. Nút xoá trong `SessionsList` để sau |
| 3 | Chi tiết bài làm từng sinh viên | ✅ Xong, đã chạy thật (test e2e `ExamFlow` + kiểm tra 27/11; sinh viên gọi → 403) |
| 4 | Thống kê câu hỏi + biểu đồ | ✅ Làm ở Đợt 5 (Task 5.5) |
| 5 | i18n & tài liệu | ⏸ Tạm hoãn phần tổng kết; key i18n và tài liệu vẫn cập nhật theo từng task (Task 1–3 đã thêm) |
| 6 | Rate limit API | ✅ Làm ở Đợt 5 (Task 5.2) — thiết kế gốc giữ ở dưới |

Ngày 13/11 các task chỉ qua kiểm tra tĩnh vì database không chạy. Ngày 27/11 đã chạy thật trên Docker Postgres (script API với phiên tạm, đã xoá sau khi chạy; cài đặt quiz được khôi phục): 9/9 đạt — xem kết quả cuối mục [Kiểm tra](#kiểm-tra).

**Thứ tự tiếp theo:** Task 6 (rate limit) → Task 4 → Task 5.

## Phạm vi

Đợt này **chỉ làm một phần**, **ưu tiên chức năng chưa làm** (mục 3 của tài liệu trạng thái). Ban đầu chọn 3 chức năng cùng một luồng (giáo viên quản lý session → xem kết quả), dữ liệu đã có sẵn, **không cần migration**; ngày 13/11/2026 bổ sung rate limit API (cần 1 migration):

1. **Huỷ / xoá session** và **gia hạn thời gian** khi session đang chạy.
2. **Giáo viên xem chi tiết bài làm từng sinh viên.**
3. **Thống kê theo câu hỏi** và **biểu đồ** (tạm hoãn).
4. **Rate limit cho API** (bổ sung 13/11/2026 — Task 6, cần 1 migration).

**Để sau:** phát hiện hành vi bất thường, test nghiệp vụ, loại câu hỏi khác, đăng nhập khác Google, tài liệu người dùng; các mục chưa hoàn thiện (archive lớp, vai trò TA, sửa hồ sơ, checklist deploy, dọn code chết, môi trường test).

### Phát hiện khi đọc code (ảnh hưởng thiết kế)
- **Lỗi chấm điểm với đề biến thể:** `api/sessions/[sessionId]/join/route.ts:157-162` cho mỗi sinh viên một tập con câu (`commonIds + variantIds`) lưu trong `AttemptQuestion`, nhưng `api/attempts/[attemptId]/submit/route.ts` chấm trên **toàn bộ** `SessionQuestionSnapshot` của session → câu không được giao tính 0 điểm và lọt vào `questionScores`. Chi tiết bài làm và thống kê đều dựa vào `questionScores` nên phải sửa trước (Task 0).
- `questionScores` có key = `SessionQuestionSnapshot.id`.
- Sinh viên poll `api/attempts/[attemptId]/state` mỗi 1,5 s và đồng hồ dùng `attemptEndTime` do server tính (`calculateAttemptEndTime`) → gia hạn chỉ cần sửa phía server, client tự cập nhật.
- `teacherScreen.tsx` là màn hình chiếu nền đen toàn màn hình → chi tiết bài làm và thống kê làm **trang riêng** theo giao diện dashboard (mẫu: `sessions/[sessionId]/questions/page.tsx` + `QuestionsView.tsx`), teacherScreen chỉ thêm link.
- `api/sessions/[sessionId]/status` chưa trả `durationSeconds`/`bufferMinutes` → cần bổ sung để hiện giờ kết thúc khi gia hạn.

---

## Task 0 — Sửa chấm điểm theo câu được giao ✅ (13/11/2026)
- `submit/route.ts`: lấy `attemptQuestion.findMany({ where: { attemptId }, select: { sessionQuestionId } })`; nếu có bản ghi thì lọc `snapshots` theo tập id đó (không có → giữ hành vi cũ cho dữ liệu cũ). `totalQuestions` = số câu sau lọc.
- Bài đã nộp trước đó không chấm lại (ghi chú trong tài liệu).
- **Đã làm:** đúng như trên. Cách lọc khớp với `api/attempts/[attemptId]/questions` (cũng ưu tiên `AttemptQuestion`, không có thì lấy toàn bộ câu).

## Task 1 — Gia hạn thời gian ✅ (13/11/2026)
**Server helper** `src/server/attemptTimeLimit.ts`:
```ts
export type SessionTimeSettings = { durationSeconds?: number; bufferMinutes?: number; extensionSeconds?: number };
export function getEffectiveDurationSeconds(s: SessionTimeSettings | null): number | null // duration + extension, null nếu không có duration
export function calculateSessionEndTime(startedAt: Date, s): Date | null // startedAt + effective + buffer (mặc định 5)
```
- `calculateAttemptEndTime` dùng 2 helper trên (cả mốc attempt và mốc session đều cộng extension).
- `api/sessions/auto/route.ts` (khối auto-end, dòng ~104-111): thay công thức tay bằng `calculateSessionEndTime`.
- `api/attempts/[attemptId]/questions/route.ts:46-51`: chỉ đọc `reviewDelayMinutes` — kiểm tra lại, đổi nếu có tính giờ kết thúc.

**API mới** `src/app/api/sessions/[sessionId]/extend/route.ts` — `POST`
- `requireUser` → `requireSessionAccess(userId, sessionId, 'teacher')`; body zod `{ minutes: int 1..60 }`.
- Session phải `active` và có `durationSeconds`, nếu không → 400 `SESSION_NOT_ACTIVE` / `NO_TIME_LIMIT`.
- Giới hạn tổng gia hạn ≤ 120 phút (`EXTENSION_LIMIT`).
- Cập nhật `settings.extensionSeconds += minutes*60` (merge JSON, giữ các field khác). Trả `{ extensionSeconds, sessionEndTime }`.
- Attempt đã bị coi là hết giờ nhưng chưa nộp sẽ được làm tiếp (vì `state` tính lại) — chấp nhận, ghi chú.

**`status/route.ts`**: trả thêm `durationSeconds`, `bufferMinutes`, `extensionSeconds`, `sessionEndTime` (từ helper).

**UI `teacherScreen.tsx`**: khi `active` và có thời lượng, cạnh nút "Kết thúc" thêm nhóm nút `+5` `+10` `+15` phút (confirm) → gọi `extend` → `fetchStatus()`; thanh thông tin hiển thị giờ kết thúc và "(+N phút)" nếu đã gia hạn.

**Đã làm — khác/bổ sung so với kế hoạch:**
- Thêm hằng `DEFAULT_BUFFER_MINUTES = 5`, `MAX_EXTENSION_SECONDS = 120 * 60` trong `attemptTimeLimit.ts`.
- `extend` dùng **khoá lạc quan** theo `updatedAt` (`updateMany` có điều kiện) → 2 lần bấm đồng thời không ghi đè nhau; trả 409 `SESSION_CHANGED` nếu xung đột.
- `api/attempts/[attemptId]/questions` không cần sửa (chỉ đọc `reviewDelayMinutes`).
- i18n: 6 key `TeacherScreen` (`confirm_extend`, `extend_minutes`, `extend_hint`, `extend_limit`, `ends_at`, `extended_by`).
- Cần xem khi chạy thật: thanh trên cùng có thể chật khi hiện cả nút gia hạn, Kết thúc và Làm mới token.

## Task 2 — Xoá / huỷ session ✅ (13/11/2026)
**API mới** `src/app/api/sessions/[sessionId]/route.ts` — `DELETE`
- Teacher của session. `active` → 409 `SESSION_ACTIVE`. `lobby`/`ended` → `prisma.quizSession.delete` (cascade sẵn trong schema: attempt, answer, snapshot, checkpointLog).
- Trả `{ ok: true, classroomId }` để UI điều hướng.

**UI**
- `teacherScreen.tsx`: nút "Xoá session" khi `lobby` (confirm thường, nhãn "Huỷ session") hoặc `ended` (bắt gõ lại tên session/quiz vì mất toàn bộ bài làm — giống Danger Zone xoá lớp). Xong `router.push` về `/dashboard/classes/[classroomId]`.
- `classes/[classId]/shared/SessionsList.tsx` (danh sách session trong trang lớp giáo viên): thêm nút xoá ở dòng `lobby`/`ended` nếu thuận tiện; không bắt buộc.

**Đã làm — khác/bổ sung so với kế hoạch:**
- Xoá bằng `deleteMany` với điều kiện `status in (lobby, ended)` thay cho `delete`: nếu session vừa được cron tự bắt đầu ngay trước khi xoá thì không xoá nhầm, trả `SESSION_ACTIVE`. Đã kiểm tra schema: mọi bảng con (Attempt, Answer, AttemptQuestion, CheckpointLog, SessionQuestionSnapshot, SessionOptionSnapshot, SessionCommonQuestion) đều `onDelete: Cascade`.
- Session `lobby`: nút **Huỷ session** trên thanh trên cùng, cạnh nút Bắt đầu (`window.confirm`).
- Session `ended`: thẻ **Vùng nguy hiểm** cuối màn hình tổng kết, hiện số bài làm sẽ mất, nhắc tải CSV trước; phải gõ đúng tên session (hoặc tên quiz nếu session không đặt tên) mới bấm được **Xoá session**.
- Xoá xong chuyển về trang chi tiết lớp.
- **Chưa làm:** nút xoá trong `SessionsList.tsx` (không bắt buộc) — để sau.
- i18n: 8 key `TeacherScreen` (`cancel_session`, `confirm_cancel_session`, `delete_session_active`, `danger_zone`, `delete_session_title`, `delete_session_warning`, `delete_session_confirm_label`, `delete_session_button`).

## Task 3 — Chi tiết bài làm từng sinh viên ✅ (13/11/2026)
**API mới** `src/app/api/sessions/[sessionId]/attempts/[attemptId]/route.ts` — `GET`
- Teacher của session; `attempt.sessionId !== sessionId` → 404.
- Response:
```ts
{
  attempt: { id, status, score, maxScore, attemptStartedAt, submittedAt, failedCount, lockedUntil },
  user: { id, name, email },
  questions: Array<{ sessionQuestionId, order, type, prompt,
    options: { order, content, isCorrect, selected: boolean }[],
    answered: boolean, score: number | null }>,   // theo AttemptQuestion.order
  checkpoints: Array<{ type, ok, enteredToken, dueAt, createdAt }>,
  scoring: { mode }  // từ quiz.settings.scoring
}
```
- Truy vấn: `attemptQuestion.findMany({ include: sessionQuestion { options } })`, `answer.findMany`, `checkpointLog.findMany` theo attempt. `score` lấy `questionScores[id]` (null nếu chưa nộp).

**UI** trang mới `dashboard/sessions/[sessionId]/attempts/[attemptId]/page.tsx` (server: `requireUser` + `getUserRole` teacher, giống `questions/page.tsx`) + `AttemptDetailView.tsx` (client):
- Đầu trang: tên/email, trạng thái, điểm `score/maxScore`, thời gian làm.
- Danh sách câu: dùng `MathRenderer` như `QuestionsView`; phương án đúng viền xanh, đã chọn đúng ✓, chọn sai ✗ đỏ, bỏ sót đúng gạch chân; điểm câu bên phải. Bộ lọc: tất cả / sai / chưa trả lời.
- Timeline checkpoint (verify_ok / verify_fail / locked) theo thời gian.
- `teacherScreen.tsx`: cột `col_attempt` trong bảng điểm thành link "Xem bài làm" (`getI18nPath`, `target="_blank"` vì màn hình chiếu).

**Đã làm — khác/bổ sung so với kế hoạch:**
- API trả thêm `session { id, status, title, classroomName }` (cho breadcrumb, tiêu đề) và `isFullyCorrect` cho từng câu (dùng cho bộ lọc, không phụ thuộc chế độ chấm).
- Attempt cũ không có `AttemptQuestion` → lấy toàn bộ câu của session, giống `attempts/[attemptId]/questions` và `submit` (Task 0).
- `attemptId` thuộc session khác → 404 `ATTEMPT_NOT_FOUND` (không lộ là attempt có tồn tại).
- Bài **đang làm** cũng xem được: hiện đáp án đã lưu, điểm câu để trống, có dòng nhắc "chưa nộp bài".
- `maxScore` = số câu được giao (mỗi câu tối đa 1 điểm).
- Thứ tự phương án hiển thị theo snapshot (A, B, C…), không theo thứ tự xáo trên màn hình sinh viên.
- Đầu trang có 4 ô: điểm (kèm chế độ chấm), số câu đúng hoàn toàn / số câu chưa trả lời, thời gian làm (bắt đầu – nộp), số lần nhập token sai (hoặc thời điểm bị khoá).
- Phương án bỏ sót đáp án đúng: viền xanh **nét đứt** (thay cho gạch chân), có nhãn "Đáp án đúng"; có chú thích màu.
- Bộ lọc: Tất cả / Sai hoặc thiếu / Chưa trả lời, kèm số lượng.
- Trên bảng điểm của màn hình giáo viên, cột Attempt nay hiện link "Xem bài làm" (mở tab mới; id đầy đủ trong tooltip).
- i18n: namespace mới `AttemptDetail` (49 key) + `TeacherScreen.view_attempt` (892 key/ngôn ngữ).

## Task 4 — Thống kê câu hỏi + biểu đồ ➡️ (đã làm ở Đợt 5, Task 5.5)
**Hàm thuần** `src/server/questionStats.ts` (để sau này viết test được):
```ts
computeQuestionStats(input: {
  attempts: { id; score: number; questionScores: Record<string, number> }[],
  assigned: Map<attemptId, Set<sessionQuestionId>>,
  answers: { attemptId; sessionQuestionId; selected: number[] }[],
  questions: { id; order; type; prompt; options: { order; content; isCorrect }[] }[],
}) => { summary, histogram, questions }
```
- Chỉ attempt `submitted`. Với mỗi câu: `n` (số bài được giao câu), `avgScore`, `correctRate` (điểm = 1), `unansweredRate`, `optionCounts[]`, `discrimination` = avgScore nhóm 27% điểm tổng cao − 27% thấp (null nếu < 10 bài).
- `summary`: số bài nộp, điểm TB/trung vị/cao/thấp (theo % để so sánh khi số câu khác nhau).
- `histogram`: 10 khoảng theo % điểm.

**API mới** `src/app/api/sessions/[sessionId]/report/questionStats/route.ts` — `GET`, teacher; gọi hàm trên.

**UI** trang mới `dashboard/sessions/[sessionId]/stats/page.tsx` + `SessionStatsView.tsx`:
- 4 thẻ tổng quan (dùng `Card`), histogram điểm bằng cột `div` CSS (chiều cao theo %), tooltip `title`.
- Bảng câu hỏi sắp xếp được theo độ khó / độ phân biệt; gắn nhãn "Khó" (<30% đúng), "Dễ" (>85%), "Cần xem lại" (độ phân biệt < 0,2).
- Mở rộng từng câu: thanh ngang tỉ lệ chọn mỗi phương án, đáp án đúng màu `success`, nhiễu được chọn nhiều nhất nổi bật.
- Không thêm thư viện chart. Màu dùng token sẵn có của Tailwind theme dự án.
- `teacherScreen.tsx`: nút "Thống kê" cạnh "Tải CSV" ở thẻ bảng điểm (khi session `ended` hoặc có bài nộp).

## Task 5 — i18n & tài liệu ⏸ (tạm hoãn)
- Key mới: `TeacherScreen` (extend_*, delete_*, view_attempt, view_stats), namespace mới `AttemptDetail`, `SessionStats`; thêm đủ vào `src/locales/en.json` và `vi.json`; tiêu đề tab qua `generateMetadata`.
- Cập nhật `docs/trang-thai-du-an-hien-tai.md`: gạch 3 mục trong mục 3, thêm nhật ký thay đổi (nêu cả lỗi chấm đề biến thể đã sửa).

## Task 6 — Rate limit API ➡️ (đã làm ở Đợt 5, Task 5.2)

**Vấn đề:** `src/proxy.ts` bỏ qua mọi `/api/*` nên Arcjet không bảo vệ API; `verifyToken` chỉ có cooldown theo attempt, chưa giới hạn theo người dùng/IP. Mã lớp có thể bị dò qua `classes/preview` và `classes/join`.

**Lựa chọn lưu bộ đếm: Postgres** (đã chốt 13/11/2026). Lý do: chạy đúng cả local lẫn Vercel nhiều instance (bộ nhớ RAM thì mỗi instance đếm riêng), không thêm dịch vụ ngoài, test được ngay không cần `ARCJET_KEY`. Đổi lại cần 1 migration và mỗi request được giới hạn tốn 1 lần ghi DB → chỉ áp cho endpoint nhạy cảm / ghi dữ liệu, không áp cho endpoint poll liên tục.

### Schema + migration
```prisma
model RateLimit {
  key         String
  windowStart DateTime
  count       Int      @default(0)
  @@id([key, windowStart])
  @@index([windowStart])
}
```
`npx prisma migrate dev --name add_rate_limit`. Lưu ý: đã có migration chưa commit `20261113020017_duy` (bỏ default id của Account/Session/User) — giữ nguyên, migration mới nối sau.

### Helper `src/server/rateLimit.ts`
```ts
export const RATE_LIMITS = {
  verifyToken:  { limit: 10,  windowSeconds: 60 },   // nhập token checkpoint
  classJoin:    { limit: 10,  windowSeconds: 60 },   // classes/join, classes/preview (dò mã lớp)
  sessionJoin:  { limit: 20,  windowSeconds: 60 },
  answers:      { limit: 120, windowSeconds: 60 },   // PUT answers (client debounce 500 ms)
  submit:       { limit: 10,  windowSeconds: 60 },
  poolImport:   { limit: 5,   windowSeconds: 600 },
  write:        { limit: 60,  windowSeconds: 60 },   // tạo/sửa/xoá chung của giáo viên
} as const;
export function getWindowStart(now: Date, windowSeconds: number): Date   // hàm thuần, có unit test
export async function checkRateLimit(name, identifier): Promise<{ ok; remaining; retryAfterSeconds }>
export async function enforceRateLimit(name, identifier): Promise<NextResponse | null> // 429 hoặc null
export function getClientIp(req: Request): string  // x-forwarded-for (phần tử đầu) → x-real-ip → 'unknown'
```
- Đếm theo cửa sổ cố định bằng **một câu SQL nguyên tử** (`prisma.$queryRaw`): `INSERT … ON CONFLICT (key, "windowStart") DO UPDATE SET count = count + 1 RETURNING count`.
- Key = `${name}:${userId}`; `classJoin` đếm thêm theo IP để chặn nhiều tài khoản cùng máy.
- Vượt giới hạn → 429 `{ error: 'RATE_LIMITED', retryAfterSeconds }` + header `Retry-After`.
- **Fail-open:** lỗi DB khi đếm → ghi log và cho qua.
- Tắt bằng env `RATE_LIMIT_DISABLED=1` (thêm vào `.env.example`).
- Dọn bản ghi cũ hơn 1 ngày trong `api/sessions/auto`.

### Áp dụng (ngay sau `requireUser`)
| Nhóm | Endpoint |
|---|---|
| `verifyToken` | `attempts/[attemptId]/verifyToken` |
| `classJoin` | `classes/join`, `classes/preview` |
| `sessionJoin` | `sessions/[sessionId]/join` |
| `answers` | `attempts/[attemptId]/answers` (PUT) |
| `submit` | `attempts/[attemptId]/submit` |
| `poolImport` | `pools/import` |
| `write` | POST/PATCH/DELETE của classes, members, quizzes, pools, questions, sessions, start/end/extend, tags |

**Không áp dụng:** GET poll liên tục (`attempts/*/state` 1,5 s/lần, `sessions/*/status`, `teacherToken`, `joinedStudents`, report), `auth/*`, `health`, `sessions/auto` (đã có `CRON_SECRET`), `dev/*`.

### Client
- `studentAttempt.tsx`: PUT answers bị 429 vẫn giữ `dirty` + localStorage (code hiện tại đã làm vậy khi `!r.ok`) → không mất bài. `verifyToken` gặp `RATE_LIMITED` → thông báo "thao tác quá nhanh, thử lại sau N giây" (phân biệt với `COOLDOWN` có sẵn).
- Form của giáo viên: hiện thông báo chung khi gặp `RATE_LIMITED`.

### Test
- Unit test `src/server/rateLimit.test.ts`: `getWindowStart`, `getClientIp`.

## Thứ tự & ước lượng
| # | Task | Ước lượng |
|---|---|---|
| 0 | Sửa chấm theo câu được giao | 0,5 giờ |
| 1 | Gia hạn | 2–3 giờ |
| 2 | Xoá session | 1–2 giờ |
| 3 | Chi tiết bài làm | 3–4 giờ |
| 4 | Thống kê + biểu đồ | 4–5 giờ |
| 5 | i18n, tài liệu | 1 giờ |
| 6 | Rate limit API | 3–4 giờ |

Mỗi task xong → chạy kiểm tra tĩnh rồi mới sang task sau.

## Kiểm tra
- **Kết quả chạy thật (27/11/2026):**
  - Bước 1 (đề biến thể), 2 (gia hạn, phần đồng hồ), 5 (huỷ / xoá) và 6 (sinh viên → 403): đạt, bằng script API trên `next start`.
  - Bước 3: phủ bởi test e2e `ExamFlow`.
  - Bước 4 và 8: làm ở Đợt 5 (Task 5.5, 5.2).
  - Bước 7: đã mở 12 trang giáo viên + 6 trang sinh viên ở cả vi và en, không có key chưa dịch hay lỗi console.
  - Chưa thử riêng: gọi `sessions/auto` sau khi gia hạn (logic đã có unit test ở `attemptTimeLimit.test.ts`).
- Tĩnh: `npx tsc --noEmit`; ESLint cho file mới; `npm test`; script so khớp key en/vi.
- Chạy thật (bật Docker Desktop + DB, `npm run dev`), 1 tài khoản giáo viên + 2 sinh viên (dùng `DEV_BYPASS_AUTH=1` đổi role):
  1. Quiz có % câu dư > 0 → session → 2 sinh viên join, xác nhận số câu mỗi người khác tổng snapshot; nộp bài → điểm tối đa = số câu được giao (Task 0).
  2. Đang làm bài → giáo viên +5 phút → đồng hồ sinh viên tăng trong ~2 s; gọi `POST /api/sessions/auto` trước giờ kết thúc mới → session không bị đóng.
  3. Dùng pool [`cau-hoi-mau.md`](./cau-hoi-mau.md); sinh viên làm vài câu đúng, vài câu sai, bỏ trống vài câu rồi nộp → bảng điểm → "Xem bài làm": điểm từng câu cộng lại bằng điểm tổng, số câu = số câu được giao, ✓/✗/viền nét đứt đúng, bộ lọc đếm đúng, nhật ký checkpoint khớp token log. Mở khi sinh viên đang làm → điểm câu trống, có dòng nhắc chưa nộp. Sinh viên mở URL trang → về dashboard; `attemptId` của session khác → 404.
  4. Trang thống kê: số lượt chọn khớp đáp án đã làm thủ công; histogram đúng số bài.
  5. Xoá session lobby và ended thành công; xoá session active → lỗi `SESSION_ACTIVE`.
  6. Tài khoản sinh viên gọi `extend`, `DELETE`, `attempts/[id]` (và `questionStats` khi làm Task 4) → 403.
  7. Chuyển vi/en trên các trang mới.
  8. (Task 6, khi làm) Console cửa sổ sinh viên gọi 12 lần `fetch('/api/classes/preview?classCode=XXXX')` → từ lần 11 trả 429 + `Retry-After`, sau 60 s gọi lại được; psql `SELECT * FROM "RateLimit" ORDER BY "windowStart" DESC LIMIT 5;`. Làm bài bình thường (chọn nhanh nhiều đáp án, nhập token) → không gặp 429. `RATE_LIMIT_DISABLED=1` → không chặn.
