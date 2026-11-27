# 🔌 API (BKquiz)

Tài liệu này mô tả contract API ở mức endpoint + mục đích. Chi tiết request/response (JSON schema) sẽ được bổ sung khi implement.

## Nguyên tắc
- Phân quyền theo **role** và **membership**.
- Với session đã start: dữ liệu câu hỏi trả về cho student dựa trên **snapshot**.

## 1) Auth
- `GET /api/auth/*` (Auth.js/NextAuth)

## 2) Class
- `POST /api/classes` (teacher)
- `GET /api/classes/preview?classCode=...` (public: preview class info trước khi join)
- `POST /api/classes/join` (student, classCode)
- `GET /api/classes` (teacher/student: danh sách lớp)

## 3) Question bank (Pool/Tag/Share)
- `POST /api/pools` (teacher)
- `GET /api/pools` (teacher: own + shared)
- `GET /api/pools/:poolId` (teacher có quyền view/use/edit)
- `POST /api/pools/:poolId/share` (teacher owner hoặc edit)
- `POST /api/pools/:poolId/questions` (teacher có quyền edit)
- `PATCH /api/questions/:questionId` (teacher có quyền edit)
- `POST /api/tags` (teacher)
- `GET /api/tags` (teacher)

## 4) Quiz authoring (rule-based)
- `POST /api/quizzes` (teacher)
- `GET /api/quizzes?classroomId=...` (teacher)
- `GET /api/quizzes/:quizId` (teacher)
- `POST /api/quizzes/:quizId/rules` (teacher)
  - hỗ trợ:
    - same-set: `count`
    - variant-set: `commonCount` + `variantCount`
- `GET /api/quizzes/:quizId/preview` (teacher: trả về đủ/thiếu theo từng rule)
- `POST /api/quizzes/:quizId/publish` (teacher, optional)

## 5) Session runtime
- `POST /api/sessions` (teacher start session; materialize + snapshot)
  - variant-set: materialize “session pool” đủ cho common + variant (có thể cảnh báo nếu thiếu)
- `GET /api/sessions/:sessionId/teacherToken` (teacher screen: QR join URL + token + countdown)
- `POST /api/sessions/:sessionId/join` (student join session → attempt)
- `GET /api/sessions/:sessionId/status` (student: lobby state: started? ended? startTime?)

### 5.1 Session status model (đề xuất)
- `status`: `scheduled | active | ended`
- `scheduled`: session được tạo nhưng teacher chưa start (student vào lobby)
- `active`: đang làm quiz
- `ended`: đã kết thúc (student chỉ xem kết quả nếu cho phép)

### 5.2 QR join URL (đã chốt)
- QR code chứa URL join theo `sessionId` (ví dụ: `/join/session/{sessionId}`), student đăng nhập xong sẽ vào lobby/join attempt.

## 6) Attempt & answers
- `GET /api/attempts/:attemptId/state` (student: blocked?, dueAt, questions snapshot, current answers, sessionName)
  - variant-set: trả về danh sách câu theo `AttemptQuestion` (order theo attempt)
  - `sessionName`: Tên session (từ settings) hoặc tên quiz
- `GET /api/attempts/:attemptId/questions` (student: questions với review info nếu có)
  - Response: `{ questions: [...], canReview: boolean, reviewWindowEnd?: Date, questionScores?: {...} }`
  - `canReview`: Chỉ true khi session ended + trong review window + teacher cho phép
  - `reviewWindowEnd`: Thời điểm kết thúc review window
  - `questionScores`: Điểm từng câu (cached trong Attempt.questionScores)
- `POST /api/attempts/:attemptId/answers` (student: lưu đáp án)
- `POST /api/attempts/:attemptId/verifyToken` (student: verify checkpoint token)
- `POST /api/attempts/:attemptId/submit` (student: submit)
  - Tính và cache `questionScores` vào `Attempt.questionScores` (JSONB)

## 6b) Report (tối thiểu)
- `GET /api/sessions/:sessionId/report/scoreboard` (teacher: bảng điểm cả lớp)
- `GET /api/sessions/:sessionId/report/tokenLog` (teacher: log verify token tối thiểu)

