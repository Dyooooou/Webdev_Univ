# Laporan audit performa dan interaksi TokoKilat

Penyusun: **JULIAN DIO SAPUTRA**

Tanggal audit: **12 Oktober 2026**

## 1. Ringkasan eksekutif (maks. 150 kata)

Halaman flash sale TokoKilat mengalami keterlambatan input, voucher membeku, scroll tersendat, pesanan ganda, dan pergeseran layout yang berisiko menyebabkan salah klik. Audit delapan tiket menemukan render seluruh katalog, layout sinkron berulang, microtask voucher panjang, serialisasi riwayat besar, serta animasi berfrekuensi tinggi sebagai penyebab. Perbaikan menerapkan virtualisasi, debounce, task perhitungan bertahap, payload analitik ringkas, guard checkout, pemuatan gambar sesuai viewport, dan reservasi ruang banner. Pada 1500 produk, median INP pencarian turun 2544 menjadi 16 ms, keranjang 368 menjadi 40 ms, dan voucher 3696 menjadi 16 ms. Pesanan dari tiga klik turun 3 menjadi 1; CLS 0,474 menjadi 0; gambar awal 1500 menjadi 2; busy idle 64,89% menjadi 13,46%. Uji fungsi 3000 produk dan 3028 perbandingan harga/cicilan lulus. Target yang belum sepenuhnya tercapai ialah INP checkout 368 ms, tiga frame lambat saat scroll, idle mendekati nol, dan batas seluruh task 100 ms.

## 2. Lingkungan pengukuran

| Komponen | Konfigurasi aktual |
|---|---|
| Perangkat | Laptop, Intel Core Ultra 7 255HX, 20 logical CPU; merek/model laptop tidak dicatat |
| RAM / OS | 33.752.997.888 byte (31,4 GiB); Windows 11 Home Single Language |
| Browser / runtime | Google Chrome 154.0.8037.98; Node.js 25.9.0 |
| Alamat aplikasi | `http://localhost:3000/?ukur=1`, server lokal asli |
| Dataset pembanding | 1500 produk, setara `start:ringan`; uji fungsi terpisah memakai 3000 produk |
| Tampilan / CPU / jaringan | Viewport 412 × 915, device scale factor 1, CPU slowdown 4× melalui CDP, tanpa network throttling |
| Profil browser | Context sementara terisolasi, tanpa ekstensi, Chrome headless |
| Versi kode | Baseline `9da21d1`; implementasi final `dcc5f7a`; bukti pengujian akhir `e29036f` |
| Awal seri (WIB) | Baseline 11 Oktober 2026 22:48:59; sesudah 12 Oktober 2026 06:25:37 |

Sumber konfigurasi: [metadata sebelum](data/before/environment.json) dan [sesudah](data/after/environment.json). Kedua seri memakai mesin, browser, jumlah produk, dan throttling yang sama. Percobaan 3000 produk terlalu berat untuk pengukuran praktis, sehingga perbandingan memakai mode ringan sesuai izin TUGAS §7. Perintah server pada PowerShell: `$env:JUMLAH_PRODUK='1500'`, kemudian `node server.js`. Pengaturan ini diperlukan karena sintaks environment pada skrip npm mode ringan ditujukan untuk shell POSIX.

**Prosedur:** setiap ulangan membuka context baru, memuat aplikasi sekali untuk seed localStorage, menunggu kartu/alat ukur aktif dan jaringan tenang, kemudian reload sekali. S0 merekam pemuatan dan diam 10 detik; S1 mengetik `sepatu` per huruf lalu menghapus; S2 menambah satu produk sekali; S3 menghapus pesanan uji, mengeklik Beli tiga kali cepat, lalu memeriksa API/lencana/log server; S4 memakai KILAT1212 sambil mengetik; S5 menggulir terus 10 detik; S6 diam 10 detik. Reset alat ukur dilakukan sebelum interaksi. Pencarian dikosongkan sesudah S4 dan scroll dikembalikan ke atas sesudah S5. Setiap skenario diulang tiga kali secara berurutan; median adalah nilai tengah setelah tiga hasil diurutkan. [Skrip dan langkah reproduksi](../scripts/README.md) tersedia untuk mengulang prosedur.

