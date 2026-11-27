# 📥 Import câu hỏi bằng Markdown (BKquiz)

Mục tiêu: cho phép giảng viên import nhanh **question pool + tags + MCQ single/multi** bằng Markdown, hỗ trợ **hình ảnh** theo cách không “đứt link”.

## 1) Định dạng file import (khuyến nghị MVP)

### 1.0 Giới hạn import (MVP defaults)
- **Max file size**:
  - `.md`: 10MB
  - `.zip`: 50MB
- **Max số câu hỏi / 1 lần import**: 500 câu
- **Ảnh** (khi import `.zip`):
  - định dạng: `.png`, `.jpg/.jpeg`, `.webp`
  - max 5 ảnh/câu
  - max 5MB/ảnh

### 1.1 Gói import dạng `.zip` (khuyến nghị)
Cấu trúc zip:
```
questions.zip
├─ questions.md
└─ assets/
   ├─ img1.png
   └─ diagram-2.jpg
```

Trong `questions.md` bạn dùng ảnh bằng link tương đối:
```md
![alt](assets/img1.png)
```

Khi import:
- Backend giải nén `.zip`
- Upload ảnh lên storage (S3; dev dùng MinIO)
- Rewrite link `assets/...` thành URL đã upload trong nội dung question (và snapshot).

### 1.2 Import trực tiếp `.md` (không có assets)
Chỉ dùng khi:
- Không có ảnh, hoặc
- Ảnh dùng URL public sẵn: `![alt](https://...)`

## 2) Cú pháp `questions.md` (1 file = 1 question pool)

> **Lưu ý (27/11/2026):** các mục 2.1–2.4 dưới đây là thiết kế ban đầu (front-matter YAML cho từng câu). Hệ thống hiện đọc định dạng ở **mục 2.6** (`# QUESTION:` / `## TAGS:` / `## ANSWER:`) — cũng là định dạng của chức năng xuất Markdown và của file mẫu [`cau-hoi-mau.md`](./cau-hoi-mau.md).

### 2.1 Nguyên tắc
- **Mỗi file `questions.md` tương ứng đúng 1 `QuestionPool`**.
- File có **pool-level front-matter** ở đầu file (khai báo thông tin pool + default).
- Sau đó, mỗi câu hỏi là một **block** ngăn cách bằng **một dòng `===`** (khuyến nghị, dễ kiểm soát).
- Hệ thống vẫn hỗ trợ format cũ (legacy): **một dòng trống + một dòng `---`**.
- Mỗi block có **YAML front-matter** (metadata của câu) + phần nội dung markdown.
- Tags là **global** (đã chốt).

### 2.2 Pool-level front-matter (đặt 1 lần ở đầu file)
```md
---
pool:
  name: "DSA - Week 1"
  visibility: "private"   # optional: private|shared
defaults:
  difficulty: 2           # optional (1..5)
  shuffleOptions: true    # optional
  points: 1               # optional
---
```

### 2.3 Schema metadata cho từng câu (front-matter)
```md
---
tags: ["stack", "array"]
type: "mcq_single"   # hoặc "mcq_multi"
difficulty: 2        # optional (override defaults)
shuffleOptions: true # optional (override defaults)
points: 1            # optional (override defaults)
---
```

### 2.4 Nội dung câu hỏi + options
Sau question front-matter:
- Nội dung question là markdown tự do.
- Options khai báo theo list; đánh dấu đáp án đúng bằng `[x]` (multi) hoặc `(x)` (single).

#### MCQ single (1 đáp án)
```md
---
tags: ["stack"]
type: "mcq_single"
---
Stack là cấu trúc dữ liệu hoạt động theo nguyên tắc nào?

(x) LIFO
( ) FIFO
( ) Random
```

#### MCQ multi (nhiều đáp án)
```md
---
tags: ["array", "complexity"]
type: "mcq_multi"
---
Chọn tất cả phát biểu đúng:

[x] Truy cập phần tử mảng theo index là O(1)
[ ] Mảng luôn chèn ở giữa là O(1)
[x] Duyệt toàn bộ mảng là O(n)
```

#### Câu hỏi có ảnh (khi import `.zip`)
```md
---
tags: ["kirchhoff"]
type: "mcq_single"
---
Quan sát sơ đồ sau:

![mạch](assets/diagram-2.jpg)

Giá trị dòng I là?

( ) 1A
(x) 2A
( ) 3A
```

### 2.5 Biểu thức toán học (LaTeX)
Markdown có thể chứa biểu thức toán học theo cú pháp LaTeX (frontend sẽ render bằng KaTeX/MathJax).

- Inline math: `\( a^2 + b^2 = c^2 \)`
- Block math:

```md
\[
\int_0^1 x^2\,dx = \frac{1}{3}
\]
```

Ví dụ câu hỏi có toán:
```md
---
tags: ["integral"]
type: "mcq_single"
---
Tính giá trị:
\[
\int_0^1 x^2\,dx
\]

( ) \( \frac{1}{2} \)
(x) \( \frac{1}{3} \)
( ) \( \frac{1}{4} \)
```

### 2.6 Định dạng hệ thống đang đọc (`src/server/import/markdownPool.ts`)
Front-matter của pool (mục 2.2) ở đầu file, sau đó mỗi câu là một khối:

```md
# QUESTION:
Đề bài (markdown, LaTeX)
## TAGS: ["tag-1", "tag-2"]
## ANSWER:
( ) phương án sai
(x) phương án đúng
```

