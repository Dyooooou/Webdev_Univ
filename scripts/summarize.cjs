const fs=require('node:fs'),zlib=require('node:zlib');
const phase=process.argv[2]||'before';const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];const result={};
for(let s=0;s<=6;s++) {
 const scenario='S'+s,rows=[];
 for(let run=1;run<=3;run++) {
  const base=`${phase}-${scenario}-${run}`;
  if(!fs.existsSync(`laporan/data/${phase}/${scenario}-${run}.json`))continue;
  const d=JSON.parse(fs.readFileSync(`laporan/data/${phase}/${scenario}-${run}.json`));
  const t=JSON.parse(fs.readFileSync(`laporan/data/${phase}/${base}-trace-summary.json`));
  const row={run,inp:d.metrics.inp??null,longTaskMs:d.metrics.longTaskTerlama??null,cls:t.traceCLS,orders:Number(d.metrics.orders),slowFrames10s:t.slowFrames10s,mainTaskBusyPercent10s:t.mainTaskBusyPercent10s};
  if(s===0) {
   const ev=JSON.parse(zlib.gunzipSync(fs.readFileSync(`laporan/trace/${base}.json.gz`))).traceEvents;
   const root=ev.find(e=>e.name==='ResourceSendRequest'&&e.args.data.url.includes('/js/'))?.args.data.frame;
   const dom=ev.find(e=>e.name==='domContentLoadedEventEnd'&&e.args.frame===root)?.ts/1e6;
   const nav=d.requested.find(r=>r.type==='Document').start;
   const images=d.requested.filter(r=>r.url.includes('/img/p/'));
   row.imageRequests10sAfterDOM=images.filter(r=>r.start<=dom+10).length;
   row.imageRequests10sFromNavigation=images.filter(r=>r.start<=nav+10).length;
   row.imageRequests=images.length;row.domContentLoadedS=dom-nav;
   const completed=d.network.filter(r=>r.url.includes('/img/p/'));
   row.lastObservedImageEndS=Math.max(...completed.map(r=>r.end-nav));row.completedImages=completed.length;row.imageBytes=completed.reduce((n,r)=>n+r.bytes,0);
   row.apiMs=d.network.find(r=>r.url.endsWith('/api/produk'))?.durationMs;
  }
  rows.push(row);
 }
 const medians={};for(const k of Object.keys(rows[0]||{}).filter(k=>k!=='run')){const values=rows.map(r=>r[k]).filter(n=>Number.isFinite(n));medians[k]=values.length?median(values):null;}
 result[scenario]={runs:rows,median:medians};
}
fs.writeFileSync(`laporan/data/${phase}/summary.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(result).map(([k,v])=>[k,v.median])),null,2));
