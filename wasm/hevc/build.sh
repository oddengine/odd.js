#!/usr/bin/env bash
# FFmpeg 7.0.1 -> standalone HEVC decoder. Never modifies the supplied sources.
set -euo pipefail

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
project=$(cd -- "$root/../.." && pwd)
image='emscripten/emsdk:3.1.64@sha256:8847dad4171ebc8a53d9ae5cda86a2546ef5b2e68834c14dc1ba2b2962e125cc'
archive_sha='8dab1da0c7ebccb2dce99265901f22ac40f8e0fbbe4a89a368d7645f2e79caa0'

if [[ ${1:-} != --local ]]; then
    source_path=$(realpath -- "${1:-$root/vendor/ffmpeg-n7.0.1.tar.gz}")
    [[ -e "$source_path" ]] || { echo 'FFmpeg source directory or tar archive is required.' >&2; exit 1; }
    command -v docker >/dev/null || { echo 'Install Docker, or run build.sh --local SOURCE with Emscripten 3.1.64 on PATH.' >&2; exit 1; }
    docker image inspect "$image" >/dev/null 2>&1 || docker pull --platform linux/amd64 "$image"
    mkdir -p "$project/.build/hevc"
    exec docker run --rm --platform linux/amd64 --network none \
        --user "$(id -u):$(id -g)" \
        --mount "type=bind,src=$project,dst=/project" \
        --mount "type=bind,src=$source_path,dst=/ffmpeg-input,readonly" \
        --env EM_CACHE=/project/.build/hevc/emscripten-cache \
        --env "ODD_HEVC_JOBS=${ODD_HEVC_JOBS:-4}" \
        --entrypoint /bin/bash "$image" /project/wasm/hevc/build.sh --local /ffmpeg-input
fi

source_path=$(realpath -- "${2:?Usage: build.sh --local FFMPEG_SOURCE}")
work="$project/.build/hevc"
[[ "$project" != *[[:space:]]* ]] || { echo 'FFmpeg local builds require a project path without whitespace; use the Docker entry instead.' >&2; exit 1; }
mkdir -p "$work" "$root/dist"
if [[ ${EM_CACHE:-} == "$work/emscripten-cache" && ! -d "$EM_CACHE/sysroot" ]]; then
    mkdir -p "$EM_CACHE"
    cp -a /emsdk/upstream/emscripten/cache/. "$EM_CACHE/"
fi
version=$(emcc --version | head -1)
[[ "$version" == *' 3.1.64 '* ]] || { echo "Expected Emscripten 3.1.64; found $version" >&2; exit 1; }
export SOURCE_DATE_EPOCH=1716595200
stage=$(mktemp -d "$work/source.XXXXXX")
trap 'rm -rf -- "$stage"' EXIT

if [[ -d "$source_path" ]]; then
    tar -C "$source_path" --exclude=.git --exclude='*.o' --exclude='*.a' --exclude='*.so*' -cf - . | tar -C "$stage" -xf -
    if [[ -f "$stage/config.h" ]]; then
        make -s -C "$stage" "SRC_PATH=$stage" "SRC_LINK=$stage" distclean
    fi
    source_hash=custom-directory
else
    source_hash=$(sha256sum "$source_path" | cut -d ' ' -f 1)
    [[ "$source_hash" == "$archive_sha" ]] || { echo 'Expected the pinned, unmodified FFmpeg n7.0.1 source archive. Supply a directory for a local modified build.' >&2; exit 1; }
    tar -C "$stage" --strip-components=1 -xf "$source_path"
fi
[[ $(cat "$stage/RELEASE") == 7.0.1 ]] || { echo 'This decoder requires FFmpeg 7.0.1 sources.' >&2; exit 1; }

exports='["_odd_hevc_create","_odd_hevc_packet","_odd_hevc_send","_odd_hevc_drain","_odd_hevc_receive","_odd_hevc_frame","_odd_hevc_plane","_odd_hevc_stride","_odd_hevc_release","_odd_hevc_flush","_odd_hevc_destroy","_odd_hevc_error","_odd_hevc_error_string","_malloc","_free"]'
for variant in scalar simd; do
    build="$work/$variant"
    # FFmpeg dependency files contain source paths; each build has its own source copy.
    rm -rf -- "$build"
    mkdir -p "$build"
    flags="-O3 -fno-ident -ffile-prefix-map=$stage=ffmpeg -ffile-prefix-map=$project=odd.js"
    [[ "$variant" != simd ]] || flags+=' -msimd128'
    (
        cd "$build"
        emconfigure "$stage/configure" \
            --cc=emcc --cxx=em++ --ar=emar --ranlib=emranlib --nm=emnm \
            --arch=wasm32 --cpu=generic --target-os=none --enable-cross-compile \
            --disable-autodetect --disable-everything --disable-programs --disable-doc \
            --disable-network --disable-pthreads --disable-w32threads --disable-os2threads \
            --disable-asm --disable-inline-asm --disable-x86asm --disable-runtime-cpudetect \
            --disable-avformat --disable-avdevice --disable-avfilter --disable-postproc \
            --disable-swresample --disable-swscale --disable-iconv --disable-logging \
            --disable-debug --disable-stripping --disable-shared --enable-static \
            --enable-avcodec --enable-avutil --enable-decoder=hevc \
            --extra-cflags="$flags" --extra-ldflags="$flags" > configure.log 2>&1
        emmake make -j "${ODD_HEVC_JOBS:-4}" libavcodec/libavcodec.a libavutil/libavutil.a > make.log 2>&1
        # Intentionally word-split compiler flags assembled only from our fixed paths/flags.
        read -r -a compiler_flags <<< "$flags"
        emcc "${compiler_flags[@]}" "$root/decoder.c" -I"$stage" -I"$build" \
            libavcodec/libavcodec.a libavutil/libavutil.a \
            -s MODULARIZE=1 -s EXPORT_ES6=1 -s EXPORT_NAME=createOddHevc \
            -s ENVIRONMENT=web,worker,node -s FILESYSTEM=0 \
            -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=67108864 -s MAXIMUM_MEMORY=536870912 \
            -s STACK_SIZE=2097152 -s ABORTING_MALLOC=0 -s MALLOC=emmalloc \
            -s "EXPORTED_FUNCTIONS=$exports" -o "$root/dist/odd.hevc.$variant.mjs"
    )
done
chmod 644 "$root"/dist/odd.hevc.*

python3 - "$root" "$version" "$source_hash" "$image" <<'PY'
import hashlib, json, pathlib, sys
root=pathlib.Path(sys.argv[1])
files={p.name: {'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted((root/'dist').glob('odd.hevc.*'))}
manifest={'ffmpeg':'7.0.1','emscripten':sys.argv[2],'image':sys.argv[4],
 'sourceArchive':'../vendor/ffmpeg-n7.0.1.tar.gz','sourceSHA256':sys.argv[3],
 'license':'LGPL-2.1-or-later','decoders':['hevc'],'threads':1,
 'initialMemoryBytes':67108864,'maximumMemoryBytes':536870912,'files':files}
(root/'dist/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
PY
echo "Built scalar/SIMD HEVC decoders in $root/dist (not yet wired into Player)."
