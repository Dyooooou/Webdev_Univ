# Laporan audit performa dan interaksi TokoKilat

Tanggal audit: 12 Oktober 2026. Identitas yang tersedia: **JULIAN DIO SAPUTRA**. Nama tim, anggota lain (tugas meminta 3–4 orang), dan kontribusi manusia belum diberikan; tidak diasumsikan.

## 1. Ringkasan eksekutif

Delapan tiket ditelusuri melalui trace Chrome sebelum perubahan. Penyebab terbesar adalah render seluruh katalog, pembacaan layout setelah penulisan, dan antrean microtask voucher. Perbaikan membatasi DOM sesuai viewport, memisahkan task perhitungan, mengecilkan payload analitik, melindungi checkout, serta menstabilkan layout dan animasi. Pada 1.500 produk, median INP pencarian turun 2544 menjadi 16 ms, keranjang 368 menjadi 40 ms, dan voucher 3696 menjadi 16 ms. Tiga klik menghasilkan satu pesanan; CLS turun 0,474 menjadi 0; pemuatan gambar awal turun dari 1500 menjadi 2. Semua 3000 produk tetap lolos pemeriksaan fungsi. Target belum seluruhnya tercapai: INP S3 368 ms, S5 tiga frame lambat, idle 13,46%, serta satu task IPC 116,7 ms pada trace S1. Data dan keterbatasan tersebut dipertahankan, bukan disembunyikan.

## 2. Lingkungan pengukuran

Intel Core Ultra 7 255HX, 20 logical CPU, RAM 31,4 GiB, Windows 11 Home Single Language; Chrome **154.0.8037.98**, Node 25.9.0. [Metadata mesin](data/after/environment.json). Pengukuran memakai 1500 produk (`JUMLAH_PRODUK=1500`, setara mode ringan): percobaan awal 3000 produk terlalu berat untuk pengukuran praktis. Uji fungsi akhir tetap memakai 3000 produk.

Sebelum/sesudah memakai mesin sama, context sementara terisolasi tanpa ekstensi, viewport **412 × 915**, CDP CPU **4×**, jaringan tanpa throttle, seed pada pemuatan pertama lalu satu reload, tiga ulangan, median, Reset sebelum skenario interaksi. Tidak ada benchmark paralel. Penyimpangan: Chrome **headless melalui CDP**, bukan UI DevTools terbuka; status versi stabil terbaru, listrik laptop, dan penutupan aplikasi lain tidak diverifikasi. Ini bukan pengujian Android fisik.

[Prosedur dan skrip](../scripts/README.md) menjelaskan batas pengukuran. Trace asli disimpan lossless sebagai `.json.gz`, dapat diimpor ke Performance (dekompresi bila diperlukan). Screenshot flame chart adalah **visualisasi event CDP asli**, bukan tiruan UI DevTools. INP/long task berasal dari alat bawaan; CLS S0 dari LayoutShift trace karena alat baseline terlambat aktif. Frame S5/S6 dihitung dari interval rAF >50 ms pada **10 detik pertama trace**, agar waktu ekspor tidak ikut dihitung. Busy adalah proporsi RunTask pada jendela tersebut, termasuk browser/alat ukur.

## 3. Hasil sebelum dan sesudah

Sumber: [tiga ulangan sebelum](data/before/summary.json), [sesudah](data/after/summary.json). Semua angka tabel adalah median.

| Skenario / metrik | Sebelum | Sesudah | Target / hasil |
|---|---:|---:|---|
| S0 CLS | 0,474 | 0 | ≤0,1: tercapai |
| S0 gambar, 10 detik dari navigasi | 0 | 2 | Baseline belum mulai request; lihat catatan |
| S0 total gambar sampai selesai diamati | 1500 | 2 | Sesuai viewport: tercapai |
| S0 byte gambar / gambar terakhir selesai | 1.652.982 / 70,69 s | 2.208 / 0,504 s | Beban pemuatan berkurang |
| S1 INP / long task terlama (ms) | 2544 / 2104 | 16 / 64 | Median ≤200 / ≤100; catatan outlier |
| S2 INP / long task (ms) | 368 / 246 | 40 / tidak teramati | Tercapai |
| S3 pesanan dari tiga klik | 3 | 1 | Tepat satu: tercapai |
| S3 INP / long task (ms) | 424 / 209 | 368 / tidak teramati | INP **belum** ≤200 |
| S4 INP / long task (ms) | 3696 / 3487 | 16 / tidak teramati | Tercapai; progres/input aktif |
| S5 long task (ms) | 218 | tidak teramati | Median tercapai; maksimum ulangan 51 |
| S5 frame >50 ms / 10 s | 52 | 3 | **Belum** ≤2 |
| S6 frame >50 ms / 10 s | 123 | 0 | Tercapai |
| S6 busy main thread | 64,89% | 13,46% | Turun; **belum mendekati nol** |

