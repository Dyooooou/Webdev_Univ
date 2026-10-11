const { chromium } = require('../.tools/node_modules/playwright');
const fs = require('node:fs');
const os = require('node:os');
const zlib = require('node:zlib');
const path = require('node:path');
const phase = process.argv[2] || 'before';
const scenarios = (process.argv[3] || 'S0,S1,S2,S3,S4,S5,S6').split(',');
const repeats = Number(process.argv[4] || 3);
const delay = ms => new Promise(r => setTimeout(r, ms));
const out = `laporan/data/${phase}`;
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync('laporan/trace', { recursive: true });
fs.mkdirSync('screenshots', { recursive: true });
async function traceStart(cdp) {
  await cdp.send('Tracing.start', { categories: '-*,toplevel,devtools.timeline,blink.user_timing,loading,latencyInfo,disabled-by-default-devtools.timeline.frame,disabled-by-default-v8.cpu_profiler', options:'sampling-frequency=1000', transferMode: 'ReturnAsStream' });
}
async function traceEnd(cdp, name) {
  const done = new Promise(r => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.end');
  const { stream } = await done;
  let parts = [];
  for (;;) { const x = await cdp.send('IO.read', { handle: stream }); parts.push(Buffer.from(x.data, x.base64Encoded ? 'base64' : 'utf8')); if(x.eof) break; }
  await cdp.send('IO.close', { handle: stream });
  const raw = Buffer.concat(parts);
  fs.writeFileSync(`laporan/trace/${name}.json.gz`, zlib.gzipSync(raw));
}
async function ready(page) {
  await page.waitForFunction(() => window.AlatUkur && document.querySelectorAll('.kartu').length > 0, null, {timeout:180000});
  await page.waitForLoadState('networkidle',{timeout:180000});
  await delay(3500);
}
async function reset(page) { await page.evaluate(() => document.querySelector('#au-reset').click()); await delay(100); }
async function clickProduct(page, selector, count=1) {
  const target = page.locator(selector).first();
  await target.scrollIntoViewIfNeeded({timeout:180000});
  await delay(1000);
  await reset(page);
  const b = await target.boundingBox();
  for(let i=0;i<count;i++) await page.mouse.click(b.x+b.width/2,b.y+b.height/2,{delay:0});
}
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true,args:['--disable-extensions']});
  fs.writeFileSync(`${out}/environment.json`, JSON.stringify({date:new Date().toISOString(),browser:browser.version(),cpu:os.cpus()[0].model,logicalCPUs:os.cpus().length,ramBytes:os.totalmem(),os:os.version(),viewport:{width:412,height:915},cpuRate:4,products:1500,headless:true,networkThrottle:false},null,2));
  for(let run=1;run<=repeats;run++) {
    const context = await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1});
    const page = await context.newPage(); page.setDefaultTimeout(180000);
    await require('./variants.cjs')(page,phase);
    await page.addInitScript(()=>{
      performance.setResourceTimingBufferSize(20000);
      // Loading CLS and frame windows come from the trace, not another rAF observer.
      window.loadMetrics=()=>({...window.AlatUkur?.ringkas(),capturedAtMs:performance.now()});
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    await cdp.send('Network.enable');
    const errors=[];page.on('pageerror', e=>errors.push(e.message));
    await page.goto('http://localhost:3000/?ukur=1',{waitUntil:'domcontentloaded'});await ready(page);
    for(const scenario of scenarios) {
      console.log(`${phase} run ${run} ${scenario} start`);
      const network=[]; const reqs=new Map();
      const request=e=>{reqs.set(e.requestId,{url:e.request.url,start:e.timestamp,type:e.type});};
      const finish=e=>{const r=reqs.get(e.requestId);if(r) network.push({...r,end:e.timestamp,bytes:e.encodedDataLength,durationMs:(e.timestamp-r.start)*1000});};
      cdp.on('Network.requestWillBeSent',request);cdp.on('Network.loadingFinished',finish);
      if(scenario==='S0') {await traceStart(cdp);await page.reload({waitUntil:'domcontentloaded'});console.log('reloaded');await delay(10000);}
      else {if(scenario===scenarios[0]) {await page.reload({waitUntil:'domcontentloaded'});await ready(page);} await reset(page);await traceStart(cdp);}
      if(scenario==='S1') {await page.locator('#kolom-cari').pressSequentially('sepatu',{delay:120});await delay(500);for(let i=0;i<6;i++) {await page.keyboard.press('Backspace');await delay(120);}await delay(1500);}
      if(scenario==='S2') {await clickProduct(page,'.tombol-tambah');await delay(1800);}
      if(scenario==='S3') {await context.request.delete('http://localhost:3000/api/pesanan');await clickProduct(page,'.tombol-beli',3);await delay(2500);}
      if(scenario==='S4') {
        await page.evaluate(()=>{window.__voucherFrames=[];window.__voucherInputs=[];window.__stopVoucherProbe=false;const frame=()=>{const p=document.querySelector('#progres');if(!p.hidden)window.__voucherFrames.push({time:performance.now(),value:p.getAttribute('aria-valuenow'),text:p.textContent});if(!window.__stopVoucherProbe)requestAnimationFrame(frame);};requestAnimationFrame(frame);document.querySelector('#kolom-cari').addEventListener('input',()=>{if(!document.querySelector('#progres').hidden)window.__voucherInputs.push(performance.now());});});
        await page.locator('#tombol-voucher').click();await page.locator('#kolom-cari').pressSequentially('sepatu',{delay:120});await delay(2000);await page.waitForFunction(()=>document.querySelector('#progres').hidden,null,{timeout:180000});
        await page.evaluate(()=>window.__stopVoucherProbe=true);
      }
      if(scenario==='S5') {await page.mouse.move(390,740);const start=Date.now();while(Date.now()-start<10000) {await page.mouse.wheel(0,160);await delay(100);} }
      if(scenario==='S6') await delay(10000);
      await traceEnd(cdp,`${phase}-${scenario}-${run}`);
      console.log('trace saved');
      const metrics=await page.evaluate(s=>({ ...(s==='S0'?window.loadMetrics():window.AlatUkur.ringkas()),cart:document.querySelector('#lencana-keranjang').textContent,orders:document.querySelector('#lencana-pesanan').textContent,results:document.querySelector('#ringkasan').textContent,analytics:window.Lacak.antrian,resources:performance.getEntriesByType('resource').map(x=>({name:x.name,duration:x.duration,start:x.startTime,end:x.responseEnd,bytes:x.transferSize})) }),scenario);
      console.log('metrics collected');
      if(scenario==='S4') metrics.progress=await page.evaluate(()=>({frames:window.__voucherFrames,inputs:window.__voucherInputs}));
      fs.writeFileSync(`${out}/${scenario}-${run}.json`,JSON.stringify({phase,scenario,run,metrics,network,requested:[...reqs.values()],errors},null,2));
      if(run===1) {const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(`screenshots/${phase}-${scenario}.png`,Buffer.from(shot.data,'base64'));}
      cdp.off('Network.requestWillBeSent',request);cdp.off('Network.loadingFinished',finish);
      console.log(JSON.stringify({phase,scenario,run,inp:metrics.inp,lt:metrics.longTaskTerlama,cls:metrics.cls,frames:metrics.frameLambat,orders:metrics.orders}));
      if(scenario==='S0') await ready(page);
      if(scenario==='S4') {await page.locator('#kolom-cari').fill('');await delay(1500);}
      if(scenario==='S5') {await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await delay(1500);}
    }
    await context.close();
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
