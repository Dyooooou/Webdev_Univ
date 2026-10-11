# Log prediksi

Tanggal: 12 Oktober 2026 (WIB). Baseline commit `48f838f`, kode asli `9da21d1`. Angka median 3 ulangan, 1500 produk, Chrome 154, 412 x 915, CPU 4x. Hash entri ini dapat ditemukan dengan `git log -- laporan/PREDIKSI.md`; menuliskan hash ke commit itu sendiri akan mengubah hash. Bagian sebelum perbaikan dibekukan; jangan ditulis ulang setelah hasil diketahui.

## P-01: Pencarian / DOM

**Tiket:** TK-1041

### Sebelum perbaikan

- **Trace baseline:** S1 INP 2544 ms; long task 2104 ms. Ulangan 1: sampel samakanTinggiJudul 3956 ms; Layout inklusif 4821 ms.
- **Dugaan mekanisme:** Setiap input membuat 1500 kartu; penulisan tinggi diselingi offsetHeight memaksa layout dan menunda rendering opportunity.
- **Rencana perubahan:** Virtualisasi dengan ruang gulir seluruh hasil, debounce 150 ms, cache teks dan formatter, tinggi judul CSS.
- **Prediksi terukur:** INP <=200 ms, long task <=100 ms; hanya puluhan node kartu.
- **Prediksi efek samping:** Jeda hasil 150 ms; kerumitan fokus, resize, dan screen reader pada virtualisasi.
- **Alternatif:** Debounce saja tidak mengurangi biaya satu render; content-visibility masih membuat semua node.

## P-02: Gulir

**Tiket:** TK-1063

### Sebelum perbaikan

- **Trace baseline:** S5 median 52 interval rAF >50 ms/10 detik; long task 218 ms. periksaGulir dan getBoundingClientRect tampak di samples.
- **Dugaan mekanisme:** Pemindaian semua kartu dan baca/tulis layout di wheel/touch/scroll menghambat compositor.
- **Rencana perubahan:** IntersectionObserver untuk efek dan impresi; satu rAF untuk bar transform dan jendela kartu; listener pasif, CSS overscroll-behavior.
- **Prediksi terukur:** <=2 frame lambat/10 detik setelah animasi idle juga diperbaiki; task <=100 ms.
- **Prediksi efek samping:** Observer asinkron sedikit menunda impresi; node baru harus didaftarkan ulang.
- **Alternatif:** Throttle pemindaian seluruh DOM tetap O(n) setiap kali.

## P-03: Gambar

**Tiket:** TK-1081

### Sebelum perbaikan

- **Trace baseline:** S0 meminta 1500 gambar, ~1,65 MB; gambar terakhir median 70,69 detik dari navigasi. API produk 192,63 ms.
- **Dugaan mekanisme:** Src eager ribuan gambar memenuhi antrean jaringan, decode, dan render.
- **Rencana perubahan:** Src melalui observer dekat viewport; decoding async; dimensi 480 x 480; jendela DOM.
- **Prediksi terukur:** <=12 gambar awal, gambar terlihat selesai <3 detik.
- **Prediksi efek samping:** Placeholder dapat terlihat saat scroll sangat cepat.
- **Alternatif:** Lazy native saja memiliki margin preload yang ditentukan browser dan masih membuat ribuan node.

## P-04: Keranjang / riwayat

**Tiket:** TK-1044

### Sebelum perbaikan

- **Trace baseline:** S2 INP 368 ms; long task 246 ms. SDK signature tampak pada samples. Eksperimen payload terisolasi: 75 ms lengkap vs 12,3 ms ringkas.
- **Dugaan mekanisme:** Parse/stringify 9000 entri dan SDK sinkron dilakukan sebelum umpan balik tergambar.
- **Rencana perubahan:** Umpan balik segera; payload ringkas dalam task sesudah render; jurnal aktivitas tambahan mempertahankan riwayat lama tanpa menulis ulang tiap klik; flush pagehide.
- **Prediksi terukur:** INP <=200 ms, task <=100 ms; satu klik menambah satu item dan aktivitas.
- **Prediksi efek samping:** Persistensi tertunda memiliki jendela kehilangan data; simpan data memori jika storage gagal.
- **Alternatif:** Menghapus riwayat mengubah fitur; queueMicrotask tidak memberi kesempatan paint.

