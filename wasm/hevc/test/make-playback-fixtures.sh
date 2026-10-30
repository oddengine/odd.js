#!/usr/bin/env bash
set -euo pipefail
ffmpeg_bin=${FFMPEG:-ffmpeg}
fixture_dir="$(cd -- "$(dirname -- "$0")" && pwd)/fixtures/playback"
mkdir -p "$fixture_dir"
# Synthetic source only: 4 s / 8 fps, open GOP with B pictures and AAC audio.
"$ffmpeg_bin" -hide_banner -loglevel error -y -f lavfi -i testsrc2=size=160x96:rate=8 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 4 -c:v libx265 -x265-params 'log-level=error:pools=1:frame-threads=1:keyint=8:min-keyint=8:scenecut=0:open-gop=1:bframes=2:b-adapt=0' -c:a aac -tag:v hvc1 -movflags empty_moov+default_base_moof+frag_keyframe "$fixture_dir/av.mp4"
"$ffmpeg_bin" -hide_banner -loglevel error -y -i "$fixture_dir/av.mp4" -c copy -f flv "$fixture_dir/av.flv"
"$ffmpeg_bin" -hide_banner -loglevel error -y -i "$fixture_dir/av.mp4" -c:a copy -c:v libx265 -pix_fmt yuv420p10le -x265-params 'log-level=error:pools=1:frame-threads=1:keyint=8:bframes=2' -tag:v hvc1 -movflags empty_moov+default_base_moof+frag_keyframe "$fixture_dir/main10.mp4"
"$ffmpeg_bin" -hide_banner -loglevel error -y -i "$fixture_dir/av.mp4" -c:a copy -c:v libx264 -g 8 -bf 2 -movflags empty_moov+default_base_moof+frag_keyframe "$fixture_dir/avc.mp4"
# Same access units in the legacy CodecID 12 envelope.
python3 - "$fixture_dir" <<'PY'
from pathlib import Path
import sys
root = Path(sys.argv[1]); data = (root / 'av.flv').read_bytes()
output = bytearray(data[:13]); offset = 13
while offset < len(data):
    header = bytearray(data[offset:offset + 11]); size = int.from_bytes(header[1:4], 'big')
    payload = data[offset + 11:offset + 11 + size]; offset += 15 + size
    if header[0] == 9 and payload[0] & 128:
        kind = payload[0] & 15
        if kind == 4: continue
        prefix = bytes([(payload[0] & 112) | 12, 1 if kind == 3 else kind])
        payload = prefix + (payload[5:8] if kind == 1 else b'\0\0\0') + payload[8 if kind == 1 else 5:]
    header[1:4] = len(payload).to_bytes(3, 'big')
    output.extend(header + payload + (len(payload) + 11).to_bytes(4, 'big'))
(root / 'legacy.flv').write_bytes(output)
PY

"$ffmpeg_bin" -hide_banner -loglevel error -y -i "$fixture_dir/avc.mp4" -c copy -f flv "$fixture_dir/avc.flv"
