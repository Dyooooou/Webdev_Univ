# Usulan AI yang diuji

Tanggal: 12 Oktober 2026. AI: OpenAI Codex. Permintaan induk pengguna: menyelesaikan tugas, termasuk audit minimal dua usulan AI. Tidak ada percakapan dengan AI kedua yang direka; agen yang sama menghasilkan kandidat dan analisis otomatis. Review mahasiswa tetap diperlukan sebelum menyatakan pemahaman pribadi.

Konteks eksperimen: kode perbaikan commit `dcc5f7a`, 1500 produk, viewport 412 x 915, CPU 4x, tiga ulangan. Routing Playwright mengganti satu modul pada browser pengujian; berkas aplikasi kerja dan berkas terlarang tidak diubah. Isi modul yang benar-benar dikirim disimpan di direktori ini. Pengujian kandidat adalah alternatif terkontrol, bukan riwayat rekomendasi yang diklaim pernah diberikan pihak lain.

## A-01 / TK-1041

Pertanyaan evaluasi yang dirumuskan Codex: "Bisakah content-visibility: auto menggantikan virtualisasi sehingga implementasi pencarian lebih sederhana?"

Usulan: tetap debounce 150 ms, buat semua kartu, gunakan grid biasa dan `content-visibility: auto; contain-intrinsic-size: 508px` pada kartu. Efek dan gambar tetap melalui observer. Hipotesis yang diuji: melewati rendering konten offscreen mungkin cukup untuk menjaga task <=100 ms. Risiko: pembuatan node dan pendaftaran observer tetap O(n).

## A-02 / TK-1057

Pertanyaan evaluasi yang dirumuskan Codex: "Bisakah seluruh perhitungan asli dipertahankan dan chunk diberi await Promise.resolve agar UI tetap responsif?"

Usulan: pertahankan 40 simulasi pembulatan asli, ganti jeda task dengan `Promise.resolve()` pada tiap chunk. Hipotesis yang diuji: chunk async saja cukup untuk memperlihatkan progres. Risiko: microtask tidak menyediakan rendering opportunity. Ini sengaja kandidat terbatas untuk memeriksa klaim mekanisme, bukan klaim rekomendasi terbaik Codex.

Hasil baru diisi di `../AUDIT-AI.md` setelah pengukuran. Jalankan `node scripts/measure.cjs audit-render S1` dan `node scripts/measure.cjs audit-microtask S4`, lalu analyzer dan trace-view dengan label yang sama.
