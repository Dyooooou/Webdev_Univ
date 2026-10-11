// Audit candidates proposed by Codex for controlled evaluation, not production fixes.
const fs=require('node:fs');
module.exports=async function variant(page,phase) {
 if(!phase.startsWith('audit-') || phase==='audit-control') return;
 const file=phase==='audit-render'?'katalog.js':'harga-promo.js';
 let source=fs.readFileSync('public/js/'+file,'utf8');
 if(phase==='audit-render') {
  source=source.replace(/export function renderProduk\(daftar\) \{[\s\S]*?\n\}\n(?=\s*export function perbaruiHargaVoucherDiKartu)/,`export function renderProduk(daftar) {
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
`);
 } else if(phase==='audit-microtask') {
  source=source.replace('const beriWaktuRender = () => new Promise(resolve => setTimeout(resolve, 16));','const beriWaktuRender = () => Promise.resolve();');
  source=source.replace('  const cicilan = simulasiCicilan(hargaAkhir);','  for (let i = 0; i < 40; i++) simulasiCicilan(hargaAkhir + i);\n  const cicilan = simulasiCicilan(hargaAkhir);');
 } else throw new Error('Unknown audit candidate');
 fs.mkdirSync('laporan/audit-candidates',{recursive:true});fs.writeFileSync(`laporan/audit-candidates/${phase}-${file}`,source);
 await page.route('**/js/'+file,route=>route.fulfill({contentType:'text/javascript',body:source}));
};