**Sumber metrik:** INP adalah estimasi interaksi terburuk dari alat bawaan berbasis Event Timing, bukan INP lapangan persentil ke-75. Long task berasal dari observer bawaan (ambang 50 ms), diperiksa silang dengan trace. CLS S0 memakai event LayoutShift asli karena alat baseline terlambat aktif. Frame lambat memakai jarak antar callback rAF >50 ms dalam 10 detik pertama trace S5/S6; busy memakai proporsi durasi RunTask pada jendela yang sama, termasuk browser/alat ukur. Angka frame panel mentah bisa mencakup waktu ekspor sehingga tidak dipakai sebagai hasil final. Gambar dihitung dari request CDP, byte dari transfer yang tercatat, dan waktu selesai relatif terhadap navigasi.

**Penyimpangan dan batas:** context terisolasi/headless menggantikan jendela Incognito dan UI DevTools manual. Status Chrome sebagai versi stabil terbaru, sambungan listrik, serta penutupan aplikasi lain tidak diverifikasi. Pengujian tidak memakai Android fisik atau jaringan seluler. Trace `.json.gz` merupakan ekspor CDP asli terkompresi lossless; screenshot flame chart adalah visualisasi event tersebut, bukan tangkapan UI DevTools. Rekaman S0 baseline mencakup penyelesaian request yang tertunda melewati jendela awal; hasil 10 detik dan total pemuatan dibedakan pada tabel.

## 3. Hasil sebelum dan sesudah

Sumber angka: [rekap tiga ulangan sebelum](data/before/summary.json) dan [sesudah](data/after/summary.json). Tabel mengikuti kolom templat tugas. Angka numerik adalah **median tiga ulangan**; progres/input merupakan hasil observasi yang dijelaskan pada catatan.

| Skenario | Metrik | Sebelum (median) | Sesudah (median) | Target | Tercapai? |
|---|---|---:|---:|---|---|
| S0 | CLS | 0,474 | 0 | ≤0,1 | Ya |
| S0 | Request gambar dalam 10 detik dari navigasi | 0 | 2 | Sesuai kartu terlihat | Ya sesudah; catatan A |
| S0 | Total request gambar awal sampai selesai diamati | 1500 | 2 | Bukan seluruh katalog | Ya |
| S0 | Transfer gambar | 1.652.982 byte | 2.208 byte | Berkurang; tanpa ambang tugas | Turun 99,87% |
| S0 | Gambar terakhir selesai | 70,69 s | 0,504 s | Tanpa ambang tugas | Lebih cepat |
| S1 | INP | 2544 ms | 16 ms | ≤200 ms | Ya |
| S1 | Long task terlama | 2104 ms | 64 ms | ≤100 ms seluruh task | Median ya; catatan B |
| S2 | INP | 368 ms | 40 ms | ≤200 ms | Ya |
| S2 | Long task terlama | 246 ms | Tidak teramati | ≤100 ms | Ya |
| S3 | Pesanan dari tiga klik cepat | 3 | 1 | Tepat 1, status proses jelas | Ya, semua ulangan |
| S3 | INP | 424 ms | 368 ms | ≤200 ms | Belum |
| S3 | Long task terlama | 209 ms | Tidak teramati | ≤100 ms | Ya |
| S4 | INP | 3696 ms | 16 ms | ≤200 ms | Ya |
| S4 | Long task terlama | 3487 ms | Tidak teramati | ≤100 ms | Ya |
| S4 | Progres dan input saat hitung | Blok panjang; hitungan frame tidak direkam | 16 nilai progres; 3 input aktif per ulangan | Progres bertahap, input responsif | Ya sesudah; catatan C |
| S5 | Long task terlama | 218 ms | Tidak teramati | ≤100 ms | Ya; maksimum ulangan 51 ms |
| S5 | Frame >50 ms per 10 detik | 52 | 3 | ≤2 | Belum |
| S6 | Frame >50 ms per 10 detik | 123 | 0 | ≤2 | Median ya; catatan D |
| S6 | Busy main thread saat idle | 64,89% | 13,46% | Mendekati nol | Belum |

**A — Pemuatan gambar.** Baseline belum memulai request gambar dalam 10 detik pertama karena startup tertunda; angka 0 bukan keberhasilan lazy loading. Setelahnya seluruh 1500 gambar diminta. Sesudah perbaikan, dua gambar dimuat sesuai area awal. [Waterfall request asli](../screenshots/01-network-before-after.png) memperlihatkan perbedaan antrean; sumbu waktu sebelum/sesudah diberi label. Waktu request selesai tidak sama dengan waktu gambar terlihat/paint.

