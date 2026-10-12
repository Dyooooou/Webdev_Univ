const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
process.env.PLAYWRIGHT_BROWSERS_PATH=path.resolve('.tools/browsers');
const {chromium}=require('../.tools/node_modules/playwright');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 fs.mkdirSync('.capture-tmp/video',{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-extensions']});
 const recordings=[];
 for(const phase of ['before','after']) {
  const context=await browser.newContext({viewport:{width:412,height:915},recordVideo:{dir:'.capture-tmp/video',size:{width:412,height:916}}});
  if(phase==='before') {
   const files=execFileSync('git',['ls-tree','-r','--name-only','9da21d1','public'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(f=>/\.(html|css|js)$/.test(f)&&!f.includes('/vendor/')&&!f.includes('/alat/'));
   const sources=new Map(files.map(f=>['/'+f.slice(7),execFileSync('git',['show',`9da21d1:${f}`])]));
   await context.route('**/*',async route=>{let p=new URL(route.request().url()).pathname;if(p==='/')p='/index.html';const body=sources.get(p);if(body)await route.fulfill({body,contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html'});else await route.continue();});
  }
  const page=await context.newPage();page.setDefaultTimeout(240000);const epoch=Date.now();
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const ready=async()=>{await page.waitForFunction(()=>window.AlatUkur&&document.querySelectorAll('.kartu').length);await page.waitForLoadState('networkidle',{timeout:240000});await pause(3500);};
  console.log(phase+' warming');await page.goto('http://localhost:3000/?ukur=1',{waitUntil:'domcontentloaded',timeout:240000});await ready();await page.reload({waitUntil:'domcontentloaded',timeout:240000});await ready();
  const item={phase,epoch,start:(Date.now()-epoch)/1000,chapters:[],cpuRate:4,viewport:{width:412,height:915}};
  const chapter=async(s)=>{console.log(phase+' '+s);await page.evaluate(()=>document.querySelector('#au-reset').click());item.chapters.push({scenario:s,time:(Date.now()-epoch)/1000});await pause(1000);};
  await chapter('S1');await page.locator('#kolom-cari').pressSequentially('sepatu',{delay:120});await pause(1200);for(let i=0;i<6;i++){await page.keyboard.press('Backspace');await pause(120);}await pause(1800);
  await chapter('S2');await page.locator('.tombol-tambah').first().click();await pause(2200);
  await context.request.delete('http://localhost:3000/api/pesanan');await page.locator('.tombol-beli').first().scrollIntoViewIfNeeded();await chapter('S3');const b=await page.locator('.tombol-beli').first().boundingBox();for(let i=0;i<3;i++)await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await pause(2500);item.orders=(await(await context.request.get('http://localhost:3000/api/pesanan')).json()).length;if(item.orders!==(phase==='before'?3:1))throw Error('unexpected demo order count '+item.orders);
  await page.locator('#tombol-voucher').scrollIntoViewIfNeeded();await chapter('S4');await page.locator('#tombol-voucher').click();await page.locator('#kolom-cari').pressSequentially('sepatu',{delay:120});await page.waitForFunction(()=>document.querySelector('#progres').hidden);await pause(2000);await page.locator('#kolom-cari').fill('');await pause(1600);
  await page.locator('.kartu').first().scrollIntoViewIfNeeded();await chapter('S5');await page.mouse.move(390,740);const scrollStart=Date.now();while(Date.now()-scrollStart<10000){await page.mouse.wheel(0,160);await pause(100);}await pause(1500);
  item.end=(Date.now()-epoch)/1000;item.video=await page.video().path();await context.close();recordings.push(item);fs.writeFileSync('.capture-tmp/recordings.json',JSON.stringify(recordings,null,2));console.log(phase+' saved '+(item.end-item.start).toFixed(1)+' seconds');
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