## 7) Scoring (MCQ single/multi)
Chấm điểm dựa trên snapshot:
- **all_or_nothing**: đúng toàn bộ tập đáp án → full điểm, sai → 0
- **partial** (multi-select):
  - **EDC (Every Decision Counts)**: mỗi lựa chọn là 1 “decision”; đúng được cộng, sai bị trừ gián tiếp vì “không đúng decision”.
    - Nếu có \(n\) options: mỗi decision trị giá \(1/n\) điểm.
    - Điểm = (số decision đúng) / n.
    - Tham khảo: Open edX “Every Decision Counts (EDC)” trong tài liệu [Award Partial Credit](https://docs.openedx.org/en/latest/educators/how-tos/course_development/exercise_tools/add_multi_select_partial_credit.html).
  - **By Halves**: mỗi lỗi làm “nửa” điểm còn lại; 0 lỗi=100%, 1 lỗi=50%, 2 lỗi=25%, >=3 lỗi=0 (có điều kiện theo số đáp án).
    - Tham khảo: Open edX “By Halves” trong tài liệu [Award Partial Credit](https://docs.openedx.org/en/latest/educators/how-tos/course_development/exercise_tools/add_multi_select_partial_credit.html).
- **penalty**: chọn sai bị trừ điểm (đảm bảo không âm)

**Thang điểm (27/11/2026):** mỗi câu được chấm trong khoảng 0–1, tổng là điểm thô `score` (tối đa = số câu được giao). Điểm trả cho giao diện được quy về **thang 10**: `grade = score / totalQuestions × 10`, làm tròn 2 chữ số. Ví dụ 5 câu thì mỗi câu 2 điểm, 20 câu thì mỗi câu 0,5 điểm.
- Các response có điểm của bài làm trả thêm `grade`, `correctCount` (số câu đúng hoàn toàn) và `totalQuestions`: `attempts/:id/submit`, `attempts/:id/state`, `sessions` (GET, sinh viên), `classes/:id/sessions`, `students/performance` (`averageScore` / `highestScore` cũng theo thang 10), `sessions/:id/monitor`, `sessions/:id/attempts/:attemptId`, `sessions/:id/attempts/:attemptId/actions` (thu bài), `report/scoreboard`.
- `report/scoreboard` xếp theo `grade`; CSV có thêm cột `grade`, `correctCount`, `totalQuestions` (cột `score` vẫn là điểm thô).

Gợi ý cấu hình (đặt trong `Quiz.settings`):
- `scoringMode`: `all_or_nothing | partial | penalty`
- `partialCreditMethod` (khi scoringMode=partial): `edc | halves`
- `penaltyPerWrongOption`: số điểm trừ cho mỗi lựa chọn sai (khi scoringMode=penalty)

## 8) `Quiz.settings` (đề xuất schema JSON dùng thống nhất)
Mục tiêu: đặt tên field chuẩn để DB/API/UI không lệch nhau.

- `durationSeconds`: int
- `questionMode`: `same_set | variant_set`
- `navigationMode`: `free | forward_only` (default: `free`)
- `variant` (khi questionMode=variant_set):
  - `defaultExtraPercent`: number (ví dụ 0.2)
  - `perTagExtraPercent`: record(tagNormalizedName -> number) (optional override theo tag)
- `checkpoint`:
  - `tokenStepSeconds`: 45
  - `minIntervalSeconds`: 240
  - `maxIntervalSeconds`: 300
  - `hardBlock`: true
  - `graceSecondsBeforeBlock`: 5
  - `maxFailedPerCheckpoint`: 6
  - `cooldownAfterFailed`: 3
  - `cooldownSeconds`: 30
  - `lockAfterFailed`: 6
  - `lockMinutes`: 5
- `scoring`:
  - `mode`: `all_or_nothing | partial | penalty`
  - `partialCreditMethod`: `edc | halves` (khi mode=partial)
  - `penaltyPerWrongOption`: number (khi mode=penalty)
  - `rounding`: `none | round_2` (default: `round_2`)

## 9) Đợt 5 (26/11/2026) — giám sát, chống gian lận, thống kê, rate limit

### 9.1 Giám sát phiên thi (teacher)
- `GET /api/sessions/:sessionId/monitor` — trạng thái trực tiếp từng sinh viên (poll 3 s)
  - Response: `{ serverTime, session: { status, title, classroomName, hasTimeLimit, maxExtraSeconds }, summary: { <liveStatus>: n }, flaggedCount, students: [...] }`
  - `liveStatus`: `not_joined | not_started | working | checkpoint_due | cooldown | locked | offline | time_up | submitted` (`offline` = không có tín hiệu > 20 s)
  - Mỗi sinh viên: `answeredCount/assignedCount`, `timeRemaining`, `extraSeconds`, `failedCount`, `lastSeenAt`, `canUnlock`, `flags[]`
- `POST /api/sessions/:sessionId/attempts/:attemptId/actions` — xử lý sự cố một sinh viên
  - Body: `{ action: 'unlock' } | { action: 'extend', minutes: 1..30 } | { action: 'submit' }`
  - Lỗi: `NOT_LOCKED`, `EXTENSION_LIMIT` (tổng gia hạn riêng ≤ 60 phút), `ATTEMPT_CHANGED` (409), `SESSION_NOT_ACTIVE`, `ATTEMPT_ALREADY_SUBMITTED`, `ATTEMPT_NOT_STARTED`, `NO_TIME_LIMIT`; attempt của session khác → 404
  - Mỗi thao tác ghi `CheckpointLog` loại `teacher_unlock | teacher_extend | teacher_submit`

### 9.2 Gắn cờ nghi vấn
- `POST /api/attempts/:attemptId/events` (student) — lô ≤ 50 sự kiện `{ type: 'tab_hidden' | 'window_blur' | 'copy' | 'paste', at, durationMs? }`; bài đã nộp → 409
- Header `x-bkquiz-device` (mã thiết bị ngẫu nhiên của trình duyệt) gửi kèm `state`, `answers`, `events` → ghi thiết bị đầu tiên / sự kiện `device_changed`
- Cờ (`{ code, severity: 'warn' | 'high', params }`) được tính khi đọc, trả trong: `monitor` (`students[].flags`), `GET /api/sessions/:sessionId/attempts/:attemptId` (`flags`, `events`), `report/scoreboard` (`attempts[].flagged`; CSV thêm cột `flags`)
- Mã cờ: `TAB_AWAY`, `FAST_SUBMIT`, `DEVICE_CHANGED`, `SHARED_DEVICE`, `TOKEN_GUESSING`, `COPY_PASTE` (ngưỡng: `src/server/suspicion.ts`)

### 9.3 Thống kê câu hỏi (teacher)
- `GET /api/sessions/:sessionId/report/questionStats`
  - Response: `{ session, summary: { submitted, meanPercent, medianPercent, minPercent, maxPercent }, histogram: [{ from, to, count }] × 10, questions: [...] }`
  - Mỗi câu: `n`, `avgScore`, `correctRate` (chọn đúng chính xác), `unansweredRate`, `discrimination` (nhóm 27% cao − 27% thấp; null khi < 10 bài), `options[{ order, content, isCorrect, count, rate }]`, `topDistractor`, `labels` (`hard | easy | review`)
  - Chỉ tính bài đã nộp; đề biến thể: mỗi câu chỉ tính trên các bài được giao câu đó

### 9.4 Rate limit
- 37 endpoint ghi / nhạy cảm trả `429 { error: 'RATE_LIMITED', retryAfterSeconds }` + header `Retry-After` khi vượt giới hạn (bảng giới hạn: `RATE_LIMITS` trong `src/server/rateLimit.ts`). Không áp cho các GET được poll liên tục. Tắt bằng `RATE_LIMIT_DISABLED=1`.

### 9.5 Thay đổi khác
- `GET /api/classes/preview` bắt buộc đăng nhập (401), không còn trả `ownerTeacher.id`; `ownerTeacher.email` đã che bớt (`ab***@domain`)
- Các route `/api/attempts/:attemptId/*`: attempt không tồn tại → `404 ATTEMPT_NOT_FOUND` (trước đây 403)

## 10) Đợt 6 (27/11/2026) — chức năng còn thiếu

### 10.1 Quiz
- `POST /api/quizzes/:quizId/duplicate` `{ title? }` — chỉ chủ quiz. Tạo bản **nháp** chép cài đặt, luật chọn câu, tag; trả `201 { quiz: { id, title, status } }`.
- `DELETE /api/quizzes/:quizId/rules?ruleId=` — luật phải thuộc đúng quiz, không thì `404 RULE_NOT_FOUND` (trước đây xoá được luật của quiz khác).

### 10.2 Lớp: lưu trữ, trợ giảng
- `PATCH /api/classes/:classId` `{ name?, archived? }` — chỉ chủ lớp. Lưu trữ khi lớp đang có phiên chạy → `409 CLASS_HAS_ACTIVE_SESSION`.
- `GET /api/classes`, `GET /api/classes/:classId` trả thêm `archivedAt`.
- Lớp đã lưu trữ → `409 CLASS_ARCHIVED` ở: `POST /api/sessions`, `POST /api/classes/join`, `GET /api/classes/preview`, `POST /api/classes/:classId/members`.
- ~~`PATCH /api/classes/:classId/members/:userId` (gán / bỏ trợ giảng)~~ — **đã gỡ ở Đợt 7** cùng vai trò trợ giảng (giờ trả 405).
- Quyền theo vai trò trong lớp (chủ lớp / sinh viên; bảng đầy đủ ở `docs/security.md` mục 3.1b). Chỉ chủ lớp: `POST /api/sessions`, `DELETE /api/sessions/:id` (huỷ / xoá), `PATCH /api/classes/:id/tags`.

### 10.3 Ảnh trong câu hỏi
- `POST /api/uploads/question-image` (multipart, trường `file`) — giáo viên. Rate limit `imageUpload` (30 / 10 phút).
  - Nhận PNG / JPEG / WebP theo nội dung file (magic bytes), tối đa 2 MB.
  - Trả `201 { url }` (URL công khai trên MinIO / Supabase Storage).
  - Lỗi: `400 UNSUPPORTED_IMAGE | EMPTY_FILE | MISSING_FILE`, `413 FILE_TOO_LARGE`, `503 STORAGE_NOT_CONFIGURED`, `502 STORAGE_UNAVAILABLE`.
- `POST /api/pools/:poolId/questions` nhận thêm `imageUrl` (http(s), ≤ 1000 ký tự) và `imageAlt` (bắt buộc khi có ảnh, ≤ 300 ký tự). Dữ liệu sai → `400 INVALID_INPUT` (trước đây 500).
- Trả `imageUrl`, `imageAlt` ở:
  - danh sách câu của pool;
  - `attempts/:id/questions`;
  - `sessions/:id/questions`;
  - `sessions/:id/attempts/:attemptId`;
  - `report/questionStats`.
  - Các endpoint thuộc phiên trả ảnh **đã chép vào snapshot** của phiên.
- Markdown (nhập / xuất / `PATCH /api/questions/:id`): dòng `![mô tả](url)` riêng trong đề bài; xem `docs/import.md` mục 2.6.

### 10.4 Hồ sơ
- `PATCH /api/user/profile` `{ name }` — đổi tên hiển thị của chính mình (1–80 ký tự, gộp khoảng trắng). Sai → `400 INVALID_NAME`.

## 11) Đợt 7 (27/11/2026) — vai trò giáo viên do quản trị viên duyệt, nhập .zip kèm ảnh

### 11.1 Chọn vai trò lần đầu, yêu cầu làm giáo viên
- `POST /api/user/onboarding`:
  - body `{ role: 'student' }` hoặc `{ role: 'teacher', organization: 2..200, note?: ≤500 }`;
  - đặt `User.onboardedAt`; chọn giáo viên thì tạo `TeacherRequest` trạng thái `pending`;
  - gọi lần 2 → `409 ALREADY_ONBOARDED`; thiếu đơn vị → `400 INVALID_INPUT`.
- `GET /api/user/teacher-request` → `{ isTeacher, request: { status, organization, note, reviewNote, … } | null }`.
- `POST /api/user/teacher-request` `{ organization, note? }`: gửi / gửi lại (về `pending`). Đã là giáo viên → `409 ALREADY_TEACHER`.
- `POST /api/user/switch-role`: **không còn tự cấp vai trò**. Vai trò chưa có → `403 ROLE_NOT_GRANTED` (trừ chế độ dev).

### 11.2 Quản trị (email trong `ADMIN_EMAILS`, người khác → 403)
- `GET /api/admin/teacher-requests?status=pending|approved|rejected` → `{ status, requests[], counts }`.
- `POST /api/admin/teacher-requests/:id` `{ action: 'approve' | 'reject', reviewNote? }`:
  - duyệt = thêm `UserRole teacher`;
  - yêu cầu không còn `pending` → `409 REQUEST_ALREADY_REVIEWED`; không tồn tại → 404.
- `GET /api/admin/teachers` → `{ teachers: [{ id, name, email, organization, approvedAt, classCount, quizCount }] }`.
- `DELETE /api/admin/teachers/:userId`: thu hồi `UserRole teacher`. Chính mình → `400 CANNOT_REVOKE_SELF`; không phải giáo viên → 404.

### 11.3 Nhập `.zip` kèm ảnh
- `POST /api/pools/import` với file `.zip`: các dòng `![mô tả](assets/a.png)` (đường dẫn tương đối với thư mục chứa `questions.md`) được đọc trong zip, kiểm tra (PNG / JPEG / WebP, ≤ 2 MB, tối đa 100 ảnh), tải lên kho ảnh và thay bằng URL công khai.
- Response thêm `uploadedImages` (số ảnh đã tải lên) và `assetWarnings` (ảnh thiếu / sai loại / quá lớn / chưa cấu hình kho ảnh). `skippedQuestions` vẫn chỉ đếm câu bị bỏ qua.

### 11.4 Sửa mã lỗi
- `POST /api/classes`, `/api/pools` (GET / POST), `/api/quizzes` (GET / POST), `/api/quizzes/:id/preview`, `/api/pools/import`, `/api/students/performance`: sai vai trò hệ thống → **403** (trước đây lỗi phân quyền ném ra ngoài thành 500).
