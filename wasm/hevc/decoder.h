/* SPDX-License-Identifier: LGPL-2.1-or-later */
#ifndef ODD_HEVC_DECODER_H
#define ODD_HEVC_DECODER_H

#include <stdint.h>

typedef struct OddHEVC OddHEVC;

/* All timestamps are milliseconds. Configuration is hvcC, or empty for Annex B.
 * One decoder belongs to one worker. The caller owns input/output scheduling.
 * These functions do not keep a display queue, clock, network or rendering state.
 */
enum OddHEVCStatus { ODD_HEVC_OK = 0, ODD_HEVC_AGAIN = 1, ODD_HEVC_EOF = 2 };
enum OddHEVCField {
    ODD_HEVC_WIDTH, ODD_HEVC_HEIGHT, ODD_HEVC_DEPTH,
    ODD_HEVC_CHROMA_WIDTH_SHIFT, ODD_HEVC_CHROMA_HEIGHT_SHIFT,
    ODD_HEVC_PLANES, ODD_HEVC_COLOR_RANGE, ODD_HEVC_COLOR_SPACE,
    ODD_HEVC_COLOR_PRIMARIES, ODD_HEVC_COLOR_TRC, ODD_HEVC_KEY_FRAME,
    ODD_HEVC_PTS, ODD_HEVC_DURATION, ODD_HEVC_FORMAT,
};
enum OddHEVCFormat { ODD_HEVC_OTHER = 0, ODD_HEVC_YUV420P = 1, ODD_HEVC_YUV420P10LE = 2 };

OddHEVC *odd_hevc_create(const uint8_t *config, int size, int max_pixels, int max_packet_bytes);

/* Reserves a padded, decoder-owned packet; fill exactly size bytes in WASM memory.
 * A pending packet cannot be replaced. On send AGAIN, receive/release output and
 * retry send with the same packet and timestamps. On OK the input is consumed.
 * Return NULL on error; odd_hevc_error gives the FFmpeg error code.
 */
uint8_t *odd_hevc_packet(OddHEVC *decoder, int size);
int odd_hevc_send(OddHEVC *decoder, double pts, double dts, double duration);
int odd_hevc_drain(OddHEVC *decoder);

/* receive OK owns ONE frame until release. No subsequent receive while held.
 * Plane pointers are valid until release/flush/destroy; reacquire HEAP views
 * after calls that may grow WASM memory. Respect stride and pixel format.
 * The decoder's reference-picture buffer is separate and owned by FFmpeg.
 */
int odd_hevc_receive(OddHEVC *decoder);
double odd_hevc_frame(OddHEVC *decoder, int field);
const uint8_t *odd_hevc_plane(OddHEVC *decoder, int plane);
int odd_hevc_stride(OddHEVC *decoder, int plane);
void odd_hevc_release(OddHEVC *decoder);
void odd_hevc_flush(OddHEVC *decoder);
void odd_hevc_destroy(OddHEVC *decoder);
int odd_hevc_error(const OddHEVC *decoder);
int odd_hevc_error_string(int error, char *buffer, int size);

#endif
