const {chromium}=require('../.tools/node_modules/playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
const mode=process.argv[2]||'catalog';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:412,height:915}});const page=await context.newPage();const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3000/?ukur=1');await page.waitForFunction(()=>document.querySelectorAll('.kartu').length>0);await page.waitForTimeout(2100);
 const products=await (await context.request.get('http://localhost:3000/api/produk')).json();
 const checks=[];
 const state=()=>page.evaluate(async()=>{const {keadaan}=await import('/js/katalog.js');return {ids:keadaan.ditampilkan.map(p=>p.id),dom:document.querySelectorAll('.kartu').length};});
 assert.equal((await state()).ids.length,products.length);assert.ok((await state()).dom<40);checks.push('all products retained; DOM bounded');
 await page.locator('#kolom-cari').fill('sepatu');await page.waitForTimeout(400);
 const expected=products.filter(p=>(p.nama+' '+p.merek+' '+p.kategori+' '+p.kota).toLowerCase().includes('sepatu')).map(p=>p.id);
 assert.deepEqual((await state()).ids,expected);checks.push('search count and ids exact');
 await page.locator('#kolom-cari').fill('zzzz-no-product');await page.waitForTimeout(400);assert.equal((await state()).ids.length,0);assert.equal(await page.locator('.kosong').count(),1);
 await page.locator('#kolom-cari').fill('');await page.waitForTimeout(400);
 await page.locator('#pilih-urut').selectOption('murah');
 const price=p=>Math.round(p.harga*(100-p.diskon)/100/100)*100;
 assert.deepEqual((await state()).ids,products.slice().sort((a,b)=>price(a)-price(b)).map(p=>p.id));checks.push('empty search, clearing, price sort');
 await page.locator('#pilih-urut').selectOption('relevan');
 for(const fraction of [0,0.25,0.5,0.75,1]) {
  await page.evaluate(f=>{const k=document.querySelector('#kisi');window.scrollTo({top:k.offsetTop+Math.max(0,k.offsetHeight-innerHeight)*f,behavior:'instant'});},fraction);await page.waitForTimeout(250);
  assert.ok((await state()).dom<40);
 }
 assert.ok(await page.locator(`.kartu[data-id="${products.at(-1).id}"]`).count());checks.push('first, middle, and final catalogue rows reachable by scrolling');
 await page.setViewportSize({width:560,height:915});await page.waitForTimeout(300);
 const overflow=await page.locator('.kartu').evaluateAll(cards=>cards.some(c=>c.scrollHeight>c.clientHeight+2));assert.equal(overflow,false);checks.push('560 px cards have no clipped content');
 await page.setViewportSize({width:1280,height:915});await page.waitForTimeout(300);assert.ok((await state()).dom<50);checks.push('desktop resize keeps bounded DOM');
 await page.setViewportSize({width:412,height:915});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(400);
 await page.getByRole('button',{name:'Fashion Pria',exact:true}).click();assert.deepEqual((await state()).ids,products.filter(p=>p.kategori==='Fashion Pria').map(p=>p.id));checks.push('category ids/count correct');
 await page.getByRole('button',{name:'Semua',exact:true}).click();
 if(mode==='checkout'||mode==='all') {
  await page.locator('.tombol-tambah').first().click();await page.waitForTimeout(300);
  assert.equal(await page.locator('#lencana-keranjang').textContent(),'1');
  const history=await page.evaluate(()=>({base:JSON.parse(localStorage.tk_riwayat).length,journal:Object.keys(localStorage).filter(k=>k.startsWith('tk_aktivitas_')).map(k=>JSON.parse(localStorage[k]))}));
  assert.equal(history.base,9000);assert.equal(history.journal.filter(x=>x.jenis==='keranjang').length,1);checks.push('one cart click adds one item; 9000 history entries preserved plus new journal event');
  await page.reload();await page.waitForSelector('.tombol-beli');assert.equal(await page.locator('#lencana-keranjang').textContent(),'1');
  await context.request.delete('http://localhost:3000/api/pesanan');
  const buy=page.locator('.tombol-beli').first();await buy.scrollIntoViewIfNeeded();const b=await buy.boundingBox();
  for(let i=0;i<3;i++) await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
  assert.equal(await buy.isDisabled(),true);assert.match(await buy.textContent(),/Memproses|Dipesan/);
  await page.waitForTimeout(700);assert.equal((await (await context.request.get('http://localhost:3000/api/pesanan')).json()).length,1);checks.push('three real clicks produce exactly one server order; visible busy state');
  await page.waitForTimeout(1500);
  await page.route('**/api/pesanan',async route=>{if(route.request().method()==='POST')await route.fulfill({status:500,body:'injected failure'});else await route.continue();});
  await buy.click();await page.waitForTimeout(400);assert.equal(await buy.isEnabled(),true);assert.match(await page.locator('#toast').textContent(),/belum dapat dipastikan/);
  await page.unroute('**/api/pesanan');await buy.click();await page.waitForTimeout(700);assert.equal((await (await context.request.get('http://localhost:3000/api/pesanan')).json()).length,2);checks.push('injected HTTP failure releases guard; retry succeeds');
  await page.evaluate(()=>{const x=JSON.parse(localStorage.tk_keranjang);x[0].jumlah=98;localStorage.tk_keranjang=JSON.stringify(x);});
  await page.locator('.tombol-tambah').first().click();await page.locator('.tombol-tambah').first().click();assert.equal(await page.locator('#lencana-keranjang').textContent(),'99');checks.push('cart quantity limit 99 retained');
 }
 assert.deepEqual(errors,[]);
 fs.mkdirSync('laporan/data',{recursive:true});fs.writeFileSync(`laporan/data/features-${mode}.json`,JSON.stringify({date:new Date().toISOString(),products:products.length,checks,errors},null,2));console.log(checks);
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
