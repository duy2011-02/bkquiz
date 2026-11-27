# Prompt: Lập kế hoạch tính năng hướng dẫn người dùng mới cho BKquiz (kèm kịch bản chi tiết)

Mình muốn thêm vào BKquiz một tính năng hướng dẫn người dùng mới, giống phần hướng dẫn tân thủ trong Clash of Clans hay Hay Day. Mình cần sớm có một bản mẫu để demo cho giáo viên, nên lượt này làm theo hai bước, thứ tự chi tiết ở mục 8 cuối file:

1. Đọc kỹ codebase, lập kế hoạch cho toàn bộ tính năng rồi lưu vào `docs/ke-hoach.md` bằng tiếng Việt.
2. Chỉ triển khai Tour GV-1 (chào mừng giáo viên) cùng phần nền tối thiểu để tour chạy được. Xong thì dừng lại cho mình xem. Mình thấy ổn mới làm tiếp các tour khác.

Bên dưới là kịch bản mình đã soạn dựa trên giao diện hiện tại. Nhãn nút và đường dẫn lấy từ `src/locales/vi.json` và các component mình đã đọc. Một số màn hình mình mới chỉ xem qua nhãn trong file locale, chưa đọc kỹ code, gồm `QuestionBankPanel`, `QuizzesPanel`, `QuizRulesPanel`, `teacherScreen` và `studentLobby`. Với những màn hình này, bạn hãy mở code ra kiểm tra phần tử có thật không và nằm ở đâu. Chỗ nào kịch bản không khớp code thì ghi lại và đề xuất cách sửa, đừng tự đoán.

---

## 1. Cảm giác mình muốn có

Màn hình tối đi, chỉ chừa sáng đúng chỗ cần thao tác. Bên cạnh có một nhân vật hướng dẫn kèm bong bóng thoại. Người dùng học bằng cách bấm và điền thật, không phải đọc một đoạn hướng dẫn dài. Những bước "học bằng cách làm" sẽ chặn click ra ngoài vùng sáng, và chỉ chuyển sang bước tiếp khi người dùng đã làm xong việc thật, ví dụ đã tạo được lớp. Các bước chỉ giới thiệu thì có nút "Tiếp". Bước nào cũng có nút "Bỏ qua hướng dẫn".

**Hướng dẫn chỉ tự xuất hiện trong lần đăng nhập đầu tiên của người dùng.** Từ lần đăng nhập thứ hai trở đi, hướng dẫn không tự bật nữa, kể cả khi người dùng chưa đi hết hoặc đã bấm "Bỏ qua". Người dùng vẫn xem lại được bất cứ lúc nào qua một nút "Xem lại hướng dẫn", ví dụ đặt trong trang hồ sơ hoặc cạnh mục Getting started trên dashboard. Các tour ngắn và tip mở dần ở mục 4–5 cũng tuân theo quy tắc này: chỉ tự hiện trong phiên đăng nhập đầu tiên, sau đó chỉ chạy khi người dùng chủ động mở lại.

Để xác định "lần đăng nhập đầu tiên", hãy lưu cờ ở phía server, ví dụ trường thời điểm đăng nhập lần đầu hoặc thời điểm đã xem hướng dẫn trên model `User`. Không chỉ dựa vào localStorage, vì người dùng đổi máy hoặc đổi trình duyệt sẽ bị hiện lại. Bạn xem NextAuth trong `src/auth.ts` và `customPrismaAdapter.ts` để chọn chỗ đánh dấu hợp lý, và đề xuất cách xử lý những tài khoản đã tồn tại trước khi có tính năng này. Với người có cả hai vai trò giáo viên và sinh viên, hãy đề xuất phương án và ghi vào mục câu hỏi để mình quyết định.

**Cần có cách bật lại hướng dẫn để demo nhiều lần**, ví dụ một API dev (giống `/api/dev/role` đã có) hoặc tham số `?tour=reset`. Cách này chỉ hoạt động ở môi trường dev hoặc khi bật một biến môi trường, không được lộ ra production.

