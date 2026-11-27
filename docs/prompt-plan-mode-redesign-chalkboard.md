# Prompt cho Plan Mode — Thiết kế lại giao diện BKquiz theo phong cách "bảng đen lớp học"

> Dán toàn bộ phần dưới vào Claude Code khi đang ở **Plan Mode** (Shift+Tab hai lần), chạy tại thư mục `bkquiz/bkquiz-web`.

---

## Vai trò & chế độ làm việc

Bạn là kỹ sư frontend kiêm UI designer. Bạn đang ở **Plan Mode**: chỉ đọc code và lập kế hoạch, **không sửa file nào** cho đến khi tôi duyệt kế hoạch. Nếu có điểm thiết kế còn mơ hồ, hãy liệt kê thành câu hỏi ở cuối kế hoạch thay vì tự đoán.

## Bối cảnh dự án

- BKquiz: hệ thống quiz trên lớp có token TOTP 45s. Stack: Next.js 16 (App Router, `src/app/[locale]/...`), Tailwind CSS 4, next-intl (vi/en), Prisma.
- **Giao diện hiện tại của dashboard** (giáo viên + sinh viên) theo kiểu SaaS tối: nền charcoal `#101010`/`#141414`/`#181818`, CTA màu cam `#FF5A00`, font Inter. Token nằm ở:
  - `tailwind.config.ts` (colors `bg.*`, `text.*`, `primary.*`, `border.*`, radius, shadow, z-index…)
  - `src/styles/global.css` (biến `--bk-*`, nền gradient của `body`, focus ring)
- **Thiết kế chuẩn cần bám theo** là trang làm bài của sinh viên, đã làm theo phong cách lớp học:
  - `src/app/[locale]/(auth)/attempt/[attemptId]/chalkboard.module.css` — toàn bộ hệ thiết kế "bảng đen":
    - Token: `--chalk #f4f1ea`, `--chalk-dim`, `--chalk-faint`, `--chalk-yellow #f6e27f`, `--chalk-pink #f5a3b5`, `--chalk-green #b4f0a8`, `--chalk-blue #9fd6f2`, `--board #2e4a3d`, `--board-dark #223a2f`, `--wood #8a5a35`, `--wood-dark #5e3b20`.
    - Bề mặt: `.room` (tường giấy kem có sọc), `.frame` (khung gỗ), `.board` (mặt bảng xanh + lớp nhiễu bụi phấn + vết lau), `.ledge` (máng phấn bằng gỗ dưới bảng).
    - Chữ: `.chalk` (text-shadow phấn), `.script`, `.dim`, màu phấn vàng/hồng/xanh lá/xanh dương.
    - Thành phần: `.btn` / `.btnPrimary` / `.btnDanger` (viền vẽ tay, bo góc lệch, hover nghiêng nhẹ), `.solidBtn`, `.ledgeBtn`, `.tag` (viền nét đứt), `.note` (khung ghi chú nét đứt), `.option` + `.optionSelected/Correct/Wrong/Missed`, `.letterCircled` (khoanh tròn bằng phấn), `.navGrid` / `.navItem`, `.timer`, `.rule` (đường kẻ phấn), `.progressTrack/Fill`, modal "bảng nhỏ" (`.overlay`, `.modal`, `.modalBoard`), `.tokenInput` (ô giấy sáng, chữ mono lớn), hiệu ứng `questionEnter`, có xử lý `prefers-reduced-motion`.
  - `src/app/[locale]/(auth)/attempt/[attemptId]/page.tsx` — nạp font `Patrick_Hand` (`--font-chalk`) và `Dancing_Script` (`--font-chalk-script`), cả hai có subset `vietnamese`.
  - `src/app/[locale]/(auth)/attempt/[attemptId]/studentAttempt.tsx` — cách các class trên được dùng trong JSX.

Hãy **đọc kỹ 3 file trên trước tiên** và coi đó là nguồn sự thật về phong cách.

Tài liệu tham khảo thêm (đọc để hiểu nghiệp vụ và các yêu cầu UX đã có, nhưng phần màu sắc/theme trong đó đã **lỗi thời** và sẽ bị thay thế): `../docs/uiux/guidelines.md`, `../docs/uiux/*.md` (dashboard, question-bank, quizzes, session-teacher, attempt-student, reports, các file `*-review.md`), `../docs/trang-thai-du-an-hien-tai.md`.

## Mục tiêu

1. **Thiết kế lại giao diện cho toàn bộ dự án** theo đúng ngôn ngữ thiết kế "bảng đen – khung gỗ – phấn màu" của trang làm bài.
2. **Chỉnh sửa code theo thiết kế đó**, sao cho mọi màn hình nhìn như cùng một sản phẩm với trang làm bài.
3. Trang làm bài hiện tại phải **giữ nguyên về mặt hình ảnh** sau khi refactor (chỉ được chuyển token/thành phần ra dùng chung).

