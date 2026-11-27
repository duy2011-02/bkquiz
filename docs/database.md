# 🗄️ Database Schema (BKquiz)

Tài liệu này là **schema chi tiết** để implement với Postgres/Prisma.

## 1) Quy ước
- `id`: UUID (default gen_random_uuid()).
- `createdAt`, `updatedAt`: timestamptz.
- Soft-delete: `deletedAt` (nullable) cho Question/Option (khuyến nghị).
- Unique:
  - `User.email`
  - `Classroom.classCode`
  - `Tag.normalizedName` (tag scope = **global**)

## 2) ERD (khái quát)
```mermaid
erDiagram
  User ||--o{ UserRole : has
  User ||--o{ ClassMembership : joins
  Classroom ||--o{ ClassMembership : has
  Classroom ||--o{ Quiz : has
  Quiz ||--o{ QuizRule : defines
  QuizRule ||--o{ QuizRulePool : uses
  QuestionPool ||--o{ QuizRulePool : referenced

  User ||--o{ QuestionPool : owns
  QuestionPool ||--o{ Question : contains
  Question ||--o{ Option : has
  Question ||--o{ QuestionTag : tagged
  Tag ||--o{ QuestionTag : usedBy

  Quiz ||--o{ QuizSession : runs
  QuizSession ||--o{ SessionQuestion : includes
  SessionQuestion ||--o{ SessionQuestionSnapshot : snapshots

  QuizSession ||--o{ Attempt : has
  User ||--o{ Attempt : makes
  Attempt ||--o{ Answer : writes
  Attempt ||--o{ TokenCheckpoint : checks
```

## 3) Bảng chi tiết (đề xuất)

### 3.1 `User`
- `id` uuid PK
- `email` text UNIQUE NOT NULL
- `name` text NULL
- `imageUrl` text NULL
- `createdAt` timestamptz NOT NULL
- `updatedAt` timestamptz NOT NULL

### 3.2 `UserRole`
- `userId` uuid FK -> User(id)
- `role` text CHECK IN ('teacher','student')
- PK (`userId`,`role`)

### 3.3 `Classroom`
- `id` uuid PK
- `name` text NOT NULL
- `ownerTeacherId` uuid FK -> User(id)
- `classCode` text UNIQUE NOT NULL
- `createdAt`, `updatedAt`

### 3.4 `ClassMembership`
- `classroomId` uuid FK -> Classroom(id)
- `userId` uuid FK -> User(id)
- `roleInClass` text CHECK IN ('student','ta','teacher') DEFAULT 'student'
- `status` text CHECK IN ('active','left','banned') DEFAULT 'active'
- `joinedAt` timestamptz NOT NULL
- PK (`classroomId`,`userId`)

### 3.5 `QuestionPool`
- `id` uuid PK
- `name` text NOT NULL
- `visibility` text CHECK IN ('private','shared') DEFAULT 'private'
- `ownerTeacherId` uuid FK -> User(id) NULL (nếu ownerType=group)
- `ownerType` text CHECK IN ('user','group') DEFAULT 'user'
- `ownerGroupId` uuid NULL (mở rộng group)
- `createdAt`, `updatedAt`

### 3.6 `QuestionPoolShare`
- `poolId` uuid FK -> QuestionPool(id)
- `sharedWithTeacherId` uuid FK -> User(id)
- `permission` text CHECK IN ('view','use','edit')
- `createdAt` timestamptz NOT NULL
- PK (`poolId`,`sharedWithTeacherId`)

### 3.7 `Tag`
- `id` uuid PK
- `name` text NOT NULL
- `normalizedName` text NOT NULL
- `scope` text CHECK IN ('global') DEFAULT 'global'
- `createdAt`, `updatedAt`
- UNIQUE:
  - UNIQUE(`normalizedName`)

### 3.8 `Question`
- `id` uuid PK
- `poolId` uuid FK -> QuestionPool(id)
- `type` text CHECK IN ('mcq_single','mcq_multi')
- `prompt` text NOT NULL
- `createdByTeacherId` uuid FK -> User(id)
- `createdAt`, `updatedAt`
- `deletedAt` timestamptz NULL
- Index:
  - (`poolId`)
  - (`deletedAt`)

