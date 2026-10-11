// Keranjang belanja, riwayat penelusuran, dan "Beli sekarang".
// Semua disimpan di localStorage supaya tetap ada walau halaman dimuat ulang.

import { $, el, formatRupiah, hargaSetelahDiskon, tampilkanToast, setelahRender, kirimAnalitik } from './util.js';

const KUNCI_KERANJANG = 'tk_keranjang';
const KUNCI_RIWAYAT = 'tk_riwayat';

const KONFIG = { maksPerProduk: 99, mataUang: 'IDR', sumber: 'web-flashsale-1212' };
const sedangDipesan = new Set();
const aktivitasBelumTersimpan = new Map();

function simpanAktivitas() {
  for (const [kunci, nilai] of aktivitasBelumTersimpan) {
    try { localStorage.setItem(kunci, JSON.stringify(nilai)); aktivitasBelumTersimpan.delete(kunci); }
    catch { tampilkanToast('Riwayat belum tersimpan: penyimpanan perangkat penuh.'); break; }
  }
}

function catatAktivitas(jenis, produk) {
  // Immutable journal records keep the original 9000-entry history intact.
  // Unique keys also avoid overwriting another tab's new activity.
  aktivitasBelumTersimpan.set('tk_aktivitas_' + crypto.randomUUID(), {
    t: Date.now(), jenis, id: produk.id, nama: produk.nama, kategori: produk.kategori, harga: produk.harga,
  });
  setelahRender(simpanAktivitas);
}
window.addEventListener('pagehide', simpanAktivitas);

function bacaKeranjang() {
  return JSON.parse(localStorage.getItem(KUNCI_KERANJANG) || '[]');
}
function simpanKeranjang(isi) {
  localStorage.setItem(KUNCI_KERANJANG, JSON.stringify(isi));
}
function simpanRiwayat(riwayat) {
  localStorage.setItem(KUNCI_RIWAYAT, JSON.stringify(riwayat));
}

// Riwayat aktivitas dipakai tim rekomendasi ("Karena kamu melihat...").
// Untuk pengembangan, kita isi dengan data contoh pelanggan lama yang aktif
// sejak 2023 supaya kondisinya mirip pengguna sungguhan.
export function siapkanRiwayatContoh(semuaProduk) {
  if (localStorage.getItem(KUNCI_RIWAYAT)) return;
  const riwayat = [];
  const jenis = ['lihat', 'lihat', 'lihat', 'cari', 'keranjang', 'beli'];
  let waktu = Date.parse('2023-01-05T08:00:00+07:00');
  for (let i = 0; i < 9000; i++) {
    const p = semuaProduk[(i * 131) % semuaProduk.length];
    waktu += 1000 * 60 * (7 + (i % 190));
    riwayat.push({ t: waktu, jenis: jenis[i % jenis.length], id: p.id, nama: p.nama, kategori: p.kategori, harga: p.harga });
  }
  simpanRiwayat(riwayat);
}

export function perbaruiLencana() {
  const total = bacaKeranjang().reduce((n, item) => n + item.jumlah, 0);
  $('#lencana-keranjang').textContent = total;
}

function gambarPanel() {
  const daftar = $('#daftar-keranjang');
  const isi = bacaKeranjang();
  daftar.innerHTML = '';
  let total = 0;
  if (isi.length === 0) daftar.append(el('li', '', 'Keranjang masih kosong. Tambahkan produk dari daftar.'));
  for (const item of isi) {
    total += item.harga * item.jumlah;
    const baris = el('li');
    baris.append(el('span', '', item.nama), el('span', 'jumlah', item.jumlah + ' x ' + formatRupiah(item.harga)));
    const hapus = el('button', 'hapus', 'Hapus dari keranjang');
    hapus.type = 'button';
    hapus.addEventListener('click', () => {
      simpanKeranjang(bacaKeranjang().filter((x) => x.id !== item.id));
      perbaruiLencana();
      gambarPanel();
    });
    baris.append(hapus);
    daftar.append(baris);
  }
  $('#total-keranjang').textContent = formatRupiah(total);
}