Hướng dẫn chia thành nhiều tour ngắn, mỗi tour gắn với một trang. Mình không muốn một tour dài chạy liền mạch.

## 2. Nhân vật hướng dẫn: "Phấn"

Mình muốn có một nhân vật tên **Phấn**: một viên phấn trắng có mặt và tay, hợp với giao diện bảng đen của trang làm bài. Phấn nói ngắn, thân thiện, mỗi bong bóng tối đa hai câu. Với giáo viên, Phấn gọi là "thầy/cô" và xưng "em". Với sinh viên, Phấn gọi là "bạn" và xưng "mình".

Hình nhân vật là vài file ảnh tĩnh (SVG hoặc WebP) đặt trong `public/onboarding/`, mỗi file một biểu cảm:

- `wave`: vẫy tay, dùng cho bước chào.
- `point`: chỉ tay, dùng cho bước hướng dẫn thao tác.
- `think`: suy nghĩ, dùng khi giải thích khái niệm.
- `alert`: lưu ý, dùng khi nói về token và nộp bài.
- `cheer`: chúc mừng, dùng khi xong một tour.

Mỗi bước trong config chọn một biểu cảm. Ảnh đặt cạnh bong bóng thoại, tự đổi phía để không che vùng đang sáng. Trên màn hình nhỏ thì thu nhỏ ảnh hoặc ẩn đi, chỉ giữ bong bóng. Hiệu ứng động chỉ dùng CSS đơn giản (nảy nhẹ, lắc tay) và phải tắt khi người dùng bật `prefers-reduced-motion`. Mình không cần Lottie hay animation phức tạp.

Trên trang dashboard, bong bóng dùng theme thường của app. Trên trang làm bài và phòng chờ, bong bóng dùng phong cách bảng đen để khớp với `chalkboard.module.css`. Mình sẽ tự chuẩn bị ảnh. Trong lúc chờ, bạn hãy đề xuất một bộ ảnh giữ chỗ đơn giản, ví dụ SVG tự vẽ hoặc emoji ✏️.

## 3. Ràng buộc quan trọng

**Không được cản trở bài thi thật.** Đồng hồ làm bài chạy theo thời gian trên server, không dừng được. Vì vậy phần hướng dẫn giao diện làm bài phải chạy lúc sinh viên còn ở trạng thái chờ giảng viên bắt đầu (`isWaitingInLobby` trong `studentAttempt.tsx`). Nếu sinh viên vào thẳng lúc session đã chạy, chỉ hiện tối đa ba bong bóng nhỏ, không làm tối màn hình, không chặn click và tự tắt sau vài giây. Phần còn lại để dành đến lúc sinh viên đã nộp bài.

**Không được che hay chặn modal checkpoint token và modal xác nhận nộp bài.** Khi modal checkpoint hiện, tour phải tạm dừng.

**Toàn bộ lời thoại nằm trong file locale** (vi, en, fr). Bản tiếng Anh và tiếng Pháp tạm dịch từ bản tiếng Việt bên dưới.

**Gắn điểm neo bằng thuộc tính `data-tour="..."`**, không dùng class CSS để định vị.

---

## 4. Kịch bản cho giáo viên

### Tour GV-1: Chào mừng (trang `/dashboard`, lần đầu vào với vai trò giáo viên)

1. Làm tối toàn màn hình, Phấn hiện ở giữa với biểu cảm vẫy tay và nói: "Chào thầy/cô! Em là Phấn, em sẽ dẫn thầy/cô tổ chức một buổi kiểm tra đầu tiên trên BKquiz, chỉ mất vài phút thôi ạ." Có hai nút: "Bắt đầu" và "Để sau".
2. Làm sáng thanh sidebar. Phấn nói: "Đây là bốn khu vực chính: Lớp học, Bài kiểm tra, Ngân hàng câu hỏi và Hồ sơ của thầy/cô."
3. Làm sáng khung Quick Actions. Phấn nói: "Quy trình gồm bốn bước: tạo lớp, chuẩn bị câu hỏi, tạo đề, rồi mở session trên lớp. Mình bắt đầu bằng việc tạo lớp nhé." Bước này chờ người dùng bấm nút "+ Tạo Class", khi đó chuyển sang tour GV-2.

