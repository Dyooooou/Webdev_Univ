const fs=require('node:fs'),zlib=require('node:zlib');
const {chromium}=require('../.tools/node_modules/playwright');
const phase=process.argv[2]||'before';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 for(const file of fs.readdirSync('laporan/trace').filter(f=>f.startsWith(phase+'-')&&f.endsWith('-1.json.gz'))) {
  const summary=JSON.parse(fs.readFileSync('laporan/data/'+phase+'/'+file.replace('.json.gz','-trace-summary.json')));
  const all=JSON.parse(zlib.gunzipSync(fs.readFileSync('laporan/trace/'+file))).traceEvents;
  const thread=all.find(e=>e.name==='thread_name'&&e.tid===summary.thread&&e.args.name==='CrRendererMain');
  const events=require('./trace-events.cjs')(all.filter(e=>e.pid===thread.pid&&e.tid===thread.tid)).filter(e=>e.dur>0);
  const task=events.filter(e=>['RunTask','BlinkScheduler_PerformMicrotaskCheckpoint'].includes(e.name)).sort((a,b)=>b.dur-a.dur)[0];
  const start=task?.ts || Math.min(...events.map(e=>e.ts));
  const end=start+Math.max(task?.dur||0,300000);
  const selected=events.filter(e=>e.ts>=start&&e.ts<end).sort((a,b)=>a.ts-b.ts||b.dur-a.dur);
  const rows=[]; const stack=[];
  for(const e of selected) {while(stack.length&&e.ts>=stack.at(-1))stack.pop();const depth=stack.length;stack.push(e.ts+e.dur); if(depth>11)continue;const color=/Layout|Style/.test(e.name)?'#a781db':/Paint|Raster/.test(e.name)?'#6dbf98':/Task/.test(e.name)?'#818ca4':'#e6c268';const x=140+(e.ts-start)/(end-start)*1230,w=Math.max(.8,Math.min(e.dur,end-e.ts)/(end-start)*1230);rows.push(`<rect x="${x}" y="${68+depth*24}" width="${w}" height="21" fill="${color}"/><text x="${x+3}" y="${83+depth*24}" font-size="11">${w>50?escape(e.name):''}</text>`);}
  const metrics=JSON.parse(fs.readFileSync('laporan/data/'+phase+'/'+file.replace(phase+'-','').replace('.json.gz','.json'))).metrics;
  metrics.cls=summary.traceCLS.toFixed(3);metrics.frameLambat=summary.slowFrames10s;
  metrics.longTaskTerlama??=((task?.dur||0)/1000).toFixed(1);
  const totals=Object.entries(summary.totals).filter(([n])=>['RunTask','Layout','UpdateLayoutTree','Paint','FunctionCall','EventDispatch','FireAnimationFrame'].includes(n));
  const funcs=Object.entries(summary.sampledSelfMs).slice(0,8);
  const html=`<!doctype html><meta charset="utf-8"><style>body{font:16px Segoe UI;margin:30px;color:#17233a;background:#f4f6fa}h1{margin:0 0 8px;font-size:25px}p{margin:8px 0}svg{background:white;border:1px solid #ccd4e0;width:100%;height:390px}.cols{display:grid;grid-template-columns:1fr 1.3fr;gap:24px}table{width:100%;background:white;border-collapse:collapse;font-size:13px}td,th{padding:7px;border-bottom:1px solid #dde2eb;text-align:left}code{font-size:12px}.note{padding:12px;background:#fff0c2}</style><h1>${escape(file)} — rekaman Chrome asli</h1><p>412 × 915 · CPU 4× · INP ${metrics.inp??'tidak tercatat'} ms · CLS ${metrics.cls} · long task ${metrics.longTaskTerlama} ms · frame &gt;50 ms: ${metrics.frameLambat}</p><p class="note">Anotasi: task terlama ${((task?.dur||0)/1000).toFixed(1)} ms. Ungu = Style/Layout; hijau = Paint; kuning = JavaScript. Tampilan analisis dari ekspor CDP, bukan tangkapan UI DevTools.</p><svg viewBox="0 0 1380 390"><text x="12" y="28">Main thread — rentang ${((end-start)/1000).toFixed(1)} ms</text>${rows.join('')}<text x="12" y="370">Sumber: ${escape(file)}. Lebar batang proporsional durasi event asli; pembesaran pada task terlama.</text></svg><div class="cols"><div><h2>Pipeline (durasi inklusif)</h2><table><tr><th>Event</th><th>Jumlah</th><th>Total ms</th><th>Maks ms</th></tr>${totals.map(([n,v])=>`<tr><td>${n}</td><td>${v.count}</td><td>${v.totalMs.toFixed(1)}</td><td>${v.maxMs.toFixed(1)}</td></tr>`).join('')}</table></div><div><h2>Bottom-up CPU samples (self)</h2><table>${funcs.map(([n,v])=>`<tr><td><code>${escape(n)}</code></td><td>${v.toFixed(1)} ms</td></tr>`).join('')}</table><p>Sampling CPU adalah estimasi; event bersarang tidak boleh dijumlah sebagai waktu total halaman.</p></div></div>`;
  const interactions=all.filter(e=>e.name==='Responsiveness.Renderer.UserInteraction').map(e=>e.args.data).sort((a,b)=>b.maxDuration-a.maxDuration).slice(0,4);
  const tracks=`<p><b>Interactions:</b> ${interactions.map(e=>escape(e.interactionType)+' '+e.maxDuration+' ms').join(' · ')||'tidak ada interaksi pada skenario ini'} &nbsp; <b>Layout Shifts:</b> ${summary.layoutShifts.map(e=>e.score.toFixed(3)).join(', ')||'0'} &nbsp; <b>Frames:</b> ${summary.slowFrames10s} interval rAF &gt;50 ms dalam jendela 10 s.</p>`;
  const full=html.replace('<div class="cols">',tracks+'<div class="cols">');
  fs.mkdirSync('laporan/trace-views',{recursive:true});fs.writeFileSync('laporan/trace-views/'+file.replace('.json.gz','.html'),full);
  await page.setContent(full);await page.screenshot({path:'screenshots/'+file.replace('.json.gz','-flame.png'),fullPage:true});
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