- `(x)` / `( )`: câu một đáp án; `[x]` / `[ ]`: câu nhiều đáp án. Loại câu tự nhận theo dấu của phương án đầu tiên.
- Câu bị bỏ qua (kèm cảnh báo) khi thiếu đề, thiếu `## ANSWER:`, có ít hơn 2 phương án, câu một đáp án không có đúng 1 đáp án đúng, hoặc câu nhiều đáp án không có đáp án đúng nào.
- Nhận cả file xuống dòng kiểu Windows (CRLF).

#### Ảnh minh hoạ (27/11/2026)
Một dòng `![mô tả](url)` **riêng** trong đề bài là ảnh của câu. Dòng này được tách khỏi đề bài, lưu vào `Question.imageUrl` / `imageAlt`, và hiện dưới đề bài trong lúc làm bài, xem lại và thống kê.

```md
# QUESTION:
Quan sát sơ đồ mạch rồi tính cường độ dòng điện qua R1.
![Sơ đồ mạch gồm R1 và R2 mắc song song](https://<kho-ảnh>/bkquiz-media/questions/abc.png)
## TAGS: ["dien-hoc"]
## ANSWER:
(x) 1 A
( ) 2 A
```

- URL phải là `http(s)` tuyệt đối. Ảnh tải lên từ form soạn câu có sẵn URL dạng này; có thể dùng URL công khai bất kỳ.
- Mỗi câu một ảnh (dòng ảnh đầu tiên). Ảnh viết giữa câu chữ không được tách.
- Xuất Markdown ghi lại dòng ảnh ngay sau đề bài, nên "Sửa bằng Markdown → Nhập lại" giữ được ảnh. Xoá dòng ảnh khi sửa thì câu không còn ảnh.
- **Nhập `.zip` có thư mục ảnh (Đợt 7):**
  - dòng ảnh dùng đường dẫn tương đối, ví dụ `![Sơ đồ](assets/a.png)`, `./assets/b.png`, `assets/do%20thi.png`; tính từ thư mục chứa `questions.md`;
  - server đọc ảnh trong zip, kiểm tra theo nội dung (PNG / JPEG / WebP, ≤ 2 MB), tải lên kho ảnh, rồi thay bằng URL công khai;
  - tối đa 100 ảnh mỗi lần nhập;
  - ảnh thiếu / sai loại / quá lớn → cảnh báo; câu vẫn được nhập, dòng ảnh giữ nguyên trong đề để giáo viên sửa;
  - đường dẫn có `..` hoặc tuyệt đối bị bỏ qua;
  - chưa cấu hình kho ảnh (`S3_*`) → không tải ảnh, có cảnh báo;
  - **giới hạn trên Vercel:** body request tối đa 4,5 MB, nên file zip phải nhỏ hơn mức này.

#### Câu Đúng/Sai (27/11/2026)
Viết 1 dòng đáp án thay cho danh sách phương án. Câu được lưu thành câu một đáp án với 2 phương án, phương án đầu là "Đúng", nên chấm điểm và thống kê như câu một đáp án.

```md
# QUESTION:
Trái Đất quay quanh Mặt Trời.
## TAGS: ["dia-ly"]
## ANSWER:
Đáp án: Đúng

# QUESTION:
2 + 2 = 5
## TAGS: ["so-hoc"]
## ANSWER: Sai
```

- Giá trị nhận được (không phân biệt hoa thường, có thể có dấu chấm cuối): `Đúng`, `Sai`, `True`, `False`.
- Có thể viết kèm `Đáp án:` hoặc `Answer:` ở trước, và có thể viết ngay trên dòng `## ANSWER:`.
- Viết `Đúng` / `Sai` thì 2 phương án là "Đúng" / "Sai"; viết `True` / `False` thì là "True" / "False".
- Một dòng đáp án khác (ví dụ `Có thể`) → câu bị bỏ qua, kèm cảnh báo.
- Khi xuất Markdown, câu Đúng/Sai được ghi lại dạng `(x) Đúng` / `( ) Sai` và nhập lại vẫn đúng.

## 3) Quy tắc validate (để báo lỗi rõ ràng)
- Pool-level front-matter bắt buộc, nếu pool chưa tồn tại thì **tạo mới** pool cho teacher import.
- `tags` optional, nếu tag chưa tồn tại thì **tạo mới** (global).
- `type` bắt buộc: `mcq_single | mcq_multi`.
- Options:
  - `mcq_single`: đúng **chính xác 1** option `(x)`.
  - `mcq_multi`: đúng **>=1** option `[x]`.
  - Tối thiểu 2 options.
- Ảnh:
  - Nếu dùng đường dẫn `assets/...` thì **bắt buộc** import dạng `.zip` và file phải tồn tại.

## 4) Mapping sang DB
- Pool-level `pool.name` → `QuestionPool.name` (owner là teacher import).
- `tags[]` → upsert `Tag(normalizedName)` + gán `QuestionTag`.
- Nội dung markdown → `Question.prompt`.
- Options:
  - Lưu thứ tự `order` theo thứ tự xuất hiện.
  - `isCorrect` theo marker `(x)` hoặc `[x]`.

## 5) API import (đề xuất)
- `POST /api/pools/import`
  - input: `.zip` hoặc `.md`
  - output: số câu import thành công, danh sách lỗi theo line/block.

### 5.1 Request/Response mẫu
Request (multipart/form-data):
- `file`: `.md` hoặc `.zip`
- `poolId`: uuid (optional; nếu muốn import vào pool có sẵn, nếu không sẽ lấy `pool.name` trong file và tạo mới nếu chưa tồn tại)

Response (JSON):
```json
{
  "poolId": "uuid",
  "createdPool": true,
  "createdTags": 3,
  "importedQuestions": 42,
  "skippedQuestions": 2,
  "errors": [
    {
      "blockIndex": 5,
      "message": "mcq_single must have exactly 1 correct option",
      "hint": "Use (x) for exactly one option"
    }
  ]
}
```


