# Kiểm chứng bản bàn giao

- 47 kiểm thử Vitest: đạt. Gồm kiểm thử hàm và HTTP thật cục bộ, kiểm tra request Claude Messages API bằng mock fetch, JSON Schema của judge, effort/token/thinking, usage, lỗi provider và việc khóa của nhà cung cấp cũ không kích hoạt AI.
- 120 ca ngoại tuyến: đạt các kiểm tra quy tắc được khai báo. Nhiều kỳ vọng về nội dung cần LLM judge hoặc người đánh giá; không suy rộng thành 120 câu trả lời LLM đạt chất lượng.
- Build React và bundle Worker: đạt. Worker tự kiểm tra homepage và health API, snapshot có dữ liệu.
- HTTP localhost: homepage trả 200.
- `npm audit`: không còn lỗ hổng được báo tại thời điểm cài đặt phiên bản trong lockfile.
- Kiểm tra trực quan desktop/mobile: **chưa thực hiện được**. Công cụ trình duyệt trả lỗi “The browser access host is unavailable”; không có trình duyệt trong inventory. CSS có breakpoint đáp ứng nhưng chưa có ảnh chụp xác nhận.
- Gọi Anthropic thật, 120 lần LLM-as-judge, độ trễ và token Claude: **chưa chạy**, chưa có ANTHROPIC_API_KEY. Lệnh `npm run test:live` dừng trước khi gọi mạng nếu thiếu khóa.
- Ghi lịch trực tiếp trên BookingCare: không có API tích hợp, dùng chuyển hướng đến hồ sơ chính thức.
- GitHub: chưa có repository/tài khoản đích; mã nguồn và hướng dẫn push được bàn giao.
