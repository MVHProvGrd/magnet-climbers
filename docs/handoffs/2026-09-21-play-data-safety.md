# Play Console — Data Safety form, drafted from the actual code

Built by reading `worker/src/index.ts`, `worker/schema.sql`, `src/game/save.ts` and the
rewritten `public/privacy/index.html` (2026-09-20/21), not from memory of what the game is
"supposed to" do. Cross-check against the live schema before submitting if the Worker has
changed since. Walks the Play Console's own category list; skip whatever isn't offered a
checkbox for in your build of the form.

**Does your app collect or share any of the required user data types?** Yes.

**Is all user data encrypted in transit?** Yes (HTTPS/WSS only, enforced by Cloudflare and
GitHub Pages).

**Do you provide a way for users to request their data be deleted?** Yes —
`public/privacy/index.html` → "Deleting your data"; backed by a real admin action
(`/admin/api/player/erase`) that removes every table a player id touches, not just the three
it used to promise.

---

## Personal info
- **Name** — *Collected, not required.* The in-game display name is chosen by the player;
  the policy tells them not to use a real one, but nothing stops them. Not verified, not an
  account name.
- **Email address** — *Not collected* in the current deployment (`FIREBASE_PROJECT_ID` is
  empty; `/auth` answers 503; no sign-in flow is reachable). **This flips to "Collected" the
  day Firebase accounts are switched on** — update this form in the same change.
- **User IDs** — *Collected.* A random id (`p-…`, generated client-side, not derived from
  any personal info) plus a paired secret token. Used to identify a save/profile; not tied to
  a real identity.
- Everything else in this category (address, phone, race/ethnicity, political/religious
  beliefs, sexual orientation) — **not collected.**

## Messages
- **In-app messages** — *Collected, shared with other users, not required.* Chat is opt-in
  and off by default (`save.chatOptIn`, a Settings toggle) as of 2026-09-20; once a player
  turns it on, messages, their display name and player id are visible to every other player
  who has also opted in. Filtered for profanity/PII, moderated, retained briefly, deletable
  by the owner.

## App activity
- **App interactions** — *Collected.* Scores, best heights, run counts, mission/streak
  progress, coins/gems balance, upgrade levels — everything in the cloud-save blob.
- **In-app search history, installed apps, other user-generated content** — not collected.
- **Other actions** (daily-climb tape / input recording) — *Collected, not shared, not
  required.* The sequence of flings/moves for the day's climb, sent so the Worker can replay
  and verify it (`TAPE_MODE = "enforce"` as of 2026-09-21 — a claim the replay doesn't
  confirm is now refused, not just logged). Kept up to 30 days, then the recording itself is
  dropped; the pass/fail verdict stays.

## Device or other IDs
- *Collected.* The random player id above; a Web Push subscription endpoint if the player
  turns reminders on (Settings, opt-in, off by default); standard hosting-provider request
  logs (IP, browser, timestamp) kept briefly for abuse rate-limiting (well under an hour) and
  under GitHub's/Cloudflare's own retention beyond that. No advertising ID, no IMEI/serial —
  there is no ad SDK in this build (the revive-row ad button is a placeholder that always
  succeeds; it does not call an ad network and collects nothing).

## Location, Financial info, Health & fitness, Photos/videos, Audio files, Files & docs,
## Calendar, Contacts, Web browsing
**Not collected** — none of these categories apply to anything in the Worker's schema or the
client's save shape.

---

## Purposes (per collected category above)
- **App functionality** — user id/token, cloud save, scores, chat, tapes, push endpoint: all
  required for the feature they belong to to work at all.
- **Analytics** — not used; no analytics SDK is loaded (see privacy policy).
- **Advertising or marketing** — not used; no ad SDK is loaded.
- **Account management** — not applicable while accounts are off; will apply to email once
  Firebase is switched on.

## Data sharing
Nothing is sold. Chat messages are visible to other players who have also opted into chat —
that's the one case that's genuinely "shared with other users" on the form, not with a third
party. Hosting infrastructure (GitHub Pages, Cloudflare Workers/D1) is a processor, not a
recipient the form asks you to name separately.

## Data retention / deletion honesty check
Everything above is deletable today via the new admin erase action, except: hosting-provider
request logs (GitHub's and Cloudflare's own infrastructure logs — governed by their
retention policies, not ours, and the privacy policy already says so) and, if a message was
already screenshotted or read by another player before deletion, nothing can un-send that —
same as any chat product.

## Kids / age
Chat is opt-in and off by default; push is opt-in and off by default; no accounts today; no
ads; no IAP. This is what makes an "all ages" self-declaration defensible on the *current*
build. If the store listing goes 13+ instead, update the "designed for children" answer and
the age line in the privacy policy's Children section to match — they currently say "suitable
for all ages," which is still true either way, but should read as a deliberate choice against
whichever bracket the listing declares, not a leftover.
