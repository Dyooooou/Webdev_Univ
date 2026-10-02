# Laporan audit performa dan interaksi TokoKilat

Tim: .....   Anggota: [JULIAN DIO SAPUTRA] Tanggal: 25 September 2026


## 1. Ringkasan eksekutif (maks. 150 kata)

Halaman flash sale TokoKilat nyaris tak bisa dipakai di HP kelas bawah karena main thread browser
terus-menerus sibuk: satu aksi pengguna (mengetik, menekan tombol, memakai voucher, menggulir)
memicu pekerjaan sinkron yang panjang, dan bahkan saat dibiarkan diam halaman tetap bekerja.
Masalah terbesar adalah voucher membeku.
Disini memperbaiki delapan temuan tanpa menghapus fitur. Hasilnya, INP
menurun pesanan ganda tidak lagi terjadi (3 klik menghasilkan 1 pesanan),
CLS turun, dan aktivitas main thread saat diam turun.
Target yang belum tercapai: LANCAR 

## 2. Lingkungan pengukuran

- Laptop: [ISI: CPU, RAM, OS].
- Chrome: [ISI: versi]. Jumlah produk: [ISI: `npm start` / `start:ringan` / `start:berat`].
- Protokol: sesuai TUGAS.md bagian 7 (Incognito, viewport 412 x 915, CPU 4x slowdown, 3 ulangan, median, muat ulang sekali sebelum mengukur).
- Penyimpangan dari protokol:  "tidak ada"

## 3. Hasil sebelum dan sesudah

| Skenario | Metrik | Sebelum (median) | Sesudah (median) | Target | Tercapai? |
|---|---|---|---|---|---|
| S0 | CLS | [ISI] | [ISI] | <= 0,1 | [ISI] |
| S0 | Jumlah permintaan gambar dalam 10 dtk pertama | [ISI] | [ISI] | sebanding dengan yang terlihat | [ISI] |
| S1 | INP | [ISI] | [ISI] | <= 200 ms | [ISI] |
| S1 | Long task terlama | [ISI] | [ISI] | <= 100 ms | [ISI] |
| S2 | INP | [ISI] | [ISI] | <= 200 ms | [ISI] |
| S3 | Jumlah pesanan dari 3 klik | [ISI] | [ISI] | 1 | [ISI] |
| S4 | INP / progres tergambar bertahap? | [ISI] | [ISI] | bertahap, kolom cari responsif | [ISI] |
| S5 | Frame > 50 ms per 10 dtk | [ISI] | [ISI] | <= 2 | [ISI] |
| S6 | Frame > 50 ms per 10 dtk | [ISI] | [ISI] | <= 2 | [ISI] |

## 4. Temuan

Urutan di bawah adalah perkiraan awal. **Susun ulang berdasarkan dampak terukur** setelah data ada.

### T-01: Perhitungan voucher berjalan sebagai satu task panjang
- **Tiket terkait:** TK-1057
- **Gejala bagi pengguna:** layar beku, tulisan "menghitung 0%" lalu tiba-tiba selesai, scroll dan ketik tidak bisa.
- **Bukti:** [ISI: tangkapan layar flame chart S4 dengan satu Task merah berdurasi [ISI] ms; anotasi `terapkanVoucher` → `hitungHargaPromo` → `simulasiCicilan`]
- **Akar masalah dan mekanismenya:** `harga-promo.js`, fungsi `terapkanVoucher`. `async`/`await` pada
  fungsi yang tidak menunggu apa pun hanya menyambung *microtask*. Antrean microtask dikosongkan habis
  sebelum browser mendapat *rendering opportunity*, sehingga seluruh loop atas semua produk berjalan
  dalam satu task. Bar progres diubah ribuan kali, tetapi tidak ada frame yang digambar di antaranya
  (hanya nilai akhir yang terlihat). Selain itu `hitungHargaPromo` memanggil `simulasiCicilan` 41 kali
  per produk (40 pemanggilan di loop "kestabilan pembulatan" yang hasilnya dibuang), dan tiap panggilan
  sendiri berloop sampai 24 x 24 iterasi. [VERIFIKASI: bottom-up menunjukkan `simulasiCicilan` dominan]
