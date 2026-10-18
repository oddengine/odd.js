# Browser account requests

The IM, RTC and Player examples load `account.js` before their page scripts. Keep
`../common/` alongside the examples when publishing them. This small host-side
client is independent of the SDK and uses the same-origin `odd-api` route.

With odd.x `Identity/CSRF` enabled, each mutation carries `X-CSRF-Token`. The client
gets a short-lived proof from `GET /session/csrf`, keeps it only in memory, and
shares concurrent refreshes. Login and session responses can replace the proof.
An anonymous HttpOnly cookie binds requests before login; a login cookie binds
them afterwards. The proof is not an authentication credential.

Only HTTP 403 `csrf_required`, emitted before the business handler, permits one
refresh and retry. A changed proof context means the browser account changed:
the action fails with `session_changed` instead of being replayed as another
user. Refresh the visible account and explicitly initiate the action again.
Network errors, timeouts and other server errors never replay a mutation.
The caller's abort signal prevents a late submission; a shared proof fetch has
its own 30-second timeout. No polling or persistent browser storage is used.

HTTP 404 from the proof endpoint or an explicit `enabled:false` supports older
deployments; all other errors fail closed. Removing the CSRF config restores the
previous Origin-only policy. Production shared-account deployments should enable
CSRF. Neither this client nor a successful proof replaces server authentication,
authorization or revocation.

Source-reviewed only; no build, browser, server or automated tests were run.
