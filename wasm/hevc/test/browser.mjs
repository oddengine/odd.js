// Real dedicated-worker WASM smoke test, served locally without the website/backend.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, extname} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const server=createServer(async(req,res)=>{
 try {
  const name=new URL(req.url,'http://localhost').pathname;
  if(name==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><title>HEVC decoder worker check</title>');return;}
  const path=resolve(root,'.'+name);if(!path.startsWith(root))throw Error('Path outside fixture');
  const body=await readFile(path);res.setHeader('content-type',({'.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json'})[extname(path)]||'application/octet-stream');res.end(body);
 }catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={scope:'Chromium dedicated module Worker, real scalar/SIMD WASM, native reference pixel hashes. No Player integration/rendering or mobile performance measurement.',cases:[],errors:[]};
try {
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 for(const variant of ['scalar','simd'])for(const name of ['main','main10']){
  const fixture=JSON.parse(await readFile(new URL(`fixtures/${name}.json`,import.meta.url)));
  const output=await page.evaluate(({variant,fixture})=>new Promise((resolve,reject)=>{
   const worker=new Worker('/test/browser.worker.mjs',{type:'module'});
   const timeout=setTimeout(()=>{worker.terminate();reject(Error('Worker deadline'));},10000);
   function close(){clearTimeout(timeout);worker.terminate();}
   worker.onmessage=({data})=>{close();data.error?reject(Error(data.error)):resolve(data);};
   worker.onerror=event=>{close();reject(Error(event.message));};
   worker.postMessage({variant,fixture});
  }),{variant,fixture});
  assert.deepEqual(output.frames,fixture.expected);report.cases.push({variant,name,frames:output.frames.length,bitExact:true,linearMemoryBytes:output.linearMemoryBytes});
 }
 assert.deepEqual(report.errors,[]);
 if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
