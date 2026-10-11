const {chromium}=require('../.tools/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:412,height:915}});
 const page=await context.newPage();
 await page.route('**/?diagnosis',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><ol id="merek-populer"></ol><ul id="kategori-terkait"></ul><script src="/vendor/lacak.min.js"></script>'}));
 await page.goto('http://localhost:3000/?diagnosis');
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await cdp.send('Tracing.start',{categories:'-*,toplevel,devtools.timeline,blink.user_timing,disabled-by-default-v8.cpu_profiler',transferMode:'ReturnAsStream'});
 const data=await page.evaluate(async()=>{
  const start=performance.now();const products=await (await fetch('/api/produk')).json();const apiMs=performance.now()-start;
  const {pasangKaki}=await import('/js/kategori.js');const {urutkanGelembung}=await import('/js/util.js');
  const footer=[],sort=[],sdkLarge=[],sdkSmall=[];const brands=[...new Set(products.map(p=>p.merek))];
  for(let r=0;r<3;r++) {document.querySelector('#merek-populer').replaceChildren();document.querySelector('#kategori-terkait').replaceChildren();let t=performance.now();pasangKaki(products);footer.push(performance.now()-t);t=performance.now();for(let i=0;i<1000;i++)urutkanGelembung(brands,(a,b)=>a.localeCompare(b));sort.push((performance.now()-t)/1000);
   let waktu=Date.parse('2023-01-05T08:00:00+07:00');const jenis=['lihat','lihat','lihat','cari','keranjang','beli'];
   const history=Array.from({length:9000},(_,i)=>{const p=products[(i*131)%products.length];waktu+=1000*60*(7+i%190);return {t:waktu,jenis:jenis[i%6],id:p.id,nama:p.nama,kategori:p.kategori,harga:p.harga};});t=performance.now();window.Lacak.kirim('add_to_cart',{produk:products[0],riwayat:history});sdkLarge.push(performance.now()-t);t=performance.now();window.Lacak.kirim('add_to_cart',{produkId:products[0].id,jumlah:1});sdkSmall.push(performance.now()-t);
  }
  return {apiMs,products:products.length,categories:new Set(products.map(p=>p.kategori)).size,brands:brands.length,footerMs:footer,sortMs:sort,sdkLargeMs:sdkLarge,sdkSmallMs:sdkSmall,note:'Isolated auxiliary benchmark, CPU 4x. Sort is mean per call over 1000 calls per repetition. SDK history is generated with the original 9000-entry seed algorithm; this controlled comparison is not S2 baseline.'};
 });
 const complete=new Promise(r=>cdp.once('Tracing.tracingComplete',r));await cdp.send('Tracing.end');const {stream}=await complete;let raw='';for(;;){const x=await cdp.send('IO.read',{handle:stream});raw+=x.data;if(x.eof)break;}await cdp.send('IO.close',{handle:stream});fs.writeFileSync('laporan/trace/diagnosis.json.gz',require('node:zlib').gzipSync(raw));
 fs.writeFileSync('laporan/data/diagnosis.json',JSON.stringify(data,null,2));console.log(data);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