## Phạm vi màn hình cần rà soát và lên kế hoạch

Hãy tự quét `src/app/[locale]/**` và `src/components/**` để lập danh sách đầy đủ, tối thiểu gồm:

- **Khung chung:** `src/app/[locale]/layout.tsx`, `(auth)/layout.tsx`, `dashboard/layout.tsx` (topbar), `Sidebar.tsx`, `MobileMenuButton.tsx`, `MobileSidebarProvider.tsx`, `RoleSwitcher.tsx`, `SignOutButton.tsx`, `LocaleSwitcher.tsx`, `templates/BaseTemplate.tsx`, `DemoBanner.tsx`.
- **Component UI dùng chung:** `src/components/ui/` — `Button`, `Card`, `Badge`, `Input`, `Table`, `Toast`, `Skeleton`, `TagInput`, `TagFilter`; và `MathRenderer`.
- **Đăng nhập:** `(auth)/(center)/sign-in`, `sign-up`, `GoogleSignInButton`, `dev/role`.
- **Dashboard:** `TeacherDashboard`, `StudentDashboard`, `ClassroomPanel`, `performance/PerformancePanel`.
- **Lớp học:** `classes/ClassesPanel`, `classes/[classId]/*` (TeacherClassDetail, StudentClassDetail, shared/ClassHeader, StatsCards, SessionsList, MembersList).
- **Ngân hàng câu hỏi:** `question-bank/QuestionBankPanel`, `[poolId]/QuestionPoolDetail`.
- **Quiz:** `quizzes/QuizzesPanel`, `[quizId]/QuizRulesPanel`.
- **Session:** `sessions/SessionsPanel`, `sessions/[sessionId]/teacher/teacherScreen` (màn chiếu cho cả lớp — đây là chỗ hợp nhất để dùng bảng đen toàn màn hình), `questions/QuestionsView`, `attempts/[attemptId]/AttemptDetailView`.
- **Sinh viên:** `session/[sessionId]/studentLobby` (phòng chờ), trang xem lại bài sau khi nộp (nằm trong luồng attempt).
- **Marketing:** `(marketing)/page.tsx`, `about`, và các trang còn sót từ boilerplate (`counter`, `portfolio`) — đề xuất giữ, đổi giao diện hay gỡ bỏ.

## Định hướng thiết kế (để bạn cụ thể hoá trong kế hoạch)

1. **Hệ token dùng chung:** đưa token phấn/bảng/gỗ từ `chalkboard.module.css` thành token toàn cục (CSS variables trong `global.css` + map vào `tailwind.config.ts`), đặt tên theo ngữ nghĩa (vd. `surface.board`, `surface.wood`, `ink.chalk`, `ink.muted`, `accent.yellow` cho CTA chính, `accent.pink` cho nguy hiểm/lỗi, `accent.green` cho thành công, `accent.blue` cho thông tin). Thay thế cam `#FF5A00` và các màu charcoal cũ. Trình bày bảng ánh xạ **token cũ → token mới**.
2. **Font:** chuyển việc nạp `Patrick_Hand` / `Dancing_Script` từ trang attempt lên layout gốc để mọi trang dùng được. Đề xuất quy tắc dùng font: chữ viết tay cho tiêu đề, nút, nhãn; cân nhắc giữ font dễ đọc hơn cho bảng dữ liệu dày, form dài và nội dung câu hỏi nếu chữ viết tay làm giảm khả năng đọc; mã lớp, token, ID dùng font mono. Nêu rõ lựa chọn và lý do.
3. **Ẩn dụ bố cục cho dashboard:** đề xuất cách áp "lớp học" vào trang quản lý nhiều dữ liệu mà vẫn dễ dùng, ví dụ: tường giấy kem làm nền trang, sidebar như tấm gỗ/bảng ghim, nội dung chính trên mặt bảng xanh trong khung gỗ, các thẻ (card) như khung phấn vẽ tay hoặc mảnh giấy ghim; thanh hành động như máng phấn. Đưa ra 1 phương án chính và 1 phương án nhẹ hơn (ít "trang trí" hơn cho các trang bảng dữ liệu), kèm ưu nhược điểm.
4. **Thành phần:** viết lại `Button` (variant primary/ghost/danger/solid/ledge), `Card` (board / note / paper), `Badge` (dạng `.tag` nét đứt theo màu phấn), `Input`/`TagInput` (ô giấy sáng như `.tokenInput` hoặc gạch chân phấn — chọn 1 và giải thích), `Table` (kẻ dòng bằng `.rule`, header chữ phấn vàng), `Toast`, `Skeleton` (hiệu ứng "đang lau bảng"), modal dùng mẫu `.modal/.modalBoard`. Giữ nguyên API props hiện có của các component để tránh sửa lan khắp nơi; nếu buộc phải đổi props thì liệt kê các chỗ gọi bị ảnh hưởng.
5. **Tái sử dụng cho trang attempt:** tách những phần dùng chung khỏi `chalkboard.module.css` (token, `.board`, `.frame`, `.btn`, `.tag`, modal…) sang chỗ chung; trang attempt chỉ giữ phần riêng của nó. Kết quả hiển thị trang attempt không được thay đổi.

