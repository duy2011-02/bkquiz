# 🎨 BKquiz – UI/UX Guidelines Chung

Tài liệu này định nghĩa **nguyên tắc giao diện & trải nghiệm** dùng chung cho toàn bộ sản phẩm BKquiz.

> Cập nhật 25/11/2026: toàn bộ sản phẩm dùng hệ thiết kế **"bảng đen – khung gỗ – phấn màu"** của trang làm bài.
> Theme tối charcoal + CTA cam (`#FF5A00`) cũ đã bị thay thế; các tài liệu `design-tokens-review.md`, `guide/style.md`
> và phần màu trong các file review cũ chỉ còn giá trị lịch sử.

---

## 1. Thương hiệu & Theme

- **Ẩn dụ**: mỗi màn hình là một lớp học — tường giấy kem, khung gỗ, mặt bảng xanh, chữ viết bằng phấn, máng phấn bằng gỗ dưới bảng.
- **Nguồn sự thật**:
  - `bkquiz-web/src/components/chalk/chalk.module.css` — hệ thiết kế dùng chung (chép nguyên từ trang làm bài).
  - `bkquiz-web/src/app/[locale]/(auth)/attempt/[attemptId]/chalkboard.module.css` — phần riêng của trang làm bài.
  - Token: biến CSS trong `bkquiz-web/src/styles/global.css`, map sang Tailwind trong `tailwind.config.ts`.
- **Không tự thêm phong cách mới**: mọi bề mặt, màu, kiểu chữ phải lấy từ một class/token đã có. Chỗ buộc phải lệch (a11y, kích thước) được đánh dấu `DEVIATION` trong CSS kèm lý do.

### Bảng màu

| Token (CSS / Tailwind) | Giá trị | Công dụng |
|---|---|---|
| `--board` / `board` | `#2e4a3d` | Mặt bảng |
| `--board-dark` / `board-dark` | `#223a2f` | Vùng sâu của bảng, modal |
| `--chalk` / `chalk` | `#f4f1ea` | Chữ chính (≈8.6:1 trên bảng) |
| `--chalk-dim` / `chalk-dim` | `rgba(244,241,234,.72)` | Chữ phụ (≈5.1:1 — đạt AA) |
| `--chalk-faint` / `chalk-faint` | `rgba(244,241,234,.28)` | **Chỉ** đường kẻ, viền trang trí — không dùng cho chữ |
| `--chalk-yellow` / `chalk-yellow` | `#f6e27f` | Hành động chính, đang chọn, cảnh báo (≈7.5:1) |
| `--chalk-pink` / `chalk-pink` | `#f5a3b5` | Lỗi, nguy hiểm (≈5.0:1) |
| `--chalk-green` / `chalk-green` | `#b4f0a8` | Thành công, đúng (≈7.4:1) |
| `--chalk-blue` / `chalk-blue` | `#9fd6f2` | Thông tin, loại (≈6.2:1) |
| `--wood` / `--wood-dark` | `#8a5a35` / `#5e3b20` | Khung, máng phấn |
| `--wall` / `--wall-stripe` | `#e3d8c4` / `#d9cdb8` | Nền trang (tường) |
| `--paper` / `paper` + `--ink-paper` | `#fbf8f1` / `#1f2a24` | Ô nhập, nền QR |
| `--ink-wood` | `#3a2412` | Chữ trên nút máng phấn |
| `--ink-on-yellow` | `#2a1a0c` | Chữ trên nút vàng đặc |

Nguyên tắc: màu phấn **mang nghĩa**, không trang trí. Chữ luôn nói rõ trạng thái — màu chỉ nhấn thêm.

---

## 2. Layout & Lưới

- Mọi màn hình là `ChalkRoom` (`components/chalk/ChalkRoom.tsx`): `.room` (tường) › `.frame` (gỗ) › `.board` › `.boardInner`, và `.ledge` (máng phấn) dưới bảng.
  - `lockViewport`: bảng vừa khít 1 màn hình trên desktop (trang làm bài, phòng chờ, màn chiếu).
  - Không khoá: bảng cao theo nội dung, trang cuộn (dashboard, marketing).
- **Dashboard**: điều hướng viết trên bảng ở cột trái (ngăn bằng nét đứt, mục hiện tại được khoanh phấn vàng); mobile mở bằng nút ☰ thành ngăn kéo bảng nhỏ. Đổi ngôn ngữ / vai trò / đăng xuất nằm trên máng phấn.
- **Tiêu đề trang**: `.header` + `.title .script .chalk`, dòng phụ `.meta .dim`, sau đó `.rule`.
- **Thẻ**: `Card` = khung phấn của `.option` (`board`), `note` (nét đứt), `plain` (mặt `.modalBoard`, không nhiễu — dùng cho bảng/form dày).
- Card **interactive**: hover sáng viền + nghiêng nhẹ (−0.4°), không scale/translate.
- **Responsive**: mobile-first; không cuộn ngang nội dung chính — bảng dữ liệu cuộn trong `TableWrap`.

---

## 3. Typography

