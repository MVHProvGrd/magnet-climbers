# Magnet Climbers — public / monetized release audit

**SHA:** origin/main `b258b97` (2026-09-20). Includes “Fix defects from full-repo review”.
**Local checkout was 3 behind when this was written.** Pull before acting.
**Code audit only.** No phone play-test. Feel pass in `src/game/config.ts` is unsigned.

**Verdict:** not ready to take money. Fine as a free web toy after the list-A holes. Charging on this build sells an infinitely farmable gem, a fake ad, and a daily board a console `fetch` can still win.

---

## What is actually on

Endless fridge climber PWA. Canvas 2D + DOM menus. Vite + TypeScript. Live at magnetclimbers.com (Pages). API: Cloudflare Worker + D1 + Durable Objects (live race, daily replay).

**On in production:** solo, chill, tutorial/story, how-to, daily (Central time), missions, streak, fridge-of-the-month, per-run kit, prize machine, 7 creatures (cosmetics), gadgets, kid hand + cat paw, best-run ghost, async race links, live 1v1 (server replays tapes), weekly league, boards, share cards, cloud save + link codes, chat, Web Push, PWA install + auto-update, 9 languages, privacy/terms/contact.

**Wired, off:** Google/Apple (`VITE_FIREBASE_CONFIG` unset; Worker `FIREBASE_PROJECT_ID=""`).

**Stubs / absent:** ads (3s placeholder that always revives), IAP, pass, energy, stretch income, prestige, Capacitor, AdMob. Crew cut to `archive/crew/`; UI only starts `"solo"`.

Version `0.1.0`. No `.kit.json`. ROADMAP “Next” still lists league/recorder/themed fridges — they are done.

---

## Architecture

**Sim.** `src/main.ts` ~1072: fixed 1/120 s accumulator, dt cap 0.05. World: xorshift `makeRng`, version 27 (`src/game/world.ts`). Casual seed is `Date.now` then recorded on the tape. Daily seed is FNV-1a of Chicago `YYYY-MM-DD` on client and Worker (`src/game/leaderboard.ts:21`, `worker/src/replay.ts:24`). `Math.random` is particles, guest names, new playerIds — not terrain.

**Tape.** Fling/move on the 120 Hz grid (`src/game/recorder.ts`). Worker `replay.ts` builds the same `Game` headless (`silent: true`), rule `claimed <= replayed`. Daily kit forced empty. Live races settle by replaying both tapes.

**Save.** `magnet-climbers:save:v1`. Ledger in/out for wallet merge — except link-code adopt **adds** both wallets (`src/main.ts` ~166). Run snapshots `v: 2`; restore **invalidates the tape** (`src/game/game.ts` ~728), so a resumed daily cannot be verified.

**PWA.** `vite.config.ts`: `base: "./"`. Precache = js/css/html/svg/woff2 + icons + title art. Fridge art/audio CacheFirst on first use. Google Fonts still from gstatic (`index.html:16-18`).

This sim/replay design is the strongest part of the repo. A paid board would stand on it — if it were enforcing.

---

## What is excellent

- Physics is real: hop-in-Z, tip contacts, pendulum, gadgets, HP, red-line product cap (`floorMultCap: 6` in `config.ts`) so three multipliers cannot stack to 11×.
- Daily + live already share one `Game` with the Worker.
- Chat: PII regex, link strip, profanity, 3s cooldown, IP limits, mutes, reports; client `esc()`.
- Cloud save: tokens, 409 conflicts, ledger. Link codes expire.
- Tests hit Worker chat, daily replay, live rooms, Firebase JWT verify, push notices — not just magnetism.
- `b258b97` already closed: unset env no longer pointing at prod Worker; dead kit-shop chips; daily kit no longer discarded; GET `/save` token moved to header (query still accepted as fallback); `/score` rejects unknown ids.

---

## Ship-blockers for paid / competitive

1. **Daily is still honour-system in prod.** `worker/wrangler.toml:25` `TAPE_MODE = "shadow"`. No tape or failed replay **keeps the claimed height** (`worker/src/index.ts:652-660`). First write of the day sticks (`:638-639`), so a fake row blocks a later real climb. `MAX_CM` is 200_000 (2 km). Anyone who `POST /save`s a profile can sit on TODAY. With VERIFY bound, a structurally valid tape lands at the claim immediately; shadow never deletes a failed replay.

2. **Solo / lifetime / league / coins are client numbers.** `/score` and `/run` take a token (who) and `cm` (claim). No tape. `/run` is 40/min/IP into lifetime **and** league. Coins board is parsed from the save blob (`index.ts:770-778`). Curl or hex-edited localStorage is top-10.

3. **Admin XSS on `player_id`.** `/save` accepts any 64-char id (`index.ts:758-762`). Admin `esc()` only replaces `&` and `<` (`worker/src/admin.ts:178`), then interpolates into `onclick="unmute('${esc(id)}')"`. Crafted id + owner click runs JS on the authenticated origin and can read `mc-admin-key`. Game settings also put that key in a URL hash (`src/game/ui.ts:855`).

4. **Legal pages describe a different product.** Privacy (14 Sep): “no accounts, no ads, no tracking pixels,” no email. Reality: Firebase is one env var from on (stores email); push endpoints stored; live race / league / tapes / wallet / IP buckets exist; Google Fonts every visit; rewarded-ad hook in the revive row. Deletion is “email us”. Admin cannot wipe save, lifetime, wallet, push, accounts, or tapes. No age gate on a toy fridge with public chat the policy calls suitable for all ages.

5. **No way to take money.** No StoreKit, Play Billing, receipts, or AdMob. Ad revive is a countdown that always pays (`ui.ts:1530-1540`). Gems start at 10, drop on the door, cost 5 to revive. Prize machine is coin gacha (`creatures.ts:92-103`, odds 65/28/7). DESIGN.md F2P (stretch, $4.99 pass, gem packs, energy) is research, not code.

