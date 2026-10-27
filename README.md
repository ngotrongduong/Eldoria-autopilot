# Eldoria Autopilot — extension cho Microsoft Edge

Extension chạy autopilot Eldoria trong tab game `https://pxhero.net/scene/play.html`, gồm đủ các chu trình: truyện chính, việc ngày, nghề + Diễn Tấu, Tháp, Đấu trường, rương Năng Động, tổ đội, Linh Thú, Yêu Tinh…

## Cài một lần

1. Mở Edge, vào `edge://extensions`.
2. Bật **Chế độ nhà phát triển** (Developer mode), ở góc trái dưới.
3. Bấm **Tải tiện ích đã giải nén** (Load unpacked) rồi chọn thư mục `C:\game auto\edge-extension`.
4. Mở `https://pxhero.net/scene/play.html` (đăng nhập như bình thường). Khoảng 10–30 giây sau khi game vào xong, autopilot tự chạy.

Bấm biểu tượng extension để xem trạng thái (`AP.report`), bật/tắt autopilot hoặc nạp lại bản mới.

## Tự cập nhật, không cần cài lại

- Claude sửa `tools/*.js` rồi chạy `node tools/build_ext.js`, lệnh này ghi `bundle.json` và `version.json` mới vào thư mục này.
- Mỗi phút extension đọc `version.json`. Có bản mới thì nó **nạp nóng** vào tab game, giữ nguyên trạng thái (`AP.k2`) và nhật ký.
- Nếu chính extension (background/popup) đổi, `version.json.loader` khác số phiên bản trong manifest, extension sẽ tự `chrome.runtime.reload()`.
- Thứ tự nguồn bản mới: URL tuỳ chọn (GitHub, đặt trong popup), rồi cầu nối `http://127.0.0.1:8765`, rồi file trong thư mục này.

## Cầu nối cho Claude theo dõi (tuỳ chọn)

`node "C:\game auto\tools\ext_bridge.js"`: extension gửi `AP.report()` mỗi phút vào `C:\game auto\ext_status.json`. Ghi `{"cmd":"reload"}` (hoặc `"start"` / `"stop"`) vào `C:\game auto\ext_cmd.json` để ra lệnh cho tab.

## Lưu ý

- **Mỗi tài khoản chỉ chạy được một tab game.** Mở game trong Edge thì tab trong khung xem của Claude bị đá ("playing elsewhere"), và ngược lại.
- Bấm vào game thì autopilot tạm dừng; sau 45 giây không bấm, nó tự lấy lại quyền.
- Giới hạn bạn đặt cho AI trong bảng Trợ lý AI của game vẫn được tôn trọng.
