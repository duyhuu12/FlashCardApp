# Các Công Nghệ Sử Dụng Trong Dự Án DolphinLingo

DolphinLingo là ứng dụng học từ vựng tiếng Anh qua Flashcard và thuật toán lặp lại ngắt quãng (Spaced Repetition). Dưới đây là chi tiết toàn bộ các công nghệ, thư viện và công cụ được sử dụng trong dự án.

---

## 1. Nền Tảng & Ngôn Ngữ (Core Framework & Language)

| Công nghệ | Phiên bản | Vai trò & Chi tiết |
| :--- | :--- | :--- |
| **React Native** | `0.81.5` | Framework phát triển ứng dụng di động đa nền tảng (Android, iOS, Web). |
| **Expo SDK** | `~54.0.35` | Bộ công cụ mã nguồn mở cung cấp Native APIs, quản lý môi trường runtime và build app. |
| **TypeScript** | `~5.9.2` | Ngôn ngữ lập trình chính, đảm bảo an toàn kiểu dữ liệu (Type Safety) và hỗ trợ Auto-complete. |
| **React / React DOM** | `19.1.0` | Thư viện nhân để xây dựng UI dựa trên các Component. |

---

## 2. Điều Hướng & Routing (Navigation)

| Công nghệ / Thư viện | Phiên bản | Vai trò & Chi tiết |
| :--- | :--- | :--- |
| **Expo Router** | `~6.0.24` | Cơ chế routing dựa trên cấu trúc thư mục (File-based routing) tương tự Next.js. |
| **React Navigation Native** | `^7.1.8` | Bộ thư viện gốc điều hướng màn hình (Stack, Native Stack). |
| **React Navigation Bottom Tabs** | `^7.4.0` | Quản lý thanh điều hướng tab phía dưới (Bottom Navigation Bar). |
| **React Navigation Elements** | `^2.6.3` | Các thành phần giao diện phục vụ điều hướng (Headers, Buttons, Dynamic Titles). |

---

## 3. Backend & Cơ Sở Dữ Liệu (Firebase Ecosystem)

| Công nghệ / Thư viện | Phiên bản | Vai trò & Chi tiết |
| :--- | :--- | :--- |
| **Firebase Web SDK** | `^12.17.1` | SDK chính kết nối các dịch vụ đám mây của Google Firebase. |
| **Firebase Authentication** | Cloud Service | Xác thực người dùng (Đăng ký, Đăng nhập email/mật khẩu, quản lý phiên). |
| **Google Sign-In** | `^16.1.4` | Tích hợp đăng nhập nhanh qua tài khoản Google (`@react-native-google-signin/google-signin`). |
| **Cloud Firestore** | Cloud Service | Cơ sở dữ liệu NoSQL lưu trữ thời gian thực: `cardProgress`, `reviewLogs`, `deckStates`, `leaderboard`, `decks/{deckId}/cards`. |
| **Firestore Security Rules** | File | Quy tắc bảo mật dữ liệu phía server (`firestore.rules`). |
| **Firestore Indexes** | File | Tối ưu hóa truy vấn nâng cao với Composite Index (`firestore.indexes.json`). |

---

## 4. Giao Diện, Hiệu Ứng & Tương Tác (UI, Animation & Interactions)

| Công nghệ / Thư viện | Phiên bản | Vai trò & Chi tiết |
| :--- | :--- | :--- |
| **React Native Reanimated** | `~4.1.1` | Xử lý các chuyển động mượt mà (chuyển cảnh, lật thẻ, vuốt trái/phải) trực tiếp trên UI thread. |
| **React Native Gesture Handler** | `~2.28.0` | Lắng nghe cử chỉ chạm, vuốt và kéo thả của người dùng. |
| **React Native Worklets** | `0.5.1` | Thực thi mã JavaScript hiệu năng cao độc lập trên UI Thread. |
| **Expo Haptics** | `~15.0.8` | Tạo phản hồi xúc giác/rung khi tương tác (đánh giá thẻ, nhấn nút). |
| **Expo Image** | `~3.0.11` | Hiển thị và tối ưu hóa bộ nhớ đệm (caching) hình ảnh minh họa thẻ. |
| **Expo Vector Icons** | `^15.0.3` | Bộ biểu tượng phong phú (Ionicons, MaterialIcons, Feather...). |
| **Expo Symbols** | `~1.0.8` | Sử dụng hệ thống SF Symbols chuẩn trên iOS. |
| **Expo Safe Area Context** | `~5.6.0` | Xử lý vùng an toàn của màn hình (Tai thỏ, Dynamic Island, Navigation bar). |

---

## 5. Âm Thanh & Phát Âm (Audio & Speech)

| Công nghệ / Thư viện | Phiên bản | Vai trò & Chi tiết |
| :--- | :--- | :--- |
| **Expo Speech** | `~14.0.8` | Công cụ chuyển văn bản thành giọng nói (Text-to-Speech) để phát âm từ vựng tiếng Anh. |
| **Expo Audio** | `~1.1.1` | Tải và phát các tệp âm thanh hiệu ứng hoặc bài nghe. |

---

## 6. Lưu Trữ Cục Bộ & Thông Báo (Storage & Notifications)

| Công nghệ / Thư viện | Phiên bản | Vai trò & Chi tiết |
| :--- | :--- | :--- |
| **Async Storage** | `2.2.0` | Lưu trữ bộ nhớ đệm cục bộ, token và cài đặt người dùng trên thiết bị. |
| **Expo Notifications** | `~0.32.17` | Quản lý và lập lịch gửi thông báo nhắc nhở học tập hàng ngày (Local Notification). |

---

## 7. Bộ Dữ Liệu & Script Xử Lý (Data & Automation Scripts)

| Công nghệ / Component | Định dạng | Mô tả |
| :--- | :--- | :--- |
| **PowerShell Dataset Script** | `.ps1` | Script `scripts/build-word-topic-dataset.ps1` tự động đọc file tài liệu Word (.docx), trích xuất và làm sạch từ vựng. |
| **Pre-packaged Word Dataset** | JSON | File `src/data/en-vi-word-topics.json` chứa 2.986 từ vựng độc bản chia thành 10 nhóm chủ đề và 61 bài học tích hợp sẵn. |

---

## 8. Công Cụ Build, Kiểm Thử & Kiểm Soát Mã Nguồn

| Công cụ | Phiên bản / Định dạng | Mô tả |
| :--- | :--- | :--- |
| **EAS (Expo Application Services)** | `eas.json` | Cấu hình dịch vụ build đám mây cho ra file `.apk`, `.aab` (Android) và `.ipa` (iOS). |
| **ESLint & Expo Lint Config** | `^9.25.0` | Kiểm tra lỗi cú pháp và chuẩn hóa phong cách viết code. |
| **Git / GitHub** | Repository | Quản lý phiên bản mã nguồn. |