## P-05: Proteksi pembelian

**Tiket:** TK-1052

### Sebelum perbaikan

- **Trace baseline:** S3 menghasilkan 3 pesanan pada setiap ulangan; INP median 424 ms. Log server asli tersimpan.
- **Dugaan mekanisme:** Tanpa guard, setiap klik memicu POST baru selama respons sebelumnya belum tiba.
- **Rencana perubahan:** Guard per produk sebelum pekerjaan lain; disabled, aria-busy, Memproses; penanganan gagal dan sukses; guard melewati umpan balik sukses singkat.
- **Prediksi terukur:** Tepat 1 pesanan dan INP <=200 ms; retry setelah gagal dapat dilakukan.
- **Prediksi efek samping:** Guard klien tidak melindungi lintas tab atau kehilangan respons sesudah server menerima pesanan.
- **Alternatif:** Debounce tidak mengikuti masa hidup request; idempotency server ideal tetapi server dilindungi.

## P-06: Voucher

**Tiket:** TK-1057

### Sebelum perbaikan

- **Trace baseline:** S4 INP 3696 ms; long task 3487 ms. Simulasi dan render ulang/tinggi judul sama-sama muncul di trace.
- **Dugaan mekanisme:** Await promise langsung selesai tetap menguras microtask sebelum render; 40 simulasi per produk membuang hasil.
- **Rencana perubahan:** Hapus hanya simulasi sia-sia, simpan simulasi final/semua aturan; chunk beranggaran waktu dan task terpisah; progres per chunk; guard operasi; update kartu terpasang.
- **Prediksi terukur:** INP <=200 ms, task <=100 ms; >=2 progres perantara mendapat frame; hasil sama untuk semua produk dan kedua voucher.
- **Prediksi efek samping:** Jeda menambah waktu total; harga baru diterapkan setelah semua perhitungan selesai.
- **Alternatif:** Worker menambah komunikasi; async/Promise.resolve saja tidak cukup.

## P-07: Aktivitas idle

**Tiket:** TK-1070

### Sebelum perbaikan

- **Trace baseline:** S6 median 123 interval rAF >50 ms/10 detik; durasi RunTask sekitar 64,9% jendela. Layout/Paint dan timer promo terus aktif.
- **Dugaan mekanisme:** Dua interval 10 ms dan animasi top/box-shadow memicu kerja main thread berulang.
- **Rencana perubahan:** Timer 1 Hz, transform/opacity untuk garis/marquee/badge, pause tab/elemen tersembunyi, reduced-motion, sederhanakan blur kaki.
- **Prediksi terukur:** <=2 frame lambat/10 detik, RunTask <10% termasuk alat ukur.
- **Prediksi efek samping:** Centisecond disembunyikan; jam/menit/detik dan marquee dipertahankan.
- **Alternatif:** Timer 60 Hz tetap lebih sering daripada kebutuhan informasi.

## P-08: Stabilitas layout

**Tiket:** TK-1078

### Sebelum perbaikan

- **Trace baseline:** S0 CLS dari LayoutShift asli median 0,474. Banner terlambat, gambar tanpa dimensi, transisi margin.
- **Dugaan mekanisme:** Perubahan geometri memindahkan target klik setelah halaman mulai terlihat.
- **Rencana perubahan:** Slot banner tetap sebelum fetch, dimensi media, efek transform/opacity, ukuran baris virtual tetap.
- **Prediksi terukur:** CLS <=0,1, diusahakan 0.
- **Prediksi efek samping:** Ruang promo tetap ada jika layanan gagal; tampilkan status bermakna.
- **Alternatif:** Overlay promo menutupi produk dan mengganggu interaksi.

## Sesudah perbaikan

Belum diukur pada saat commit prediksi. Hash perbaikan, hasil median, ketepatan prediksi, dan efek samping akan ditambahkan di sini setelah verifikasi.
