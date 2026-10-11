import { $ } from './util.js';

const sudahTercatat = new Set();
const dekat = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) {
    const img = entry.target.querySelector('img[data-src]');
    if (img) { img.src = img.dataset.src; delete img.dataset.src; }
    dekat.unobserve(entry.target);
  }
}, { rootMargin: '240px' });
const terlihat = new IntersectionObserver(entries => {
  const produk = [];
  for (const entry of entries) {
    entry.target.classList.toggle('dalam-layar', entry.isIntersecting);
    if (!entry.isIntersecting) continue;
    entry.target.classList.add('terlihat');
    const id = entry.target.dataset.id;
    if (!sudahTercatat.has(id)) { sudahTercatat.add(id); produk.push(id); }
  }
  if (produk.length) setTimeout(() => window.Lacak?.kirim('impression', { produk }), 0);
}, { threshold: 0.01 });

export function amatiKartu(kartu) { dekat.observe(kartu); terlihat.observe(kartu); }
export function lepasKartu(kartu) { dekat.unobserve(kartu); terlihat.unobserve(kartu); }

let terjadwal = false;
export function periksaGulir() {
  if (terjadwal) return;
  terjadwal = true;
  requestAnimationFrame(() => {
    terjadwal = false;
    const y = scrollY;
    const tinggi = document.documentElement.scrollHeight - innerHeight;
    $('#kepala').classList.toggle('melayang', y > 8);
    $('#ke-atas').hidden = y < 900;
    $('#bar-gulir').style.transform = `scaleX(${tinggi > 0 ? y / tinggi : 0})`;
  });
}

export function pasangGulir() {
  window.addEventListener('scroll', periksaGulir, { passive: true });
  window.addEventListener('resize', periksaGulir, { passive: true });
  $('#ke-atas').addEventListener('click', () => window.scrollTo({ top: 0 }));
}
