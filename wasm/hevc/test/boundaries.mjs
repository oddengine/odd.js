import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url));
const server=createServer(async(req,res)=>{
 try{
 let name=new URL(req.url,'http://localhost').pathname,slow=name.startsWith('/slow/');
 if(name==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><script src="/release/odd.common.min.js"></script><script src="/release/odd.player.min.js"></script>');return;}
 if(slow)name='/release/wasm/hevc/'+name.slice(6);
 const path=resolve(root,'.'+name);if(!path.startsWith(root))throw Error('Bad path');
 let data=await readFile(path);
 if(slow&&name.endsWith('worker.js'))data=Buffer.from(data.toString().replace('const start = performance.now();','const start = performance.now(); while (performance.now() - start < 200) {}'));
 res.setHeader('content-type',({'.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json'})[extname(path)]||'application/octet-stream');res.end(data);
 }catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const report={parsing:null,cases:[]};
try{
 const page=await browser.newPage();page.on('pageerror',e=>console.error('PAGE',e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);
 report.parsing=await page.evaluate(async()=>{
  const AV=odd.AV, F=AV.Format.FMP4, errors=[], quiet={log(){},debug(){},warn(){},error(){}};
  const raw=new Uint8Array(await (await fetch('/wasm/hevc/test/fixtures/playback/av.mp4')).arrayBuffer());
  const counts=[];
  for(const quantum of [1,7,257,65536]){
   const format=new F(quiet,{streaming:true});let parser,video=0,audio=0,cts=false;
   format.addEventListener('error',e=>errors.push(e.data));
   format.addEventListener('packet',e=>{const packet=e.data.packet;if(packet.get('Type')==='moov')parser=new F.Samples(packet.get('Tracks'),sample=>{if(sample.track.kind==='video'){video++;cts ||= sample.pts!==sample.dts;}else audio++;});parser?.append(packet);});
   for(let n=0;n<raw.length;n+=quantum)format.append(raw.slice(n,n+quantum).buffer);
   counts.push({quantum,video,audio,cts,complete:format.complete()&&parser.complete()});
  }
  // Extended mdat headers change trun offsets; also exercise signed CTS.
  const parts=[];let negativeCTS=false;
  for(let offset=0;offset<raw.length;){
   const length=new DataView(raw.buffer).getUint32(offset),part=raw.slice(offset,offset+length),type=String.fromCharCode(...part.subarray(4,8));
   if(type==='moof'){
    function runs(begin,end){const view=new DataView(part.buffer);for(let p=begin;p<end;){const size=view.getUint32(p),kind=String.fromCharCode(...part.subarray(p+4,p+8));if(kind==='traf')runs(p+8,p+size);if(kind==='trun'){const flags=view.getUint32(p+8)&0xffffff;let cursor=p+16;if(flags&1){view.setInt32(cursor,view.getInt32(cursor)+8);cursor+=4;}if(flags&4)cursor+=4;if(flags&0x800){part[p+8]=1;cursor+=(flags&0x100?4:0)+(flags&0x200?4:0)+(flags&0x400?4:0);view.setInt32(cursor,-2048);}}p+=size;}}
    runs(8,part.length);parts.push(part);
   }else if(type==='mdat'){
    const header=new Uint8Array(16),view=new DataView(header.buffer);view.setUint32(0,1);header.set(part.subarray(4,8),4);view.setUint32(12,length+8);parts.push(header,part.subarray(8));
   }else parts.push(part);offset+=length;
  }
  const extended=F.merge(...parts),format=new F(quiet,{streaming:true});let extendedParser,extendedCount=0,recordTracks,recordFragment,recordBodies=0;
  format.addEventListener('error',e=>errors.push(e.data));
  format.addEventListener('packet',e=>{const packet=e.data.packet,type=packet.get('Type');if(type==='moov'){recordTracks=F.recordingTracks(packet.payload);extendedParser=new F.Samples(packet.get('Tracks'),sample=>{extendedCount++;negativeCTS ||= sample.pts<sample.dts;});}if(type==='moof')recordFragment={header:packet.payload,layout:F.recordingFragment(packet.payload,recordTracks)};if(type==='mdat'&&packet.get('Offset')<packet.get('BodyOffset')){F.recordingBody(recordFragment.header,packet.payload,recordFragment.layout.ranges,packet.length);recordBodies++;}extendedParser?.append(packet);});
  for(let n=0;n<extended.length;n+=11)format.append(extended.slice(n,n+11).buffer);
  const fixture=await(await fetch('/wasm/hevc/test/fixtures/main.json')).json();
  const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  function packet(type,data,timestamp,cts){const p=new AV.Packet();p.payload=data;p.position=0;p.timestamp=timestamp;p.set('DataType',type);p.set('CTS',cts);return p;}
  const cra=fixture.packets.findIndex(p=>p.nalTypes.includes(21));
  const samples=[];const codec=new AV.Codec.HEVC(new AV.Information(),quiet);codec.addEventListener('hevcsample',e=>samples.push({pts:e.data.packet.get('PTS'),meta:e.data.packet.get('HEVC')}));
  codec.parse(packet(0,decode(fixture.config),0,0));
  for(const p of fixture.packets.slice(cra))codec.parse(packet(1,decode(p.data),p.dts+250,p.pts-p.dts));
  // Malformed metadata must be a single explicit parser error, not a huge allocation.
  const invalid=new F(quiet,{streaming:true});let rejected=0;invalid.addEventListener('error',()=>rejected++);invalid.append(new Uint8Array([255,255,255,255,109,111,111,118]).buffer);
  const canvas=document.createElement('canvas'),renderer=new AV.YUV(canvas), colors=[];
  for(const depth of [8,10])for(const white of [false,true]){
   const data=depth===8?new Uint8Array([white?235:16,white?235:16,white?235:16,white?235:16,128,128]):new Uint16Array([white?940:64,white?940:64,white?940:64,white?940:64,512,512]);
   renderer.draw({buffer:data.buffer,width:2,height:2,depth,range:1,space:1});const gl=canvas.getContext('webgl2'),pixel=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);colors.push({depth,white,pixel:Array.from(pixel)});
  }renderer.destroy();
  return {counts,errors,extendedCount,negativeCTS,recordBodies,extendedComplete:format.complete()&&extendedParser.complete(),cra,recoverySamples:samples.length,raslAfterRecovery:samples.some(s=>s.meta.rasl&&s.pts<fixture.packets[cra].pts+250),continuousRasl:samples.some(s=>s.meta.rasl),rejected,colors};
 });
 for(const config of [{name:'one-frame',maxFrameBytes:23040},{name:'slow',url:'/slow/'},{name:'live',mode:'live',maxBufferLength:1.1,maxPlaybackLength:1},{name:'missing-decoder',url:'/missing/',error:true},{name:'tiny-frame-budget',maxFrameBytes:100,error:true}]){
  const result=await page.evaluate(async settings=>{
   const fixture=await(await fetch('/wasm/hevc/test/fixtures/main.json')).json(),decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
   const container=document.createElement('div'),native=document.createElement('video');document.body.append(container);native.muted=true;
   const options={bufferLength:.5,maxBufferLength:4,maxPlaybackLength:2,mode:'vod',hevc:{url:'/release/wasm/hevc/',mode:'wasm',...settings}};
   if(settings.mode)options.mode=settings.mode;if(settings.maxBufferLength)options.maxBufferLength=settings.maxBufferLength;if(settings.maxPlaybackLength)options.maxPlaybackLength=settings.maxPlaybackLength;
   delete options.hevc.mode;const events=[],stats=[];let count=0;
   const player=new odd.AV.HEVCPlayback(container,native,options,{log(){},debug(){},warn(){},error(){}});
   player.addGlobalListener(e=>{if(e.type==='statschange')stats.push(e.data.stats);else events.push({type:e.type,data:e.data});});
   player.configure({config:decode(fixture.config)},false);player.activate(0,true);
   for(const packet of fixture.packets){const data=decode(packet.data);player.append({track:{kind:'video'},data,dts:packet.dts/1000,pts:packet.pts/1000,duration:packet.duration/1000,...odd.AV.Codec.HEVC.inspect(data,4)});}
   player.end();await new Promise(r=>setTimeout(r,settings.name==='slow'?8500:3800));
   const result={name:settings.name,stats,events:events.filter(e=>e.type!=='timeupdate'),time:player.position().time,frame:!!player.frame()};player.destroy();result.cleaned=container.children.length===0;container.remove();return result;
  },config);
  report.cases.push(result);
 }
 await writeFile('/tmp/hevc-boundaries-report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,cases:report.cases.map(c=>({...c,stats:c.stats.slice(-1)}))},null,2));
 assert.deepEqual(report.parsing.errors,[]);assert.equal(report.parsing.extendedCount,221);assert.ok(report.parsing.extendedComplete&&report.parsing.negativeCTS&&report.parsing.recordBodies>=4);assert.ok(report.parsing.counts.every(c=>c.video===32&&c.audio>180&&c.cts&&c.complete));assert.ok(report.parsing.recoverySamples>5);assert.equal(report.parsing.raslAfterRecovery,false);assert.equal(report.parsing.rejected,1);
 for(const color of report.parsing.colors)assert.ok(color.pixel.slice(0,3).every(v=>Math.abs(v-(color.white?255:0))<=1),'YUV range');
 for(const c of report.cases){assert.ok(c.cleaned,'all resources released');if(['missing-decoder','tiny-frame-budget'].includes(c.name)){assert.equal(c.events.filter(e=>e.type==='error').length,1);continue;}assert.ok(!c.events.some(e=>e.type==='error'));assert.ok(c.frame);assert.equal(c.events.filter(e=>e.type==='ended').length,1);assert.ok(c.stats.every(s=>s.ReadyFrames<=3));}
 assert.ok(report.cases.find(c=>c.name==='one-frame').stats.every(s=>s.ReadyFrameBytes<=23040));
 const slow=report.cases.find(c=>c.name==='slow');assert.ok(slow.stats.some(s=>s.DegradationLevel===2),'keyframe-only degradation');assert.ok(slow.stats.some(s=>s.DependencyDroppedFrames>0),'dependency-safe drop');
 assert.ok(report.cases.find(c=>c.name==='live').stats.some(s=>s.LiveCatchups>0),'live catchup');
}finally{await browser.close();await new Promise(r=>server.close(r));}