### Tour GV-2: Tạo lớp (trang `/dashboard/classes`)

1. Làm sáng ô "Tạo lớp mới" (input `newClassName`). Phấn chỉ tay và nói: "Thầy/cô đặt tên cho lớp, ví dụ Toán 10A, rồi bấm Tạo." Đây là bước làm thật: chặn click ra ngoài, chỉ qua bước khi tạo lớp thành công (có toast "Đã tạo lớp thành công" hoặc lớp mới xuất hiện trong danh sách).
2. Làm sáng dòng lớp vừa tạo trong "Lớp của tôi", đặc biệt là mã lớp. Phấn nói: "Đây là mã lớp. Sinh viên nhập mã này để vào lớp. Thầy/cô bấm vào lớp để xem chi tiết nhé." Chờ người dùng bấm vào lớp.
3. Ở trang chi tiết lớp, làm sáng nút "📱 Mã QR" (nếu có trong `ClassHeader`). Phấn nói: "Trên lớp, thầy/cô chiếu mã QR này lên máy chiếu, sinh viên quét là vào lớp ngay." Bấm "Tiếp".
4. Làm sáng tab Members. Phấn nói: "Danh sách sinh viên sẽ hiện ở đây. Thầy/cô cũng có thể thêm sinh viên bằng email." Sau đó Phấn đổi sang biểu cảm chúc mừng: "Xong bước 1! Giờ mình chuẩn bị câu hỏi nhé." Có nút dẫn sang trang Ngân hàng câu hỏi.

### Tour GV-3: Ngân hàng câu hỏi (trang `/dashboard/question-bank`)

1. Phấn với biểu cảm suy nghĩ: "Câu hỏi được gom vào từng pool, giống như từng chương sách. Mỗi câu có tag để sau này BKquiz tự bốc câu theo chủ đề." Bấm "Tiếp".
2. Làm sáng khu "Import từ Markdown/ZIP". Phấn nói: "Cách nhanh nhất là import một file .md. Thầy/cô có thể tải file mẫu bên dưới để thử." Ở đây thêm một liên kết tải file câu hỏi mẫu, lấy nội dung từ `docs/cau-hoi-mau.md` và đặt trong `public/`, để giáo viên có dữ liệu thử ngay. Nút "Xem hướng dẫn →" giữ nguyên.
3. Bước làm thật: chờ giáo viên import thành công, hoặc tạo pool bằng "Tạo pool mới". Qua bước khi pool mới xuất hiện trong "Pools của bạn".
4. Làm sáng pool vừa tạo, hiển thị số câu và số tag. Phấn chúc mừng: "Đã có câu hỏi rồi! Tiếp theo mình tạo đề." Có nút dẫn sang trang Bài kiểm tra.

Tip mở dần, chỉ hiện khi giáo viên lần đầu vào trang chi tiết pool: một bong bóng nhỏ cạnh mục "Chia sẻ pool" với nội dung "Thầy/cô có thể chia sẻ pool cho đồng nghiệp bằng email."

### Tour GV-4: Tạo đề và cấu hình rule (trang `/dashboard/quizzes` và trang chi tiết quiz)

