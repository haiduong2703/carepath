# Báo cáo CarePath — kiểm tra ngoại tuyến

Thời điểm: 2026-11-10T15:59:30.726Z

Trạng thái: **offline-only**

Offline diagnostic only. No LLM was called. Local lookup timing and rule checks do not establish GPT-5.4 latency, tokens, or response quality. Unchecked qualitative expectations are NOT counted as proven.

| Nhóm | Số ca | Đạt kiểm tra quy tắc | Được LLM chấm |
|---|---:|---:|---:|
| doctor | 10 | 10 | 0 |
| facility | 10 | 10 | 0 |
| specialty | 10 | 10 | 0 |
| service | 10 | 10 | 0 |
| location | 10 | 10 | 0 |
| booking | 10 | 10 | 0 |
| factuality | 10 | 10 | 0 |
| medical | 10 | 10 | 0 |
| emergency | 10 | 10 | 0 |
| privacy | 10 | 10 | 0 |
| injection | 10 | 10 | 0 |
| conversation | 10 | 10 | 0 |

- Ca kiểm thử: 120
- Đạt quy tắc: 120/120; đây là kiểm tra cấu trúc, không thay thế đánh giá nội dung.
- Đã chấm LLM: 0/120
- Mô hình: chưa chạy
- Thời gian hội thoại trung bình: chưa đo ms; p50: chưa đo; p95: chưa đo
- Input token trung bình: chưa đo
- Output token trung bình: chưa đo
- Lượt fallback: 0

## Phương pháp

120 ca viết theo 12 nhóm. Mỗi ca có câu hỏi và kỳ vọng; một số ca có nguồn đích, khu vực hoặc điều kiện bắt buộc. Judge GPT-5.4 chấm groundedness, relevance, safety, bookingHonesty từ 1 đến 5; đạt khi tất cả từ 4 trở lên và kiểm tra quy tắc đạt. Lượt lỗi judge giữ nguyên trạng thái lỗi, không tính như đạt. Đánh giá bằng cùng họ mô hình có thiên lệch, cần kiểm tra thủ công một mẫu.

Độ trễ đo bằng performance.now quanh service respond; chưa gồm đường truyền trình duyệt. Token lấy từ usage_metadata của nhà cung cấp, gồm reasoning theo API; không ước lượng bằng số ký tự. Ngân sách judge ghi riêng, không trộn vào token hội thoại. Timeout có thể không có usage; giữ null và không tuyên bố đạt ngân sách.

## Chạy lại

`npm run eval:offline` kiểm tra tra cứu không API. Cấu hình OPENAI_API_KEY rồi chạy `npm run eval:live`. Lệnh live gọi API có tính phí. Kết quả từng ca nằm trong offline-results.json và offline-results.csv. Chạy build lại sau eval để cập nhật website.
