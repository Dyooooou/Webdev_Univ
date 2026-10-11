// Voucher: menghitung harga promo untuk setiap produk.
// Aturan promo bertingkat + simulasi cicilan ditentukan tim bisnis.

import { $, hargaSetelahDiskon, tampilkanToast, kirimAnalitik } from './util.js';
import { keadaan, perbaruiHargaVoucherDiKartu } from './katalog.js';

const VOUCHER = {
  KILAT1212: { persen: 12, maksPotongan: 120000, minBelanja: 50000 },
  HEMAT50: { persen: 5, maksPotongan: 50000, minBelanja: 0 },
};

function simulasiCicilan(harga) {
  let terbaik = { tenor: 1, angsuran: harga };
  for (let tenor = 1; tenor <= 24; tenor++) {
    let sisa = harga;
    let angsuran = Math.ceil(harga / tenor / 100) * 100;
    for (let bulan = 1; bulan <= tenor; bulan++) {
      const biayaAdmin = Math.round(sisa * 0.0005 * Math.log2(bulan + 1));
      sisa = sisa - angsuran + biayaAdmin;
      if (sisa < 0) sisa = 0;
    }
    angsuran += Math.ceil(sisa / tenor);
    if (angsuran >= 25000 && angsuran < terbaik.angsuran) terbaik = { tenor, angsuran };
  }
  return terbaik;
}

// Pure business calculation. Rendering opportunities are scheduled by the caller.
function hitungHargaPromo(produk, aturan) {
  const dasar = hargaSetelahDiskon(produk);
  if (dasar < aturan.minBelanja) return null;
  let potongan = Math.min(Math.round((dasar * aturan.persen) / 100), aturan.maksPotongan);
  if (produk.flashSale) potongan = Math.round(potongan / 2); // flash sale hanya dapat setengah
  let hargaAkhir = Math.max(dasar - potongan, 100);
  const cicilan = simulasiCicilan(hargaAkhir);
  return { hargaAkhir, cicilan };
}

let menghitung = false;
const beriWaktuRender = () => new Promise(resolve => setTimeout(resolve, 16));

async function terapkanVoucher(kode) {
  if (menghitung) return;
  const aturan = VOUCHER[kode];
  if (!aturan) {
    tampilkanToast('Kode voucher "' + kode + '" tidak dikenal. Coba KILAT1212.');
    return;
  }

  const progres = $('#progres');
  const isi = $('#progres-isi');
  const teks = $('#progres-teks');
  const tombol = $('#tombol-voucher');
  menghitung = true;
  tombol.disabled = true;
  tombol.setAttribute('aria-busy', 'true');
  progres.hidden = false;
  isi.style.width = '0%';
  teks.textContent = 'Menghitung harga promo… 0%';
  progres.setAttribute('role', 'progressbar');
  progres.setAttribute('aria-label', 'Perhitungan harga voucher');
  progres.setAttribute('aria-valuemin', '0');
  progres.setAttribute('aria-valuemax', '100');
  progres.setAttribute('aria-valuenow', '0');

  const total = keadaan.semuaProduk.length;
  let selesai = 0;
  const hargaBaru = new Map();
  try {
    await beriWaktuRender();
    while (selesai < total) {
      const mulai = performance.now();
      let potongan = 0;
      do {
        const produk = keadaan.semuaProduk[selesai++];
        const hasil = hitungHargaPromo(produk, aturan);
        if (hasil) hargaBaru.set(produk.id, hasil.hargaAkhir);
        potongan++;
      } while (selesai < total && potongan < 100 && performance.now() - mulai < 4);
      const persen = Math.round(selesai / total * 100);
      isi.style.width = persen + '%';
      progres.setAttribute('aria-valuenow', persen);
      teks.textContent = `Menghitung harga promo… ${persen}% (${selesai} dari ${total} produk)`;
      await beriWaktuRender(); // a task boundary, not an already-resolved microtask
    }
    keadaan.hargaVoucher = hargaBaru;
    perbaruiHargaVoucherDiKartu();
    tampilkanToast('Voucher ' + kode + ' dipakai di ' + hargaBaru.size.toLocaleString('id-ID') + ' produk.');
    kirimAnalitik('apply_voucher', { kode, jumlah: hargaBaru.size });
  } catch {
    tampilkanToast('Voucher gagal dihitung. Harga sebelumnya tetap berlaku; silakan coba lagi.');
  } finally {
    progres.hidden = true;
    tombol.disabled = false;
    tombol.removeAttribute('aria-busy');
    menghitung = false;
  }
}

export function pasangVoucher() {
  const kolom = $('#kolom-voucher');
  $('#tombol-voucher').addEventListener('click', () => terapkanVoucher(kolom.value.trim().toUpperCase()));
  kolom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') terapkanVoucher(kolom.value.trim().toUpperCase());
  });
}
