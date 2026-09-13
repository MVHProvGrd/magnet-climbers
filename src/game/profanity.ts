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

function normalizeName(name: string): string {
  return deleet(name.toLowerCase()).replace(/[^a-z]/g, "");
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
    contain a short bad substring (Cassandra → "ass", Titus → "tit"). */
export function nameHasProfanity(name: string): boolean {
  const whole = normalizeName(name);
  if (!whole) return false;
  const tokens = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => deleet(t).replace(/[^a-z]/g, ""))
    .filter(Boolean);
  for (const bad of BLOCKED) {
    if (bad.length < 3) continue;
    if (bad.length === 3) {
      if (whole === bad || tokens.some((t) => t === bad)) return true;
    } else if (bad.length === 4) {
      if (whole === bad || whole.startsWith(bad) || tokens.some((t) => t === bad || t.startsWith(bad))) return true;
    } else {
      if (whole.includes(bad) || tokens.some((t) => t.includes(bad))) return true;
    }
  }
  return false;
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
