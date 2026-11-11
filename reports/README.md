# Kết quả đánh giá

`offline-report.md`, `offline-results.json` và `offline-results.csv` được tạo bằng lệnh kiểm tra ngoại tuyến. Chúng không phải đánh giá chất lượng của mô hình LLM.

`live-report.md`, `live-results.json` và `live-results.csv` chứa lần đánh giá Claude Haiku 5.5 thực tế gần nhất. Xem số ca đạt/không đạt, lỗi judge và cách đo trong báo cáo; không suy từ trạng thái `live-complete` thành mọi ca đều đạt.

`live-smoke.openai-history.json` giữ nguyên kết quả lỗi của nhà cung cấp cũ trước khi chuyển sang Claude. File này chỉ là lịch sử, không phải kết quả của Anthropic. `live-smoke.json` là trạng thái thử kết nối hiện tại.

Khi đã cấu hình khóa, chạy `npm run eval:live` để tạo `live-report.md`, `live-results.json`, `live-results.csv` và cập nhật `summary.json`. Chạy lại `npm run build` để website hiển thị báo cáo mới. Mỗi báo cáo có SHA-256 của snapshot dữ liệu để truy vết.

V2 đo HTTP localhost và service riêng, tách lượt Claude khỏi các lượt xử lý bằng quy tắc, tách token judge khỏi hội thoại. APP_FACTS cung cấp căn cứ về kiến trúc, không phải nguồn bác sĩ/cơ sở y tế. Ngưỡng điểm giữ nguyên >=4 cho từng tiêu chí. Kết quả cũ giữ nguyên trong `history/`; rubric thay đổi được ghi rõ để tránh so sánh sai.

`eval:offline` chỉ ghi `offline-summary.json`, không thay thế kết quả live trong `summary.json`. File `live-results.partial.json` chỉ là checkpoint khi chạy, không phải báo cáo hoàn tất và được Git bỏ qua.
