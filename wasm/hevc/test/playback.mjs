// End-to-end local playback. Generate .build/playback/av.mp4 and av.flv with FFmpeg first.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url));
const server=createServer(async(req,res)=>{
 try{
 const name=new URL(req.url,'http://localhost').pathname;
 if(name==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><body><div id="player" style="width:480px;height:270px"></div><script src="/release/odd.common.min.js"></script><script src="/release/odd.player.min.js"></script>');return;}
 const path=resolve(root,'.'+name);if(!path.startsWith(root))throw Error('Bad path');
 const data=await readFile(path);res.setHeader('content-type',({'.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm'})[extname(path)]||'application/octet-stream');res.end(data);
 }catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const report=[];
try {
 for(const scenario of [{type:'FLV',name:'av.flv',mode:'auto'},{type:'FLV',name:'legacy.flv',mode:'wasm'},{type:'FMP4',name:'av.mp4',mode:'wasm'},{type:'FMP4',name:'main10.mp4',mode:'wasm'},{type:'FMP4',name:'av.mp4',mode:'auto',nativeFailure:true},{type:'FMP4',name:'avc.mp4',mode:'auto'},{type:'FLV',name:'avc.flv',mode:'auto'}]){
  const page=await browser.newPage();let assets=0;page.on('request',req=>{if(req.url().endsWith('.wasm'))assets++;});page.on('pageerror',e=>console.error('PAGE',e.message));
  page.on('console',m=>{if(m.type()==='error') console.error('CONSOLE',m.text().slice(0,400));});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const result=await page.evaluate(async({type,name,mode,nativeFailure})=>{
   if(nativeFailure){const supported=MediaSource.isTypeSupported.bind(MediaSource);MediaSource.isTypeSupported=mime=>/hvc1|hev1/.test(mime)||supported(mime);}
   const api=odd.player(), events=[],stats=[];let seenFrame=null;window.api=api;
   api.addGlobalListener(e=>{if(['error','ended','playing','waiting','seeked','timeupdate'].includes(e.type)){events.push({type:e.type,data:e.data});}if(e.type==='statschange'){stats.push(e.data.stats);const f=api.frame?.();if(f)seenFrame={width:f.width,height:f.height};}});
   await api.setup(document.querySelector('#player'),{autoplay:true,muted:true,retry:{count:0},hevc:{mode},playlist:[{type,vod:true,sources:[{url:location.origin+'/wasm/hevc/test/fixtures/playback/'+name}]}]});
   await new Promise(r=>setTimeout(r,1700));
   const beforePause=api.position().time;api.pause();await new Promise(r=>setTimeout(r,200));
   const pauseDelta=Math.abs(api.position().time-beforePause);
   api.seek(.65);api.seek(1.35);await new Promise(r=>setTimeout(r,300));
   const pausedSeek=api.position().time, screenshot=api.capture();api.play();
   await new Promise(r=>setTimeout(r,4400));
   const frame=api.frame(),result={type,name,nativeFailure:!!nativeFailure,pauseDelta,pausedSeek,screenshot:!!screenshot,seenFrame,events,stats:stats.filter(s=>s.Backend),position:api.position(),frame:frame?{width:frame.width,height:frame.height}:null,canvas:document.querySelectorAll('canvas').length};
   api.destroy();return result;
  },scenario);
  result.wasmLoads=assets;if(scenario.name.startsWith('avc.'))assert.equal(assets,0,'AVC must not load WASM');report.push(result);await page.close();
 }
 await writeFile('/tmp/hevc-playback-report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report.map(r=>({...r,events:r.events.filter(e=>e.type!=='timeupdate'),stats:r.stats.slice(-2)})),null,2));
 for(const result of report){assert.ok(result.seenFrame,'decoded frame');assert.ok(result.pauseDelta<.12,'pause freezes clock');assert.ok(result.pausedSeek>=1.3&&result.pausedSeek<1.6,'last seek wins');assert.ok(result.screenshot,'capture');assert.ok(result.stats.every(s=>s.ReadyFrames<=3),'bounded output');assert.ok(result.events.some(e=>e.type==='ended'),'ended');assert.ok(!result.events.some(e=>e.type==='error'),'no error');}
}finally{await browser.close();await new Promise(r=>server.close(r));}
