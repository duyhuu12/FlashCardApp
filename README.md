# DolphinLingo – Ứng dụng học từ vựng bằng flashcard

DolphinLingo là ứng dụng React Native dùng flashcard và lặp lại ngắt quãng. Người dùng có thể quản lý bộ từ, ôn bằng thẻ lật/vuốt, theo dõi tiến độ, chia sẻ bộ từ và đặt lịch nhắc học hằng ngày.

## Công nghệ

- Expo SDK 54, React Native 0.81, TypeScript
- Expo Router/React Navigation
- Firebase Authentication và Cloud Firestore
- Expo Notifications
- React Native Animated và Gesture Handler

## Chức năng

- Đăng ký, đăng nhập và duy trì phiên bằng Firebase Auth.
- Tạo, sửa, xóa bộ từ và flashcard; validate form và phát hiện từ trùng.
- Danh sách thẻ phân trang 40 mục/lần, ưu tiên dữ liệu cache.
- Phiên ôn chỉ lấy tối đa 30 thẻ đến hạn, sắp theo lịch ôn gần nhất.
- Lật thẻ, vuốt trái/phải và đánh giá Không nhớ/Khó/Dễ.
- Thống kê bằng truy vấn đếm phía Firestore, không tải toàn bộ tài liệu.
- Tích hợp sẵn lộ trình gần 3.000 từ Anh–Việt từ tài liệu Word, chia theo nhóm và chủ đề.
- Mọi tài khoản đều nhìn thấy 61 bài ngay khi đăng nhập, không cần nhập dữ liệu riêng.
- Công khai và sao chép bộ từ cộng đồng.
- Nhắc ôn hằng ngày bằng local notification.
- Phiên học hằng ngày trộn tối đa 30 thẻ: lỗi sai, từ khó, đến hạn và từ mới.
- Luyện tập theo chế độ trắc nghiệm, ghép cặp và nhập từ.
- XP, streak, thành tích và bảng xếp hạng.
- Loading, Error và Empty State cho các luồng tải dữ liệu.

## Kiến trúc dữ liệu

```text
users/{uid}
  cardProgress/{cardId}
  reviewLogs/{reviewId}
  deckStates/{deckId}

leaderboard/{uid}

decks/{deckId}
  cards/{cardId}
```

Nội dung lộ trình hệ thống nằm trong `src/data/en-vi-word-topics.json`. Firestore chỉ lưu tiến độ riêng trong `cardProgress`, `deckStates` và `studySessions`; bộ cá nhân vẫn được lưu trong `decks/{deckId}/cards`.

Thẻ chưa học được tính là `new`, không phải `due`. Mỗi lần đánh giá cập nhật `studySessions/{YYYY-MM-DD}` để tính mục tiêu ngày, streak và XP chính xác.

## Cài đặt

Yêu cầu Node.js LTS và Expo Go tương thích SDK 54.

```bash
npm install
```

1. Tạo project tại Firebase Console.
2. Bật Authentication → Sign-in method → Email/Password.
3. Tạo Cloud Firestore database.
4. Sao chép `.env.example` thành `.env` và điền Firebase Web App config.
5. Triển khai Firestore Rules và composite index:

```bash
npx firebase-tools login
npx firebase-tools use YOUR_PROJECT_ID
npx firebase-tools deploy --only firestore
```

6. Chạy ứng dụng:

```bash
npx expo start
```

Sau khi thay `.env`, dừng Metro và khởi động lại. Không commit file `.env`.

## Lộ trình từ vựng theo chủ đề

Tài liệu nguồn có 2.997 dòng từ hợp lệ. Sau khi bỏ 11 bản ghi trùng hoàn toàn trong cùng chủ đề, ứng dụng sử dụng 2.986 thẻ duy nhất, chia thành 10 nhóm lớn và 61 bài học. Lộ trình được đóng gói sẵn trong app nên tài khoản mới có thể học ngay.

Tạo lại dữ liệu JSON từ file Word bằng PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-word-topic-dataset.ps1 `
  -SourceDocx "D:\Tai Lieu\TỪ-VỰNG-THEO-CHỦ-ĐỀ-TĂNG-ĐIỂM-NGHE-ĐỌC-NÓI-VIẾT.docx"
```

Kết quả nằm tại `src/data/en-vi-word-topics.json`; báo cáo làm sạch nằm tại `docs/word-topic-import-audit.json`. Bài đầu được mở mặc định, bài tiếp theo mở khi người học đã đánh giá ít nhất 80% số thẻ của bài trước.

## Thuật toán ôn tập

- Không nhớ: đặt lại chuỗi ghi nhớ, ôn sau 10 phút.
- Khó: khoảng cách tối thiểu 1 ngày, sau đó nhân 1,5.
- Dễ: lần đầu 3 ngày, sau đó nhân 2,5.
- Một thẻ được tính đã thuộc khi trả lời đúng liên tiếp ít nhất 3 lần và khoảng ôn đạt ít nhất 7 ngày.

## Kiểm thử luồng chính

1. Đăng ký và đăng nhập.
2. Đăng nhập bằng tài khoản mới và xác nhận 61 bài xuất hiện ngay, không cần nhập dữ liệu.
3. Kiểm tra đủ 10 nhóm, 61 bài, 2.986 thẻ và quy tắc mở khóa 80%.
4. Ôn tập và xác nhận phiên có tối đa 30 thẻ.
5. Tạo bộ riêng; thêm, sửa và xóa thẻ.
6. Kiểm tra thống kê sau khi đánh giá cả ba mức.
7. Đặt lịch nhắc trên thiết bị Android/iOS thật.

## Lưu ý

- Local notification cần kiểm thử trên Android/iOS; web không hỗ trợ luồng cài đặt này.
- Ảnh minh họa nhận URL để không bắt buộc Firebase Storage/Blaze.
- Không xóa deck trực tiếp trong Firebase Console vì subcollection không tự bị xóa. Xóa qua ứng dụng sẽ dọn cards và progress liên quan.
- Truy vấn phiên ôn cần composite index `cardProgress(deckId ASC, nextReviewAt ASC)` trong `firestore.indexes.json`.