“Tidak teramati” berarti tidak ada long task ≥50 ms yang dicatat, bukan CPU nol. S1 ulangan ketiga memiliki RunTask IPC `Receive mojo message` **116,731 ms** pada trace, tidak tercatat oleh observer long task; belum cukup bukti mengatribusikannya ke aplikasi. Karena itu klaim ketat *semua task ≤100 ms* belum terbukti. Baseline S0 terlambat memulai gambar: angka 0 dalam 10 detik **bukan keberhasilan lazy loading**; total 1500 dan waterfall menunjukkan banjir request setelah startup. Waktu selesai gambar bukan waktu gambar terlihat/paint.

[Video demo](../demo/demo.mp4): **124,76 detik**, 1280 × 1024, 25 fps, CPU 4×. S1/S4 baseline dipercepat 5,00×/5,86× dengan label; adegan lain kecepatan asli. [Naskah](../demo/SCRIPT.md), [chapter](../demo/chapters.json), [verifikasi decode](../demo/verification.json). Durasi screencast bukan median benchmark.

## 4. Temuan berdasarkan dampak terukur

### T-01 — Voucher memblokir input (TK-1057)

`terapkanVoucher` melanjutkan promise yang langsung selesai sebagai **microtask**, bukan task baru; browser belum mendapat kesempatan paint. `hitungHargaPromo` juga membuang 40 hasil `simulasiCicilan` per produk. Trace menunjukkan simulasi dan render ulang. [S4 sebelum](../screenshots/before-S4-1-flame.png) memperlihatkan blok panjang; [sesudah](../screenshots/after-S4-1-flame.png) menunjukkan task lebih pendek. INP **3696 →16 ms**, long task **3487 → tidak teramati**.

Perbaikan mempertahankan simulasi final dan seluruh aturan, memakai anggaran 4 ms/maksimum 100 produk lalu task `setTimeout(16)`, memperbarui progres, dan menerapkan peta harga secara atomik. [Oracle](data/voucher-correctness.json): **3028** perbandingan harga/cicilan cocok, 16 nilai progres (0–100) mendapat frame, enam input saat hitung aktif pada uji khusus. *Time behaviour/resource utilization* membaik karena kerja sia-sia hilang; *operability/self-descriptiveness* membaik karena input dan progres benar-benar dapat digambar. Trade-off: jeda menambah waktu total; Worker lebih kompleks tetapi dapat memindahkan CPU dari main thread.

### T-02 — Setiap input membangun seluruh katalog (TK-1041)

`pencarian.js → renderProduk → samakanTinggiJudul` membuat ribuan node, bergantian menulis tinggi dan membaca `offsetHeight`; layout kotor harus dihitung sinkron. Pemindaian gulir menambah pembacaan geometri. [S1 sebelum](../screenshots/before-S1-1-flame.png) dan [sesudah](../screenshots/after-S1-1-flame.png): INP **2544 →16 ms**, long task median **2104 →64 ms**.

Debounce 150 ms dan cache normalisasi mengurangi pengulangan; `katalog.js` memasang kartu hanya pada jendela viewport dengan overscan, sementara seluruh data/filter/jumlah tetap lengkap. Ukuran baris CSS menggantikan pengukuran judul. *Time behaviour/capacity* membaik karena DOM dibatasi; *operability/inclusivity* membaik karena mengetik tidak menunggu seluruh katalog. Trade-off: hasil tertunda 150 ms, ruang kartu tetap dapat kosong; fokus kartu dipertahankan, namun pembaca layar perlu uji manusia lebih lanjut.

### T-03 — Checkout tidak menjaga request yang sedang berjalan (TK-1052)

Setiap klik asli mengirim POST baru. Guard per produk dipasang **sebelum** pekerjaan lain, dengan `disabled`, `aria-busy`, status Memproses, dan pemulihan bila request gagal. [Log server sebelum/sesudah](../screenshots/02-server-orders-before-after.png) memperlihatkan **3 →1** pesanan per ulangan; [S3 sesudah](../screenshots/after-S3-1-flame.png) menunjukkan interaksi dan task. Log sesudah memilih tiga ulangan final dari stdout lengkap, bukan hasil yang direka.

*Resource utilization* membaik karena request duplikat hilang; *user error protection/self-descriptiveness* mencegah pembelian tak sengaja dan menjelaskan status. INP tetap **368 ms**: trace mencatat pointerdown lanjutan pada tombol disabled dengan processing mendekati nol, tetapi menunggu presentasi berikutnya; respons pertama sekitar 16 ms. Ini observasi, bukan bukti bug Chrome. Trade-off: guard klien tidak melindungi lintas tab/refresh; idempotency backend tetap diperlukan.

