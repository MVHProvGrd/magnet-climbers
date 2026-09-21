# Roadmap

Ordered. Each item is a GitHub issue. Pick the top open one.

## Done

**Core climb.** Solo mode, tutorial, story, chill mode, HP and moving bumpers, kid-hand
swipes, tricks, gadgets, field guide, per-run kit (coins buy a higher jump and a stickier
floor for one climb), instant restart with the near-miss line, the creature roster, the
prize machine (doubling in price up to a ceiling). Crew and Expeditions were cut — see
`archive/crew/README.md`; the UI only ever starts solo.

**Boards and fairness.** Global and lifetime boards, challenge links with verified share
cards, cloud save with device linking and merge, chat with moderation and the owner's scale
bench. Weekly league (buckets of ~30 by metres climbed that week, top ten up and bottom ten
down across Paper/Plastic/Steel/Chrome/Gold, seated lazily, no cron). Fridge of the month
(twelve doors, repainted on the first, each with one pattern only that month gives out).
Input recorder (every fling and climb taped; a tape replays into the same climb to the
centimetre) and server-side replay of the daily climb — as of 2026-09-21 the Worker refuses
a row its own replay does not confirm (`TAPE_MODE = "enforce"`), instead of just recording
the disagreement. Daily climb (one fridge for everyone from the Central date, one scored
attempt, no kit, a TODAY board; the Worker owns the day), missions, streak (pays 40 up to
200 as the days run, the seventh in a row pays a pattern). Ghost of your best run, drawn
live from its tape. Async race (a shared run's tape travels under a short id; the sharer's
ghost climbs the same fridge beside whoever opens the link). Live ghost race (a Durable
Object per match relays inputs between two phones; both tapes are replayed by the room and
the result is what the replays say).

**Platform.** PWA auto-update, generated music loops, `navigator.storage.persist()`.

**Accounts — wired, switched off.** Google/Apple sign-in through Firebase Auth, loaded from
Google's CDN only when tapped; the Worker verifies the ID token against Google's keys and
ties the account to the profile, so signing in on a second phone adopts it like a link code.
Switch on with `VITE_FIREBASE_CONFIG` on the game and `FIREBASE_PROJECT_ID` on the Worker —
and rewrite the privacy policy's Firebase caveat in the same commit.

## Now — release readiness (from the 2026-09-20 audit)

19. **Home screen collapse.** One full-width SOLO CLIMB button; daily as a small chip;
    race/board/story behind one sheet; missions as one line, not three bars; chill moved to
    Settings. Needs a phone playtest before it's called done, not just code review.
20. **Store prep.** Pick 13+ vs all-ages (gates the Play "designed for children" checkbox
    and the Apple listing) — chat is now off by default either way. Draft the Play Data
    Safety form from the real Worker schema. Apple Developer Program enrollment (owner
    action, $99/yr).
21. **Access control on the owner benches.** `/placement`, `/scale`, `/art-archive` and
    `/elements` are `noindex` but not actually locked; anyone who finds the URL can open
    them. Move them behind the Worker's existing `ADMIN_KEY` auth instead of static Pages.
22. **Worker deploy in CI.** Pages deploys the client on every push; the Worker is still
    `npx wrangler deploy` by hand. Needs a Cloudflare API token added as a GitHub Actions
    secret (owner action) before the workflow step can run.
23. **Solo / lifetime / league verification.** Client-trusted numbers today — `/score` and
    `/run` take a token and a claimed height, no tape, unlike the now-enforced daily. Real
    fix (full tape replay on every mode) is weeks of Worker CPU, not a bug fix; the lighter
    alternative is delisting them from any "competitive" framing until they're verified too.
    Owner call, not a default.

## Later — platform and money

Capacitor wrap for Android/iOS comes after the home screen and the store-prep legal work,
not in parallel with them.

24. Capacitor wrap; AdMob rewarded revive (hook exists in `main.ts` — the current "WATCH AD"
    button is a placeholder that always revives and should not ship to a store build as-is);
    store IAP for gems.
25. Offline "stretch" income, prestige, season pass, roster gacha per `DESIGN.md` — research,
    not scoped.
26. Feel pass from real-phone play: fling scale, gap sizes, wall ramp, link radius. Numbers
    live in `config.ts`. Ongoing, never really "done".
