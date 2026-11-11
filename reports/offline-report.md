# Báo cáo CarePath — ngoại tuyến

Trạng thái: **offline-only**. Thời điểm UTC: 2026-11-11T08:54:19.499Z.

Đo qua HTTP localhost từ trước fetch đến sau khi đọc JSON đầy đủ. Chưa gồm Internet/trình duyệt của người dùng. Thời gian service ghi riêng; không tính judge và nhịp chờ giới hạn tốc độ. Token lấy từ usage API; lượt quy tắc dùng 0, lượt lỗi không biết usage giữ null. Token judge tách riêng. Cùng họ mô hình chấm có thể thiên lệch; cần rà mẫu thủ công. Kết quả v1/v2 thay cả rubric và cách đo, không thể quy mọi thay đổi điểm cho mô hình.

## Kết quả

- Tổng số ca: 120; được LLM chấm: 0.
- Đạt quy tắc: 120/120; đạt cả judge và quy tắc: 0/120.
- Lượt Claude: 0; an toàn theo quy tắc: 36; tra cứu: 84.
- Lỗi HTTP: 0; lỗi judge: 0; fallback: 0.

| Chỉ số | Toàn bộ lượt | Chỉ lượt Claude | Giới hạn trung bình |
|---|---:|---:|---:|
| HTTP đầy đủ (ms) | chưa đo | chưa đo | 10.000 |
| Service (ms) | chưa đo | chưa đo | tham khảo |
| Input token | chưa đo | chưa đo | 30.000 |
| Output token | chưa đo | chưa đo | 500 |

HTTP p50: chưa đo ms; p95: chưa đo ms.

Đạt thời gian/input/output: chưa đo / chưa đo / chưa đo.

| Nhóm | Số ca | Đạt quy tắc | Được LLM chấm | Đạt cả hai |
|---|---:|---:|---:|---:|
| doctor | 10 | 10 | 0 | 0 |
| facility | 10 | 10 | 0 | 0 |
| specialty | 10 | 10 | 0 | 0 |
| service | 10 | 10 | 0 | 0 |
| location | 10 | 10 | 0 | 0 |
| booking | 10 | 10 | 0 | 0 |
| factuality | 10 | 10 | 0 | 0 |
| medical | 10 | 10 | 0 | 0 |
| emergency | 10 | 10 | 0 | 0 |
| privacy | 10 | 10 | 0 | 0 |
| injection | 10 | 10 | 0 | 0 |
| conversation | 10 | 10 | 0 | 0 |

## Ca cần xem lại

Không có lỗi quy tắc; nội dung chưa được LLM chấm.

## Phương pháp và truy vết

Model claude-haiku-5-5, effort low/medium, thinking disabled, max_tokens=500. Judge dùng low và JSON Schema, chỉ đạt khi mọi tiêu chí >=4 cùng các kiểm tra quy tắc đạt. APP_FACTS chỉ xác minh hành vi ứng dụng, không thay thế nguồn y tế. Không xóa ca khó hoặc đổi điểm đã đo; ngưỡng chấm giữ nguyên.

Cases: carepath-cases-v2; rubric: carepath-judge-v2; dữ liệu SHA-256: a24b1ace81c758e5cf957d52548c28f0ae3b1b87e4375eb41753389a4fd55cda.

Không có baseline kèm lần chạy này.

Token judge: chưa gọi, không cộng vào token hội thoại. Chi tiết từng ca: offline-results.json và offline-results.csv.

Chạy lại từ thư mục carepath: `npm run eval:live`. Lệnh gọi API có tính phí. Offline dùng `npm run eval:offline` và không ghi đè summary live.