### T-04 — Umpan balik keranjang menunggu serialisasi (TK-1044)

`bacaRiwayat/simpanRiwayat` memproses 9000 entri dan mengirim seluruh riwayat ke SDK sebelum frame respons. [S2 sebelum](../screenshots/before-S2-1-flame.png) dibanding [sesudah](../screenshots/after-S2-1-flame.png): INP **368 →40 ms**, long task **246 → tidak teramati**.

Riwayat dasar tetap utuh; aktivitas baru menjadi record jurnal kecil, disimpan setelah paint dengan flush `pagehide`. Payload event ringkas tetap bermakna. *Time behaviour/resource utilization* membaik karena serialisasi berkurang; *self-descriptiveness/user error protection* membaik karena respons cepat mengurangi dorongan mengulang klik. Trade-off: ada jendela persistensi tertunda; kegagalan kuota dipertahankan dalam antrean dan diberi pesan. Konteks SDK lebih sedikit.

### T-05 — Scroll memaksa layout seluruh kartu (TK-1063)

`periksaGulir` membaca `getBoundingClientRect` dan menulis style/class dalam loop seluruh kartu; listener wheel/touch yang memblokir membuat compositor menunggu JS. [S5 sebelum](../screenshots/before-S5-1-flame.png) dan [sesudah](../screenshots/after-S5-1-flame.png) menunjukkan **52 →3** interval frame >50 ms/10 s; busy **67,73 →33,32%**.

IntersectionObserver menangani reveal, impresi unik, dan pemuatan gambar; scroll pasif/rAF hanya memperbarui header/progres transform. Virtualisasi menjaga daftar panjang tetap terjangkau. *Time behaviour/capacity* membaik; *operability/user engagement/inclusivity* membaik karena scroll lebih lancar pada CPU terbatas. Trade-off: observer asinkron dan SDK impresi masih menghabiskan CPU; target dua frame belum tercapai.

### T-06 — Idle tetap menjalankan layout/paint (TK-1070)

Dua interval 10 ms menulis lebar/posisi dan membaca ukuran; badge menganimasikan `top/box-shadow`. [S6 sebelum](../screenshots/before-S6-1-flame.png) dan [sesudah](../screenshots/after-S6-1-flame.png): busy **64,89 →13,46%**, frame lambat **123 →0**. Median Layout/Paint final sekitar **11,6/11,2 ms** pada jendela idle.

Countdown menjadi 1 Hz (jam/menit/detik dipertahankan), marquee/badge memakai transform/opacity, dijeda saat tersembunyi/tidak terlihat, dengan reduced-motion. Dekorasi blur disederhanakan. *Resource utilization/capacity* menyediakan ruang untuk input; *inclusivity/user engagement* mengurangi beban pengalaman perangkat terbatas. Baterai/suhu tidak diukur. Trade-off: centisecond disembunyikan; timer, browser, profiling dan sampler bawaan masih aktif, jadi belum idle nol.

### T-07 — Ruang banner dan media belum dicadangkan (TK-1078)

Banner async di-prepend, gambar tanpa dimensi, dan reveal `margin-top` mengubah geometri setelah konten tampil. Slot banner, dimensi 480 ×480/aspect ratio, baris tetap, dan transform reveal menstabilkan layout. [S0 sebelum](../screenshots/before-S0-1-flame.png) dan [sesudah](../screenshots/after-S0-1-flame.png) memuat Layout Shifts: **CLS 0,474 →0**.

*Time behaviour/resource utilization* membaik lewat layout ulang yang berkurang; *user error protection/operability* menjaga target klik tidak berpindah. Trade-off: slot tetap memakan ruang jika promo gagal, sehingga menampilkan fallback; ukuran diuji 320/412/560/1280 px. Data tidak dapat menyimpulkan niat pembuat iklan.

### T-08 — Gambar di luar layar berebut pemuatan (TK-1081)

Pembuatan `img src` untuk semua produk langsung mengantrekan 1500 gambar. Observer kini memasang sumber pada jarak pra-muat 240 px, dengan decoding async/dimensi eksplisit. [Waterfall CDP sebelum/sesudah](../screenshots/01-network-before-after.png) menunjukkan request asli (sumbu waktu berbeda diberi label). Total awal **1500 →2**, median gambar terakhir selesai **70,69 →0,504 s**.

*Resource utilization/time behaviour* membaik karena bandwidth dan antrean berkurang; *inclusivity/operability* membantu pengguna berkuota kecil. Seluruh gambar tetap dapat dimuat saat menggulir. Trade-off: gulir sangat cepat dapat mendahului gambar; placeholder mempertahankan ukuran. Ini mengukur request selesai, bukan LCP atau waktu paint gambar.

