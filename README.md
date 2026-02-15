README - memory-hybrid (SQLite-only + LLM re-ranker)

Mục đích
- Hướng dẫn nhanh để cài đặt / phục hồi database SQLite cho plugin memory-hybrid.
- Hướng dẫn import cuộc hội thoại Telegram vào database để agent có thể dùng ngay.
- Hướng dẫn test, kiểm tra và khắc phục lỗi cơ bản (smoke tests).

Tiện ích đi kèm
- scripts/import_telegram.py  — script Python để import file Telegram export (JSON) vào SQLite DB của plugin.
- scripts/import_telegram.sh  — wrapper shell chạy Python script.

Vị trí cài đặt
- Plugin: /usr/lib/node_modules/openclaw/extensions/memory-hybrid/
- DB mặc định: ~/.openclaw/memory/facts.db (tương ứng /root/.openclaw/memory/facts.db khi chạy dưới root)

Nội dung chính
1) Restore / backup DB
- Sao lưu DB hiện tại:
  cp ~/.openclaw/memory/facts.db ~/.openclaw/memory/facts.db.bak

- Khôi phục từ bản sao lưu:
  cp ~/.openclaw/memory/facts.db.bak ~/.openclaw/memory/facts.db

2) Import cuộc hội thoại Telegram
- Chuẩn bị
  + Đặt file export Telegram JSON ở: /root/telegram_export.json (hoặc chỉ rõ đường dẫn khi gọi script)

- Thực thi import (dưới user root hoặc user đang chạy gateway):
  /usr/lib/node_modules/openclaw/extensions/memory-hybrid/scripts/import_telegram.sh /root/telegram_export.json

- Script sẽ:
  + Đọc JSON, tách các message (text) hợp lệ
  + Bỏ qua message quá ngắn hoặc nghi ngờ là nhạy cảm
  + Kiểm tra duplicate (so sánh text) trước khi insert
  + Insert vào bảng facts với source = 'telegram-import' và decayClass = 'stable'

3) Smoke tests
- Kiểm tra plugin load & stats:
  openclaw hybrid-mem stats

- Tìm kiếm test:
  openclaw hybrid-mem search "pairing code" --limit 5

- Thử LLM re-ranker (nếu đã cấu hình llmBaseUrl/llmApiKey/llmModel trong openclaw.json):
  curl -sS -X POST "http://127.0.0.1:20128/v1/chat/completions" -H "Authorization: Bearer <KEY>" -H "Content-Type: application/json" -d '{"model":"combo-ben","messages":[{"role":"system","content":"You are a concise tester."},{"role":"user","content":"Say hi in Vietnamese"}],"temperature":0}'

4) Cấu hình LLM re-ranker
- Trong /root/.openclaw/openclaw.json dưới plugins.entries.memory-hybrid.config thêm:
  "llmBaseUrl": "http://127.0.0.1:20128/v1",
  "llmApiKey": "<API_KEY>",
  "llmModel": "combo-ben"

- Sau đó chạy: openclaw doctor --fix (hoặc restart gateway bằng pm2 restart openclaw)

5) Phần kiểm thử & khắc phục lỗi thường gặp
- ParseError / Syntax error khi load plugin:
  + Kiểm tra file index.ts thay đổi gần nhất (nếu tự sửa code, đảm bảo không có regex chưa đóng hoặc chuỗi template lỗi).
- "No API key found" khi gọi LLM:
  + Kiểm tra openclaw.json providers (9router) và fields llmApiKey trong memory-hybrid config.
- Nếu plugin không load: xem log openclaw gateway / pm2 logs openclaw

6) Mã nguồn lên GitHub
- Đảm bảo commit các file sau:
  /index.ts
  /config.ts
  /openclaw.plugin.json
  /package.json
  /README.md
  /scripts/import_telegram.py
  /scripts/import_telegram.sh

- Trong README của repo GitHub, ghi rõ bước cài đặt, requirement (node/npm, python3) và cảnh báo: file config chứa API key — không commit key thật vào repo công khai.

7) Giấy phép & Liên hệ
- Thả vào LICENSE (MIT) nếu muốn chia sẻ công khai.
- Nếu cần hỗ trợ thêm, ping Trí (owner) trên Telegram @ngunguoi2025.


Hết.
