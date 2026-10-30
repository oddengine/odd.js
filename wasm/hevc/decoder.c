/* SPDX-License-Identifier: LGPL-2.1-or-later */
#include "decoder.h"

#include <errno.h>
#include <math.h>
#include <string.h>
#include <libavcodec/avcodec.h>
#include <libavutil/error.h>
#include <libavutil/imgutils.h>
#include <libavutil/mem.h>
#include <libavutil/pixdesc.h>

struct OddHEVC {
    AVCodecContext *codec;
    AVPacket *packet;
    AVFrame *frame;
    int max_packet_bytes;
    int pending;
    int held;
    int draining;
    int error;
};

static int create_error;

static int status(OddHEVC *decoder, int error) {
    decoder->error = error;
    if (error == AVERROR(EAGAIN)) { return ODD_HEVC_AGAIN; }
    if (error == AVERROR_EOF) { return ODD_HEVC_EOF; }
    return error < 0 ? error : ODD_HEVC_OK;
}

OddHEVC *odd_hevc_create(const uint8_t *config, int size, int max_pixels, int max_packet_bytes) {
    const AVCodec *codec = avcodec_find_decoder(AV_CODEC_ID_HEVC);
    OddHEVC *decoder;
    int error;

    create_error = AVERROR(EINVAL);
    if (size < 0 || size > 1048576 || (size && !config) ||
        max_pixels <= 0 || max_pixels > 16777216 ||
        max_packet_bytes <= 0 || max_packet_bytes > 67108864) { return NULL; }
    if (!codec) { create_error = AVERROR_DECODER_NOT_FOUND; return NULL; }
    decoder = av_mallocz(sizeof(*decoder));
    if (!decoder) { create_error = AVERROR(ENOMEM); return NULL; }
    decoder->codec = avcodec_alloc_context3(codec);
    decoder->packet = av_packet_alloc();
    decoder->frame = av_frame_alloc();
    if (!decoder->codec || !decoder->packet || !decoder->frame) {
        create_error = AVERROR(ENOMEM);
        odd_hevc_destroy(decoder);
        return NULL;
    }
    decoder->max_packet_bytes = max_packet_bytes;
    decoder->codec->thread_count = 1;
    decoder->codec->thread_type = 0;
    decoder->codec->max_pixels = max_pixels;
    decoder->codec->pkt_timebase = (AVRational){ 1, 1000000 };
    decoder->codec->err_recognition = AV_EF_CAREFUL | AV_EF_EXPLODE;
    if (size) {
        decoder->codec->extradata = av_mallocz(size + AV_INPUT_BUFFER_PADDING_SIZE);
        if (!decoder->codec->extradata) {
            create_error = AVERROR(ENOMEM);
            odd_hevc_destroy(decoder);
            return NULL;
        }
        memcpy(decoder->codec->extradata, config, size);
        decoder->codec->extradata_size = size;
    }
    error = avcodec_open2(decoder->codec, codec, NULL);
    if (error < 0) {
        create_error = error;
        odd_hevc_destroy(decoder);
        return NULL;
    }
    create_error = 0;
    return decoder;
}

uint8_t *odd_hevc_packet(OddHEVC *decoder, int size) {
    int error;
    if (!decoder) { return NULL; }
    if (decoder->pending || decoder->draining) { decoder->error = AVERROR(EBUSY); return NULL; }
    if (size <= 0 || size > decoder->max_packet_bytes) { decoder->error = AVERROR(EINVAL); return NULL; }
    error = av_new_packet(decoder->packet, size);
    decoder->error = error;
    if (error < 0) { return NULL; }
    decoder->pending = 1;
    return decoder->packet->data;
}

static int timestamp(double value, int64_t *result) {
    /* Preserve exact integer microseconds, reject infinity/unsafe conversion. */
    if (isnan(value)) { *result = AV_NOPTS_VALUE; return 0; }
    if (!isfinite(value) || fabs(value) > 9007199254740.0) { return AVERROR(EINVAL); }
    *result = (int64_t)llrint(value * 1000.0);
    return 0;
}

int odd_hevc_send(OddHEVC *decoder, double pts, double dts, double duration) {
    int error;
    if (!decoder) { return AVERROR(EINVAL); }
    if (!decoder->pending || decoder->draining) { return status(decoder, AVERROR(EINVAL)); }
    if (!isfinite(duration) || duration < 0 ||
        timestamp(pts, &decoder->packet->pts) < 0 ||
        timestamp(dts, &decoder->packet->dts) < 0 ||
        timestamp(duration, &decoder->packet->duration) < 0) { return status(decoder, AVERROR(EINVAL)); }
    error = avcodec_send_packet(decoder->codec, decoder->packet);
    if (error != AVERROR(EAGAIN)) {
        av_packet_unref(decoder->packet);
        decoder->pending = 0;
    }
    return status(decoder, error);
}