### 3.9 `Option`
- `id` uuid PK
- `questionId` uuid FK -> Question(id)
- `content` text NOT NULL
- `isCorrect` boolean NOT NULL DEFAULT false
- `order` int NOT NULL DEFAULT 0
- `createdAt`, `updatedAt`
- `deletedAt` timestamptz NULL
- Index:
  - (`questionId`)

### 3.10 `QuestionTag`
- `questionId` uuid FK -> Question(id)
- `tagId` uuid FK -> Tag(id)
- PK (`questionId`,`tagId`)
- Index:
  - (`tagId`,`questionId`) để query theo tag

### 3.11 `Quiz`
- `id` uuid PK
- `classroomId` uuid FK -> Classroom(id)
- `title` text NOT NULL
- `createdByTeacherId` uuid FK -> User(id)
- `settings` jsonb NOT NULL DEFAULT '{}' (duration, checkpoint policy, question mode, scoring…)
- `status` text CHECK IN ('draft','published','archived') DEFAULT 'draft'
- `createdAt`, `updatedAt`
- Index:
  - (`classroomId`)

### 3.12 `QuizRule`
- `id` uuid PK
- `quizId` uuid FK -> Quiz(id)
- `tagId` uuid FK -> Tag(id)
- `count` int NOT NULL CHECK (count > 0) -- tổng số câu theo tag trong mode same-set
- `commonCount` int NULL CHECK (commonCount >= 0) -- dùng trong mode variant-set
- `variantCount` int NULL CHECK (variantCount >= 0) -- dùng trong mode variant-set
- `filters` jsonb NOT NULL DEFAULT '{}' (difficulty/type…)
- `extraPercent` numeric NULL -- override theo tag (nếu NULL thì dùng `Quiz.settings.variant.defaultExtraPercent`)
- `createdAt`, `updatedAt`
  - Thứ tự override đề xuất:
    - nếu `QuizRule.extraPercent` != NULL: dùng giá trị này
    - else nếu có `Quiz.settings.variant.perTagExtraPercent[tag]`: dùng giá trị theo tag
    - else dùng `Quiz.settings.variant.defaultExtraPercent`
- Index:
  - (`quizId`)

### 3.13 `QuizRulePool`
- `quizRuleId` uuid FK -> QuizRule(id)
- `poolId` uuid FK -> QuestionPool(id)
- PK (`quizRuleId`,`poolId`)

### 3.14 `QuizSession`
- `id` uuid PK
- `quizId` uuid FK -> Quiz(id)
- `status` text CHECK IN ('active','ended') DEFAULT 'active'
- `startedAt` timestamptz NOT NULL
- `endedAt` timestamptz NULL
- `totpSecret` text NOT NULL
- `totpStepSeconds` int NOT NULL DEFAULT 45
- Index:
  - (`quizId`)
  - (`status`)

### 3.15 `SessionQuestion`
- `sessionId` uuid FK -> QuizSession(id)
- `questionId` uuid FK -> Question(id)
- `order` int NOT NULL
- PK (`sessionId`,`questionId`)
- UNIQUE (`sessionId`,`order`)

### 3.16 `SessionQuestionSnapshot`
- `id` uuid PK
- `sessionId` uuid FK -> QuizSession(id)
- `questionId` uuid FK -> Question(id)
- `promptSnapshot` text NOT NULL
- `optionsSnapshot` jsonb NOT NULL  -- danh sách option + text
- `correctSnapshot` jsonb NOT NULL  -- đáp án đúng (ids/index) cho chấm điểm
- `createdAt` timestamptz NOT NULL
- UNIQUE (`sessionId`,`questionId`)

### 3.17 `Attempt`
- `id` uuid PK
- `sessionId` uuid FK -> QuizSession(id)
- `studentUserId` uuid FK -> User(id)
- `status` text CHECK IN ('in_progress','submitted') DEFAULT 'in_progress'
- `startedAt` timestamptz NOT NULL
- `submittedAt` timestamptz NULL
- `score` numeric NULL
- Index:
  - (`sessionId`,`studentUserId`) UNIQUE (1 attempt mỗi SV mỗi session)

