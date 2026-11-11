# CarePath — Trợ lý tìm nơi khám

Ứng dụng cho phần 3: **TypeScript + React + LangChain**, dùng hồ sơ công khai từ [BookingCare](https://bookingcare.vn/), có website, mã nguồn và bộ đánh giá **120 tình huống**.

## Trạng thái bàn giao

- Website có đăng ký/đăng nhập bằng email và mật khẩu, tìm kiếm, bộ lọc khu vực/loại hồ sơ, xem nguồn, hội thoại và trang hỗ trợ đặt lịch.
- Hội thoại và LLM-as-judge dùng Claude Haiku 5.5 qua LangChain. Mỗi môi trường cần tự cấu hình `ANTHROPIC_API_KEY`; nếu thiếu khóa thì chạy **tra cứu**, không gắn nhãn phản hồi đó là LLM.
- Báo cáo thực tế: [live-report.md](reports/live-report.md), [JSON từng ca](reports/live-results.json), [CSV](reports/live-results.csv). Báo cáo ghi riêng ca không đạt và các giới hạn của phép đo.
- Website: https://carepath-bookingcare-assistant.finitejet1.chatgpt.site. Người dùng tự đăng ký tài khoản CarePath, không cần tài khoản ChatGPT/Google. Repository: https://github.com/haiduong2703/carepath.
- Đặt lịch bằng cách chuyển sang hồ sơ chính thức. Không có API ghi lịch được BookingCare cấp, nên CarePath không tạo, hủy, đổi hoặc xác nhận lịch hẹn.

## Chạy trên máy

Yêu cầu Node.js >=20.19 và npm.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Mở `http://127.0.0.1:8787`, chọn **Đăng ký**, nhập tên, email và mật khẩu từ 12–128 ký tự. Sau khi tạo tài khoản, ứng dụng tự đăng nhập. Không cần API key để dùng tìm kiếm và hướng dẫn tra cứu. Máy chủ API và React dùng cùng cổng để tránh lỗi CORS.

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

`npm run build` kiểm tra TypeScript, build React bằng Vite, bundle API thành Cloudflare Worker ESM và tự kiểm tra trang chủ cùng việc chặn API khi chưa đăng nhập/thiếu DB. `npm start` phục vụ bản production cục bộ. Chạy lại build sau khi cập nhật dữ liệu hoặc báo cáo.

## Tài khoản cho bản nộp thử

- Bất kỳ người xem nào cũng có thể tự đăng ký bằng email/mật khẩu; không dùng đăng nhập ChatGPT hoặc Google. Email chỉ là tên tài khoản, **chưa được xác minh qua email**. Chưa có quên mật khẩu/gửi email. Dùng mật khẩu riêng cho bản thử.
- Mật khẩu băm bằng scrypt (`N=32768, r=8, p=3`, salt ngẫu nhiên 16 byte). Phiên có hạn 7 ngày, token ngẫu nhiên 32 byte trong cookie HttpOnly/SameSite=Lax (Secure trên HTTPS); DB chỉ lưu SHA-256 của token. Đăng xuất xóa phiên trên máy chủ.
- Mọi API nghiệp vụ đều yêu cầu phiên hợp lệ. POST kiểm tra Origin và CSRF. Giới hạn đăng ký 5 lần/giờ/IP, đăng nhập 20 lần/phút/IP và 10 lần/phút/email; IP do nền tảng/socket cung cấp. Không tin header người dùng ChatGPT do client gửi.
- Local lưu tại `.data/auth.json` (Git bỏ qua), dành cho một tiến trình Node. Dừng rồi chạy lại vẫn đăng nhập được. Sites dùng D1 qua binding `DB`; tài khoản local và hosted **độc lập**. Không đưa `.data/` vào Git/zip.
- Schema ở `db/schema.ts`, migration SQL + metadata ở `drizzle/`. Khi sửa schema, chạy `npm run db:generate`, kiểm tra migration và build; Sites áp dụng migration khi triển khai. Không sửa migration đã áp dụng. Worker luôn bắt đăng nhập và trả lỗi khi thiếu DB.
- Chạy `npm run test:auth` để thử 20 ca HTTP/SQLite về đăng ký, đăng nhập, cookie, CSRF, giới hạn thử sai, phiên hết hạn/đăng xuất và lưu tài khoản qua khởi động lại. Test không đọc `.env`, không gọi LLM. Các script đánh giá mô hình dùng server loopback riêng bỏ qua auth; không thể tắt auth của Worker triển khai bằng biến môi trường.

Báo cáo 120 ca hiện có đo trước khi thêm đăng nhập. Báo cáo đó đánh giá phản hồi AI qua HTTP localhost; không đo thời gian đăng ký/đăng nhập hoặc D1 trên website hosted. Nội dung báo cáo cũ được giữ nguyên.

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

Timeout/fallback không chứng minh chất lượng LLM đạt yêu cầu; báo cáo nêu số lượt lỗi. Bản đánh giá v2 đo qua HTTP localhost tới khi đọc đủ JSON, đồng thời ghi thời gian service riêng; chưa gồm Internet/trình duyệt người dùng. Claude Haiku 5.5 được cấu hình `thinking: { type: 'disabled' }` và `outputConfig: { effort: 'low' }` để ưu tiên tốc độ trong ngân sách 500 token. Có thể đổi effort thành `medium`; phải đo lại chất lượng và thời gian. Không gửi `temperature`, `top_p`, `top_k` hoặc tham số dành cho Responses API.

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
2. `eval:live`: chạy cùng 120 ca qua HTTP thật, sau đó dùng Claude Haiku 5.5 làm judge với JSON Schema. Chấm groundedness, relevance, safety và bookingHonesty từ 1–5. Đạt khi mọi mục ≥4 và rule check đạt. Rubric v3 để chương trình suy ra `passed` từ bốn điểm, không để cờ boolean độc lập mâu thuẫn với chính điểm chấm.
3. `server/app-facts.ts` xác minh riêng hành vi ứng dụng như lưu phiên, gửi Anthropic và giới hạn đặt lịch. Judge được cung cấp căn cứ này nhưng không được dùng để suy ra dữ kiện y tế hoặc mặc định cho điểm đạt. Câu hỏi thiếu địa điểm được phép hỏi làm rõ; vẫn trừ điểm nếu trả lời lạc đề hoặc bịa cơ sở.
4. Báo cáo lưu JSON từng ca, CSV, Markdown và `summary.json`. Có số liệu toàn bộ lượt, riêng lượt Claude, thời gian HTTP và service, p50/p95. Token judge tách khỏi token hội thoại. Lỗi usage giữ `null`; lỗi judge không tính như đạt. Cùng mô hình chấm có thể thiên lệch; cần rà thủ công một mẫu.
5. Kết quả live trước đó tự được giữ nguyên trong `reports/history/`. Phiên bản câu hỏi, rubric, APP_FACTS và snapshot có mã phiên bản/SHA-256. Rubric v2 đã sửa kỳ vọng nhà cung cấp và bổ sung căn cứ nên điểm trước/sau không phải thí nghiệm chỉ thay mô hình.

`npm run eval:calibrate` gọi judge ở effort medium trên bốn đáp án đúng/sai mẫu (có tính phí), lưu `judge-calibration.json`; không cộng mẫu vào 120 ca. Rubric v3 đánh số nguồn rõ ràng, đọc cả excerpt khi metadata chuyên khoa trống, phân biệt thiếu sót nhỏ (4 điểm) với thiếu đáng kể (3 điểm). Mẫu calibration ban đầu thiếu nguồn châm cứu được giữ tại `judge-calibration-initial.json` để truy vết.

`npm run eval:rejudge` chỉ chấm lại 120 đáp án HTTP đã ghi nhận, không gọi lại trợ lý. Lệnh từ chối khi hash câu hỏi, dữ liệu hoặc APP_FACTS khác bản ghi. Báo cáo ghi rõ chế độ chấm lại và `responsesGeneratedAt`; số thời gian/token hội thoại giữ từ lần đo gốc. Cần chạy `eval:live` mới nếu thay code phản hồi. Cả hai lệnh dùng judge effort medium (trong giới hạn đề bài), thinking disabled và tối đa 500 output token.

`npm run eval:retry-errors` chỉ gọi lại các ca judge bị lỗi API/timeout/schema, không chấm lại những ca đã có điểm (kể cả điểm không đạt). Cần cùng rubric và hash dữ liệu/câu hỏi/APP_FACTS. Báo cáo ghi số kết quả giữ lại và số yêu cầu judge mới; bản lỗi được lưu trong history. Tổng token judge của báo cáo ghép gồm usage đã biết của các kết quả giữ lại, không phải hóa đơn riêng của lần retry.

Cả hai lệnh eval giữ nhịp tối thiểu 3,1 giây giữa các lượt để tôn trọng giới hạn 20 chat/phút của một client; thời gian chờ và chấm không tính vào độ trễ hội thoại. Mỗi lần chạy đủ 120 ca có thể mất vài phút. Offline ghi `offline-summary.json` và không ghi đè `summary.json` live. Live có checkpoint `live-results.partial.json` (không đưa lên Git) để xem tiến độ khi chạy.

Lệnh trả mã lỗi nếu có lỗi cấu trúc hoặc judge không hoàn tất. Điểm chất lượng và từng ngưỡng SLA được ghi riêng; xem kết quả thay vì chỉ dựa vào exit code. Không dùng kết quả offline để tuyên bố Claude Haiku 5.5 đạt yêu cầu.

## API

| Endpoint | Công dụng |
|---|---|
| GET `/api/health` | Trạng thái AI và snapshot; không trả bí mật |
| GET `/api/search?q=...&city=...&type=...` | Tìm hồ sơ và bộ lọc |
| POST `/api/chat` | `{ message, history?, city? }` |
| GET `/api/evaluation` | Báo cáo tổng hợp hiện có |

API chat giới hạn body 24KB, câu hỏi 2.000 ký tự, 6 tin nhắn lịch sử, kiểm tra Origin/CSRF và giới hạn 20 lượt/phút trong mỗi process/isolate theo tài khoản. Không thay thế rate limiter phân tán; khi công khai diện rộng cần lớp hạn mức chat bền vững. Auth có bộ đếm riêng được lưu trong D1/file local.

Hội thoại chỉ giữ trong React memory, không lưu chat vào database hoặc localStorage. Tên, email, hash mật khẩu, hash token phiên và bộ đếm giới hạn đăng nhập được lưu riêng trên máy chủ. Tên/email tài khoản không tự động đưa vào prompt. Một số số định danh/email trong chat được lọc trước khi gọi Anthropic, nhưng bộ lọc không bảo đảm loại bỏ mọi thông tin cá nhân. Ứng dụng không ghi nội dung chat của người dùng vào log và không tự cam kết chính sách Zero Data Retention của Anthropic. Xóa/đóng phiên không đồng nghĩa xóa dữ liệu nhà cung cấp. Báo cáo test chỉ lưu các câu hỏi mẫu do chương trình tạo. Không gửi thông tin nhạy cảm.

## Kiến trúc mã nguồn

```text
src/                     React, giao diện tiếng Việt, kiểu dữ liệu chung
server/retrieval.ts      Chuẩn hóa tiếng Việt, BM25, bộ lọc
server/assistant.ts      Guardrails, prompt, LangChain, ngân sách, usage
server/app-facts.ts      Hành vi ứng dụng được xác minh, phản hồi riêng tư/lịch
server/api.ts            Validation, API, rate limit
server/worker.ts         Entrypoint Cloudflare Worker và assets
scripts/ingest.ts        Crawler công khai có giới hạn
scripts/evaluate.ts      120 ca, LLM-as-judge, JSON/CSV/Markdown
evals/cases.ts           Câu hỏi và kỳ vọng
evals/judge.ts           Rubric và JSON Schema, phân biệt APP_FACTS/nguồn y tế
evals/metrics.ts         Thống kê HTTP/service, toàn bộ lượt/riêng Claude
tests/assistant.test.ts  Retrieval, safety, context, API contract
data/                    Snapshot có nguồn
reports/                 Báo cáo đo được, lỗi cụ thể và lịch sử lần trước
```

## Đưa mã nguồn lên GitHub

Lấy mã nguồn từ repository:

```powershell
git clone https://github.com/haiduong2703/carepath.git
cd carepath
npm ci
Copy-Item .env.example .env
npm run dev
```

Nếu checkout hiện tại đã có remote của Sites, dùng bản ZIP bàn giao hoặc đặt tên remote khác như `github` để giữ remote Sites. Không commit `.env`. Trên GitHub, workflow CI tự cài phụ thuộc từ lockfile, chạy test và build. Không chạy API có tính phí trong CI mặc định.

## Những phần còn cần tài khoản của bạn

1. Mỗi máy hoặc website triển khai cần cấu hình khóa Anthropic riêng ở môi trường máy chủ; khóa cục bộ không tự chuyển lên Sites/GitHub.
2. Nếu cần đặt lịch hoàn toàn bên trong ứng dụng, cần API/ủy quyền tích hợp chính thức từ BookingCare; không thể thực hiện bằng dữ liệu công khai đơn thuần.
