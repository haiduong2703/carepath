# Kiểm chứng bản bàn giao

- 22 kiểm thử Vitest: đạt. Có kiểm tra prompt thực sự chứa câu hỏi và nguồn, usage từ nhà cung cấp qua mock, trạng thái lỗi không bịa token, nguồn/khu vực, bảo vệ y khoa, giới hạn model và hợp đồng HTTP.
- 120 ca ngoại tuyến: đạt các kiểm tra quy tắc được khai báo. Nhiều kỳ vọng về nội dung cần LLM judge hoặc người đánh giá; không suy rộng thành 120 câu trả lời LLM đạt chất lượng.
- Build React và bundle Worker: đạt. Worker tự kiểm tra homepage và health API, snapshot có dữ liệu.
- HTTP localhost: homepage trả 200.
- `npm audit`: không còn lỗ hổng được báo tại thời điểm cài đặt phiên bản trong lockfile.
- Kiểm tra trực quan desktop/mobile: **chưa thực hiện được**. Công cụ trình duyệt trả lỗi “The browser access host is unavailable”; không có trình duyệt trong inventory. CSS có breakpoint đáp ứng nhưng chưa có ảnh chụp xác nhận.
- Gọi OpenAI thật, 120 lần LLM-as-judge, độ trễ và token LLM: **chưa chạy**, thiếu khóa theo trạng thái bàn giao đã thống nhất.
- Ghi lịch trực tiếp trên BookingCare: không có API tích hợp, dùng chuyển hướng đến hồ sơ chính thức.
- GitHub: chưa có repository/tài khoản đích; mã nguồn và hướng dẫn push được bàn giao.
