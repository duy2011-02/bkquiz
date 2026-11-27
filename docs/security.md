# 🔐 Security & Permission (BKquiz)

## 1) Authentication
- Bắt buộc login.
- Google OAuth (MVP), thiết kế sẵn để mở rộng SSO trường.

## 2) Authorization (RBAC + membership)
- Role hệ thống: `teacher`, `student`.
- Quyền thao tác dựa trên:
  - role
  - membership trong `Classroom`
  - quyền trên `QuestionPool` (owner/share/group)

## 3) Permission matrix (tóm tắt)
### 3.1 Classroom
- Teacher owner:
  - create/update class, create quiz, start session, xem report.
- Student:
  - join class, join session, answer/submit.

### 3.1b Vai trò trong lớp: chủ lớp, sinh viên (cập nhật Đợt 7, 27/11/2026)
Lớp chỉ có 2 vai trò (`ClassMembership.roleInClass`): **chủ lớp** (`teacher`) và **sinh viên** (`student`). Vai trò trợ giảng (TA) làm ở Đợt 6 đã được **gỡ bỏ ở Đợt 7**, kể cả giá trị `ta` trong enum `ClassroomRole` (migration `remove_classroom_ta_role`).

| Việc | Chủ lớp | Sinh viên |
|---|---|---|
| Xem màn chiếu, Theo dõi, Thống kê, chi tiết bài làm, câu hỏi của phiên | ✓ | ✗ |
| Mở khoá / gia hạn riêng / thu bài; bắt đầu / kết thúc / gia hạn chung phiên | ✓ | ✗ |
| Tạo / huỷ / xoá phiên | ✓ | ✗ |
| Thêm / xoá / chặn thành viên | ✓ | ✗ |
| Đổi tên / sửa tag / lưu trữ / xoá lớp | ✓ | ✗ |
| Làm bài trong phiên | ✗ | ✓ |

Hàm kiểm tra (`src/server/authz.ts`):
- `requireSessionAccess(…, 'teacher')`: chủ lớp hoặc chủ quiz của phiên.
- `canTeachSession`: dùng cho các trang giáo viên của phiên (kiểm tra quyền trên phiên, không theo vai trò hệ thống đang chọn).
- `requireSessionOwner`: huỷ / xoá phiên.
- `requireClassroomOwnership`: tạo phiên, quản lý thành viên, cài đặt lớp.

### 3.1c Vai trò hệ thống: ai được làm giáo viên (Đợt 7, 27/11/2026)
- **Lần đăng nhập đầu** (`User.onboardedAt` trống): dashboard chuyển sang `/onboarding` để chọn **Sinh viên / học sinh** hoặc **Giáo viên**.
  - Sinh viên: dùng ngay (`UserRole student`).
  - Giáo viên: gửi yêu cầu (trường / đơn vị, ghi chú) → `TeacherRequest` trạng thái `pending`. Trong lúc chờ, tài khoản dùng giao diện sinh viên kèm ghi chú "đang chờ duyệt".
- **Quản trị viên** = email trong biến môi trường `ADMIN_EMAILS` (`src/server/admin.ts`). Trang `/dashboard/admin` (link "Quản trị (n)" trên sidebar, chỉ quản trị viên thấy):
  - **Duyệt** → thêm `UserRole teacher`.
  - **Từ chối** (kèm lý do; người gửi xem lý do và gửi lại ở trang Hồ sơ).
  - **Thu hồi** quyền giáo viên (không tự thu hồi chính mình). Lớp / quiz cũ vẫn thuộc người đó, nhưng họ không tạo mới được (`requireTeacher`).
- **Không ai tự cấp vai trò được.** `POST /api/user/switch-role` chỉ chuyển giữa các vai trò đã có, nếu không thì `403 ROLE_NOT_GRANTED`. Trước Đợt 7, route này tự tạo `UserRole teacher`, nên ai cũng tự thành giáo viên được.
- **Ô chọn vai trò** ở chân trang chỉ hiện khi tài khoản có cả 2 vai trò (giáo viên đã được duyệt). Riêng chế độ dev (`DEV_BYPASS_AUTH=1`) luôn hiện, để chuyển giữa 2 tài khoản dev.
- Người dùng có trước Đợt 7 được migration đánh dấu đã chọn vai trò, và giữ nguyên vai trò đang có.

### 3.2 QuestionPool
- Owner: full quyền.
- Shared:
  - `view`: xem pool + câu hỏi + đáp án.
  - `use`: view + được dùng trong quiz/rules.
  - `edit`: use + CRUD question/option/tag (soft-delete).

## 4) Token & anti-abuse
- TOTP stepSeconds cấu hình được (ví dụ 45s); verify cho phép lệch **±1 window** (theo thông lệ TOTP).
- Rate limit verify token theo `attemptId`.
- Giới hạn số lần sai (`failedCount`) theo checkpoint.
- Cooldown + lock attempt:
  - Nếu sai liên tiếp: tăng `failedCount` và đặt `cooldownUntil`.
  - Nếu vượt ngưỡng: đặt `lockedUntil` hoặc `status='locked'` (không cho làm/submit cho đến khi hết lock).
  - Default đề xuất (đơn giản, đủ dùng):
    - `maxFailedPerCheckpoint = 6`
    - `cooldownAfterFailed = 3` lần sai → `cooldownSeconds = 30`
    - `lockAfterFailed = 6` lần sai → `lockMinutes = 5`

## 5) Audit & immutability (freeze theo session)
- Khi start session:
  - materialize câu hỏi + snapshot để đảm bảo lịch sử.
- Sau khi session start:
  - sửa pool/question/option không ảnh hưởng session.

## 6) Data hygiene
- Soft-delete question/option để tránh gãy lịch sử.
- Index các trường hot: classCode, tag pivot, poolId, sessionId, attemptId.

## 7) Mất mạng / quay lại (offline behavior)
- Frontend nên **cache answers local** (localStorage/IndexedDB) và retry gửi lại khi online.
- Backend là nguồn sự thật:
  - Khi quay lại, `GET /api/attempts/:attemptId/state` trả về `blocked`, `dueAt`, `lockedUntil` để UI render đúng trạng thái.
- Nếu mất mạng đúng lúc đến hạn checkpoint:
  - Khi online lại, nếu `now >= dueAt` thì attempt bị **blocked** ngay và bắt verify token.


