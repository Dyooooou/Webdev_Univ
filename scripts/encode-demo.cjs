const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const ffmpeg=require('../.tools/node_modules/ffmpeg-static'),ffprobe=require('../.tools/node_modules/ffprobe-static').path;
const root=process.cwd(),tmp=path.resolve('.capture-tmp'),records=JSON.parse(fs.readFileSync('.capture-tmp/recordings.json'));
const run=args=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{cwd:tmp,stdio:'inherit'});
const labels={S1:'Ketik sepatu, lalu hapus | Pencarian dan respons input',S2:'Satu klik + Keranjang | Lihat umpan balik dan jumlah',S3:'Tiga klik cepat Beli sekarang | Sebelum: 3 pesanan; sesudah: 1',S4:'Pakai KILAT1212 dan ketik | Perhitungan voucher dan progres',S5:'Gulir terus 10 detik | Kelancaran daftar produk'};
let offset=0;const chapters=[],clips=[];
for(const r of records)for(let i=0;i<r.chapters.length;i++){
 const c=r.chapters[i],sourceEnd=r.chapters[i+1]?.time??r.end,duration=sourceEnd-c.time,speed=Math.max(1,duration/35),clip=`${r.phase}-${c.scenario}.mp4`;
 // Trim only setup/reset before the first chapter. Preserve all action time;
 // long chapters are explicitly accelerated, short chapters remain real time.
 run(['-ss',String(c.time),'-i',path.resolve(r.video),'-t',String(duration/speed),'-vf',`setpts=(PTS-STARTPTS)/${speed},fps=25,pad=1280:1024:434:16:color=0x11182b`,'-an','-c:v','libx264','-preset','fast','-crf','25','-pix_fmt','yuv420p',clip]);
 clips.push(clip);chapters.push({phase:r.phase,scenario:c.scenario,sourceStart:c.time,sourceEnd,speed,start:offset,end:offset+duration/speed,caption:`${r.phase==='before'?'SEBELUM':'SESUDAH'} | ${c.scenario} | CPU 4x | 1500 produk | Video ${speed.toFixed(2)}x\n${labels[c.scenario]}`});offset+=duration/speed;
}
const timestamp=s=>{const ms=Math.round(s*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
const srt=chapters.map((c,i)=>`${i+1}\n${timestamp(c.start)} --> ${timestamp(c.end)}\n${c.caption}\n`).join('\n');fs.writeFileSync(path.join(tmp,'demo.srt'),srt);fs.writeFileSync(path.join(tmp,'concat.txt'),clips.map(f=>`file '${f}'`).join('\n')+'\n');
const assTime=s=>timestamp(s).slice(1,-1).replace(',','.');
const ass='[Script Info]\nScriptType: v4.00+\nPlayResX: 1280\nPlayResY: 1024\nWrapStyle: 2\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,26,&H00FFFFFF,&H00FFFFFF,&H0011182B,&H0011182B,0,0,0,0,100,100,0,0,1,1,0,2,20,20,18,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'+chapters.map(c=>`Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Default,,0,0,0,,${c.caption.replace('\n','\\N')}`).join('\n');
fs.writeFileSync(path.join(tmp,'demo.ass'),ass);
run(['-f','concat','-safe','0','-i','concat.txt','-vf','ass=demo.ass','-an','-c:v','libx264','-preset','fast','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',path.join(root,'demo/demo.mp4')]);
const verification=JSON.parse(execFileSync(ffprobe,['-v','error','-count_frames','-show_entries','format=duration,size:stream=codec_name,width,height,nb_read_frames,r_frame_rate','-of','json',path.join(root,'demo/demo.mp4')],{encoding:'utf8'}));
run(['-i',path.join(root,'demo/demo.mp4'),'-f','null','-']);
if(Number(verification.format.duration)>180)throw Error('video exceeds 3 minutes');
verification.decodeCheck='ffmpeg full decode: exit 0';verification.speeds=chapters.map(c=>({phase:c.phase,scenario:c.scenario,speed:c.speed}));verification.cpuRate=4;verification.orders=records.map(r=>({phase:r.phase,count:r.orders}));
fs.writeFileSync('demo/verification.json',JSON.stringify(verification,null,2));fs.writeFileSync('demo/chapters.json',JSON.stringify(chapters,null,2));fs.writeFileSync('demo/demo.srt',srt);
fs.mkdirSync(path.join(tmp,'frames'),{recursive:true});
for(const c of chapters)for(const [suffix,time] of [['',(c.start+c.end)/2],['-end',c.end-.3]])run(['-ss',String(time),'-i',path.join(root,'demo/demo.mp4'),'-frames:v','1',path.join(tmp,'frames',`${c.phase}-${c.scenario}${suffix}.png`)]);
console.log(JSON.stringify(verification,null,2));