| Font | Biến | Dùng cho |
|---|---|---|
| Dancing Script | `--font-chalk-script` (`.script`, `font-script`) | Tiêu đề trang, số lớn (điểm, KPI) |
| Patrick Hand | `--font-chalk` (`font-chalk`, mặc định trên bảng) | Mọi chữ viết trên bảng: nút, tag, nhãn, điều hướng, mô tả |
| Inter | `--font-sans` (`font-sans`) | Thân bảng dữ liệu, ô nhập, nội dung câu hỏi ở trang giáo viên |
| JetBrains Mono | `--font-mono` (`font-mono`) | Mã lớp, token, ID, mã lỗi |

- Patrick Hand cỡ tối thiểu 1rem (riêng `.tag` 0.85rem) — nét mảnh, cần lớn hơn Inter một bậc.
- Không viết hoa toàn bộ nhãn; không dùng eyebrow nhỏ phía trên tiêu đề.

---

## 4. Components & Interaction

### 4.1 Button (`components/ui/Button.tsx`)

- `ghost` (mặc định, `.btn`): hành động phụ.
- `primary` (`.btnPrimary`, viền vàng): hành động quan trọng.
- `solid` (`.solidBtn`, nền vàng): **một** hành động chính mỗi màn / modal (Tạo lớp, Tham gia, Nộp bài…).
- `danger` (`.btnDanger`): xoá, kết thúc phiên.
- `ledge` (`.ledgeBtn`): nút giấy kem đặt trên máng phấn.
- Trạng thái: hover nghiêng −1°; focus nét đứt vàng; disabled opacity .38; `loading` → disabled + `aria-busy` + chữ "Đang …".
- Link điều hướng trông như nút: dùng `<Link className={cn(s.btn, …)}>`, **không** lồng `<Button>` trong `<Link>`.
- Trên mobile mọi nút cao tối thiểu 44px.

### 4.2 Badge (`.tag`)

- Nét đứt theo màu chữ: `neutral` (dim), `success` (xanh lá), `warning` (vàng), `danger` (hồng), `info` (xanh dương).
- Chính sách: `success` published/online/running · `warning` sắp đến hạn checkpoint, thiếu câu · `danger` locked/error · `info` trung lập hữu ích.

### 4.3 Form & Input

- `Input` / `Textarea` / `Select` (`components/ui/Input.tsx`) = ô giấy sáng của `.tokenInput`, chữ Inter, cao ≥44px, focus viền + vòng vàng.
- Nhãn `FieldLabel` (`.inputLabel`), gợi ý `FieldHint` (`.inputHint`).
- Mọi input có label thật (không chỉ placeholder); placeholder là ví dụ cụ thể ("VD: DSA K66").

### 4.4 Modal (`components/ui/Modal.tsx`)

- `.overlay` › `.modal` (khung gỗ) › `.modalBoard`. Có focus trap, Esc để đóng (trừ `dismissible={false}` như cổng checkpoint), trả focus về nút mở.
- `placement="left"`: ngăn kéo điều hướng mobile.

### 4.5 Trạng thái mạng & sync

- Các màn có autosave (Attempt) luôn hiển thị: tag Online/Offline, số câu chờ đồng bộ, thời gian sync gần nhất (nếu có).
- Khi offline: vẫn chọn đáp án được; không cho nộp và nói rõ lý do.

---

## 5. States: Loading, Empty, Error

- **Loading**: `Skeleton` (vệt lau bảng quét ngang; đứng yên khi reduced-motion) cho layout phức tạp; "Đang tải…" cho khối đơn.
- **Empty state**: `Card variant="note"` với 1 câu mô tả + hành động gợi ý.
- **Error**: `.note .pink` (nét đứt hồng), text lỗi ngắn, mã lỗi `font-mono`.
- **Toast**: bảng nhỏ ở góc dưới phải, chữ xanh lá / hồng / xanh dương theo loại.

---

## 6. Accessibility & Usability

- Tương phản ≥ 4.5:1 cho chữ (xem bảng màu); `chalk-faint` không bao giờ dùng cho chữ.
- Tap target ≥ 44px trên mobile.
- Không dùng màu là tín hiệu duy nhất (luôn có chữ/ký hiệu ✓ ✗).
- Bàn phím: focus nét đứt vàng thấy rõ (trên nền sáng dùng mực gỗ); modal & ngăn kéo trap focus.
- `prefers-reduced-motion`: tắt xoay, trượt, vệt lau.
- Màn chiếu (teacher screen, mã lớp): token/mã lớp mono vàng cỡ `clamp(3.5rem, 7vw, 9rem)`, QR trên giấy sáng ≤ `min(60vh, 480px)`.

---

## 7. Phân biệt Teacher vs Student

- **Teacher**:
  - Nhiều số liệu, bảng, filter, action management → dùng `Card plain` + Inter cho vùng dày.
  - Ngôn ngữ: “Tạo”, “Quản lý”, “Preview”, “Report”.
- **Student**:
  - Ít distraction: chỉ câu hỏi, options, timer/checkpoint — bảng phấn toàn màn hình.
  - Ngôn ngữ: “Vào làm bài”, “Tiếp tục”, “Nộp bài”.

Khi thiết kế màn hình mới, luôn xác định rõ **persona chính** trước, sau đó áp dụng tone & layout phù hợp.