1. Làm sáng ô "Tạo quiz mới (draft)". Phấn nói: "Thầy/cô đặt tên đề, ví dụ Quiz tuần 1, rồi bấm Tạo." Bước làm thật, qua khi có toast "Đã tạo quiz thành công". Sau đó chờ giáo viên bấm "Mở" trên quiz vừa tạo.
2. Ở trang chi tiết quiz, làm sáng khu "Bước 1 - Cài đặt quiz". Phấn nói: "Đặt thời gian làm bài ở đây. Để trống nghĩa là không giới hạn thời gian." Bấm "Tiếp", không bắt buộc phải lưu.
3. Làm sáng khu "Bước 2 – Chọn câu cho đề". Phấn với biểu cảm suy nghĩ: "Mỗi lượt chọn câu nghĩa là: lấy bao nhiêu câu, thuộc chủ đề (tag) nào, từ pool nào." Bấm "Tiếp".
4. Lần lượt làm sáng từng phần: ô chọn pool, danh sách tag, phần chọn kiểu đề, ô số câu. Phấn giải thích ngắn từng phần. Riêng phần kiểu đề, Phấn nói: "Một đề giống nhau cho cả lớp (same-set) là dễ nhất. Nhiều phiên bản đề (variant-set) giúp chống nhìn bài." Bước làm thật: chờ giáo viên bấm "Xong lượt chọn này" và có toast "Đã lưu lượt chọn câu thành công".
5. Làm sáng nút "Preview". Phấn nói: "Bấm Preview để kiểm tra ngân hàng có đủ câu cho đề chưa." Chờ giáo viên bấm.
6. Làm sáng nút "Publish Quiz". Phấn nói: "Đề đã sẵn sàng. Thầy/cô có thể publish ngay, hoặc để nháp và chỉnh tiếp." Ghi chú cho bạn: theo code của `TeacherClassDetail`, quiz chỉ cần có ít nhất một rule và không bị lưu trữ là đã tạo được session, chưa cần publish. Bạn kiểm tra lại điều này rồi chỉnh câu thoại cho đúng. Phấn kết thúc bằng: "Giờ mình quay lại lớp để mở session nhé." Có nút dẫn về trang chi tiết lớp mà giáo viên đã tạo ở tour GV-2.

Tip mở dần, chỉ hiện khi giáo viên lần đầu mở phần chế độ chấm điểm: giải thích ngắn ba chế độ ("Đúng hết mới có điểm", "Điểm từng phần", "Trừ điểm khi chọn sai").

### Tour GV-5: Tạo session (trang chi tiết lớp)

1. Làm sáng nút "Tạo Session". Phấn chỉ tay: "Mỗi buổi kiểm tra là một session. Thầy/cô bấm đây nhé." Chờ người dùng bấm.
2. Trong modal, làm sáng danh sách quiz. Phấn nói: "Chọn đề vừa tạo." Chờ người dùng chọn một quiz.
3. Lần lượt làm sáng các ô Tên session, Thời gian bắt đầu, Thời gian làm bài, Thời gian buffer và Cho phép xem lại đáp án. Mỗi bong bóng một câu. Ví dụ ở ô thời gian bắt đầu: "Để trống nếu muốn session bắt đầu ngay khi tạo." Ở ô buffer: "Hết giờ làm bài, session sẽ tự đóng sau thêm vài phút buffer này." Các bước này đều bấm "Tiếp".
4. Làm sáng nút "Tạo Session" trong modal. Bước làm thật: chờ tạo thành công. App sẽ tự chuyển sang màn hình giáo viên, và tour GV-6 tiếp tục ở đó.

### Tour GV-6: Màn hình giáo viên (`/dashboard/sessions/[id]/teacher`)

1. Phấn vẫy tay: "Đây là màn hình để chiếu lên máy chiếu trong giờ kiểm tra." Bấm "Tiếp".
2. Làm sáng mã QR. Phấn nói: "Sinh viên quét QR để vào phòng chờ." Bấm "Tiếp".
3. Làm sáng danh sách "Sinh viên đã join". Phấn nói: "Thầy/cô theo dõi ai đã vào ở đây." Bấm "Tiếp".
4. Làm sáng nút "Bắt đầu Session". Phấn với biểu cảm lưu ý: "Khi lớp đã đủ người, thầy/cô bấm Bắt đầu. Đồng hồ làm bài sẽ chạy từ lúc này." Bước này không bắt buộc bấm, vì giáo viên có thể đang tạo session thử. Bấm "Tiếp".
5. Làm sáng khu "Token (TOTP)" và đồng hồ đếm ngược. Phấn nói: "Trong lúc làm bài, sinh viên thỉnh thoảng phải nhập token đang hiện ở đây. Ai không có mặt trên lớp sẽ không làm tiếp được." Phần này chỉ hiện khi session đã bắt đầu. Nếu session chưa bắt đầu, dời phần này sang lúc session chuyển sang trạng thái active.
6. Khi session đang chạy, làm sáng các nút gia hạn "+N phút" và "Kết thúc Session". Mỗi nút một câu giải thích.
7. Tip mở dần, chỉ hiện khi session đã kết thúc lần đầu: làm sáng các nút "Xem Scoreboard", "Xem Token Log" và "Tải Scoreboard CSV". Phấn chúc mừng: "Xong buổi kiểm tra đầu tiên! Kết quả và nhật ký token nằm ở đây."

