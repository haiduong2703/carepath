// First-party application behavior, kept separate from public medical profiles.
// These facts describe this codebase; they do not promise provider retention terms.
export const APP_FACTS = {
  version: 'carepath-app-facts-v1',
  role: 'Trợ lý điều hướng khám bệnh, không phải bác sĩ hoặc đại diện BookingCare.',
  provider: 'Anthropic',
  storage: 'Ứng dụng giữ hội thoại trong bộ nhớ của trang đang mở; không có database hoặc localStorage lưu chat, không có chức năng lưu bệnh án.',
  processing: 'Khi bật AI và lượt hỏi cần gọi mô hình, câu hỏi cùng lịch sử gần đây và nguồn liên quan được gửi tới Anthropic sau khi lọc một số định danh/email. Bộ lọc không bảo đảm ẩn mọi dữ liệu cá nhân.',
  localDeletion: 'Nút Cuộc trò chuyện mới xóa lịch sử khỏi phiên hiện tại; tải lại hoặc đóng trang cũng làm mất lịch sử trong ứng dụng.',
  providerDeletion: 'Xóa phiên không xóa nội dung đã gửi tới Anthropic. CarePath không có API xóa dữ liệu của nhà cung cấp và không cam kết Zero Data Retention.',
  booking: 'CarePath không tạo, đổi, hủy hoặc xác nhận lịch; không truy cập lịch trống hay trạng thái thanh toán và không thu tiền. Người dùng hoàn tất các thao tác này trên BookingCare hoặc qua kênh hỗ trợ chính thức của BookingCare/cơ sở y tế.',
  navigation: 'Có thể hướng dẫn chung mở BookingCare và tìm kênh hỗ trợ chính thức; không được bịa vị trí nút, số tổng đài, phí hoặc chính sách hủy/hoàn tiền.',
  directory: 'Dùng snapshot công khai có ngày lấy dữ liệu. Không bao phủ toàn bộ cơ sở y tế và không biết GPS của người dùng.',
  clarification: 'Nếu chỉ có danh mục chuyên khoa hoặc thiếu địa điểm, hỏi thêm khu vực là hợp lệ; không được bịa cơ sở để đủ câu trả lời.'
} as const;

export function privacyAnswer(normalized: string) {
  if (/xoa du lieu|xoa lich su|xoa hoi thoai/.test(normalized)) return 'Bạn bấm “Cuộc trò chuyện mới” để xóa lịch sử khỏi phiên CarePath hiện tại. Tải lại hoặc đóng trang cũng làm mất lịch sử trong ứng dụng. Thao tác này không xóa nội dung đã gửi tới Anthropic; CarePath không có chức năng xóa dữ liệu tại nhà cung cấp. Đừng gửi thêm CCCD, số điện thoại hoặc bệnh án vào chat.';
  if (/benh an cua nguoi khac|danh sach benh nhan|so dien thoai.*benh nhan|can cuoc.*benh nhan|lich su.*nguoi (?:dung )?khac/.test(normalized)) return 'Tôi không có quyền truy cập hoặc cung cấp bệnh án, danh sách, số điện thoại, căn cước hoặc lịch sử trò chuyện của người khác. Tôi chỉ tra cứu hồ sơ bác sĩ và cơ sở y tế công khai. Đừng gửi dữ liệu riêng tư của bạn hoặc người khác vào chat.';
  if (/luu.*benh an|luu du lieu.*may chu/.test(normalized)) return 'CarePath không có chức năng lưu bệnh án vào máy chủ. Đừng gửi CCCD, số điện thoại hoặc bệnh án vào chat. Hội thoại chỉ giữ trong phiên đang mở; khi bật AI, một số lượt hỏi được gửi tới Anthropic sau khi lọc một số định danh, nhưng không bảo đảm loại bỏ mọi thông tin cá nhân.';
  if (/cccd|can cuoc/.test(normalized)) return 'Bạn không nên nhập CCCD, căn cước, số điện thoại hoặc bệnh án vào chat CarePath. Ứng dụng không cần các thông tin này để giúp tìm nơi khám. Nếu đặt lịch yêu cầu thông tin người khám, hãy nhập trực tiếp trên BookingCare chính thức.';
  return 'Hội thoại CarePath chỉ giữ trong bộ nhớ của trang đang mở, không được lưu vào database hoặc localStorage của ứng dụng. Khi bật AI, câu hỏi và lịch sử gần đây của một số lượt được gửi tới Anthropic sau khi lọc một số định danh/email; việc lọc không bảo đảm ẩn mọi dữ liệu cá nhân. Bấm “Cuộc trò chuyện mới” để xóa lịch sử trong phiên; thao tác này không xóa dữ liệu đã gửi tới Anthropic. Đừng gửi thông tin nhạy cảm vào chat.';
}

export function bookingActionAnswer(normalized: string): string | null {
  if (/huy lich|huy hen/.test(normalized)) return 'CarePath không thể hủy lịch và chưa thực hiện thao tác hủy nào. Bạn hãy mở BookingCare chính thức, kiểm tra lịch đã đặt và dùng kênh hỗ trợ được BookingCare hoặc cơ sở y tế cung cấp để yêu cầu hủy. Tôi chưa có dữ liệu xác minh vị trí nút hủy, phí hay chính sách hủy; hãy chờ xác nhận hủy từ hệ thống hoặc cơ sở y tế.';
  if (/doi lich|doi hen/.test(normalized)) return 'CarePath không thể đổi lịch và chưa thay đổi lịch hẹn của bạn. Hãy xử lý trên BookingCare chính thức hoặc liên hệ kênh hỗ trợ của BookingCare/cơ sở y tế để yêu cầu đổi. Ngày, giờ mới và việc đổi lịch chỉ có giá trị khi bạn nhận xác nhận chính thức; tôi không kiểm tra được lịch trống hoặc chính sách đổi lịch.';
  if (/thanh toan|chuyen khoan/.test(normalized)) return 'CarePath không thu tiền, không kiểm tra hoặc xác nhận thanh toán và không xác nhận lịch hẹn. Bạn chỉ thực hiện thanh toán qua hướng dẫn được xác minh trên BookingCare hoặc tại cơ sở y tế. Nếu đã chuyển khoản, hãy kiểm tra và liên hệ kênh hỗ trợ chính thức; không gửi thông tin giao dịch hoặc tài khoản vào chat này.';
  return null;
}
