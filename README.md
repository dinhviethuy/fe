# DataExtract AI - Frontend Client

Ứng dụng giao diện người dùng (Frontend Client) được xây dựng bằng **React**, **TypeScript** và **Vite** để tương tác với hệ thống backend NestJS. Giao diện trực quan hỗ trợ tải tài liệu lên, quản lý hàng đợi và hiển thị kết quả OCR & Trích xuất bảng biểu thời gian thực.

---

## ✨ Tính Năng Nổi Bật

1. **Cấu Hình API Key Linh Hoạt**:
   - Cho phép người dùng chuyển đổi giữa việc sử dụng API Key hệ thống (mặc định cấu hình trên backend) hoặc sử dụng danh sách API Key cá nhân lưu cục bộ (`localStorage`).
2. **Review Văn Bản OCR Phân Trang**:
   - Giao diện xem văn bản OCR phân trang lazy load tiết kiệm băng thông.
   - Hiển thị phần trăm độ tin cậy (`confidence score`) cho từng trang tài liệu.
   - Hỗ trợ sửa đổi văn bản trực tiếp, sao chép nhanh (`Copy`) và tải xuống tệp văn bản (`.txt`) cho từng trang hoặc toàn bộ tài liệu.
3. **Chỉnh Sửa & Xuất Bảng Biểu (Excel/ZIP)**:
   - Giao diện Table Editor cho phép chỉnh sửa trực tiếp các ô bảng biểu trích xuất được.
   - Xem trước cấu trúc bảng trực quan (Excel Preview).
   - Xuất dữ liệu bảng ra file Excel (`.xlsx`) đơn lẻ hoặc gộp nhiều trang, hỗ trợ tải file nén `.zip` chứa các bảng riêng biệt.
4. **Hỗ Trợ Huỷ Tác Vụ Chủ Động (Cancel Job)**:
   - Khi tài liệu đang trong quá trình xử lý, người dùng có thể click **🚫 Huỷ tác vụ** để ra lệnh dừng khẩn cấp trên hệ thống, tránh lãng phí hạn ngạch API Google Cloud.

---

## ⚙️ Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Cài đặt các thư viện phụ thuộc
Đảm bảo bạn đã cài đặt Node.js và npm hoặc pnpm. Di chuyển vào thư mục client và chạy lệnh:
```bash
npm install
# hoặc sử dụng pnpm
pnpm install
```

### 2. Cấu hình Endpoint Backend
Mặc định client sẽ kết nối đến NestJS Backend chạy tại `http://localhost:3000`. Bạn có thể kiểm tra cấu hình này tại tệp [types.ts](src/types.ts):
```typescript
export const API_BASE = 'http://localhost:3000';
```

### 3. Khởi chạy chế độ phát triển
Chạy lệnh sau để khởi động dev server:
```bash
npm run dev
# hoặc
pnpm dev
```
Truy cập ứng dụng tại đường dẫn mặc định hiển thị trên console (thường là `http://localhost:5173`).

### 4. Build sản phẩm production
```bash
npm run build
```
Thư mục kết xuất `dist/` có thể được triển khai lên bất kỳ máy chủ static hosting nào (như Nginx, Vercel, Netlify).
