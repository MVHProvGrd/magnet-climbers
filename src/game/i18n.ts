import * as ru from "./lang/ru";
import * as es from "./lang/es";
import * as fr from "./lang/fr";
import * as pt from "./lang/pt";
import * as zh from "./lang/zh";
import * as zhHant from "./lang/zh-Hant";
import * as ja from "./lang/ja";
import * as ko from "./lang/ko";

/**
 * Languages. English is the source; other languages are looked up by the English string.
 * DOM panels are translated after they render (text nodes, titles, placeholders), the canvas
 * HUD and floats call t() directly. Anything without a translation stays English.
 */

export type Lang = "en" | "ru" | "es" | "fr" | "pt" | "zh" | "zh-Hant" | "ja" | "ko";
export const LANGS: { id: Lang; name: string }[] = [
  { id: "en", name: "English" }, { id: "es", name: "Español" }, { id: "fr", name: "Français" }, { id: "pt", name: "Português" },
  { id: "ru", name: "Русский" }, { id: "zh", name: "简体中文" }, { id: "zh-Hant", name: "繁體中文" }, { id: "ja", name: "日本語" }, { id: "ko", name: "한국어" },
];

let current: Lang = "en";
export const lang = () => current;
export function setLang(l: Lang) { current = l; if (typeof document !== "undefined") document.documentElement.lang = l; }
/** Browser language on first launch; the setting overrides it. */
export function detectLang(): Lang {
  const n = typeof navigator !== "undefined" ? navigator.language || "" : "";
  const l = n.toLowerCase();
  if (l.startsWith("zh")) return /hant|tw|hk|mo/.test(l) ? "zh-Hant" : "zh";
  const base = l.split("-")[0] as Lang;
  return LANGS.some((x) => x.id === base) ? base : "en";
}

export type Rule = [RegExp, (m: RegExpMatchArray) => string];

const TABLES: Record<Lang, { exact: Record<string, string>; rules: Rule[] }> = { en: { exact: {}, rules: [] }, ru, es, fr, pt, zh, "zh-Hant": zhHant, ja, ko };

/** Translate one string; unknown strings come back unchanged. */
export function t(s: string): string {
  if (current === "en") return s;
  const table = TABLES[current];
  const hit = table.exact[s];
  if (hit !== undefined) return hit;
  for (const [re, fn] of table.rules) { const m = s.match(re); if (m) return fn(m); }
  return s;
}

const ATTRS = ["title", "aria-label", "placeholder"];

/** Translate every text node and labelled attribute under a node, keeping surrounding whitespace. */
export function translateTree(root: Node) {
  if (current === "en" || typeof document === "undefined") return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const texts: Text[] = []; const els: Element[] = [];
  let n: Node | null = walker.currentNode;
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) texts.push(n as Text);
    else if (n.nodeType === Node.ELEMENT_NODE) els.push(n as Element);
    n = walker.nextNode();
  }
  for (const tx of texts) {
    const raw = tx.data; const core = raw.trim();
    if (!core) continue;
    // keep the exact whitespace around the text: inline spacing depends on it
    const lead = raw.slice(0, raw.indexOf(core)), trail = raw.slice(raw.indexOf(core) + core.length);
    const out = t(core);
    if (out !== core) tx.data = lead + out + trail;
    else if (lead || trail) { const whole = t(raw); if (whole !== raw) tx.data = whole; }
  }
  for (const e of els) for (const a of ATTRS) {
    const v = e.getAttribute(a); if (!v) continue;
    const out = t(v); if (out !== v) e.setAttribute(a, out);
  }
}

/** Keep a live DOM subtree translated as panels, toasts and async rows appear. */
export function watchTree(root: Node) {
  if (typeof MutationObserver === "undefined") return;
  const mo = new MutationObserver((records) => {
    if (current === "en") return;
    for (const r of records) {
      if (r.type === "characterData") translateTree(r.target);
      for (const added of r.addedNodes) translateTree(added);
    }
  });
  mo.observe(root, { childList: true, subtree: true, characterData: true });
}