- **Kualitas yang terdampak (ISO/IEC 25010):** *time behaviour* (task [ISI] ms jauh melewati 50 ms),
  *resource utilization* (CPU main thread penuh). Pada interaction capability: *self-descriptiveness*
  (progres "0%" menyesatkan, pengguna mengira aplikasi crash) dan *operability* (input tidak dapat dipakai selama perhitungan).
- **Perbaikan:** memecah loop menjadi potongan dengan anggaran waktu (mis. ~8-10 ms), lalu memberi
  kesempatan render antar potongan dengan `scheduler.yield()` / `setTimeout` / `requestAnimationFrame`
  (pilih yang didukung target). Menghapus 40 pemanggilan sia-sia setelah dipastikan hasil akhir tidak
  berubah. Render ulang kartu dilakukan sekali di akhir.
- **Trade-off:** total waktu bisa sedikit lebih panjang karena jeda antar potongan, tetapi UI tetap
  responsif. Alternatif: Web Worker (tidak memblokir sama sekali, tetapi menambah kompleksitas
  komunikasi data, dan tugas ini tetap platform web murni). Alternatif lain: hitung harga hanya untuk
  kartu yang terlihat (lazy), lebih hemat tetapi mengubah semantik "diterapkan di semua produk".
- **Hasil:** longest task [ISI] → [ISI] ms; INP S4 [ISI] → [ISI] ms; progres tergambar [ISI] langkah.

### T-02: Setiap ketukan membangun ulang seluruh daftar produk
- **Tiket terkait:** TK-1041
- **Gejala bagi pengguna:** huruf muncul terlambat, HP seperti hang saat mengetik.
- **Bukti:** [ISI: flame chart S1, track Interactions (INP [ISI] ms), Task per ketukan [ISI] ms, tahap Layout/Recalculate Style dominan]
- **Akar masalah dan mekanismenya:** `pencarian.js` → handler `input` memanggil `terapkanSaringan` →
  `renderProduk` (`katalog.js`), yang mengosongkan `#kisi` dan membuat ulang seluruh kartu di DOM pada
  setiap ketukan. Lalu `samakanTinggiJudul` menulis `style.height` dan membaca `offsetHeight` bergantian
  (memaksa layout sinkron berulang-ulang, layout thrashing), dan `periksaGulir` membaca
  `getBoundingClientRect` untuk semua kartu setelah DOM berubah (satu lagi layout paksa). Event `search`
  juga dikirim ke SDK pada setiap ketukan. [VERIFIKASI: tampilkan peringatan "Forced reflow" di trace]
- **Kualitas yang terdampak:** *time behaviour* (INP), *resource utilization* (CPU, memori karena DOM
  dibuat ulang). *Operability*: umpan balik huruf yang diketik tertunda sehingga pengguna mengulang atau meninggalkan pencarian.
- **Perbaikan:** debounce input, render bertahap/ber-batch (atau hanya merender yang perlu), memisah
  fase baca dan tulis layout (baca dulu semua, baru tulis), mengganti pengukuran tinggi judul dengan CSS
  (mis. `min-height` berbasis `lh`/`line-clamp`) bila memungkinkan, dan mengirim event `search` sekali
  setelah jeda mengetik.
- **Trade-off:** debounce menambah jeda hasil (mis. 150 ms) tetapi menjaga kolom input tetap lancar.
  Virtualisasi daftar sangat efektif tetapi mengubah cara semua produk dijangkau lewat scroll
  (aturan 3 mensyaratkan tetap terjangkau dan jumlah hasil tetap benar).
- **Hasil:** INP S1 [ISI] → [ISI] ms; long task terlama [ISI] → [ISI] ms.

### T-03: Handler "+ Keranjang" dan "Beli sekarang" melakukan kerja berat sebelum memberi umpan balik
- **Tiket terkait:** TK-1044, TK-1052
- **Gejala bagi pengguna:** tombol seolah tidak bereaksi, pengguna menekan berulang sehingga keranjang jadi 3.
- **Bukti:** [ISI: flame chart S2, Task [ISI] ms dengan `JSON.parse`/`JSON.stringify`/`localStorage` dan `Lacak.kirim`]
- **Akar masalah dan mekanismenya:** `keranjang.js`. Riwayat contoh berisi 9.000 entri; setiap klik
  melakukan `bacaRiwayat` (parse JSON) dan `simpanRiwayat` (stringify + tulis `localStorage` sinkron),
  serta mengirim `riwayat` penuh ke `Lacak.kirim` (serialisasi besar). Perubahan visual (teks tombol,
  toast) baru terjadi setelahnya, jadi frame berikutnya terlambat dan pengguna tidak melihat respons
  untuk beberapa ratus ms. [VERIFIKASI: peran `Lacak.kirim` vs `localStorage` di bottom-up]
