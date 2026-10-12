# Naskah demo otomatis

Tujuan: menunjukkan S1–S5 **sebelum lalu sesudah**, CPU 4×, viewport 412 × 915, 1500 produk. Maksimum video final 3 menit; perkiraan 100–160 detik. Tidak ada narasi suara: subtitle dibakar ke MP4. Durasi akhir dan chapter aktual dicatat setelah recording.

## Setup

```powershell
npm install --prefix .tools --no-save --no-package-lock playwright ffmpeg-static ffprobe-static
$env:PLAYWRIGHT_BROWSERS_PATH=(Join-Path (Get-Location) '.tools\browsers')
node .tools/node_modules/playwright/cli.js install ffmpeg
$env:JUMLAH_PRODUK='1500'
node server.js
# Terminal lain:
node scripts/record-demo.cjs
node scripts/encode-demo.cjs
```

Record sebelum membaca HTML/CSS/JS asli dari commit `9da21d1` melalui routing browser. API dan vendor tetap server asli. Record sesudah memakai berkas kerja. Masing-masing memakai context terisolasi, memuat halaman sekali untuk seed riwayat, menunggu semua request selesai, lalu reload. Pemanasan dipotong dari video akhir; interaksi dipertahankan. Timestamp chapter disimpan, bukan ditebak.

## Urutan setiap versi

1. **S1:** fokus kolom cari, ketik `sepatu` satu huruf setiap 120 ms, berhenti sebentar, hapus enam huruf dengan Backspace. Caption menjelaskan render besar pada baseline dan jendela DOM pada perbaikan.
2. **S2:** gulir tombol produk pertama ke layar, tekan `+ Keranjang` satu kali, tahan tampilan agar lencana dan toast terbaca. Caption menjelaskan umpan balik dan persistensi aktivitas.
3. **S3:** kosongkan pesanan via API, tekan koordinat tombol `Beli sekarang` tiga kali cepat, tampilkan lencana Pesanan dan status. Caption mengajak melihat tiga pesanan vs satu, dengan penjelasan guard klien.
4. **S4:** gulir ke voucher `KILAT1212`, tekan Pakai voucher dan ketik `sepatu` saat perhitungan berjalan. Tampilkan progres dan hasil, lalu kosongkan pencarian. Caption membandingkan microtask panjang dengan chunk task dan progres.
5. **S5:** gulir terus-menerus selama 10 detik. Caption menjelaskan layout berulang vs jendela kartu, observer, dan animasi transform.

Jeda 1–3 detik antar aksi membantu keterbacaan. Video merupakan demonstrasi satu pengambilan per versi, **bukan** pengganti median 3 ulangan di laporan. Jika durasi interaksi nyata melampaui 3 menit, adegan yang panjang boleh dipercepat dengan faktor per adegan yang ditampilkan di caption dan metadata; angka laporan tetap dari trace terpisah.

## Hasil rekaman

Video final: [demo.mp4](demo.mp4), 124,76 detik, 1280 x 1024, H.264 25 fps, 3.460.514 byte. Viewport aplikasi tetap 412 x 915; ruang luar dipakai untuk subtitle. Baseline S1 dipercepat 5,00x dan S4 5,86x, ditandai sepanjang adegan; delapan adegan lain 1,00x. Pemanasan/reset awal dipotong. Beban screencast dan otomatisasi memperpanjang baseline, sehingga durasi demo bukan metrik performa. Rekaman ini memakai angka panel dari satu pengambilan, bukan median laporan.

[Chapter sumber dan hasil](chapters.json), [subtitle](demo.srt), [hasil ffprobe dan full decode](verification.json). Pemeriksaan visual mencakup frame tengah/akhir setiap adegan dan contact sheet tiap 5 detik; jumlah pesanan server diverifikasi 3 lalu 1. Semua artefak mentah encoding berada di folder sementara yang diabaikan Git.

