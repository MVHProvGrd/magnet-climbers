/**
 * Fit audio masters into the shipped format.
 *
 * Codex delivers foley as mono 48 kHz WAV, which is the right thing to keep in the archive
 * and the wrong thing to ship: everything under public/ is precached, so 51 seconds of PCM
 * was 4.8 MB on every install. These are half-second one-shots, so mp3 at 96 kbps mono is
 * transparent for the material and about a seventh of the size. mp3 rather than Opus because
 * the app is installed as an iOS PWA, where Opus-in-WebM is not safe to rely on.
 *
 * The WAV masters stay in art/archive; this only writes public/.
 */
import { readdirSync, existsSync, mkdirSync, statSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const PACKS = ["33-object-audio-v1", "34-rubber-launch-v1"];
const OUT = "public/audio/objects-v1";
const BITRATE = "96k";

mkdirSync(OUT, { recursive: true });

// drop any previously shipped WAVs: the mp3 replaces them, and a stray copy would
// quietly go back into the precache
for (const f of readdirSync(OUT).filter((f) => f.endsWith(".wav"))) rmSync(join(OUT, f));

let masters = 0, before = 0, after = 0;
for (const pack of PACKS) {
  const dir = `art/archive/${pack}/ready`;
  if (!existsSync(dir)) { console.log("missing", dir); continue; }
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".wav"))) {
    const src = join(dir, f), dst = join(OUT, f.replace(/\.wav$/, ".mp3"));
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", src, "-ac", "1", "-c:a", "libmp3lame", "-b:a", BITRATE, dst]);
    masters++; before += statSync(src).size; after += statSync(dst).size;
  }
}
console.log(`${masters} samples: ${(after / 1024) | 0} KB shipped (masters were ${(before / 1024) | 0} KB)`);
