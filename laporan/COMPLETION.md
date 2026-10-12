# Checklist penyelesaian dan panduan peninjauan

Sumber: [TUGAS.md](../TUGAS.md), [README](../README.md), dan ketiga templat laporan. Urutan pekerjaan mengikuti checklist yang ditampilkan sebelum implementasi.

| No. | Instruksi dan luaran | Status | Bukti |
|---|---|---|---|
| 1 | Baca tugas/templat; diagnosis delapan tiket dan dugaan Rudi; baseline S0–S6, tiga ulangan | Selesai | `48f838f`; [data](data/before/summary.json), [trace](trace/), bagian 5 laporan |
| 2 | Tulis dan commit delapan hipotesis sebelum perubahan, beserta mekanisme, prediksi, alternatif, efek samping | Selesai | `820616b` mendahului seluruh fix; [PREDIKSI](PREDIKSI.md) |
| 3 | Perbaiki pencarian, scroll/gambar, keranjang/checkout, voucher, idle/CLS; pertahankan fitur dan seluruh produk; commit logis | Selesai | `b18d174`, `c3bddc7`, `d26d1c3`, `dcc5f7a`; [uji fungsi 3000 produk](data/features-all.json), [oracle voucher](data/voucher-correctness.json) |
| 4 | Audit minimal dua usulan AI yang salah/tidak lengkap dengan kontrol dan trace | Selesai | `253993b`; [AUDIT-AI](AUDIT-AI.md), kandidat sumber dan tiga ulangan tersedia |
| 5 | Ulang S0–S6 tiga kali, median; minimal tiga pasangan trace; buat screenshot nyata dan bukti Network/log server | Selesai | `e29036f`; **21 pasangan** baseline/final; [data akhir](data/after/summary.json), [45 screenshot](../screenshots/INDEX.md) |
| 6 | Naskah, rekam otomatis S1–S5 sebelum/sesudah CPU 4×, subtitle, video maksimal tiga menit | Selesai | `8fa9a33`; [MP4 124,76 detik](../demo/demo.mp4), [ffprobe/decode](../demo/verification.json), [naskah](../demo/SCRIPT.md) |
| 7 | Isi tujuh bagian laporan, hasil prediksi/trade-off, AI disclosure, referensi seluruh bukti, maksimal setara enam halaman | Selesai untuk analisis; identitas tim perlu tindakan pemilik | [LAPORAN](LAPORAN.md), [PREDIKSI](PREDIKSI.md); render QA **5 halaman A4** telah diperiksa |
| 8 | Baca ulang instruksi; audit semua luaran, integritas trace, tautan, Git, file terlindungi dan batas video | Pemeriksaan akhir sedang dijalankan | Hasil akan dicatat setelah pemeriksaan |

## Cakupan fitur yang diverifikasi

Seluruh 3000 produk tetap ada, jumlah/filter/sort cocok, baris awal/tengah/akhir terjangkau, DOM terbatas, ukuran responsif; countdown, marquee, badge kilat, banner, reveal kartu, aktivitas 9000 entri dasar + jurnal; harga/cicilan kedua voucher dan batas aturan; progres dan input bersamaan; keranjang satu klik/persistensi/batas 99; tiga klik checkout satu pesanan, status proses, kegagalan dan retry. Event `page_view`, `search`, `impression`, `add_to_cart`, `begin_checkout`, `apply_voucher`, `promo_click` semuanya tercatat di SDK asli.

Target bukan semuanya lulus: S3 INP 368 ms, S5 tiga frame >50 ms, S6 busy 13,46%, serta satu task IPC S1 116,731 ms tetap dijelaskan. Tugas menyatakan target sebagai arah dan meminta analisis jujur. Tidak ada klaim angka nol untuk CPU atau baterai/suhu yang tidak diukur. Profil headless CDP adalah penyimpangan dari UI DevTools manual dan dinyatakan di laporan.

## Commit pekerjaan

1. `48f838f` — `test: capture reproducible flash sale performance baseline`
2. `820616b` — `docs: record measured hypotheses before performance fixes`
3. `b18d174` — `perf: window product cards and observe viewport activity`
4. `c3bddc7` — `fix: acknowledge cart actions and guard duplicate checkout`
5. `d26d1c3` — `perf: yield voucher calculation while preserving business rules`
6. `dcc5f7a` — `perf: stabilize promo layout and reduce idle rendering work`
7. `253993b` — `test: audit two AI alternatives against controlled browser traces`
8. `e29036f` — `test: verify final performance and full catalogue behavior`
9. `8fa9a33` — `docs: record captioned before and after interaction demo`

Commit dokumentasi/audit berikutnya dapat dilihat melalui `git log --oneline 9da21d1..HEAD`. Tidak ada push, perubahan remote, commit kosong, atau penulisan ulang riwayat.

## Tindakan yang memang harus dilakukan manusia

- Tinjau kode, trace, video, dan laporan. Identitas yang tersedia hanya **JULIAN DIO SAPUTRA**; lengkapi nama tim, 3–4 anggota dan kontribusi aktual sesuai ketentuan dosen. Informasi mata kuliah/tenggat pada TUGAS asli juga belum diisi oleh pemberi tugas. Jangan mengarang anggota atau mengklaim pengukuran manual tim.
- Siapkan sesi individu dari TUGAS §10: **20 menit** diagnosis masalah baru memakai DevTools tanpa AI/internet, lalu **5–10 menit** penjelasan. Buka trace S1/S4/S6, identifikasi task/microtask serta Style/Layout/Paint, dan jelaskan trade-off dengan bukti. Agen tidak menggantikan ujian ini atau menjamin pemahaman manusia.
- Setelah meninjau, lakukan `git push` sendiri dan kumpulkan repository, laporan, trace, serta demo sesuai kanal/tenggat dosen. Tidak perlu merekam ulang screenshot atau video untuk melengkapi luaran otomatis yang tersedia.
