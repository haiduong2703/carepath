# CarePath — Trợ lý tìm nơi khám

Ứng dụng cho phần 3: **TypeScript + React + LangChain**, dùng hồ sơ công khai từ [BookingCare](https://bookingcare.vn/), có website, mã nguồn và bộ đánh giá **120 tình huống**.

## Trạng thái bàn giao

- Website có tìm kiếm, bộ lọc khu vực/loại hồ sơ, xem nguồn, hội thoại và trang hỗ trợ đặt lịch.
- Chưa có khóa API theo lựa chọn của người dùng: mặc định chạy **tra cứu**, không gắn nhãn đây là phản hồi LLM.
- Đã có pipeline Claude Haiku 5.5 qua LangChain và chương trình LLM-as-judge. **Chưa có kết quả đánh giá LLM thực tế**. Xem `reports/offline-report.md`; các chỉ số LLM để trống thay vì ước lượng hoặc bịa số.
- Chưa có repository GitHub do người dùng cung cấp. Hướng dẫn đưa mã lên GitHub ở dưới; không có tuyên bố đã push GitHub.
- Đặt lịch bằng cách chuyển sang hồ sơ chính thức. Không có API ghi lịch được BookingCare cấp, nên CarePath không tạo, hủy, đổi hoặc xác nhận lịch hẹn.

## Chạy trên máy

Yêu cầu Node.js >=20.19 và npm.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Mở `http://127.0.0.1:8787`. Không cần khóa để dùng tìm kiếm và hướng dẫn tra cứu. Máy chủ API và React dùng cùng cổng để tránh lỗi CORS.

Để bật AI, tự đặt khóa vào `.env` trên máy của bạn:

```dotenv
ANTHROPIC_API_KEY=your_key_here
CLAUDE_EFFORT=low
PORT=8787
```

Khởi động lại `npm run dev`. Không đặt khóa trong biến `VITE_*`, mã React, GitHub, ảnh chụp hoặc chat. `.env` được Git bỏ qua. Đối với website Sites đã triển khai, cấu hình bí mật `ANTHROPIC_API_KEY` trong môi trường máy chủ; khóa cục bộ không tự chuyển sang website.

```powershell
npm run test
npm run eval:offline
npm run eval:live  # gọi API có tính phí, cần khóa thật
npm run build
npm start
```

`npm run build` kiểm tra TypeScript, build React bằng Vite, bundle API thành Cloudflare Worker ESM và tự kiểm tra `/` cùng `/api/health`. `npm start` phục vụ bản production cục bộ. Chạy lại build sau khi cập nhật dữ liệu hoặc báo cáo.

## Chạy thử bằng file test

Chạy nhanh các luồng qua HTTP thật, **không cần API key và không cần mở server trước**:

```powershell
cd D:\TestLLM\carepath
npm run test:smoke
```

File `tests/smoke.test.ts` tự mở server trên một cổng trống và đóng lại sau test. Test luôn tắt khóa Anthropic trong môi trường thử nghiệm, không gọi LLM có tính phí. Mỗi ca hiện tên và kết quả PASS/FAIL: health, tìm bác sĩ/cơ sở, lọc khu vực, chat, hỏi tiếp, đặt lịch, an toàn và các lỗi HTTP. Khi vừa giải nén mã nguồn trên máy mới, chạy `npm ci` trước.

Để tự sửa câu hỏi và gửi từng request, mở `tests/api.http`, chạy `npm run dev` ở terminal rồi dùng **Send Request** của REST Client trong VS Code hoặc HTTP Client hỗ trợ `.http`. Chế độ này gọi server đang chạy; nếu server đã bật khóa API thì một số câu hỏi chat sẽ gọi LLM có tính phí. Bỏ trống `ANTHROPIC_API_KEY` và khởi động lại server nếu muốn chỉ thử tra cứu. Gửi quá 20 câu hỏi/phút có thể nhận HTTP 429; chờ một phút rồi thử lại.

Chạy tất cả test bằng `npm test`. Smoke test xác minh luồng ứng dụng và hợp đồng HTTP, không thay thế `npm run eval:live` để chấm chất lượng LLM.

Khi đã đặt khóa trong `.env`, chạy `npm run test:live` để thử kết nối Claude Haiku 5.5 và ba câu hỏi qua HTTP thật. Lệnh này có thể gọi tối đa bốn yêu cầu LLM có tính phí; nếu kết nối đầu tiên lỗi thì dừng ngay. Kết quả nằm trong `reports/live-smoke.json`, không ghi khóa hoặc lỗi SDK thô. File `.env.example` chỉ là mẫu, ứng dụng không tự đọc khóa từ file này.

## Ràng buộc mô hình và hiệu năng

| Yêu cầu | Cách thực hiện | Cách xác minh |
|---|---|---|
| Không cao hơn Claude Haiku 5.5 | Model cố định `claude-haiku-5-5`, không cho client chọn | Test chính sách + log cấu hình báo cáo |
| Reasoning không quá medium | `CLAUDE_EFFORT` chỉ nhận `low`, `medium`; mặc định `low`; thinking tắt rõ ràng | Từ chối giá trị khác |
| Trung bình ≤10 giây/lượt | Một lệnh gọi, không retry, timeout 8,5 giây, retrieval cục bộ | `eval:live` đo mean/p50/p95; cần đo thêm đường truyền trình duyệt |
| Trung bình ≤30.000 input token | Top 4 hồ sơ, lịch sử tối đa 6 tin; chặn >28.000 byte UTF-8 nội dung prompt, chừa overhead | Chỉ kết luận bằng `usage_metadata` thực tế |
| Trung bình ≤500 output token | `maxTokens=500` chuyển thành `max_tokens` trong Claude Messages API; không bật thinking | Usage thực tế, lỗi/thiếu usage giữ `null` |

Timeout/fallback không chứng minh chất lượng LLM đạt yêu cầu; báo cáo nêu số lượt lỗi. Độ trễ đo trong service chưa gồm browser/HTTP, nên chưa tuyên bố đạt SLA từ kết quả cục bộ. Claude Haiku 5.5 được cấu hình `thinking: { type: 'disabled' }` và `outputConfig: { effort: 'low' }` để ưu tiên tốc độ trong ngân sách 500 token. Có thể đổi effort thành `medium`; phải đo lại chất lượng và thời gian. Không gửi `temperature`, `top_p`, `top_k` hoặc tham số dành cho Responses API.

Tài liệu: [Claude Haiku 5.5](https://platform.claude.com/docs/en/models/haiku-5-5/overview), [effort](https://platform.claude.com/docs/en/build-with-claude/effort), [LangChain ChatAnthropic](https://docs.langchain.com/oss/javascript/integrations/chat/anthropic). Hội thoại và LLM-as-judge đều dùng Anthropic. Ứng dụng không đọc khóa `OPENAI_API_KEY` và không tự chuyển sang nhà cung cấp cũ khi Claude lỗi.

## Dữ liệu và giới hạn

```powershell
npm run data:refresh
```

Crawler đọc robots.txt, chỉ lấy danh mục và hồ sơ công khai thuộc HTTPS `bookingcare.vn`, cách nhau ít nhất 1 giây, không crawl trang đặt lịch/thanh toán hay đánh giá bệnh nhân. Mỗi hồ sơ có URL, thời điểm lấy và SHA-256. Nếu lấy ít hơn 15 hồ sơ, giữ snapshot cũ. Kết quả nằm trong `data/catalog.json`; thống kê và lỗi ở `data/ingestion.json`.

Snapshot nhỏ phục vụ bài tập, không bao phủ toàn bộ BookingCare và không đồng bộ thời gian thực. Không có embeddings trả phí: dùng BM25 kết hợp chuẩn hóa tiếng Việt và từ đồng nghĩa để tiết kiệm độ trễ/token. Danh mục chuyên khoa là toàn quốc; vị trí hồ sơ lấy từ phần đầu trang và cần xác minh tại nguồn. Không suy đoán giá, lịch trống, quyền lợi bảo hiểm hay xếp hạng.

Khi refresh dữ liệu trang chủ có thể thay đổi. Bộ eval giữ các nguồn đích theo snapshot bàn giao; hãy rà lại expectedIds nếu nguồn biến mất hoặc đổi URL.

## Đặt lịch

Chọn hồ sơ → “Hỗ trợ đặt lịch” → chọn ngày mong muốn (tùy chọn) → “Tiếp tục trên BookingCare”. Người dùng nhập thông tin cá nhân, chọn giờ thực tế và hoàn tất tại BookingCare. Ghi chú tải xuống chỉ là checklist, **không phải phiếu xác nhận**. Ngày dự kiến không được tự chuyển sang BookingCare vì không có hợp đồng tích hợp đặt hẹn.

## Đánh giá 120 ca bằng LLM-as-judge

`evals/cases.ts` có 12 nhóm × 10 ca viết cụ thể: bác sĩ; cơ sở; chuyên khoa; dịch vụ; địa điểm; đặt lịch; tính đúng dữ kiện; yêu cầu y khoa; cấp cứu; riêng tư; prompt injection; hội thoại nối tiếp.

1. `eval:offline`: kiểm tra nguồn đích/top 4, khu vực, một số ý định, điều kiện bắt buộc và nguồn cho phép. Không đánh giá tự động đầy đủ nội dung kỳ vọng.
2. `eval:live`: chạy cùng 120 ca qua service, sau đó dùng Claude Haiku 5.5 làm judge với JSON Schema. Chấm groundedness, relevance, safety và bookingHonesty từ 1–5. Đạt khi mọi mục ≥4, judge đồng ý và rule check đạt.
3. Báo cáo lưu JSON từng ca, CSV, Markdown và `summary.json`. Token judge tách khỏi token hội thoại. Lỗi usage giữ `null`; lỗi judge không tính như đạt. Cùng mô hình chấm có thể thiên lệch; cần rà thủ công một mẫu.

Lệnh trả mã lỗi nếu có lỗi cấu trúc hoặc judge không hoàn tất. Điểm chất lượng và từng ngưỡng SLA được ghi riêng; xem kết quả thay vì chỉ dựa vào exit code. Không dùng kết quả offline để tuyên bố Claude Haiku 5.5 đạt yêu cầu.

## API

| Endpoint | Công dụng |
|---|---|
| GET `/api/health` | Trạng thái AI và snapshot; không trả bí mật |
| GET `/api/search?q=...&city=...&type=...` | Tìm hồ sơ và bộ lọc |
| POST `/api/chat` | `{ message, history?, city? }` |
| GET `/api/evaluation` | Báo cáo tổng hợp hiện có |

API giới hạn body 24KB, câu hỏi 2.000 ký tự, 6 tin nhắn lịch sử, kiểm tra Origin và giới hạn 20 lượt/phút trong mỗi process/isolate. Không thay thế rate limiter phân tán; khi công khai diện rộng cần lớp hạn mức bền vững theo tài khoản. Website Sites mới mặc định riêng tư.

Hội thoại chỉ giữ trong React memory; không database hoặc localStorage. Một số số định danh/email được lọc trước khi gọi Anthropic, nhưng bộ lọc không bảo đảm loại bỏ mọi thông tin cá nhân. Ứng dụng không ghi nội dung chat của người dùng vào log và không tự cam kết chính sách Zero Data Retention của Anthropic. Xóa/đóng phiên không đồng nghĩa xóa dữ liệu nhà cung cấp. Báo cáo test chỉ lưu các câu hỏi mẫu do chương trình tạo. Không gửi thông tin nhạy cảm.

## Kiến trúc mã nguồn

```text
src/                     React, giao diện tiếng Việt, kiểu dữ liệu chung
server/retrieval.ts      Chuẩn hóa tiếng Việt, BM25, bộ lọc
server/assistant.ts      Guardrails, prompt, LangChain, ngân sách, usage
server/api.ts            Validation, API, rate limit
server/worker.ts         Entrypoint Cloudflare Worker và assets
scripts/ingest.ts        Crawler công khai có giới hạn
scripts/evaluate.ts      120 ca, LLM-as-judge, JSON/CSV/Markdown
evals/cases.ts           Câu hỏi và kỳ vọng
tests/assistant.test.ts  Retrieval, safety, context, API contract
data/                    Snapshot có nguồn
reports/                 Báo cáo đo được và trạng thái chưa chạy
```

## Đưa mã nguồn lên GitHub

Tạo repository rỗng trên GitHub, rồi trong thư mục mã nguồn đã giải nén:

```powershell
git init -b main
git add .
git commit -m "Build CarePath BookingCare assistant"
git remote add origin https://github.com/YOUR_ACCOUNT/carepath.git
git push -u origin main
```

Nếu checkout hiện tại đã có remote của Sites, dùng bản ZIP bàn giao hoặc đặt tên remote khác như `github` để giữ remote Sites. Không commit `.env`. Trên GitHub, workflow CI tự cài phụ thuộc từ lockfile, chạy test và build. Không chạy API có tính phí trong CI mặc định.

## Những phần còn cần tài khoản của bạn

1. Đặt ANTHROPIC_API_KEY trên máy chủ và chạy `npm run eval:live` để có báo cáo LLM-as-judge thực tế ≥100 ca, số token và độ trễ.
2. Tạo repository GitHub và push mã nguồn theo hướng dẫn.
3. Nếu cần đặt lịch hoàn toàn bên trong ứng dụng, cần API/ủy quyền tích hợp chính thức từ BookingCare; không thể thực hiện bằng dữ liệu công khai đơn thuần.
