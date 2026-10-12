# Reproduksi bukti

Alat di direktori ini adalah **alat audit**, bukan dependensi aplikasi. Aplikasi tetap memakai HTML/CSS/JavaScript dan Web API saja.

```powershell
npm install --prefix .tools --no-save --no-package-lock playwright ffmpeg-static ffprobe-static
$env:JUMLAH_PRODUK='1500'
node server.js
# Terminal lain, gunakan label baru agar bukti historis tidak ditimpa:
node scripts/measure.cjs reproduce-after
node scripts/analyze-traces.cjs reproduce-after
node scripts/summarize.cjs reproduce-after
node scripts/trace-view.cjs reproduce-after
```

**Label tidak memilih versi source.** Untuk mengukur baseline lagi, hentikan server final milik proses ini, ekspor commit asli ke direktori terisolasi, lalu jalankan server hasil ekspor pada port 3000:

```powershell
New-Item -ItemType Directory -Force .capture-tmp | Out-Null
git archive --format=zip --output=.capture-tmp/baseline.zip 9da21d1
Expand-Archive -LiteralPath .capture-tmp/baseline.zip -DestinationPath .capture-tmp/baseline-source -Force
$env:JUMLAH_PRODUK='1500'
node .capture-tmp/baseline-source/server.js
# Terminal lain tetap di root repository:
node scripts/measure.cjs reproduce-before
node scripts/analyze-traces.cjs reproduce-before
node scripts/summarize.cjs reproduce-before
node scripts/trace-view.cjs reproduce-before
```

Jangan menjalankan server baseline/final bersamaan pada port sama. Ekspor tersebut tidak mengganti working tree atau riwayat Git. Berkas `before` yang dikumpulkan sebelum perbaikan dan `after` final tetap menjadi bukti historis. Untuk demo, routing source asli sudah otomatis: lihat [naskah demo](../demo/SCRIPT.md).

Argumen opsional kedua adalah daftar skenario, misalnya `S1,S5`; argumen ketiga jumlah ulangan (default 3). Chrome yang terpasang dijalankan headless, profil sementara terisolasi (tanpa ekstensi), viewport 412 × 915, CDP CPU throttling 4×, tanpa network throttling. Setiap ulangan memuat halaman untuk mengisi riwayat, lalu reload sekali. Skenario dijalankan berurutan dengan Reset sebelum interaksi; setelah S4 pencarian dikosongkan, setelah S5 kembali ke atas. S3 menghapus pesanan server sebelum tiga klik nyata melalui input browser.

`laporan/trace/*.json.gz` berisi JSON trace asli Chrome, dikompresi lossless. Impor ke DevTools Performance (dekompresi dahulu bila versi DevTools tidak menerima gzip). Ringkasan pipeline mencakup event lengkap dan pasangan begin/end. Bottom-up memakai CPU samples, bukan waktu fungsi yang direka. `trace-view.cjs` membuat visualisasi dari event asli dan screenshot-nya; tampilannya diberi label sebagai visualisasi ekspor CDP, bukan screenshot UI DevTools.

Angka INP dan long task interaksi berasal dari `AlatUkur.ringkas()` tanpa mengubah alat bawaan. Ini perkiraan INP pada skenario pendek, bukan data lapangan persentil ke-75. Untuk S0, gunakan CLS dari event LayoutShift asli: impor alat ukur dapat tertunda di halaman baseline. Untuk S5/S6, gunakan jarak antar FireAnimationFrame pada sepuluh detik pertama trace; angka panel mentah dapat mencakup waktu ekspor. Ringkasan mempertahankan kedua sumber agar perbedaan bisa diperiksa. Tidak adanya event interaksi >=16 ms menghasilkan `null`, bukan bukti INP 0.

Selama verifikasi antara (`catalog`, `checkout`, `voucher`, `promo`, `audit-*`), probe rAF tambahan untuk load ikut terpasang. Trace audit-control S1 mengungkap callback `frame`, URL kosong, sekitar 106 ms; itu overhead pengukuran, bukan aplikasi. Probe redundan tersebut dibuang sebelum seri `after`. Baseline asli juga tidak memakai probe rAF ini. Bukti antara tetap disimpan dan tidak dipakai sebagai hasil akhir aplikasi. Pengamatan progres hanya dipasang selama S4.

Pengukuran otomatis tidak mengklaim DevTools UI dibuka, semua aplikasi pengguna ditutup, sumber listrik diverifikasi, atau Chrome diperbarui. Versi browser dan mesin aktual ada di `laporan/data/*/environment.json`. Konfigurasi 3.000 produk dicoba terlebih dahulu namun rekamannya tidak selesai secara praktis; seri perbandingan memakai mode ringan 1.500 produk sesuai izin TUGAS §7. Data sebelum/sesudah harus dibandingkan pada mesin dan konfigurasi yang sama.

`diagnose.cjs` adalah eksperimen tambahan terisolasi untuk kategori/merek dan payload SDK; jangan mencampur hasilnya dengan median S0–S6. Riwayatnya dibentuk dengan algoritme seed asli. Semua pengukuran browser dijalankan berurutan, bukan paralel.

## Pemeriksaan panjang laporan

`python scripts/render-report.py` menghasilkan salinan PDF QA dan PNG di `.capture-tmp/report-qa/` (tidak dikumpulkan atau di-commit). Tooling Python: reportlab, pypdf, PyMuPDF; memakai font Arial Windows. Laporan utama tetap `laporan/LAPORAN.md`. Render final diperiksa secara visual: 5 halaman A4, font isi 10,5 pt, dalam batas setara 6 halaman.
