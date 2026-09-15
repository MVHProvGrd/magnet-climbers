# Corrected cat paw: back view, claws, fading scratches

Owner correction: pads face the fridge, camera sees furry back of paw. Supersedes pack 15 for orientation; pack 15 preserved as rejected history.

Review: C:\Users\micha\magnet-art-ready\public\art-archive\cat-paw-v2\index.html

Source: sources/cat-paw-back-claws-v2-magenta.png. Preferred cutout: ready/cat-paw-back-claws-v2.webp. One successful built-in imagegen generation; existing hard chroma key, no erosion. 1024x1536, bbox [304,0,746,1312]. QC flags top frame contact ONLY, intentional offscreen foreleg crop. 111 magenta-tinted opaque pixels by checker; light/dark composite supplied for visual review.

Single rigid photographic cutout, with four ivory claws permanently extended in this pose. Not an articulated wrist or retractable-claw rig. Earlier conversational suggestion of claws extending on every tap is NOT implemented by this asset.

Preview retains three-tap timings from pack15, with thin shadow/highlight scratch pairs appearing at each contact, growing over100ms and fading fully after1.6s. Scratches remain fixed to the fridge, draw underneath paw, and avoid the center seam. Approximate claw offsets in preview pixels: (-36,35),(-8,55),(21,54),(48,31) from pose center. Correct them against final game transform/collision shape when wiring.

Claude: implement marks as bounded short-lived cosmetic effects only, attached to fridge/world coordinates rather than screen coordinates when scrolling. No permanent damage, extra collisions, scoring or difficulty changes implied. Match actual claw contact events, honor reduced-motion settings, reuse effect storage; no unbounded decal accumulation. Current browser review starts paused for reduced motion. No src/game or public/art changes here. Review only, not live.
