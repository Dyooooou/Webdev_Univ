// Read original Chrome trace events; never synthesize timings.
const fs = require('node:fs');
const zlib = require('node:zlib');
const phase=process.argv[2]||'before';
for(const name of fs.readdirSync('laporan/trace').filter(n=>n.startsWith(phase+'-')&&n.endsWith('.json.gz'))) {
 const trace=JSON.parse(zlib.gunzipSync(fs.readFileSync('laporan/trace/'+name)));
 const events=trace.traceEvents;
 const threads=events.filter(e=>e.name==='thread_name'&&e.args.name==='CrRendererMain');
 const thread=threads.map(t=>({t,count:events.filter(e=>e.pid===t.pid&&e.tid===t.tid&&e.name.endsWith('RunTask')).length})).sort((a,b)=>b.count-a.count)[0]?.t;
 if(!thread) continue;
 const main=require('./trace-events.cjs')(events.filter(e=>e.pid===thread.pid&&e.tid===thread.tid));
 const totals={};
 for(const e of main) if(e.ph==='X'&&e.dur) {const x=totals[e.name] ||= {count:0,totalMs:0,maxMs:0};x.count++;x.totalMs+=e.dur/1000;x.maxMs=Math.max(x.maxMs,e.dur/1000);}
 const functions={};
 const profiles=events.filter(e=>e.pid===thread.pid&&e.name==='ProfileChunk');
 for(const e of profiles) {const p=e.args.data.cpuProfile; if(p?.nodes) for(const n of p.nodes) functions[n.id]=n.callFrame;}
 const samples={};
 for(const e of profiles) {const d=e.args.data;const p=d.cpuProfile; if(p?.samples) p.samples.forEach((id,i)=>{const f=functions[id];if(f) {const k=f.functionName+' @ '+f.url+':'+(f.lineNumber+1);samples[k]=(samples[k]||0)+(d.timeDeltas?.[i]||0)/1000;}});}
 const start=Math.min(...main.filter(e=>e.ts>0).map(e=>e.ts));
 const frames=main.filter(e=>e.name==='FireAnimationFrame'&&e.ts>=start&&e.ts<=start+1e7).sort((a,b)=>a.ts-b.ts);
 let slowFrames=0;for(let i=1;i<frames.length;i++)if(frames[i].ts-frames[i-1].ts>50000)slowFrames++;
 let cls=0,session=0,last=0,first=0;const shifts=events.filter(e=>e.pid===thread.pid&&e.name==='LayoutShift'&&!e.args.data.had_recent_input).sort((a,b)=>a.ts-b.ts);
 for(const e of shifts){if(e.ts-last<1e6&&e.ts-first<5e6)session+=e.args.data.score;else{session=e.args.data.score;first=e.ts;}last=e.ts;cls=Math.max(cls,session);}
 const busy=main.filter(e=>e.name==='RunTask'&&e.ts>=start&&e.ts<start+1e7).reduce((n,e)=>n+Math.min(e.dur,start+1e7-e.ts),0)/1e5;
 const summary={source:name,thread:thread.tid,windowStartUs:start,frameWindowMs:10000,slowFrames10s:slowFrames,mainTaskBusyPercent10s:busy,traceCLS:cls,layoutShifts:shifts.map(e=>({ts:e.ts,score:e.args.data.score,nodes:e.args.data.impacted_nodes})),totals,sampledSelfMs:Object.fromEntries(Object.entries(samples).sort((a,b)=>b[1]-a[1]).slice(0,40)),longTasks:main.filter(e=>e.name==='RunTask'&&e.dur>50000).map(e=>({ts:e.ts,durationMs:e.dur/1000})).sort((a,b)=>b.durationMs-a.durationMs).slice(0,20)};
 fs.writeFileSync('laporan/data/'+phase+'/'+name.replace('.json.gz','-trace-summary.json'),JSON.stringify(summary,null,2));
 console.log(name,JSON.stringify({tasks:totals.RunTask,layout:totals.Layout,paint:totals.Paint,top:Object.entries(summary.sampledSelfMs).slice(0,5)}));
}
