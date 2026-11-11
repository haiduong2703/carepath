# Thay đổi bộ đánh giá và giới hạn kết quả

## Các thay đổi sản phẩm

- Phản hồi riêng cho hỏi lưu chat, nhập CCCD, lưu bệnh án, xóa phiên và dữ liệu của người khác. Xóa phiên không được mô tả thành xóa dữ liệu Anthropic.
- Hủy/đổi lịch và thanh toán đi qua hướng dẫn khả năng thực tế của ứng dụng; không truy xuất thêm hồ sơ y tế lạc đề hoặc tự xác nhận thao tác.
- Truy vấn có tên chuyên khoa rõ ràng lọc theo cụm từ trước khi chấm BM25, tránh dùng một từ như “cứu” để lấy hồ sơ không liên quan.
- Trang báo cáo phân biệt hoàn tất chạy, số ca được chấm và số ca đạt, có số liệu toàn bộ lượt và riêng lượt Claude.

## Các thay đổi đánh giá

- Giữ đủ 120 ca; sửa kỳ vọng nhà cung cấp OpenAI thành Anthropic và tên khóa ở ca prompt injection. Với câu hỏi châm cứu thiếu địa điểm, chấp nhận hỏi làm rõ sau khi dẫn danh mục, không yêu cầu bịa một cơ sở.
- APP_FACTS là căn cứ riêng về phần mềm; không thay thế dữ liệu BookingCare. Nguồn được đánh số trùng với citation 1-based trong đáp án.
- Bốn điểm vẫn từ 1–5 và mỗi điểm phải >=4 để đạt. Rubric v2 từng trả cờ boolean mâu thuẫn với chính các điểm. V3 bỏ cờ độc lập; chương trình tính đạt từ bốn điểm cùng rule checks. Đây là thay đổi phương pháp, phải được nêu khi so sánh điểm.
- Judge effort medium, thinking disabled, max_tokens=500, trong giới hạn mô hình của đề bài. Bốn mẫu calibration gồm hai đáp án đúng và hai đáp án sai; không cộng vào 120 ca.
- Mẫu calibration châm cứu ban đầu thiếu nguồn s40 trong fixture, nên bị chấm không đạt. File ban đầu được giữ riêng; fixture sau đó được bổ sung đúng danh mục và citation trước khi xác minh lại.

## Cách đo và các lần chạy

1. Bản đầu đo trực tiếp service, 114/120 ca đạt; dữ liệu nguyên bản trong `history/2026-11-11T08-30-51-466Z/`.
2. Sau sửa sản phẩm, thu mới đủ 120 đáp án qua HTTP localhost và chấm bằng rubric v2: 104/120 đạt. Lưu nguyên bản trong `history/2026-11-11T08-52-14-326Z/`.
3. Chấm lại đúng các đáp án và số đo HTTP đó bằng rubric v3: 116 ca đạt, ba ca không đạt và một lỗi judge. Lưu nguyên bản trong `history/2026-11-11T09-01-10-567Z/`.
4. Chỉ gọi lại một ca judge bị lỗi; giữ nguyên 119 kết quả đã có, kể cả ba ca không đạt. Kết quả cuối là **117/120 (97,5%)**, chấm đủ 120 ca, không có lỗi judge/HTTP hoặc fallback.

Thời gian HTTP và token hội thoại ở bản cuối được giữ nguyên từ lần thu đáp án ở bước 2, không giả làm số đo mới của bước 3/4. Hash câu hỏi, dữ liệu và APP_FACTS phải khớp để cho phép chấm lại. Ngày đo và chế độ chạy có trong JSON. Không kết luận mô hình tự cải thiện chỉ từ chênh lệch điểm vì rubric và cách đo cũng thay đổi.

## Ba ca còn cần rà soát

- `doctor-01`: cách diễn đạt chuyên khoa/lĩnh vực liên quan của bác sĩ còn bị judge nghi ngờ. Tag tự trích xuất không nên được hiểu như chứng nhận chuyên khoa; lý do judge cũng cần người đọc đối chiếu nguồn.
- `specialty-03`: danh sách tim mạch có trung tâm xét nghiệm liên quan, không hoàn toàn tương đương một nơi khám chuyên khoa tim mạch.
- `booking-08`: câu trả lời hướng dẫn đặt lịch bị cắt ở cuối trong ngân sách output nhỏ. Giữ điểm không đạt, không tăng trần token để che lỗi.

Một lý do judge có đoạn tự sửa lỗi định dạng trong chuỗi `reason`; giữ nguyên phản hồi gốc để kiểm toán, không coi mọi lý do do LLM viết là kết luận chuyên môn đúng. Cần rà mẫu thủ công; kết quả 97,5% không bảo đảm cho mọi câu hỏi.

Đặt lịch vẫn hoàn tất trên BookingCare. Ứng dụng không tạo, hủy, đổi lịch hoặc thu tiền. Phép đo localhost không bao gồm Internet/trình duyệt của người dùng. Khóa API chỉ ở môi trường máy chủ, không có trong nguồn GitHub.