## 5. Dugaan yang ternyata keliru

[Benchmark diagnosis terisolasi](data/diagnosis.json) dan [trace diagnosis](trace/diagnosis.json.gz) memakai CPU 4×; bukan pengganti baseline interaksi.

| Dugaan / sumber | Fakta pengukuran dan keputusan |
|---|---|
| O(n²) kategori penyebab utama — Rudi #1 | Hanya 8 kategori/12 merek; `pasangKaki` 38,7/1,0/1,4 ms, median 1,4. Bukan sumber blok detik pada tiap input. |
| API perlu server tambahan — Rudi #2 | API produk median S0 192,6 ms; gambar terakhir 70,69 s dan task interaksi beberapa detik. Tambah server tidak menghilangkan kerja sinkron UI. |
| Ganti bubble sort — Rudi #3 | 12 merek; median rerata 1000 panggilan **0,0019 ms/panggilan**. Dampak praktis kecil dibanding render. |
| Async voucher aman — Rudi #4 | Salah: microtask belum memberi paint; long task S4 3487 ms. Audit microtask masih menghasilkan 686 ms dan nol frame progres. |
| SDK berat dan tak bisa diperbaiki — Rudi #5 | Sebagian benar: vendor tetap utuh, payload/waktu panggilan boleh diubah. Benchmark SDK median payload besar **75 ms**, kecil **12,3 ms**. |
| Tombol keranjang rusak — TK-1044 | Klik bekerja, umpan balik tertunda 368 ms; setelah perbaikan 40 ms. |
| Semua gambar lambat karena server — TK-1081 | Request gambar pertama sekitar **106,3 ms** median; antrean 1500 request dan pekerjaan UI lebih menjelaskan ekor 70,69 s. |
| Loncat sengaja untuk iklan — TK-1078 | Trace membuktikan pergeseran layout, bukan niat. Reservasi ruang menghilangkan CLS pada seri ini. |

## 6. Yang belum beres dan rekomendasi

Target tersisa adalah S3 INP, S5 frame, busy idle, dan outlier IPC S1 sebagaimana tabel. Pisahkan overhead browser/profiling dari aplikasi pada eksperimen lanjutan; jangan menghapus sampel yang buruk. SDK tetap mempunyai biaya sinkron; batching vendor dapat membantu. Backend sebaiknya menambah pagination/filter, idempotency key, dan gambar responsif. Itu rekomendasi, **tidak diimplementasikan** karena server/vendor dilindungi.

[Uji fungsi 3000 produk](data/features-all.json) lulus tanpa page error: pencarian/filter/sort tepat, baris awal/tengah/akhir terjangkau, responsif, keranjang persisten/batas 99, history 9000 + jurnal, checkout gagal/retry, promo/countdown/marquee, dan ketujuh event analitik. Oracle voucher mencakup kedua kode dan batas aturan. Risiko tersisa: pembaca layar, storage quota lintas tab, Android fisik, jaringan lambat, dan masa pemakaian lama belum diuji menyeluruh. Tidak mengklaim penghematan baterai aktual.

## 7. Pernyataan penggunaan AI dan pembagian kerja

**OpenAI Codex** membaca kode, membuat hipotesis, menulis perbaikan dan skrip, menjalankan Chrome/CDP, merekam demo, serta menyusun laporan ini. Angka berasal dari eksekusi nyata oleh agen, **bukan klaim pengukuran manual tim**. [Audit AI](AUDIT-AI.md) menguji dua alternatif yang tidak memadai terhadap kontrol, dengan trace dan source kandidat. Probe rAF tambahan pada pengukuran antara teridentifikasi menimbulkan overhead 106 ms; dibuang sebelum seri final, data lama tetap disimpan.

Prediksi dibekukan dalam commit `820616b`, sebelum perbaikan pertama `b18d174`; [PREDIKSI.md](PREDIKSI.md) memisahkan hasil setelahnya. `server.js`, vendor, dan alat ukur tetap tidak berubah. Aplikasi tidak memakai framework/dependensi baru; Playwright/FFmpeg hanya tooling lokal yang diabaikan Git.

Nama yang tersedia adalah JULIAN DIO SAPUTRA; pembagian kerja tim belum dapat diisi tanpa fakta dari anggota. Pemilik tugas perlu melengkapi identitas/kontribusi aktual dan meninjau seluruh bukti. Sesi individu **20 menit diagnosis tanpa AI/internet, lalu 5–10 menit penjelasan** harus dilakukan mahasiswa di kelas; agen tidak dapat menggantikannya. [Indeks seluruh screenshot](../screenshots/INDEX.md) dan [checklist akhir](COMPLETION.md) memetakan luaran.