int odd_hevc_drain(OddHEVC *decoder) {
    int error;
    if (!decoder) { return AVERROR(EINVAL); }
    if (decoder->pending) { return status(decoder, AVERROR(EBUSY)); }
    if (decoder->draining) { return ODD_HEVC_EOF; }
    error = avcodec_send_packet(decoder->codec, NULL);
    if (error >= 0 || error == AVERROR_EOF) { decoder->draining = 1; }
    return status(decoder, error);
}

int odd_hevc_receive(OddHEVC *decoder) {
    int error;
    if (!decoder) { return AVERROR(EINVAL); }
    if (decoder->held) { return status(decoder, AVERROR(EBUSY)); }
    error = avcodec_receive_frame(decoder->codec, decoder->frame);
    if (error >= 0) { decoder->held = 1; }
    return status(decoder, error);
}

double odd_hevc_frame(OddHEVC *decoder, int field) {
    const AVFrame *frame;
    const AVPixFmtDescriptor *format;
    if (!decoder || !decoder->held) { return NAN; }
    frame = decoder->frame;
    format = av_pix_fmt_desc_get(frame->format);
    switch (field) {
        case ODD_HEVC_WIDTH: return frame->width;
        case ODD_HEVC_HEIGHT: return frame->height;
        case ODD_HEVC_DEPTH: return format ? format->comp[0].depth : 0;
        case ODD_HEVC_CHROMA_WIDTH_SHIFT: return format ? format->log2_chroma_w : 0;
        case ODD_HEVC_CHROMA_HEIGHT_SHIFT: return format ? format->log2_chroma_h : 0;
        case ODD_HEVC_PLANES: return av_pix_fmt_count_planes(frame->format);
        case ODD_HEVC_COLOR_RANGE: return frame->color_range;
        case ODD_HEVC_COLOR_SPACE: return frame->colorspace;
        case ODD_HEVC_COLOR_PRIMARIES: return frame->color_primaries;
        case ODD_HEVC_COLOR_TRC: return frame->color_trc;
        case ODD_HEVC_KEY_FRAME: return !!(frame->flags & AV_FRAME_FLAG_KEY);
        case ODD_HEVC_PTS: return frame->best_effort_timestamp == AV_NOPTS_VALUE ? NAN : frame->best_effort_timestamp / 1000.0;
        case ODD_HEVC_DURATION: return frame->duration / 1000.0;
        case ODD_HEVC_FORMAT:
            switch (frame->format) {
                case AV_PIX_FMT_YUV420P: return ODD_HEVC_YUV420P;
                case AV_PIX_FMT_YUV420P10LE: return ODD_HEVC_YUV420P10LE;
                default: return ODD_HEVC_OTHER;
            }
        default: return NAN;
    }
}

const uint8_t *odd_hevc_plane(OddHEVC *decoder, int plane) {
    if (!decoder || !decoder->held || plane < 0 || plane >= 4) { return NULL; }
    return decoder->frame->data[plane];
}

int odd_hevc_stride(OddHEVC *decoder, int plane) {
    if (!decoder || !decoder->held || plane < 0 || plane >= 4) { return 0; }
    return decoder->frame->linesize[plane];
}

void odd_hevc_release(OddHEVC *decoder) {
    if (!decoder) { return; }
    av_frame_unref(decoder->frame);
    decoder->held = 0;
}

void odd_hevc_flush(OddHEVC *decoder) {
    if (!decoder) { return; }
    avcodec_flush_buffers(decoder->codec);
    av_packet_unref(decoder->packet);
    odd_hevc_release(decoder);
    decoder->pending = decoder->draining = decoder->error = 0;
}

void odd_hevc_destroy(OddHEVC *decoder) {
    if (!decoder) { return; }
    av_frame_free(&decoder->frame);
    av_packet_free(&decoder->packet);
    avcodec_free_context(&decoder->codec);
    av_free(decoder);
}

int odd_hevc_error(const OddHEVC *decoder) {
    return decoder ? decoder->error : create_error;
}

int odd_hevc_error_string(int error, char *buffer, int size) {
    if (!buffer || size <= 0) { return AVERROR(EINVAL); }
    return av_strerror(error, buffer, size);
}
