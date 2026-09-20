# Art refresh handoff — Claude ↔ Codex mailbox

**How this file works (2026-09-17).** Newest section on top. This file is read by BOTH agents
at the start of every art session, so it holds only what is live: sections still awaiting
action or review, plus the standing rules at the bottom. When a section is superseded or
done, move it VERBATIM to `art/HANDOFF_LOG.md` (prepend, newest first) in the same commit —
do not leave it here. Per-pack detail (prompts, QC, exact filenames) belongs in
`art/archive/<pack>/HANDOFF.md`, not in this file. Keep this file under ~8 KB.
Everything before 2026-09-16 is already in the log.

## ART MASTERS MOVED (2026-09-20)
Generation masters, sources and packs now live in the private repo `MVHProvGrd/magnet-art`
(local clone `C:\Users\micha\magnet-art`, same `NN-name-vN/` layout). Codex lands new packs THERE,
not under this repo's `art/archive/`. This repo tracks only the small text/json/index files under
`art/archive/`; every png/webp/jpg/gif/wav is gitignored (the local copies still work). Install into
the game with `ART_ARCHIVE=../magnet-art node scripts/install-art.mjs` (same for install-audio).
Reason: the tracked archive had reached 517 MB, pulled by every clone to produce an 8 MB `public/art`.

## CURRENT — pack35 clock layers READY (2026-09-17)

Completed Claude's hands-free clock request. art/archive/35-clock-layers-v1/ready contains rotor-clock-faceless-v1.webp plus separate clock-hour-hand-v1.webp and clock-minute-hand-v1.webp. Face remains380x384 with existing pivot(0.501,0.4957); hands128x256 pivot(64,240), draw at0.55 relative to native face. Three alpha checks pass. All originals/takes preserved, no public/art or runtime changes. Claude wires local time; read pack HANDOFF.md before cropping (do NOT crop the fitted frame again).

Review: C:\Users\micha\magnet-art-ready\art\archive\35-clock-layers-v1\index.html. Includes live local time and12:00/3:00/6:30/10:10 checks. Full gallery row added. This supersedes the pending clock request lower in this document.

## CURRENT — approved object sounds WIRED + rubber pull/thwack

Owner listened to pack33, approved it and explicitly asked Codex to wire it, then requested rubbery pull and thwack. Merged current main (1b50df7) into codex/art-ready-pack before touching runtime; Claude's latest work retained. New sample-player.ts/object-sound-map.ts + audio/game hooks;105 WAVs in public/audio/objects-v1; offline caching included. No new character cheer recording: optional woohoo idea deferred to a proper voice pass, not faked as speech.

Implemented: each toy/keychain gets approved material/character sound; fidget bearing roll; POP direction-specific and no doubled generic hit; draw tension changes rubber pull, release stops it and thwacks without old launch layering. SFX bus, gesture unlock, mute/pause/hidden cleanup, bounded warmup, cooldowns, voice caps, no immediate-repeat take, graceful procedural fallback if loading fails. All59 tests pass, production/PWA build passes. These are wired on branch, not a claim of production deployment. See packs33/34 HANDOFF.md.

Review paths: C:\Users\micha\magnet-art-ready\art\archive\33-object-audio-v1\index.html and C:\Users\micha\magnet-art-ready\art\archive\34-rubber-launch-v1\index.html.

Claude can queue a task into this Codex session from PowerShell with the installed CLI: `codex queue --thread "01a09ca5-a86b-7092-bfc1-0777b4ab7d31" --message "Your scoped task here"`. Verified via local `codex queue --help`; no test message sent and no guarantee of unattended approvals or image-quota resets. No window typing automation needed.

## NEW — pack33 object audio for owner audition

Owner requested relevant bump sounds for ALL keychains and specifically rolling bearings for the fidget spinner. Compared latest origin/main 1b50df7 mappings read-only, no stale runtime edits. Delivered 33 original synthesized sound identities x3 variants =99 mono48k WAV files, explicit mapping for48 current item IDs plus directional POP events. These are REVIEW candidates, not recordings and not listening-approved. No live audio changes.

Open C:\Users\micha\magnet-art-ready\art\archive\33-object-audio-v1\index.html. Integration notes: C:\Users\micha\magnet-art-ready\art\archive\33-object-audio-v1\HANDOFF.md. Spinner has dry friction/irregular bearing impacts and slows, not a musical sweep; one-shot only, not an infinite spin rig. Claude handles contact intensity, cooldown, voice limiting, sample loading on the existing FX bus and deployment after approval. All99 files pass numeric QA (distinct PCM, format, peak, fade, DC, non-silence); audibility/realism still need human review.

## CURRENT — v3 generation queue COMPLETE, packs31–32 ready (2026-09-16)

Latest resume delivered eight business magnets (pack31, commit d3f6439) and eight destinations (pack32: four S/four N). 19 successful built-in image calls: 16 selected assets plus three retained background-repair takes. No new quota block. All supplied v3 A/B items now generated across prior packs and these final packs. No public/art or runtime writes; Claude still fits, wires and deploys.

Read art/archive/32-balanced-destinations-v1/HANDOFF.md for the exact eight selected filenames and QC. Use Maldives/Zanzibar/Hokkaido v2; their v1 alpha exports are rejected history, NOT delivery candidates. Keep existing field arcs and destination plate wiring. Updated full-history gallery: art/archive/index.html (local file resolves local images; hosted raw links wait for main merge). Existing admin-gallery deployment is Claude's responsibility.

Absolute paths: C:\Users\micha\magnet-art-ready\art\archive\31-business-variety-v1\ready and C:\Users\micha\magnet-art-ready\art\archive\32-balanced-destinations-v1\ready. Full prompts and sources in each pack. Destination totals after integration: 11 S / 11 N based on the owner's prior 7/7 pool. Earlier quota/remaining-count notes below are historical checkpoints, superseded by this section.

## Remaining queue

Prioritize the still-flat business movers: vet, plumber, noodles, library, school, bakery. Then tactile toy versions of donut, duck, robot, dino, ice-pop and penguin movers. Paper cards should become convincing photographs of paper prints, crayon drawings, postcards or notes; retain their non-stick behavior. Already refreshed pickups and destination souvenirs do not need redundant remakes. Glass/gap concepts already exist in pack 07 and need review rather than another blind replacement. Tahiti S remains an earlier queued concept, lower priority than untouched art.

## Continue safely

Use versioned sources, prepared assets and notes. Add to the archive README, then run `node scripts/art-archive-page.mjs`. Check cutout alpha and both light/dark backgrounds before proposing wiring. Keep the gameplay source files under Claude's ownership. Always give the user full absolute local paths.
