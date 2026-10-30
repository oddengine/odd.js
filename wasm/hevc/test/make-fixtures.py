#!/usr/bin/env python3
"""Generate tiny, synthetic Main/Main10 open-GOP fixtures with native FFmpeg 7.0.1."""
import argparse, base64, hashlib, json, pathlib, subprocess, tempfile
p=argparse.ArgumentParser();p.add_argument('--ffmpeg',default='ffmpeg');p.add_argument('--ffprobe',default='ffprobe');args=p.parse_args()
out=pathlib.Path(__file__).resolve().parent/'fixtures';out.mkdir(exist_ok=True)
def run(*cmd):return subprocess.check_output(cmd)
def hexdump(value):
 return bytes.fromhex(''.join(line.split(':',1)[1].split('  ',1)[0].replace(' ','') for line in value.strip().splitlines()))
with tempfile.TemporaryDirectory() as work:
 for name,fmt,bits in [('main','yuv420p',8),('main10','yuv420p10le',10)]:
  file=pathlib.Path(work)/(name+'.mp4')
  command=[args.ffmpeg,'-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc2=size=160x96:rate=8','-frames:v','24','-c:v','libx265','-pix_fmt',fmt,'-x265-params','log-level=error:pools=1:frame-threads=1:keyint=8:min-keyint=8:scenecut=0:open-gop=1:bframes=2:b-adapt=0:repeat-headers=0','-tag:v','hvc1',str(file)]
  subprocess.check_call(command)
  info=json.loads(run(args.ffprobe,'-v','error','-show_streams','-show_packets','-show_data','-of','json',str(file)))
  stream=info['streams'][0];packets=[]
  for packet in info['packets']:
   data=hexdump(packet['data']);types=[];pos=0
   while pos<len(data):
    size=int.from_bytes(data[pos:pos+4],'big');types.append((data[pos+4]>>1)&63);pos+=size+4
   packets.append({'pts':float(packet['pts_time'])*1000,'dts':float(packet['dts_time'])*1000,'duration':float(packet['duration_time'])*1000,'nalTypes':types,'data':base64.b64encode(data).decode()})
  assert any(21 in packet['nalTypes'] for packet in packets), 'CRA fixture missing'
  assert any(set(packet['nalTypes'])&{8,9} for packet in packets), 'RASL fixture missing'
  raw=run(args.ffmpeg,'-v','error','-i',str(file),'-pix_fmt',fmt,'-f','rawvideo','-')
  size=160*96*3//2*(2 if bits>8 else 1)
  frames=json.loads(run(args.ffprobe,'-v','error','-show_frames','-select_streams','v','-of','json',str(file)))['frames']
  assert len(raw)==size*len(frames)
  expected=[{'pts':float(frame['best_effort_timestamp_time'])*1000,'sha256':hashlib.sha256(raw[i*size:(i+1)*size]).hexdigest()} for i,frame in enumerate(frames)]
  doc={'source':'Synthetic testsrc2, FFmpeg 7.0.1 + libx265; no external footage.','generator':command[1:-1], 'width':160,'height':96,'depth':bits,'config':base64.b64encode(hexdump(stream['extradata'])).decode(),'packets':packets,'expected':expected}
  (out/(name+'.json')).write_text(json.dumps(doc,indent=2)+'\n')
  print(name,len(packets),'packets',len(frames),'frames',sorted({t for p in packets for t in p['nalTypes']}))
