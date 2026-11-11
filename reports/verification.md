# Kiểm chứng bản bàn giao

- 62 kiểm thử Vitest: đạt. Gồm kiểm thử hàm và HTTP thật cục bộ, request Claude Messages API bằng mock fetch, JSON Schema của judge, effort/token/thinking, usage, lỗi provider, xóa phiên không xóa dữ liệu provider, giới hạn hủy/đổi lịch và cách tách token/thời gian trong báo cáo.
- 120 ca ngoại tuyến: đạt các kiểm tra quy tắc được khai báo. Nhiều kỳ vọng về nội dung cần LLM judge hoặc người đánh giá; không suy rộng thành 120 câu trả lời LLM đạt chất lượng.
- Build React và bundle Worker: đạt. Worker tự kiểm tra homepage và health API, snapshot có dữ liệu.
- HTTP localhost: homepage trả 200.
- `npm audit`: không còn lỗ hổng được báo tại thời điểm cài đặt phiên bản trong lockfile.
- Kiểm tra trực quan desktop/mobile: **chưa thực hiện được**. Công cụ trình duyệt trả lỗi “The browser access host is unavailable”; không có trình duyệt trong inventory. CSS có breakpoint đáp ứng nhưng chưa có ảnh chụp xác nhận.
- Kết quả gọi Claude và 120 lần LLM-as-judge thực tế: xem `live-report.md` và từng ca trong `live-results.json`. V2 đo qua HTTP localhost, không tính judge vào độ trễ/token hội thoại. Baseline v1 được giữ nguyên tại `history/`.
- Ghi lịch trực tiếp trên BookingCare: không có API tích hợp, dùng chuyển hướng đến hồ sơ chính thức.
- Repository đích: https://github.com/haiduong2703/carepath. `.env` và checkpoint được Git bỏ qua; GitHub Actions chỉ chạy kiểm tra không dùng khóa thật.
- Bản đánh giá cuối chấm đủ 120 ca, đạt 117/120 (97,5%); xem `evaluation-changes.md` để biết lịch sử rubric, phép đo và ba ca không đạt còn giữ lại. 4/4 mẫu calibration hiện tại đạt kỳ vọng. Một lỗi judge được thử lại riêng, không chấm lại các ca không đạt để tìm điểm tốt hơn.
