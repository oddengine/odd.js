# RTC audio measurement

`NetStream.volume()` keeps its existing integer 0–100 peak scale. It now observes
the local stream after capture as well as the remote stream received by ontrack.
It is a local display value, not RFC 6464 dBov, RMS, voice recognition or proof of
publishing permission. The existing API returns 0 both for silence and unavailable
measurement; do not infer microphone authorization from it.

`RTC.AudioMeter.update(stream)` selects one live audio track, reuses an unchanged
source and follows track additions/removals/ending. The analyser borrows that track
without stopping or cloning it. Disabled, muted, ended or absent tracks report 0.
Changing to a video-only stream releases the audio graph and keeps the stream
listener ready for a later audio track. `stop()` removes all listeners, clears the
graph and requests AudioContext closure; repeated stop is harmless. A later update
creates a fresh graph. Closing a NetStream still owns and stops its actual tracks.

WebAudio construction, reading, resume or close failures are handled without
failing the media connection. Browsers can suspend AudioContext until a user
gesture. Update attempts resume; ordinary volume reads do not retry it.
Use update when binding/changing a stream or responding to a user gesture, not
as a sampling loop. Measurement stays 0 while suspended. An application
using AudioMeter directly may call update again from its user gesture; this does
not bypass autoplay policy.

No polling timer, IM message, database record or UI component is added. Call
volume only at the display's required rate, and stop that UI work when hidden or
destroyed. One call examines the analyser's existing sample buffer with no new
sample allocation. With the current default 1024 samples, 25 reads/second is about
25600 simple comparisons per measured track; this is a source estimate, not a
browser benchmark. Each measured NetStream has its own AudioContext, so subscribe
and measure only the streams the application needs.

This is a source repair for the existing API. Room-wide speaker sorting,
cross-node aggregation, microphone level UI and release builds remain separate.
No compilation, browser, runtime or functional tests were run.
