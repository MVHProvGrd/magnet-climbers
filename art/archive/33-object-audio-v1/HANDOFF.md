# Pack33 — object-matched audio REVIEW candidates

## UPDATE: owner listened and approved; runtime wiring implemented

Owner explicitly requested wiring these sounds. The implementation is now on codex/art-ready-pack, built over origin/main 1b50df7. This supersedes the review-only/integration-to-do status below. New src/game/sample-player.ts and object-sound-map.ts drive existing contact/bubble events via the existing FX bus. All99 approved samples plus six pack34 rubber gestures copied to public/audio/objects-v1. Bounded two-bank preload after unlock, no immediate-repeat takes, four object voices max, six total, cooldown, muted/paused cleanup, offline old-SFX fallback, no late collisions after decode. WAVs included in service-worker cache. Spinner remains the approved short bearing-roll one-shot, not a sustained speed-controlled loop.

59 automated tests and production build pass. Gameplay/audio listening on a real phone remains a useful final subjective check. Not deployed merely by being committed to this branch.

Owner request: every keychain should make an object-relevant sound; specifically fidget spinner must have rolling bearings. Original synthesized/physically inspired effects, NOT field recordings. No external samples or AI audio service used. Listening approval is still needed; numerical QA cannot establish perceived realism.

## Review

Open C:\Users\micha\magnet-art-ready\art\archive\33-object-audio-v1\index.html directly in a browser. Three individually playable takes per object, master level and stop button. Files: ready/*.wav (mono 48kHz PCM16); descriptions, lengths, levels and hashes: manifest.json. Source recipe: generate.py. Audition before replacing anything.

33 sound identities / 99 variants. 48 item IDs in item-map.json, including the 13 swing-toy aliases, plain bumpers, 15 named swings and 7 rotors. POP directions have explicit event mappings. Review UI is archive-only and has no authentication itself: do not publish it at a public URL; route through existing admin-only review if deployed.

## What changes

Compared against origin/main 1b50df7, especially music-score.ts TOY_VOICE and game.ts world.knocked dispatch. Current sound recipes use small oscillators and shared noise bursts. This pack gives every object a tailored layered effect, not a generic bell for unrelated objects. Keys have irregular metal resonances; spoons are hollow cups; beads are dry wood. Baby shoe is sole/cloth, disco ball is light glass/chain (not music), whistle sounds like its metal body when bumped (not magically blown). Toy duck/robot/dino/taxi keep playful squeeze/servo/growl/horn identities. Donut/banana/gummy are toy materials, not eating sounds. No changes to unrelated music or gameplay SFX.

Spinner specifically uses broadband rolling friction and uneven ball-pass micro-impacts that slow down, NOT a swept sine whine. Three distinct 1.63-second one-shots including quiet tail. These are not seamless loops. Pinwheel gets paper flutter, not bearings.

## Claude integration contract — implementation intentionally left to you

1. Copy approved files to your audio asset path, lazy decode after audio unlock. Route through existing fxBus and limiter: obey SFX mute, pause/hidden state, volume and sound-only unlock. Don't send directly to destination or play via HTMLAudioElement in the game; the HTML review does that only to work from disk.
2. Map world item IDs using item-map.json. Its values are sample keys, NOT existing sfx function names. Keep existing procedural voices as failure/offline fallback; never layer both on a successful sample hit.
3. Choose one of three variants, avoid immediate repeats per sound. Apply subtle gain variation; do not indiscriminately randomize pitch of mechanical bearing loops/rolls.
4. Trigger once per actual new contact, not every overlap frame. Per-object cooldown around 180ms and global maximum four simultaneous object voices; prefer dropping quiet/far impacts. Quiet gain for gentle brushing, louder for actual impact. Current world.knocked is a string and has no impact magnitude: add contact strength in implementation if needed, do not pretend it already exists.
5. Spinner: start only on a real hit that sets it moving. Stop/fade if rotor is stopped, reset, offscreen or game paused. Match playback envelope to visible spin; this short deceleration sample is a first-pass one-shot, NOT a complete indefinite spin-loop rig. A sustained fast/mid/slow layer system would be a separate follow-up if visible spins last longer. No fake repeat every frame.
6. POP stays on the existing bubble inversion events. Replace directional pop sounds if approved, but suppress generic bumper/swing sound for bumper-4 and swing-toy-4 to avoid double triggers. Three outward variants, three inward variants.
7. Initial mix suggestion: these files peak roughly -6 to -20 dBFS before fxBus; start an object bus gain around 0.45, tune in-game on phone + headphones, and do not peak-normalize every file. Cloth should remain quieter than a horn or metal strike.

## Reproduce / verify

python art/archive/33-object-audio-v1/generate.py
python art/archive/33-object-audio-v1/build-review.py
python art/archive/33-object-audio-v1/test_audio.py

Generate is deterministic and refuses to overwrite a different existing WAV. New sonic iterations belong in a new versioned pack. Runtime files, public/audio and deployment are untouched.