export function tambahKeKeranjang(produk, tombol) {
  const keranjang = bacaKeranjang();

  const ada = keranjang.find((item) => item.id === produk.id);
  if (ada) ada.jumlah = Math.min(ada.jumlah + 1, KONFIG.maksPerProduk);
  else keranjang.push({ id: produk.id, nama: produk.nama, harga: hargaSetelahDiskon(produk), jumlah: 1 });

  simpanKeranjang(keranjang);
  perbaruiLencana();
  tombol.textContent = 'Ditambahkan ✓';
  tombol.classList.add('sudah');
  setTimeout(() => {
    tombol.textContent = '+ Keranjang';
    tombol.classList.remove('sudah');
  }, 1500);
  tampilkanToast('Ditambahkan ke keranjang: ' + produk.nama);
  catatAktivitas('keranjang', produk);
  kirimAnalitik('add_to_cart', { produkId: produk.id, jumlah: ada?.jumlah || 1, harga: hargaSetelahDiskon(produk), sumber: KONFIG.sumber });
}

export async function beliSekarang(produk, tombol) {
  if (sedangDipesan.has(produk.id)) return;
  sedangDipesan.add(produk.id);
  tombol.disabled = true;
  tombol.setAttribute('aria-busy', 'true');
  tombol.textContent = 'Memproses…';
  tampilkanToast('Pesanan sedang diproses.');
  kirimAnalitik('begin_checkout', { produkId: produk.id, sumber: KONFIG.sumber });
  let berhasil = false;
  try {
    const respons = await fetch('/api/pesanan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ produkId: produk.id, nama: produk.nama }),
  });
    if (!respons.ok) throw new Error('HTTP ' + respons.status);
    const pesanan = await respons.json();
    berhasil = true;
    catatAktivitas('beli', produk);
    tombol.textContent = 'Dipesan ✓';
    tampilkanToast('Pesanan ' + pesanan.id + ' dibuat: ' + produk.nama);
    await perbaruiLencanaPesanan();
  } catch {
    tampilkanToast(berhasil ? 'Pesanan dibuat; lencana belum diperbarui.' : 'Pesanan belum dapat dipastikan. Periksa Pesanan sebelum mencoba lagi.');
    tombol.textContent = berhasil ? 'Dipesan ✓' : 'Coba lagi';
  } finally {
    tombol.removeAttribute('aria-busy');
    const lepas = () => { sedangDipesan.delete(produk.id); tombol.disabled = false; tombol.textContent = 'Beli sekarang'; };
    if (berhasil) setTimeout(lepas, 1500); else lepas();
  }
}

export async function perbaruiLencanaPesanan() {
  const respons = await fetch('/api/pesanan');
  const pesanan = await respons.json();
  $('#lencana-pesanan').textContent = pesanan.length;
  return pesanan;
}

export function pasangKeranjang() {
  const panel = $('#panel-keranjang');
  const tombolBuka = $('#tombol-keranjang');
  const buka = (ya) => {
    panel.hidden = !ya;
    tombolBuka.setAttribute('aria-expanded', String(ya));
    if (ya) gambarPanel();
  };
  tombolBuka.addEventListener('click', () => buka(panel.hidden));
  $('#tutup-keranjang').addEventListener('click', () => buka(false));
  $('#kosongkan-keranjang').addEventListener('click', () => {
    simpanKeranjang([]);
    perbaruiLencana();
    gambarPanel();
  });

  $('#tombol-pesanan').addEventListener('click', async () => {
    const pesanan = await perbaruiLencanaPesanan();
    if (pesanan.length === 0) return tampilkanToast('Belum ada pesanan. Tekan "Beli sekarang" pada produk untuk memesan.');
    const terakhir = pesanan.slice(-3).map((p) => p.id + ' (produk #' + p.produkId + ')').join(', ');
    tampilkanToast(pesanan.length + ' pesanan. Terakhir: ' + terakhir);
  });

  perbaruiLencana();
  perbaruiLencanaPesanan();
}
