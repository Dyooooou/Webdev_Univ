# Reproduksi bukti

Alat di direktori ini adalah **alat audit**, bukan dependensi aplikasi. Aplikasi tetap memakai HTML/CSS/JavaScript dan Web API saja.

```powershell
npm install --prefix .tools --no-save --no-package-lock playwright ffmpeg-static ffprobe-static
$env:JUMLAH_PRODUK='1500'
node server.js
# Terminal lain:
node scripts/measure.cjs before
node scripts/analyze-traces.cjs before
node scripts/summarize.cjs before
node scripts/trace-view.cjs before
```

Gunakan `after` sebagai label untuk versi perbaikan. Argumen opsional kedua adalah daftar skenario, misalnya `S1,S5`; argumen ketiga jumlah ulangan (default 3). Chrome yang terpasang dijalankan headless, profil sementara terisolasi (tanpa ekstensi), viewport 412 × 915, CDP CPU throttling 4×, tanpa network throttling. Setiap ulangan memuat halaman untuk mengisi riwayat, lalu reload sekali. Skenario dijalankan berurutan dengan Reset sebelum interaksi; setelah S4 pencarian dikosongkan, setelah S5 kembali ke atas. S3 menghapus pesanan server sebelum tiga klik nyata melalui input browser.

`laporan/trace/*.json.gz` berisi JSON trace asli Chrome, dikompresi lossless. Impor ke DevTools Performance (dekompresi dahulu bila versi DevTools tidak menerima gzip). Ringkasan pipeline mencakup event lengkap dan pasangan begin/end. Bottom-up memakai CPU samples, bukan waktu fungsi yang direka. `trace-view.cjs` membuat visualisasi dari event asli dan screenshot-nya; tampilannya diberi label sebagai visualisasi ekspor CDP, bukan screenshot UI DevTools.

Angka INP dan long task interaksi berasal dari `AlatUkur.ringkas()` tanpa mengubah alat bawaan. Ini perkiraan INP pada skenario pendek, bukan data lapangan persentil ke-75. Untuk S0, gunakan CLS dari event LayoutShift asli: impor alat ukur dapat tertunda di halaman baseline. Untuk S5/S6, gunakan jarak antar FireAnimationFrame pada sepuluh detik pertama trace; angka panel mentah dapat mencakup waktu ekspor. Ringkasan mempertahankan kedua sumber agar perbedaan bisa diperiksa. Tidak adanya event interaksi >=16 ms menghasilkan `null`, bukan bukti INP 0.

Pengukuran otomatis tidak mengklaim DevTools UI dibuka, semua aplikasi pengguna ditutup, sumber listrik diverifikasi, atau Chrome diperbarui. Versi browser dan mesin aktual ada di `laporan/data/*/environment.json`. Konfigurasi 3.000 produk dicoba terlebih dahulu namun rekamannya tidak selesai secara praktis; seri perbandingan memakai mode ringan 1.500 produk sesuai izin TUGAS §7. Data sebelum/sesudah harus dibandingkan pada mesin dan konfigurasi yang sama.

`diagnose.cjs` adalah eksperimen tambahan terisolasi untuk kategori/merek dan payload SDK; jangan mencampur hasilnya dengan median S0–S6. Riwayatnya dibentuk dengan algoritme seed asli. Semua pengukuran browser dijalankan berurutan, bukan paralel.