- **Kualitas yang terdampak:** *time behaviour* (INP), *self-descriptiveness* (tak ada umpan balik),
  *user error protection* (pengguna terdorong menekan berulang, jumlah keranjang salah).
- **Perbaikan:** beri umpan balik visual lebih dulu, lalu jalankan persistensi dan pelacakan setelahnya
  (mis. `requestAnimationFrame` + task terpisah atau `requestIdleCallback`). Kirim payload yang ramping
  ke SDK (id produk, jumlah, bukan seluruh riwayat), dan batasi/rapikan riwayat yang disimpan. Event
  `add_to_cart` tetap terkirim dengan informasi bermakna (aturan 1).
- **Trade-off:** menunda penyimpanan memperkecil jendela waktu data tersimpan bila tab ditutup tepat
  setelah klik (mitigasi: simpan di `pagehide`). Payload ramping mengurangi konteks yang diminta tim
  data, perlu disepakati.
- **Hasil:** INP S2 [ISI] → [ISI] ms.

### T-04: "Beli sekarang" tidak punya perlindungan klik ganda
- **Tiket terkait:** TK-1052
- **Gejala bagi pengguna:** satu pembelian menjadi tiga pesanan dan refund.
- **Bukti:** [ISI: log terminal server menampilkan 3 pesanan; lencana "Pesanan" = 3; trace S3 memperlihatkan 3 handler dan 3 `fetch`]
- **Akar masalah dan mekanismenya:** `beliSekarang` bukan idempoten dan tidak menonaktifkan tombol
  maupun memberi status "memproses". Karena handler lambat (T-03) dan balasan server datang
  belakangan, pengguna menekan lagi, dan tiap klik adalah task sendiri yang memicu `POST /api/pesanan` baru.
- **Kualitas yang terdampak:** *user error protection* (tidak ada pencegahan kesalahan yang mudah
  dihindari), *self-descriptiveness* (tak ada status "sedang diproses"). Dampak bisnis langsung (refund).
- **Perbaikan:** tandai "sedang diproses" per produk (flag in-flight), `disabled` + `aria-busy` dan teks
  "Memproses…" seketika, lepas setelah respons. Pertimbangkan kunci idempotensi bila API mendukung (server
  tidak boleh diubah, jadi guard di klien).
- **Trade-off:** guard klien tidak melindungi dari pembukaan di dua tab atau refresh; perlindungan penuh
  perlu idempotency key di backend (rekomendasi, bagian 6).
- **Hasil:** pesanan dari 3 klik [ISI] → 1.

### T-05: Handler scroll membaca dan menulis layout semua kartu
- **Tiket terkait:** TK-1063
- **Gejala bagi pengguna:** scroll patah-patah.
- **Bukti:** [ISI: track Frames S5 dengan frame > 50 ms sebanyak [ISI]; flame chart handler `scroll` dan "Forced reflow"]
- **Akar masalah dan mekanismenya:** `gulir.js`. `periksaGulir` dipanggil pada setiap `scroll`,
  `touchmove`, `wheel`; ia menghitung `scrollHeight`, memanggil `getBoundingClientRect()` untuk **semua**
  `.kartu`, dan menulis `style.minHeight`/`classList` di dalam loop yang sama (baca-tulis bergantian). Listener
  `touchmove` dan `wheel` didaftarkan dengan `passive: false` dan dapat memanggil `preventDefault`, sehingga
  browser harus menunggu JavaScript sebelum boleh menggulir di compositor.
- **Kualitas yang terdampak:** *time behaviour*, *user engagement* (pengalaman menggulir yang buruk
  menurunkan keterlibatan), *inclusivity* (perangkat murah paling terdampak).
