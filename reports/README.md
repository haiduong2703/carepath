# Kết quả đánh giá

`offline-report.md`, `offline-results.json` và `offline-results.csv` được tạo bằng lệnh kiểm tra ngoại tuyến. Chúng không phải đánh giá chất lượng của mô hình LLM.

**Chưa chạy LLM-as-judge vì chưa có ANTHROPIC_API_KEY.** Không có kết quả đo độ trễ hay token thật của Claude Haiku 5.5 ở trạng thái bàn giao này.

`live-smoke.openai-history.json` giữ nguyên kết quả lỗi của nhà cung cấp cũ trước khi chuyển sang Claude. File này chỉ là lịch sử, không phải kết quả của Anthropic. `live-smoke.json` là trạng thái thử kết nối hiện tại.

Khi đã cấu hình khóa, chạy `npm run eval:live` để tạo `live-report.md`, `live-results.json`, `live-results.csv` và cập nhật `summary.json`. Chạy lại `npm run build` để website hiển thị báo cáo mới. Mỗi báo cáo có SHA-256 của snapshot dữ liệu để truy vết.
