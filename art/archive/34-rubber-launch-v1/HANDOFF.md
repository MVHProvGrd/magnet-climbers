# Rubber pull + release thwack

Owner requested rubbery stretch plus a thwack on release after approving pack33 object sounds. Six original synthesized PCM16 mono48k WAV files; three pull takes, three release takes. Sources: generate.py. No generated/recorded voice, no woohoo asset: the optional occasional character cheer was discussed but left for a voice pass.

Runtime integration now authorized by owner and implemented alongside pack33. public/audio/objects-v1 contains all105 WAVs. Existing sfx.stretch(rate) API maps to the new sample; pull strength drives modest pitch and gain changes. A new pull chunk fades the previous chunk. Release stops the pull, then plays ONE thwack. The old sfx.launch() layering is removed; if a sample is unavailable the old twang is the fallback, not a second simultaneous sound. Cancel, release, keyboard cancellation and blur stop pull tails; pause/hidden/SFX mute stop active sampled effects.

Full path: C:\Users\micha\magnet-art-ready\art\archive\34-rubber-launch-v1\index.html

Audio is procedural design, not real foley recording. The owner approved pack33 by listening; this new gesture pass is implemented per request but has only numeric/automated QA so far. Listen and tune on device.