**B — Long task dan variasi INP.** “Tidak teramati” berarti tidak ada long task ≥50 ms yang dicatat, bukan CPU nol. INP S1 sebelum adalah 2544/2472/3128 ms dan sesudah 24/16/16 ms; INP S3 sesudah 368/368/376 ms. Long task panel S1 sesudah 64/69/0 ms, tetapi trace ulangan ketiga memuat task IPC `Receive mojo message` **116,731 ms** yang tidak tercatat observer. Atribusinya ke aplikasi belum terbukti; klaim seluruh task ≤100 ms belum dapat diberikan. [Flame chart S1 sebelum](../screenshots/before-S1-1-flame.png) dan [sesudah](../screenshots/after-S1-1-flame.png) menunjukkan perbedaan beban. [Log server S3](../screenshots/02-server-orders-before-after.png) membuktikan tiga pesanan menjadi satu per ulangan.

**C — Progres voucher.** Data final [ulangan 1](data/after/S4-1.json), [2](data/after/S4-2.json), dan [3](data/after/S4-3.json) masing-masing mencatat 16 nilai progres 0–100%, termasuk 14 nilai perantara, serta tiga input selama hitung masih aktif; jumlah sampel frame 52/52/53. Baseline S4 mempunyai long task median 3487 ms, tetapi tidak memasang probe jumlah frame progres sehingga angka nol tidak diasumsikan. [Trace voucher sebelum](../screenshots/before-S4-1-flame.png) dan [sesudah](../screenshots/after-S4-1-flame.png) mendukung diagnosis. Uji oracle terpisah memverifikasi 3028 hasil harga/cicilan cocok.

**D — Konsistensi scroll dan idle.** Frame lambat S5 sebelum 33/52/54, sesudah 1/3/4; S6 sebelum 132/113/123, sesudah 0/0/3. Jadi median S6 lulus, tetapi satu ulangan masih melampaui dua frame. Busy idle turun **51,43 poin persentase**; hasil ini tidak membuktikan penghematan baterai karena konsumsi daya tidak diukur. [Trace idle sebelum](../screenshots/before-S6-1-flame.png) dan [sesudah](../screenshots/after-S6-1-flame.png) menunjukkan perubahan aktivitas.

Secara keseluruhan, INP pencarian turun **99,37%**, keranjang **89,13%**, dan voucher **99,57%**. Checkout memenuhi ketepatan jumlah pesanan namun belum memenuhi target INP. Bukti tersedia dalam **21 pasangan trace** dan [indeks screenshot](../screenshots/INDEX.md). [Video demo](../demo/demo.mp4) berdurasi **124,76 detik**, 1280 × 1024, 25 fps, direkam dengan CPU 4×. S1/S4 baseline dipercepat 5,00×/5,86× dengan label; adegan lain kecepatan asli. [Naskah](../demo/SCRIPT.md), [chapter](../demo/chapters.json), dan [verifikasi decode](../demo/verification.json) melengkapi video. Angka pada satu rekaman demo tidak menggantikan median benchmark.

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

**Penyusun dan penanggung jawab laporan:** JULIAN DIO SAPUTRA. Cakupan pekerjaan mencakup diagnosis delapan tiket, penyusunan hipotesis, implementasi perbaikan, pengujian sebelum dan sesudah, audit usulan AI, serta dokumentasi hasil dan video demo.

**Penggunaan AI:** OpenAI Codex digunakan sebagai alat bantu analisis kode, implementasi, otomatisasi pengujian dan perekaman demo, serta penyusunan laporan. Hasil dievaluasi melalui trace Chrome, pengujian fungsi, dan perbandingan harga/cicilan. Rincian dua usulan yang tidak memadai beserta bukti pengujiannya tersedia dalam [Audit AI](AUDIT-AI.md).

Pengukuran dilakukan menggunakan skrip Chrome/CDP dengan konfigurasi pada bagian 2. Probe rAF tambahan pada pengukuran antara teridentifikasi menimbulkan overhead sekitar 106 ms dan dihapus sebelum seri final; data pengukuran antara tetap disimpan untuk penelusuran.

Hipotesis dicatat dalam commit `820616b`, sebelum perbaikan pertama `b18d174`. Perbandingan prediksi dan hasil tersedia dalam [PREDIKSI.md](PREDIKSI.md). Berkas `server.js`, vendor, dan alat ukur tetap tidak berubah. Aplikasi menggunakan platform web tanpa framework atau dependensi runtime tambahan; Playwright dan FFmpeg digunakan untuk pengujian dan dokumentasi.

Bukti pendukung tersedia dalam [indeks screenshot](../screenshots/INDEX.md), [video demo](../demo/demo.mp4), dan [checklist penyelesaian](COMPLETION.md).