### 3.17b `AttemptQuestion`
Mapping bộ câu hỏi thực tế mà một sinh viên nhận trong session (để hỗ trợ mode variant-set).
- `attemptId` uuid FK -> Attempt(id)
- `questionId` uuid FK -> Question(id)
- `order` int NOT NULL
- PK (`attemptId`,`questionId`)
- UNIQUE (`attemptId`,`order`)
- Ghi chú:
  - Question content/đáp án để hiển thị/chấm điểm vẫn dựa trên `SessionQuestionSnapshot` (session-level).

### 3.18 `Answer`
- `attemptId` uuid FK -> Attempt(id)
- `questionId` uuid FK -> Question(id)
- `selected` jsonb NOT NULL DEFAULT '[]'
  - Đề xuất MVP (ổn định + không phức tạp): lưu theo **snapshot option order**:
    - MCQ single: `[2]` nghĩa là chọn option order=2 trong snapshot
    - MCQ multi: `[1,3]`
  - Lý do: session đã freeze theo snapshot; lưu theo snapshot giúp chấm điểm/hiển thị lại luôn đúng, không phụ thuộc optionId “live”.
- `updatedAt` timestamptz NOT NULL
- PK (`attemptId`,`questionId`)

### 3.18b Điểm per-question (MVP-friendly)
MVP khuyến nghị:
- dùng `points` trong metadata import để lưu vào `Quiz.settings` hoặc `Question` (tuỳ implement).
- nếu chưa có points: mặc định **1 điểm/câu**.

### 3.19 `TokenCheckpoint`
- `id` uuid PK
- `attemptId` uuid FK -> Attempt(id)
- `dueAt` timestamptz NOT NULL
- `verifiedAt` timestamptz NULL
- `failedCount` int NOT NULL DEFAULT 0
- `lastAttemptAt` timestamptz NULL
- Index:
  - (`attemptId`)
  - (`dueAt`)

## 4) Nhóm chuyên môn (mở rộng)
### 4.1 `DepartmentGroup`
- `id` uuid PK
- `name` text NOT NULL UNIQUE
- `createdAt`, `updatedAt`

### 4.2 `GroupMembership`
- `groupId` uuid FK -> DepartmentGroup(id)
- `teacherId` uuid FK -> User(id)
- `role` text CHECK IN ('owner','member') DEFAULT 'member'
- `createdAt` timestamptz NOT NULL
- PK (`groupId`,`teacherId`)

## 5) Thay đổi trong Đợt 5 (26/11/2026)

> Theo `bkquiz-web/prisma/schema.prisma` (tên bảng/cột theo Prisma, khác bản thiết kế ban đầu ở trên).

### 5.1 `RateLimit` (migration `add_rate_limit`)
Bộ đếm rate limit theo cửa sổ cố định.
- `key` text — `<nhóm>:user:<id>` hoặc `<nhóm>:ip:<ip>`
- `windowStart` timestamp
- `count` int DEFAULT 0
- PK (`key`, `windowStart`); index (`windowStart`) — cron `sessions/auto` xoá bản ghi cũ hơn 24 giờ

### 5.2 `Attempt` — cột mới (migration `add_attempt_monitoring`, `add_attempt_events`)
- `lastSeenAt` timestamp NULL — lần cuối client gọi `state`/`answers` (ghi tối đa 10 s/lần)
- `extraSeconds` int DEFAULT 0 — gia hạn riêng (cộng vào cả mốc kết thúc chung cho riêng bài này)
- `deviceId` text NULL — mã thiết bị đầu tiên làm bài

### 5.3 `CheckpointEventType` — giá trị mới
- `teacher_unlock`, `teacher_extend` (`dueAt` = giờ kết thúc mới), `teacher_submit`

### 5.4 `AttemptEvent` (migration `add_attempt_events`)
Hành vi khi làm bài, dùng để gắn cờ nghi vấn (không lưu nội dung copy/paste, không lưu IP).
- `id` cuid PK
- `attemptId` FK -> Attempt(id) ON DELETE CASCADE
- `type` enum `AttemptEventType`: `tab_hidden | window_blur | copy | paste | device_changed`
- `at` timestamp — thời điểm phía client, đã kẹp trong khoảng làm bài
- `durationMs` int NULL — với `tab_hidden` / `window_blur`
- `deviceId` text NULL — chỉ với `device_changed`
- `createdAt` timestamp
- UNIQUE (`attemptId`, `type`, `deviceId`) — mỗi thiết bị mới ghi 1 lần (NULL không trùng nhau nên sự kiện khác không bị ảnh hưởng); index (`attemptId`, `at`)

