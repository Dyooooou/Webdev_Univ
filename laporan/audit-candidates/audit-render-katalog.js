// Katalog: menyimpan data produk dan menggambar kisi kartu produk.

import { $, el, formatRupiah, formatRibuan, hargaSetelahDiskon } from './util.js';
import { tambahKeKeranjang, beliSekarang } from './keranjang.js';
import { amatiKartu, lepasKartu } from './gulir.js';

export const keadaan = {
  semuaProduk: [],
  ditampilkan: [],
  hargaVoucher: new Map(), // id produk -> harga setelah voucher
};

export async function muatProduk() {
  const respons = await fetch('/api/produk');
  keadaan.semuaProduk = await respons.json();
  return keadaan.semuaProduk;
}

function buatKartu(produk) {
  const kartu = el('article', 'kartu');
  kartu.dataset.id = produk.id;
  kartu.setAttribute('role', 'listitem');

  if (produk.flashSale) kartu.append(el('span', 'lencana-kilat', '⚡ Kilat'));

  const media = el('a', 'kartu-media');
  media.href = '#produk-' + produk.id;
  const gambar = document.createElement('img');
  gambar.dataset.src = produk.gambar;
  gambar.width = gambar.height = 480;
  gambar.decoding = 'async';
  gambar.alt = produk.nama;
  media.append(gambar);

  const badan = el('div', 'kartu-badan');
  badan.append(el('h3', 'kartu-judul', produk.nama));

  const harga = el('div', 'harga');
  harga.append(el('span', 'harga-kini', formatRupiah(hargaSetelahDiskon(produk))));
  if (produk.diskon > 0) {
    harga.append(el('span', 'harga-asli', formatRupiah(produk.harga)));
    harga.append(el('span', 'harga-diskon', '-' + produk.diskon + '%'));
  }
  const hargaVoucher = keadaan.hargaVoucher.get(produk.id);
  if (hargaVoucher) harga.append(el('span', 'harga-voucher', 'Pakai voucher: ' + formatRupiah(hargaVoucher)));
  badan.append(harga);

  badan.append(el('div', 'keterangan', '★ ' + produk.rating.toLocaleString('id-ID') + ' | ' + formatRibuan(produk.terjual) + ' terjual'));
  badan.append(el('div', 'keterangan', produk.kota));

  const aksi = el('div', 'aksi');
  const tombolTambah = el('button', 'tombol-tambah', '+ Keranjang');
  tombolTambah.type = 'button';
  tombolTambah.addEventListener('click', () => tambahKeKeranjang(produk, tombolTambah));
  const tombolBeli = el('button', 'tombol-beli', 'Beli sekarang');
  tombolBeli.type = 'button';
  tombolBeli.addEventListener('click', () => beliSekarang(produk, tombolBeli));
  aksi.append(tombolTambah, tombolBeli);
  badan.append(aksi);

  kartu.append(media, badan);
  return kartu;
}

// Full data stays in memory. Only a viewport-sized window occupies the DOM.
// A fixed row pitch preserves the scrollbar and makes every result reachable.
const TINGGI_BARIS = 520;
const kartuAktif = new Map();
let terpasang = false, terjadwal = false;

export function perbaruiJendela() {
  const kisi = $('#kisi');
  const kotak = kisi.getBoundingClientRect(); // all geometry reads precede writes
  const lebar = kotak.width;
  const celah = window.innerWidth <= 560 ? 8 : 12;
  const kolom = window.innerWidth <= 560 ? 2 : Math.max(1, Math.floor((lebar + celah) / 180));
  const jumlah = keadaan.ditampilkan.length;
  if (!jumlah) return;
  const baris = Math.ceil(jumlah / kolom);
  const awal = Math.min(baris - 1, Math.max(0, Math.floor(-kotak.top / TINGGI_BARIS) - 1));
  const akhir = Math.min(baris, Math.max(awal + 1, Math.ceil((innerHeight - kotak.top) / TINGGI_BARIS) + 1));
  const perlu = new Set();
  kisi.style.height = baris * TINGGI_BARIS + 'px';
  for (let i = awal * kolom; i < Math.min(jumlah, akhir * kolom); i++) {
    const produk = keadaan.ditampilkan[i];
    perlu.add(produk.id);
    let kartu = kartuAktif.get(produk.id);
    if (!kartu) {
      kartu = buatKartu(produk); kartuAktif.set(produk.id, kartu);
      kartu.setAttribute('aria-setsize', jumlah);
      kartu.setAttribute('aria-posinset', i + 1);
      kisi.append(kartu); amatiKartu(kartu);
    }
    kartu.style.width = (lebar + celah) / kolom - celah + 'px';
    kartu.style.left = (i % kolom) * (lebar + celah) / kolom + 'px';
    kartu.style.top = Math.floor(i / kolom) * TINGGI_BARIS + 'px';
  }
  for (const [id, kartu] of kartuAktif) {
    // Preserve a focused card until focus leaves it, including keyboard users.
    if (!perlu.has(id) && !kartu.contains(document.activeElement)) {
      lepasKartu(kartu); kartu.remove(); kartuAktif.delete(id);
    }
  }
}

function jadwalkanJendela() {
  if (terjadwal) return;
  terjadwal = true;
  requestAnimationFrame(() => { terjadwal = false; perbaruiJendela(); });
}

export function renderProduk(daftar) {
  const kisi = $('#kisi');
  keadaan.ditampilkan = daftar;
  for (const kartu of kartuAktif.values()) lepasKartu(kartu);
  kartuAktif.clear(); kisi.replaceChildren();
  Object.assign(kisi.style, { height: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '8px' });
  for (const produk of daftar) {
    const kartu = buatKartu(produk);
    Object.assign(kartu.style, { position: 'relative', contentVisibility: 'auto', containIntrinsicSize: '508px' });
    kartuAktif.set(produk.id, kartu); kisi.append(kartu); amatiKartu(kartu);
  }
  if (!daftar.length) kisi.append(el('p', 'kosong', 'Produk tidak ditemukan.'));
  $('#ringkasan').textContent = daftar.length.toLocaleString('id-ID') + ' produk ditampilkan';
}


export function perbaruiHargaVoucherDiKartu() {
  for (const [id, kartu] of kartuAktif) {
    kartu.querySelector('.harga-voucher')?.remove();
    const nilai = keadaan.hargaVoucher.get(id);
    if (nilai) kartu.querySelector('.harga').append(el('span', 'harga-voucher', 'Pakai voucher: ' + formatRupiah(nilai)));
  }
}
