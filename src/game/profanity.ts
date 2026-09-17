/* ============================================================================
   Content filter — usernames/display names and player-authored messages.
   A TypeScript port of the WordWeft ProfanityFilter, sharing the same word
   lists (LDNOOBW-merged multilingual profanity + reserved names) so both apps
   behave the same.

   Two tiers:
     • messageReason()  — for alliance/private messages: word-boundary token
       match, no leetspeak (so prose like "the assassin" never false-positives).
     • nameReason()     — for usernames/nation/ruler/alliance names: stricter,
       leetspeak-normalized, tiered substring matching plus a reserved-name
       guard against impersonating system/staff identities.
   ============================================================================ */
import PROFANITY from "./data/profanity.json";
import RESERVED from "./data/reservedNames.json";

const BLOCKED: Set<string> = new Set(
  (PROFANITY as string[]).map((w) => w.trim().toLowerCase()).filter(Boolean),
);

// Reserved identities — the JSON list plus a few Flotillas system senders so a
// player can't masquerade as the Harbor Office / War Ledger / a fake staff account.
const RESERVED_NAMES: Set<string> = new Set(
  [...(RESERVED as string[]), "magnetclimbers", "magnet climbers", "system", "admin", "claude"]
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean),
);

/** Map common leetspeak glyphs back to letters so "5h1t"/"f@g" normalize. */
function deleet(text: string): string {
  let out = "";
  for (const c of text) {
    switch (c) {
      case "0": out += "o"; break;
      case "1": case "|": out += "i"; break;
      case "3": out += "e"; break;
      case "4": case "@": out += "a"; break;
      case "5": case "$": out += "s"; break;
      case "7": case "+": out += "t"; break;
      case "8": out += "b"; break;
      case "9": out += "g"; break;
      default: out += c;
    }
  }
  return out;
}

/** A run of 3+ identical letters collapses to one, so "fuuuuck" reads as "fuck" without
    touching ordinary doubled letters like "book" or "seed" (those never run to three). */
function collapseRepeats(text: string): string {
  return text.replace(/(\p{L})\1{2,}/gu, "$1");
}

/** Full normalization for a single word/name: NFKC first, so a fullwidth or mathematical-
    bold disguise ("ｆｕｃｋ", "𝓯𝓾𝓬𝓴") folds back to plain letters before anything else runs,
    then lowercase, delete non-letters, collapse stretched-out repeats, and de-leet. */
function squash(text: string): string {
  return collapseRepeats(deleet(text.normalize("NFKC").toLowerCase())).replace(/[^a-z]/g, "");
}

function normalizeName(name: string): string {
  return squash(name);
}

/** Tiered substring/whole-word match shared by the name and word checks below: a 3-letter
    hit must be the entire word, a 4-letter hit may lead it, 5+ may sit anywhere inside it. */
function matchesBad(word: string, bad: string): boolean {
  if (bad.length === 3) return word === bad;
  if (bad.length === 4) return word === bad || word.startsWith(bad);
  return word.includes(bad);
}

/** True if this single word/token (after normalizing) is profane on its own. Also works on a
    whole name or message, since squash() strips separators too — "n i g g e r" squashes to
    "nigger" whether it arrived as one word or six space-separated letters. */
export function wordIsProfane(raw: string): boolean {
  const word = squash(raw);
  if (!word) return false;
  for (const bad of BLOCKED) {
    if (bad.length >= 3 && matchesBad(word, bad)) return true;
  }
  return false;
}

/** Gameplay/message filter: split on whitespace, strip non-letters per token,
    exact word-boundary match. Catches "fuck" but not "Scunthorpe". */
export function containsProfanity(text: string): boolean {
  if (!text) return false;
  return text
    .toLowerCase()
    .split(/\s+/)
    .some((word) => {
      const cleaned = word.replace(/[^a-z]/g, "");
      return cleaned.length > 0 && BLOCKED.has(cleaned);
    });
}

/** True if the normalized name is, or starts with, a reserved identity. */
export function isReservedName(name: string): boolean {
  const norm = normalizeName(name);
  if (!norm) return false;
  if (RESERVED_NAMES.has(norm)) return true;
  // "admin1", "system_2", "harborbot" …
  return [...RESERVED_NAMES].some((r) => r.length >= 3 && norm.startsWith(r));
}

/** Tiered profanity match for names — avoids nuking innocent names that merely
    contain a short bad substring (Cassandra → "ass", Titus → "tit"). Checking the whole
    name (separators and all) plus each token separately catches both a word buried in a
    longer name and a short exact-match token, without the whole-name substring check
    over-triggering on a short bad word that only happens to appear split across tokens. */
export function nameHasProfanity(name: string): boolean {
  if (!name.trim()) return false;
  if (wordIsProfane(name)) return true;
  const tokens = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.some((t) => wordIsProfane(t));
}

/** Validate a display name (climber name). Returns a
    user-facing reason if rejected, or null if it's fine. */
export function nameReason(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null; // emptiness handled by the caller's required-field check
  if (isReservedName(trimmed)) return "That name is reserved — please pick another.";
  if (nameHasProfanity(trimmed)) return "Let's keep it clean — please pick a different name.";
  return null;
}

/** Validate an alliance/private message (subject and/or body). Returns a
    user-facing reason if it contains profanity, or null if it's fine. */
export function messageReason(...parts: string[]): string | null {
  if (parts.some((p) => containsProfanity(p))) {
    return "Please keep messages civil — that wording isn't allowed.";
  }
  return null;
}

// A single letter, standing alone as its own word, three or more times in a row, is how
// a slur gets spelled out to dodge a token match ("n i g g e r"): each letter is its own
// token and far too short to ever hit the blocklist by itself. Joining runs like this back
// into one word before matching closes that gap without touching ordinary short words —
// "u ok", "a b" (two, not three) and normal sentences never have three in a row.
const LETTER_SPACED_RE = /\b\p{L}\b(?:[ \t]+\b\p{L}\b){2,}/gu;

/** Chat/message censor: profane words — including the evasions above (repeats, look-alike
    Unicode letters, spelling a word out one letter at a time) — become stars; everything
    else in the message is left untouched. `censored` says whether anything was starred, so
    a caller can count it as a strike the same way a plain profane word already does. */
export function censorChat(text: string): { clean: string; censored: boolean } {
  let censored = false;
  const star = (s: string) => "*".repeat(Math.min(s.length, 6));
  const spaced = text.replace(LETTER_SPACED_RE, (run) => {
    if (!wordIsProfane(run)) return run;
    censored = true;
    return star(run.replace(/\s+/g, ""));
  });
  const clean = spaced
    .split(/(\s+)/)
    .map((tok) => {
      if (/\s/.test(tok) || !wordIsProfane(tok)) return tok;
      censored = true;
      return star(tok);
    })
    .join("");
  return { clean, censored };
}