---

## 5. Kịch bản cho sinh viên

### Tour SV-1: Chào mừng (trang `/dashboard`, lần đầu vào với vai trò sinh viên)

1. Phấn vẫy tay: "Chào bạn! Mình là Phấn. Mình chỉ bạn cách vào lớp và làm bài kiểm tra nhé, chưa tới một phút đâu." Có hai nút: "Bắt đầu" và "Để sau".
2. Làm sáng sidebar, gồm Lớp học và Phiên của tôi. Phấn nói: "Lớp học là nơi chứa các lớp bạn tham gia. Phiên của tôi là các buổi kiểm tra của bạn." Bấm "Tiếp".
3. Nếu sinh viên chưa có lớp nào, làm sáng nút "Join lớp". Phấn nói: "Việc đầu tiên là vào lớp của giảng viên." Chờ người dùng bấm, chuyển sang tour SV-2.

### Tour SV-2: Tham gia lớp (trang `/dashboard/classes`)

1. Làm sáng ô "Join lớp bằng code". Phấn nói: "Nhập mã lớp giảng viên cho, ví dụ ABC123, rồi bấm Join. Nếu giảng viên chiếu QR thì bạn chỉ cần quét." Bước làm thật: chờ join thành công.
2. Nếu sinh viên vào bằng link QR (có tham số `?join=`), modal "Xác nhận tham gia lớp" sẽ hiện. Phấn đứng cạnh modal, không che modal, và nói: "Kiểm tra đúng tên lớp và tên giảng viên rồi bấm Đồng ý tham gia nhé."
3. Sau khi app chuyển sang trang chi tiết lớp, Phấn chúc mừng: "Bạn đã vào lớp! Khi giảng viên mở session, bạn sẽ thấy nó ở đây và ở mục Phiên của tôi."

### Tour SV-3: Phiên của tôi (trang `/dashboard/sessions`, lần đầu vào)

1. Làm sáng nhóm "Đang diễn ra" và "Chờ bắt đầu". Phấn nói: "Session màu xanh là đang diễn ra, màu vàng là đang chờ giảng viên bắt đầu." Bấm "Tiếp".
2. Nếu có session, làm sáng nút "Join session →". Phấn nói: "Bấm đây để vào phòng chờ." Nếu chưa có session nào thì bỏ qua bước này.

### Tour SV-4: Phòng chờ (`/session/[id]`)

1. Làm sáng nút "Tham gia". Phấn nói: "Bấm Tham gia, rồi chờ giảng viên bắt đầu." Bước làm thật.
2. Ở trạng thái "Đã tham gia, đang chờ giảng viên bắt đầu", Phấn nói: "Màn hình sẽ tự chuyển khi bài bắt đầu. Trong lúc chờ, mình chỉ bạn giao diện làm bài nhé." Nếu lúc này app đã chuyển sang trang làm bài ở trạng thái chờ (`isWaitingInLobby`), chạy tour SV-5 ở đó.

### Tour SV-5: Giao diện làm bài trên bảng đen (`/attempt/[id]`, chỉ chạy khi `isWaitingInLobby`)

Bong bóng ở tour này dùng phong cách bảng đen.