## Ràng buộc bắt buộc

- **Không đổi logic nghiệp vụ, API, Prisma schema, luồng dữ liệu, polling, autosave/offline, checkpoint token.** Chỉ đổi phần trình bày (JSX markup, className, CSS, font, component UI).
- **i18n:** mọi chuỗi mới phải thêm vào cả `src/locales/vi.json` và `src/locales/en.json`; không hard-code chữ.
- **Khả năng truy cập:** độ tương phản chữ/nền tối thiểu WCAG AA (kiểm tra cụ thể `--chalk-dim` và `--chalk-faint` trên `--board`), focus-visible rõ ràng cho bàn phím, tôn trọng `prefers-reduced-motion`, tap target ≥ 44px trên mobile.
- **Responsive:** mobile-first, các mốc 360 / 768 / 1024 / 1440px; không cuộn ngang ở nội dung chính (bảng dữ liệu được cuộn ngang trong vùng bọc riêng).
- **Hiệu năng:** texture nhiễu/gradient chỉ dùng CSS/SVG inline như hiện tại, không thêm ảnh nền nặng; không thêm thư viện UI mới trừ khi có lý do rõ ràng.
- **Màn chiếu `teacherScreen`:** token và QR phải đọc được từ cuối phòng học — cỡ chữ lớn, tương phản cao.
- Giữ quy ước code hiện có (ESLint config của dự án, `cn()` trong `src/utils/cn.ts`, cấu trúc thư mục).

## Kế hoạch cần trả về

Trình bày kế hoạch bằng tiếng Việt, gồm:

1. **Tóm tắt hiện trạng:** những gì đọc được từ trang attempt (hệ thiết kế), và những chỗ dashboard đang lệch so với nó. Liệt kê các file còn dùng màu/class cũ (vd. `primary`, `bg-bg-*`, `text-text-*`, `border-border-*`, màu hex cứng).
2. **Đặc tả design system mới:** bảng token (tên, giá trị, công dụng), quy tắc font, bảng ánh xạ token cũ → mới, đặc tả từng component (variant, trạng thái hover/focus/disabled/loading).
3. **Phương án bố cục** cho layout chung và cho từng nhóm màn hình (có phác thảo ASCII ngắn cho layout dashboard và 1 trang danh sách điển hình).
4. **Lộ trình theo giai đoạn**, mỗi giai đoạn có danh sách file sẽ sửa/tạo và tiêu chí hoàn thành, ví dụ:
   - GĐ 1: token + font + `global.css` + `tailwind.config.ts`
   - GĐ 2: component trong `src/components/ui/`
   - GĐ 3: khung layout (sidebar, topbar, nền trang, đăng nhập)
   - GĐ 4: các trang giáo viên (dashboard, lớp, ngân hàng câu hỏi, quiz, session, báo cáo)
   - GĐ 5: các trang sinh viên (dashboard, lớp, lobby, xem lại bài) + `teacherScreen`
   - GĐ 6: refactor trang attempt dùng token chung (không đổi hình ảnh), dọn file/boilerplate thừa, cập nhật `docs/uiux/guidelines.md` theo theme mới
   Mỗi giai đoạn phải để ứng dụng chạy được và build qua.
5. **Rủi ro & cách giảm thiểu:** độ đọc của chữ viết tay, tương phản, KaTeX trên nền xanh, bảng dữ liệu dài, xung đột Tailwind 4 với các class fallback trong `global.css`, trang attempt bị thay đổi ngoài ý muốn.
6. **Cách kiểm tra** sau mỗi giai đoạn: `npm run lint`, kiểm tra kiểu (`tsc --noEmit` hoặc script tương ứng trong `package.json`), `npm run build`, chạy thử và xem các trang chính ở 360px và 1280px với cả vai trò giáo viên và sinh viên, ngôn ngữ vi và en; so sánh trang attempt trước/sau.
7. **Câu hỏi cần tôi quyết định** trước khi bắt đầu sửa code.