- **Perbaikan:** ganti dengan `IntersectionObserver` untuk efek kartu muncul dan pencatatan impresi,
  jadikan listener `passive: true` (atau hapus), batasi pembaruan bar progres/header dengan
  `requestAnimationFrame`, animasikan bar lewat `transform: scaleX`.
- **Trade-off:** `IntersectionObserver` bersifat asinkron sehingga impresi tercatat sedikit lebih lambat
  dan perlu ambang yang tepat. Melepas `preventDefault` bisa mengaktifkan kembali pull-to-refresh (ganti
  dengan CSS `overscroll-behavior`).
- **Hasil:** frame > 50 ms per 10 dtk: [ISI] → [ISI].

### T-06: Halaman tetap bekerja keras saat diam
- **Tiket terkait:** TK-1070
- **Gejala bagi pengguna:** HP panas dan baterai cepat turun.
- **Bukti:** [ISI: trace S6; aktivitas main thread [ISI]% saat diam; ringkasan Layout/Paint per detik]
- **Akar masalah dan mekanismenya:** `promo.js` memakai dua `setInterval` 10 ms (100 kali/detik):
  hitung mundur menulis teks dan `style.width` serta membaca `offsetWidth` (layout paksa), dan teks
  berjalan menulis `style.left` dan membaca `offsetWidth` tiap tick. Di CSS, animasi `denyut`
  pada lencana kilat menganimasikan `top` dan `box-shadow` (Layout + Paint), tanpa henti, untuk setiap
  kartu kilat; `.kaki-hias` memakai `filter: blur` besar dan `box-shadow` tebal yang mahal untuk di-paint.
  [VERIFIKASI: track Layout/Paint tidak pernah tenang pada S6]
- **Kualitas yang terdampak:** *resource utilization* (CPU, baterai), *time behaviour* (frame terlewat),
  *capacity* (tak ada sisa kapasitas untuk interaksi).
- **Perbaikan:** hitung mundur di-update cukup 1 kali per detik untuk jam/menit/detik (atau
  `requestAnimationFrame` bila senti detik dipertahankan), garis menyusut dengan `transform: scaleX`; teks
  berjalan dengan CSS `animation` pada `transform`; animasi `denyut` memakai `transform`/`opacity`
  saja; jeda animasi saat tab tersembunyi atau elemen di luar layar; sederhanakan `.kaki-hias`.
- **Trade-off:** angka perseratus detik menjadi kurang "mulus" bila diturunkan frekuensinya;
  perlu disepakati dengan desain (aturan 4: bentuk visual boleh disesuaikan dengan alasan).
- **Hasil:** aktivitas main thread saat diam [ISI]% → [ISI]%; frame > 50 ms [ISI] → [ISI].

### T-07: Pergeseran tata letak (CLS)
- **Tiket terkait:** TK-1078
- **Gejala bagi pengguna:** halaman loncat saat akan menekan, yang kepencet iklan promo.
- **Bukti:** [ISI: track Layout Shifts pada S0, skor CLS [ISI], elemen penyebab]
- **Akar masalah dan mekanismenya:** (a) `pasangBannerPromo` menyisipkan banner dengan
  `prepend` setelah `fetch /api/promo`, mendorong seluruh konten ke bawah; (b) gambar kartu tidak punya
  `width`/`height`/`aspect-ratio` sehingga tingginya berubah saat gambar dimuat; (c) kartu
  bertransisi `margin-top` (properti layout) ketika muncul. [VERIFIKASI: elemen mana yang tercatat di Layout Shifts]
- **Kualitas yang terdampak:** *user error protection* (salah tekan karena target berpindah),
  *operability*, *user engagement* (kepercayaan menurun, tampak seperti manipulasi).
- **Perbaikan:** sediakan ruang tetap untuk banner sebelum data tiba (slot `min-height`/skeleton),
  beri `width`/`height` atau `aspect-ratio` pada gambar, ganti transisi `margin-top` dengan `transform`/`opacity`.
- **Trade-off:** ruang cadangan menyisakan area kosong bila promo tidak ada; bentuk skeleton perlu dijaga sinkron dengan ukuran banner nyata.
- **Hasil:** CLS [ISI] → [ISI].