1. Làm sáng phần header gồm số câu đã trả lời, nhãn "● Online" và ô "⟳" (số câu chờ đồng bộ). Phấn nói: "Bài của bạn được tự lưu liên tục. Mất mạng cũng không sao, có mạng lại là tự đồng bộ." Bấm "Tiếp".
2. Làm sáng đồng hồ. Phấn nói: "Đây là thời gian còn lại. Đồng hồ chuyển vàng rồi đỏ khi sắp hết giờ, hết giờ bài sẽ tự nộp." Bấm "Tiếp".
3. Làm sáng nhãn "Chọn 1" hoặc "Chọn nhiều" và các phương án A, B, C. Phấn nói: "Để ý nhãn này: Chọn 1 nghĩa là một đáp án, Chọn nhiều nghĩa là có thể có nhiều đáp án đúng." Bấm "Tiếp".
4. Làm sáng các nút "← Trước", "Sau →" và nút "Submit" của từng câu. Phấn nói: "Bạn đi qua lại giữa các câu thoải mái. Bấm Submit để chốt câu đó, câu sẽ chuyển sang màu xanh." Bấm "Tiếp".
5. Làm sáng "Danh sách câu hỏi" ở bên phải, kèm chú thích màu. Phấn nói: "Bấm số để nhảy tới câu bất kỳ. Ô vàng là câu đang làm, ô xanh là câu đã chốt." Bấm "Tiếp".
6. Phấn với biểu cảm lưu ý, không làm sáng phần tử nào: "Thỉnh thoảng sẽ hiện ổ khoá 🔒 yêu cầu nhập token. Bạn nhìn lên màn hình của giảng viên để lấy token nhé. Nhập sai nhiều lần sẽ bị khoá 30 giây." Bấm "Tiếp".
7. Làm sáng nút "Nộp bài" ở gờ bảng phía dưới. Phấn nói: "Làm xong thì bấm Nộp bài. Nút này chỉ bấm được khi đang online và mọi câu đã đồng bộ xong." Phấn chúc mừng: "Sẵn sàng rồi! Chúc bạn làm bài tốt!"

Trường hợp sinh viên vào thẳng khi bài đang chạy: chỉ hiện các bong bóng nhỏ của bước 2, 4 và 7, không làm tối màn hình, mỗi bong bóng tự tắt sau khoảng 4 giây.

Tip mở dần lần đầu gặp checkpoint: khi modal checkpoint hiện lần đầu, Phấn hiện ở góc màn hình, không che ô nhập, kèm một câu: "Nhập token đang hiện trên màn hình giảng viên nhé." Tip này không chặn và không làm tối thêm màn hình.

### Tour SV-6: Sau khi nộp bài

1. Làm sáng phần điểm số. Phấn chúc mừng: "Đây là điểm của bạn!"
2. Nếu chưa được xem đáp án, Phấn giải thích theo đúng trạng thái đang hiện: session chưa kết thúc, đang trong cửa sổ xem lại, hay giảng viên không cho xem lại.
3. Tip mở dần, chỉ hiện khi sinh viên lần đầu vào trang `/dashboard/performance`: "Đây là điểm trung bình và các bài bạn đã làm."

---

## 6. Gợi ý tên điểm neo `data-tour`

`sidebar`, `quick-actions`, `create-class-input`, `class-list`, `class-code`, `class-qr-button`, `class-members-tab`, `pool-import`, `pool-create`, `pool-list`, `quiz-create-input`, `quiz-open`, `quiz-settings`, `quiz-rules`, `rule-pools`, `rule-tags`, `rule-mode`, `rule-count`, `rule-save`, `quiz-preview`, `quiz-publish`, `create-session-button`, `session-quiz-list`, `session-config`, `session-submit`, `teacher-qr`, `teacher-joined`, `teacher-start`, `teacher-token`, `teacher-extend`, `teacher-end`, `teacher-reports`, `join-class-input`, `sessions-groups`, `join-session`, `lobby-join`, `attempt-header`, `attempt-timer`, `attempt-options`, `attempt-nav`, `attempt-question-list`, `attempt-submit`, `attempt-score`.

Bạn có thể đổi tên cho hợp với code, miễn là đặt tên thống nhất.

## 7. Những việc mình cần trong kế hoạch

