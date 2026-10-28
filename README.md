# LiveQ — Audience Question + Realtime Word Cloud

Web realtime sederhana seperti sistem Q&A/word cloud untuk presentasi.

## Fitur
- Presenter membuat room + pertanyaan.
- Kode room dan QR otomatis.
- Audiens join dari HP melalui QR/link.
- Jawaban muncul realtime tanpa refresh.
- Frekuensi jawaban menentukan ukuran kata.
- Presenter dapat mengganti pertanyaan, menutup/membuka jawaban, menghapus jawaban, dan fullscreen.
- Tidak memakai database pada versi awal; data room disimpan di memory server dan otomatis hilang setelah server restart/room kedaluwarsa.

## Cara menjalankan
1. Install Node.js 18+.
2. Buka terminal di folder project.
3. Jalankan `npm install`.
4. Jalankan `npm start`.
5. Buka `http://localhost:3000`.

## Dipakai satu Wi-Fi untuk presentasi
Jika HP audiens satu Wi-Fi dengan laptop presenter, buka alamat IP laptop, misalnya `http://192.168.1.10:3000`. QR yang dibuat server akan otomatis memakai host yang sedang dibuka.

## Catatan deployment
Untuk dipakai lewat internet, deploy project Node.js ini ke hosting yang mendukung WebSocket/Socket.IO (misalnya VPS atau platform Node.js). Untuk produksi sebaiknya tambahkan database, moderasi kata, autentikasi presenter, rate limit, dan HTTPS.