### T-08: Seluruh gambar dimuat sekaligus
- **Tiket terkait:** TK-1081
- **Gejala bagi pengguna:** kotak abu-abu lama, kuota cepat habis.
- **Bukti:** [ISI: panel Network S0: [ISI] permintaan gambar, gambar terakhir selesai pada [ISI] detik, total [ISI] MB]
- **Akar masalah dan mekanismenya:** `katalog.js` membuat `<img src>` untuk setiap produk tanpa
  `loading="lazy"` atau `decoding="async"`, sehingga browser meminta ribuan gambar yang jauh di luar layar
  dan bersaing untuk bandwidth dengan gambar yang terlihat. Ini bukan masalah kecepatan server
  (cek waktu respons satu gambar di Network: [ISI]).
- **Kualitas yang terdampak:** *resource utilization* (bandwidth, kuota pengguna), *time behaviour*
  (gambar penting terlambat), *inclusivity* (pengguna dengan kuota/jaringan terbatas).
- **Perbaikan:** `loading="lazy"`, `decoding="async"`, dimensi gambar eksplisit; bila perlu
  `IntersectionObserver` untuk memuat sedikit sebelum masuk layar.
- **Trade-off:** pada scroll sangat cepat gambar mungkin tampil terlambat (placeholder tetap perlu);
  lazy loading menunda pemuatan sehingga perlu *margin* pra-muat yang cukup.
- **Hasil:** permintaan gambar [ISI] → [ISI]; waktu gambar pertama terlihat [ISI] → [ISI].

## 5. Dugaan yang ternyata keliru

| Dugaan | Sumber | Fakta menurut pengukuran |
|---|---|---|
| Loop O(n²) di `kategori.js` adalah biang kerok utama | Rudi #1 | [ISI: berapa ms total `pasangKaki` di trace; jumlah kategori/merek hanya [ISI], jadi dampaknya [ISI]] |
| API produk lambat, perlu server tambahan | Rudi #2 | [ISI: waktu respons `/api/produk` di Network [ISI] ms; porsi terhadap total beban halaman [ISI]] |
| Ganti bubble sort dengan quicksort | Rudi #3 | [ISI: `urutkanGelembung` hanya mengurutkan [ISI] merek, durasi [ISI] ms, tidak terlihat di bottom-up] |
| Voucher sudah `async` jadi aman | Rudi #4 | Keliru: `await` pada promise yang langsung selesai tidak memberi rendering opportunity (lihat T-01). Trace: task [ISI] ms |
| SDK analitik berat tapi tidak boleh disentuh | Rudi #5 | [ISI: sebagian benar/salah? Ukur kontribusi `Lacak.kirim` dan payload-nya. Cara dan isi pemanggilan boleh diubah] |
| Tombol "+ Keranjang" rusak | TK-1044 | Tombol berfungsi; yang terlambat adalah umpan baliknya (T-03) |
| Server lemot sehingga gambar lambat | TK-1081 | [ISI: waktu respons gambar [ISI] ms, masalahnya jumlah permintaan (T-08)] |
| Halaman loncat disengaja demi klik iklan | TK-1078 | Bukan niat; akibat ruang banner tidak dicadangkan (T-07) |

## 6. Yang belum beres dan rekomendasi

- **Backend:** tambahkan pagination/filter di API produk; idempotency key untuk `POST /api/pesanan`
  agar tidak bergantung pada guard klien; sediakan gambar dengan ukuran sesuai tampilan (`srcset`).
- **Vendor SDK:** minta dukungan pengiriman batch dan payload ringan; [ISI: dampak sisa SDK di trace].
- **Desain:** sepakati penyederhanaan efek visual (denyut kartu, senti detik, blur dekoratif) untuk perangkat kelas bawah.
- **Sisa:** [ISI: target yang belum tercapai beserta penyebabnya, risiko regresi, dan hal yang belum diuji].

## 7. Pernyataan penggunaan AI dan pembagian kerja

- **Alat AI:** [ISI: nama, mis. Claude] dipakai untuk [ISI: membaca kode dan merumuskan hipotesis awal,
  menyusun draf laporan, menulis draf kode perbaikan]. Semua hipotesis diverifikasi dengan rekaman
  panel Performance sendiri dan semua angka berasal dari pengukuran tim.
- **Audit usulan AI:** lihat `laporan/AUDIT-AI.md`.
- **Pembagian kerja:** [ISI: nama, kontribusi tiap anggota].