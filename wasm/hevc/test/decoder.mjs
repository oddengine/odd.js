// Standalone decoder verification. Does not assert Player/FLV/FMP4 integration.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const Field={width:0,height:1,depth:2,cw:3,ch:4,planes:5,range:6,space:7,primaries:8,trc:9,key:10,pts:11,duration:12,format:13};
const report={scope:'Real FFmpeg 7.0.1 WASM decoding; synthetic HEVC Main/Main10 with B frames, CRA/RASL. No Player integration or device performance claim.',results:[]};
for(const variant of ['scalar','simd']) {
 const {default:factory}=await import(new URL(`dist/odd.hevc.${variant}.mjs`,root));
 const mod=await factory({wasmBinary:await readFile(new URL(`dist/odd.hevc.${variant}.wasm`,root)),printErr:()=>{}});
 const formatError=code=>{const p=mod._malloc(256);mod._odd_hevc_error_string(code,p,256);const text=new TextDecoder().decode(mod.HEAPU8.subarray(p,p+256)).split('\0')[0];mod._free(p);return text;};
 function create(config) {const p=mod._malloc(config.length);mod.HEAPU8.set(config,p);const d=mod._odd_hevc_create(p,config.length,16777216,16777216);mod._free(p);assert(d,formatError(mod._odd_hevc_error(0)));return d;}
 for(const name of ['main','main10']) {
  const fixture=JSON.parse(await readFile(new URL(`test/fixtures/${name}.json`,root)));
  const config=Buffer.from(fixture.config,'base64'),decoder=create(config),frames=[];
  let eagain=0,holds=0;
  const frame=()=>{
   assert.equal(mod._odd_hevc_frame(decoder,Field.width),fixture.width);
   assert.equal(mod._odd_hevc_frame(decoder,Field.height),fixture.height);
   assert.equal(mod._odd_hevc_frame(decoder,Field.depth),fixture.depth);
   assert.equal(mod._odd_hevc_frame(decoder,Field.format),fixture.depth===8?1:2);
   const hash=createHash('sha256'),bytes=fixture.depth===8?1:2;
   for(let plane=0;plane<3;plane++) {
    const w=plane?fixture.width/2:fixture.width,h=plane?fixture.height/2:fixture.height;
    const ptr=mod._odd_hevc_plane(decoder,plane),stride=mod._odd_hevc_stride(decoder,plane);
    assert(ptr&&stride>=w*bytes);
    for(let row=0;row<h;row++)hash.update(mod.HEAPU8.subarray(ptr+row*stride,ptr+row*stride+w*bytes));
   }
   const value={pts:mod._odd_hevc_frame(decoder,Field.pts),sha256:hash.digest('hex')};
   assert(mod._odd_hevc_receive(decoder)<0,'Held frame must not be overwritten');holds++;
   assert.equal(mod._odd_hevc_frame(decoder,Field.pts),value.pts);
   mod._odd_hevc_release(decoder);assert(Number.isNaN(mod._odd_hevc_frame(decoder,Field.pts)));
   return value;
  };
  const receive=()=>{for(let i=0;i<64;i++){const r=mod._odd_hevc_receive(decoder);if(r===1||r===2)return r;assert.equal(r,0,formatError(r));frames.push(frame());}throw Error('Unbounded output');};
  const send=packet=>{
   const bytes=Buffer.from(packet.data,'base64'),p=mod._odd_hevc_packet(decoder,bytes.length);assert(p,formatError(mod._odd_hevc_error(decoder)));mod.HEAPU8.set(bytes,p);
   assert.equal(mod._odd_hevc_packet(decoder,8),0,'Pending packet ownership must be retained');
   assert([...mod.HEAPU8.subarray(p+bytes.length,p+bytes.length+64)].every(b=>b===0),'FFmpeg input padding');
   for(let i=0;i<4;i++){const r=mod._odd_hevc_send(decoder,packet.pts,packet.dts,packet.duration);if(r===1){eagain++;receive();continue;}assert.equal(r,0,formatError(r));return;}throw Error('Send stalled');
  };
  const drain=()=>{let r=mod._odd_hevc_drain(decoder);if(r===1){receive();r=mod._odd_hevc_drain(decoder);}assert.equal(r,0,formatError(r));assert.equal(receive(),2);};
  for(const packet of fixture.packets)send(packet);drain();assert.deepEqual(frames,fixture.expected);assert(eagain>0);
  const baseline=mod.HEAPU8.byteLength;
  // Flush discards delayed decoder output and pending/held ownership. Replay stays bounded.
  for(let n=0;n<20;n++) {
   mod._odd_hevc_flush(decoder);frames.length=0;assert.equal(mod._odd_hevc_receive(decoder),1);
   for(const packet of fixture.packets){send(packet);receive();}drain();assert.deepEqual(frames,fixture.expected);
  }
  assert.equal(mod.HEAPU8.byteLength,baseline,'Repeated decode/flush must not grow linear memory');
  mod._odd_hevc_flush(decoder);frames.length=0;
  const firstCRA=fixture.packets.findIndex(p=>p.nalTypes.includes(21));
  assert(firstCRA>0);const anchor=fixture.packets[firstCRA].pts;
  // Explicit RASL suppression belongs to the future packet scheduler. Test its decoder boundary.
  let recovering=true,skipped=0;
  for(const packet of fixture.packets.slice(firstCRA)) {
   const rasl=packet.nalTypes.some(n=>n===8||n===9);
   if(recovering&&rasl){skipped++;continue;}
   if(!packet.nalTypes.includes(21)&&packet.nalTypes.some(n=>n<=31)&&!packet.nalTypes.some(n=>n===6||n===7))recovering=false;
   send(packet);receive();
  }
  drain();assert(skipped>0);assert.deepEqual(frames,fixture.expected.filter(f=>f.pts>=anchor));
  assert.equal(mod._odd_hevc_packet(decoder,8),0,'Drained decoder rejects new packets before flush');
  mod._odd_hevc_flush(decoder);
  assert.equal(mod._odd_hevc_packet(decoder,16777217),0,'Packet byte bound');
  assert.equal(mod._odd_hevc_packet(decoder,0),0,'Empty access unit rejected');
  // Leave a pending packet, then flush and replay; no stale output may survive.
  assert(mod._odd_hevc_packet(decoder,8));mod._odd_hevc_flush(decoder);assert.equal(mod._odd_hevc_receive(decoder),1);
  mod._odd_hevc_destroy(decoder);
  assert.equal(mod._odd_hevc_create(0,0,0,1024),0,'Invalid pixel limit');
  report.results.push({variant,name,frames:fixture.expected.length,bitExact:true,bFrames:true,CRA:anchor,skippedRASL:skipped,sendBackpressure:eagain,frameOwnershipChecks:holds,flushReplayCycles:20,linearMemoryBytes:baseline});
 }
}
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