- Chọn thư viện: so sánh driver.js, React Joyride, Shepherd.js và phương án tự viết. Tiêu chí: chạy tốt với Next.js App Router, có tour đi qua nhiều trang, chặn click ngoài vùng sáng, chèn được ảnh nhân vật vào bong bóng, đổi được theme thường và theme bảng đen, nhẹ, giấy phép phù hợp.
- Lưu trạng thái: thiết kế cờ "lần đăng nhập đầu tiên" và cờ "đã xem hướng dẫn" ở DB (trường Prisma kèm migration và API). Có thể dùng thêm client để nhớ đang ở bước nào trong phiên đầu. Phải xử lý được tài khoản cũ, người dùng có hai vai trò, nút xem lại và cách reset để demo.
- Kiến trúc: một provider bọc ngoài, config các bước dạng dữ liệu, cách chờ một hành động thật xảy ra (sự kiện tự phát ra, hay theo dõi DOM hoặc URL), cách xử lý phần tử chưa render, dữ liệu đang tải và sidebar thu gọn trên mobile.
- Accessibility: điều khiển được bằng bàn phím, focus trap, ARIA, tôn trọng `prefers-reduced-motion`.
- Đo lường: dự án đã có PostHog, đề xuất các event bắt đầu, hoàn thành, bỏ qua, và bỏ ở bước nào.
- Lộ trình triển khai: giai đoạn 0 là bản demo GV-1 (mục 8). Giai đoạn 1 gồm GV-2, SV-1, SV-2 và SV-5. Các tour còn lại làm sau. Với từng giai đoạn, liệt kê file cần tạo hoặc sửa, rủi ro và cách test (Vitest, Playwright).

## 8. Thứ tự thực hiện ở lượt này

**Bước 1: Lập kế hoạch và lưu vào `docs/ke-hoach.md`.** File này có thể đã tồn tại và đang chứa kế hoạch cũ của dự án. Nếu vậy, đừng ghi đè hay xoá nội dung cũ. Hãy thêm một phần mới ở cuối file, tiêu đề "Kế hoạch: Hướng dẫn người dùng mới (Onboarding Tutorial)", gồm mọi mục ở phần 7 và mục "Câu hỏi cần mình quyết định". Với những câu hỏi chưa có câu trả lời, hãy chọn phương án hợp lý nhất cho bản demo, ghi rõ đã chọn gì, rồi làm tiếp. Đừng dừng lại hỏi.

**Bước 2: Chỉ triển khai Tour GV-1 cùng phần nền tối thiểu:**
- Cài thư viện tour đã chọn ở bước 1. Ghi rõ tên và phiên bản trong báo cáo.
- Provider hoặc component tour dùng lại được cho các tour sau, kèm config các bước dạng dữ liệu.
- Bong bóng thoại có nhân vật Phấn, dùng ảnh giữ chỗ.
- Cờ đăng nhập lần đầu ở server (migration Prisma), để GV-1 chỉ tự bật trong lần đăng nhập đầu tiên với vai trò giáo viên.
- Cách reset dành riêng cho dev để demo lại nhiều lần.
- Nút "Xem lại hướng dẫn".
- Lời thoại GV-1 trong `vi.json`, `en.json`, `fr.json`.

Trong bản demo này, bước 3 của GV-1 kết thúc ngay khi giáo viên bấm "+ Tạo Class". App chuyển sang trang lớp học, kèm một câu chúc mừng ngắn. Chưa làm GV-2.

**Bước 3: Kiểm tra và dừng.** Chạy lint, type-check và test hiện có. Nếu được, thêm một test e2e Playwright đơn giản cho GV-1. Sau đó **dừng lại**, không làm các tour khác. Báo cáo cho mình:
- Những file đã tạo hoặc sửa.
- Cách chạy migration.
- Cách demo từng bước: đăng nhập lần đầu bằng một tài khoản giáo viên mới, hoặc reset cờ, rồi thấy tour hiện ra.
- Những gì chưa ổn hoặc cần mình quyết định.
