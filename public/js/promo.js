// Elemen kampanye: hitung mundur, teks berjalan, dan banner promo.

import { $, el, tampilkanToast, kirimAnalitik } from './util.js';

// Flash sale berakhir tengah malam nanti (waktu perangkat).
function akhirFlashSale() {
  const t = new Date();
  t.setHours(24, 0, 0, 0);
  return t.getTime();
}

const duaDigit = (n) => String(n).padStart(2, '0');

function pasangHitungMundur() {
  const akhir = akhirFlashSale();
  const awal = Date.now();
  const garis = $('#hm-garis');
  const jam = $('#hm-jam'), menit = $('#hm-menit'), detik = $('#hm-detik');
  const perbarui = () => {
    const sisa = Math.max(akhir - Date.now(), 0);
    jam.textContent = duaDigit(Math.floor(sisa / 3600000));
    menit.textContent = duaDigit(Math.floor((sisa % 3600000) / 60000));
    detik.textContent = duaDigit(Math.floor((sisa % 60000) / 1000));
    garis.style.transform = `scaleX(${sisa / (akhir - awal + 1)})`;
  };
  let timer;
  const visibilitas = () => {
    clearInterval(timer);
    document.documentElement.classList.toggle('tab-tersembunyi', document.hidden);
    if (!document.hidden) { perbarui(); timer = setInterval(perbarui, 1000); }
  };
  document.addEventListener('visibilitychange', visibilitas);
  visibilitas();
}

function pasangTeksBerjalan() {
  // CSS transform animation is eligible for compositor execution.
  $('#berjalan-teks').classList.add('bergerak');
}

async function pasangBannerPromo() {
  const banner = $('#slot-promo');
  try {
  const respons = await fetch('/api/promo');
  if (!respons.ok) throw new Error('Promo tidak tersedia');
  const promo = await respons.json();
  const teks = el('div');
  teks.append(el('h2', '', promo.judul), el('p', '', promo.isi));
  const tombol = el('button', '', promo.tombol);
  tombol.type = 'button';
  tombol.addEventListener('click', () => {
    tampilkanToast('Syarat promo: berlaku 12 Desember, satu voucher per akun, tidak bisa digabung.');
    kirimAnalitik('promo_click', { judul: promo.judul });
  });
  banner.replaceChildren(teks, tombol);
  } catch {
    banner.replaceChildren(el('p', '', 'Penawaran belum tersedia. Produk dan voucher tetap dapat digunakan.'));
  } finally { banner.removeAttribute('aria-busy'); }
}

export function pasangPromo() {
  pasangHitungMundur();
  pasangTeksBerjalan();
  pasangBannerPromo();
}