### 5.5 `Attempt` — điểm thang 10 (migration `add_attempt_result_counts`, 27/11/2026)
- `correctCount` int NULL — số câu đúng hoàn toàn (chọn đúng chính xác tập đáp án đúng)
- `totalQuestions` int NULL — số câu được giao cho bài này (đề biến thể: có thể khác nhau giữa các sinh viên)
- Cả hai ghi lúc nộp bài; migration điền lại cho các bài đã nộp trước đó.
- `score` vẫn là **điểm thô**: mỗi câu tối đa 1 điểm, tối đa = `totalQuestions`. Thống kê câu hỏi và cờ nghi vấn dùng điểm thô.
- Điểm hiển thị cho sinh viên / giáo viên là **thang 10**: `grade = score / totalQuestions × 10`, làm tròn 2 chữ số (`toTenPointScale` trong `src/server/scoring.ts`). Ví dụ 5 câu → mỗi câu 2 điểm; 20 câu → mỗi câu 0,5 điểm; tối đa luôn là 10.

## 6) Thay đổi trong Đợt 6 (27/11/2026)

### 6.1 `Classroom.archivedAt` (migration `add_classroom_archived`)
- `archivedAt` timestamp NULL — lớp đã lưu trữ (kết thúc): không tạo phiên, không tham gia bằng mã, không thêm thành viên; vẫn xem được kết quả. `NULL` = đang hoạt động.

### 6.2 Ảnh câu hỏi (migration `add_question_image`)
- `Question.imageUrl` text NULL, `Question.imageAlt` text NULL — ảnh minh hoạ (URL công khai) và mô tả cho trình đọc màn hình.
- `SessionQuestionSnapshot.imageUrl`, `imageAlt` — chép từ `Question` lúc tạo đề (`quizSnapshot.ts`). Sửa / bỏ ảnh trong ngân hàng không đổi đề của phiên đã tạo.
- File ảnh nằm trong bucket `bkquiz-media` (MinIO local / Supabase Storage), key `questions/<userId>/<id>.<ext>`. Xoá câu hỏi không xoá file ảnh (snapshot của phiên cũ vẫn dùng).

### 6.3 Không đổi schema
- ~~Vai trò trợ giảng dùng giá trị `ta` có sẵn trong `ClassroomRole`~~ — đã gỡ ở Đợt 7 (mục 7.1).
- Câu Đúng/Sai lưu như `mcq_single` có 2 phương án.

## 7) Thay đổi trong Đợt 7 (27/11/2026)

### 7.1 `ClassroomRole` bỏ `ta` (migration `remove_classroom_ta_role`)
- Enum chỉ còn `student`, `teacher`. Migration chuyển thành viên `ta` (nếu có) về `student`, rồi tạo lại kiểu enum (Postgres không xoá được một giá trị enum). Default cột `roleInClass` vẫn là `student`.

### 7.2 Chọn vai trò + yêu cầu làm giáo viên (migration `add_teacher_requests`)
- `User.onboardedAt` timestamp NULL: đã chọn vai trò ở lần đăng nhập đầu. Migration điền `now()` cho mọi user có sẵn. User dev tạo mới cũng được điền.
- Enum `TeacherRequestStatus`: `pending | approved | rejected`.
- Bảng `TeacherRequest`:
  - `id` cuid PK; `userId` UNIQUE FK → User (CASCADE): mỗi người 1 yêu cầu, gửi lại = cập nhật;
  - `organization` text (trường / đơn vị); `note` text NULL;
  - `status` (mặc định `pending`); `createdAt`, `updatedAt`;
  - `reviewedAt`, `reviewedById` (quản trị viên), `reviewNote` (lý do từ chối);
  - index (`status`, `createdAt`).
- Duyệt = thêm `UserRole(userId, teacher)`; thu hồi = xoá dòng đó. Quản trị viên xác định bằng env `ADMIN_EMAILS`, không lưu trong DB.
