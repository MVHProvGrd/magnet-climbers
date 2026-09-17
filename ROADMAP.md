# Roadmap

Ordered. Each item is a GitHub issue. Pick the top open one.

Done so far: crew SYNC fling, solo mode, tutorial, story, chill mode, HP and
moving bumpers, kid hand swipes, tricks, gadgets, field guide, cloud save with
device linking and merge, global and lifetime boards, challenge links with
verified share cards, PWA auto-update, generated music loops.

## Done in the league / seasons pass (September)
**Weekly league** — buckets of ~30 by metres climbed that week, top ten up and
bottom ten down across Paper, Plastic, Steel, Chrome, Gold; seated lazily, no
cron. **Fridge of the month** — twelve doors, repainted on the first, each with
one pattern only that month gives out. **Input recorder** — every fling and
climb taped; a tape replays into the same climb to the centimetre.

## Done in the retention pass (September)
**Daily climb** — one fridge for everyone from the UTC date, one scored
attempt, no kit, a TODAY board; the Worker owns the day. **Missions** — three
at a time on the menu and the game-over card, written against counters the run
already kept. **Streak** — the daily pays 40 up to 200 as the days run, and the
seventh in a row pays a pattern. **Crew and Expeditions cut** — see
`archive/crew/README.md`.

## Done since this list was written
Checked against the code, not this file: the **creature roster** (#4), the
**prize machine** (#5, now doubling in price up to a ceiling) and **instant restart
with the near-miss line** (#7) are all in the game. Also since: per-run kit
(coins buy a higher jump and a stickier floor for one climb), chat with
moderation, and the owner's scale bench.

## Now — what the recorder unlocks
1. **Ghost of your best run** drawn live on the fridge. The tape of your best
   climb is already kept on the device; this is playback plus a faintly drawn
   second climber.
2. **Server-side replay of the daily.** A shared board is the first thing worth
   cheating. The sim is deterministic and a tape is about a kilobyte, so the
   Worker can climb it again and keep the row only if it agrees.
3. **Async race:** race a friend's recorded run as a ghost from a share link.
   Needs the ghost renderer and the same tape storage the replay check wants.

## Next — social and progression
8. **Weekly league.** Buckets of ~30 players by lifetime metres, top 10
   promote, bottom 10 drop. Tier badge on the scoreboard.
9. **Input recorder:** log every fling/climb/reserve as `{tick, id, vector}`
   per run. Foundation for replay, ghosts and score validation.
10. **Ghost of your best run** drawn live on the fridge (uses the recorder).
11. **Async race:** race a friend's recorded run as a ghost from a share link.
12. **Live ghost race:** Durable Object per match relaying inputs over
    WebSocket; goal height; result settled by server replay.
13. **Themed fridges:** monthly skin of the fridge (stickers, plates, palette)
    with one limited climber skin. Gives each update something to post.
14. **Accounts:** Sign in with Google/Apple on top of the current link codes
    (needs OAuth client ids from the owner).

## Later — platform and money
15. Capacitor wrap for Android/iOS; AdMob rewarded revive (hook exists in
    `main.ts`); store IAP for gems.
16. Offline "stretch" income, prestige, season pass, roster gacha per DESIGN.md.
17. Colour abilities: superseded by creature verbs in `CREW_DESIGN.md`.
18. Feel pass from real-phone play: fling scale, gap sizes, wall ramp, link
    radius. Numbers live in `config.ts`. Ongoing.