6. **Kids + UGC + future IAP.** COPPA “directed to children” is a plausible read (Cooper, cat, toys, “I’m 8” left in chat on purpose). Persistent id, chat, push, optional Google/Apple before any parental consent. Prize machine becomes a loot-box problem the moment gems are real money.

---

## High (do before calling it free 1.0)

- **Live race seats are `playerId` only** (`worker/src/index.ts` comment ~“id is the secret”; `match.ts:109-111` reconnect replaces `send`). Public ids are on the board and in chat. WS has no Origin check. Replay still stops a fake winning height; it does not stop grief or impersonation.
- **Resume kills daily verification.** Don’t snapshot-resume a daily, or keep the tape across restore.
- **Link-code adopt sums wallets** (`src/main.ts` ~166). Conflict merge uses ledger max; adopt adds. Two phones + a code duplicate coins/gems.
- **Owner benches ship to every player:** `placement.html`, `scale.html` in Vite input (`vite.config.ts:15`); `public/art-archive/` and `elements/` copy into dist.
- **`window.__mc.save()` returns the live save including the cloud token** (`src/main.ts:1228-1232`). Same secret is already in localStorage; the comment says “no secrets.”
- **CORS includes `https://mvhprovgrd.github.io`; `workers_dev = true`** on the production Worker (`wrangler.toml:4,26`).
- **No `navigator.storage.persist()`.** iOS can evict an installed PWA’s save.
- **Worker deploy is not in CI.** Pages runs tests + build; API is `npx wrangler deploy` by hand.
- **Git ~590 MB** mostly `art/archive/` history. Needs a history rewrite (owner must approve).

---

## Copy vs code

| Says | Is |
|---|---|
| README / OG: crew or solo | Crew cut; only solo starts |
| DESIGN: daily is “next” | Built |
| DESIGN: floor `22+14/1000px cap 120` | Stepped 15%/50cm, creep, product cap 6× (`config.ts:26-40`) |
| DESIGN: backend Supabase/Firebase | Worker + D1 |
| JSON-LD: Android and iOS (`index.html:33`) | Web only |
| ROADMAP Now: “set up Firebase” | Still off |
| Client chat 403: “Finish a run first” | Worker only requires a cloud save |
| Worker README: chat keeps 500 | Code keeps 5000 (`CHAT_HISTORY`) |

---

## Tests and gates

`npm test` (`tests/run.mjs`) Vite-bundles four entries: magnetism (+ audio/creatures), sample-player, sample-engine, worker. Card PNG path stubbed. Visual `*.mjs` not in CI. `tsconfig` `include: ["src"]` — tests are not typechecked. No bundle/precache ratchet in this repo’s CI. `tests/magnetism.test.ts` contains a NUL (ripgrep treats it as binary). No replay checksum, no save-migration suite, no test that a resumed daily cannot post.

---

## Two bars — do not mix them

### A. Free web 1.0 (weeks)

Keep ads off. Keep Firebase off.

1. Flip `TAPE_MODE=enforce` only after the shadow log is clean. Do not INSERT a daily row until replay succeeds. Reject missing tapes.
2. Require a tape on `/score` and `/run`, or take league/lifetime/coins off the public menu.
3. Fix admin `esc` + restrict `playerId` to `^p-[a-z0-9]+$`. Stop putting ADMIN_KEY in URLs.
4. Rewrite privacy/terms to push, live race, league, tapes, fonts, Cloudflare/GitHub logs. In-game delete that hits every table.
5. Age gate or default chat **off**. 13+ (16+ EU) before chat/push.
6. Drop github.io from CORS. `workers_dev = false` on prod. Hide placement/scale/art-archive from the player origin.
7. Don’t resume dailies (or don’t invalidate that tape). One merge rule: ledger max, never sum.
8. Self-host Barlow. `storage.persist()`. Deploy Worker from the same workflow as Pages.
9. Kill crew from README, OG, JSON-LD, how-to. Move the policy date when it matches the binary.
10. Phone play-test of the feel pass. This audit cannot sign that.

After A you can say: free browser game, casual boards, daily is checked.

### B. Paid / stores (months)

Do not turn on IAP or AdMob until A is done.

1. Server wallet. Receipts table. Gems never come from the client blob. Validate StoreKit / Play / RevenueCat on the Worker.
2. Real rewarded ads behind a store-build flag. The placeholder must not grant a life on production web.
3. Economy: gems cannot drop freely on the door if they cost $. DESIGN “gems buy time only” is the right rule; the code does the opposite.
4. If the fridge stays kid-shaped: no real-money loot boxes, no chat under 16, COPPA counsel, Play Families, Apple 3.1.1. If you want gacha + IAP, re-skin and age-gate hard.
5. Capacitor, icons, splash, ATT, nutrition labels, in-app deletion, refunds policy that does not contradict Apple/Google.
6. Firebase on only after privacy names email and you have unlink + deletion.
7. Live race: bind seat to save token; Origin check; CPU caps.
8. Hash tokens at rest; drop `?token=` on GET `/save`; timing-safe compare.
9. History rewrite for art archive — needs explicit owner go.

---

## Sequence

1. Legal + daily enforce + playerId lock + admin XSS — this week, still free.
2. Feel pass on a real phone — the ROADMAP “Now” that is actually the product.
3. Firebase on only if accounts beat COPPA risk; rewrite privacy in the same commit.
4. Money last. Server wallet, then one IAP (gem pack or ad-free), then maybe a pass. Not gacha.

Do not sell this as-is. Keep magnetclimbers.com up as a free PWA, ship list A, then decide whether the store is worth the kids/chat/IAP knot.
