const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');const {chromium}=require('../.tools/node_modules/playwright');
const price=p=>Math.round(p.harga*(100-p.diskon)/100/100)*100;
const extract=source=>vm.runInNewContext(source.replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')+'\n;({hitungHargaPromo,VOUCHER})',{hargaSetelahDiskon:price});
(async()=>{
 const original=extract(execFileSync('git',['show','9da21d1:public/js/harga-promo.js'],{encoding:'utf8'}));
 const actual=extract(fs.readFileSync('public/js/harga-promo.js','utf8'));
 const products=await (await fetch('http://localhost:3000/api/produk')).json();let comparisons=0;
 const cases=products.concat([0,100,49900,50000,50100,1000000,10000000].flatMap(harga=>[true,false].map(flashSale=>({harga,diskon:0,flashSale}))));
 for(const p of cases)for(const rule of Object.keys(original.VOUCHER)){const expected=await original.hitungHargaPromo(p,original.VOUCHER[rule]);const received=await actual.hitungHargaPromo(p,actual.VOUCHER[rule]);assert.equal(JSON.stringify(received),JSON.stringify(expected));comparisons++;}
 const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:412,height:915}});const page=await context.newPage();const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.goto('http://localhost:3000/?ukur=1');await page.waitForSelector('.kartu');await page.waitForTimeout(2100);
 await page.evaluate(()=>{window.progressFrames=[];window.inputDuringProgress=[];document.querySelector('#kolom-cari').addEventListener('input',()=>{if(!document.querySelector('#progres').hidden)window.inputDuringProgress.push(performance.now());});const sample=()=>{const p=document.querySelector('#progres');if(!p.hidden)window.progressFrames.push({t:performance.now(),value:p.getAttribute('aria-valuenow')});requestAnimationFrame(sample);};requestAnimationFrame(sample);});
 await page.locator('#tombol-voucher').click();await page.locator('#kolom-cari').pressSequentially('sepatu',{delay:30});
 await page.waitForFunction(()=>document.querySelector('#progres').hidden);
 const observation=await page.evaluate(async()=>({frames:window.progressFrames,inputDuringProgress:window.inputDuringProgress,prices:[...(await import('/js/katalog.js')).keadaan.hargaVoucher]}));
 assert.ok(new Set(observation.frames.map(x=>x.value).filter(x=>Number(x)>0&&Number(x)<100)).size>=2);assert.ok(observation.inputDuringProgress.length>0);
 const expectedPrices=[];for(const p of products){const value=actual.hitungHargaPromo(p,actual.VOUCHER.KILAT1212);if(value)expectedPrices.push([p.id,value.hargaAkhir]);}assert.deepEqual(observation.prices,expectedPrices);
 await page.locator('#kolom-voucher').fill('INVALID');await page.locator('#tombol-voucher').click();assert.match(await page.locator('#toast').textContent(),/tidak dikenal/);
 await page.locator('#kolom-voucher').fill('HEMAT50');await page.locator('#tombol-voucher').click();await page.waitForFunction(()=>document.querySelector('#progres').hidden);assert.equal(await page.evaluate(async()=>(await import('/js/katalog.js')).keadaan.hargaVoucher.size),products.length);
 fs.writeFileSync('laporan/data/voucher-correctness.json',JSON.stringify({comparisons,products:products.length,intermediateFrameValues:[...new Set(observation.frames.map(x=>x.value))],inputsDuringCalculation:observation.inputDuringProgress.length,checks:['original price and installment oracle matches both vouchers and threshold cases','incremental progress sampled in animation frames','typing while calculation remains active','atomic full-product price map correct','invalid code handled; second voucher reapplies']},null,2));
 console.log({comparisons,frames:observation.frames.length,inputs:observation.inputDuringProgress.length});await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
