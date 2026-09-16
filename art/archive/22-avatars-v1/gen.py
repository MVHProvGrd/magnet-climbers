"""Chat avatars: cartoon sticker busts on flat magenta, keyed later by chroma-cut.py. Needs GEMINI_API_KEY in the env."""
import json, base64, urllib.request, os, time, sys
from concurrent.futures import ThreadPoolExecutor
K = os.environ["GEMINI_API_KEY"]
OUT = os.path.dirname(os.path.abspath(__file__))
AVATARS = json.load(open(os.path.join(OUT, "avatars.json")))
LOOK = ("Cute cartoon sticker portrait, head and shoulders, centred, facing the viewer, big simple eyes, thick dark outlines, "
  "flat bright colours with soft cel shading and a subtle glossy sticker highlight, rounded friendly shapes, kids' game avatar style. "
  "No text, no frame, no drop shadow, generous clear margins. ")
def key_suffix(colour, hexcode, forbid):
    return (f"IMPORTANT: place the character against a completely FLAT SOLID PURE {colour} background, hex {hexcode}, "
      f"filling every pixel that is not the character; no checkerboard, gradient or scenery. No {forbid} anywhere on the character.")
STYLE = LOOK + key_suffix("MAGENTA", "#FF00FF", "pink or magenta or purple")
# Pink subjects cannot be keyed on magenta (their own colour reads as the key), so they
# are generated on green instead and cut with `chroma-cut.py --key=green`.
# purple dragon included: a magenta screen would eat purple art.
GREEN_KEY = {"donut", "popit", "unicorn", "clown", "purpledragon", "watermelon", "snowglobe", "opossum"}
# Gemini renders a polite sage green unless the prompt insists on the saturated
# screen colour; a muted green does not clear the keyer's threshold.
GREEN_STYLE = LOOK + ("IMPORTANT: place the character on a VIVID PURE NEON GREEN CHROMA KEY SCREEN, exact hex #00FF00 "
  "(red 0, green 255, blue 0) — the maximally saturated video green-screen colour, NOT sage, olive, lime, mint or any "
  "muted green. That flat screen colour must fill every pixel that is not the character; no checkerboard, gradient or "
  "scenery. No green anywhere on the character.")
def gen(entry):
    aid, _, desc = entry
    path = f"{OUT}/sources/{aid}-{'green' if aid in GREEN_KEY else 'magenta'}.png"
    if os.path.exists(path): return aid, "skip"
    style = GREEN_STYLE if aid in GREEN_KEY else STYLE
    body = {"contents": [{"parts": [{"text": f"{desc}. {style}"}]}], "generationConfig": {"responseModalities": ["IMAGE"]}}
    for attempt in range(4):
        try:
            req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={K}",
                data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
            r = json.load(urllib.request.urlopen(req, timeout=120))
            parts = r.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            img = next((p["inlineData"]["data"] for p in parts if "inlineData" in p), None)
            if not img: return aid, "no image " + json.dumps(r)[:200]
            open(path, "wb").write(base64.b64decode(img)); return aid, "ok"
        except Exception as e:
            time.sleep(4 * (attempt + 1)); last = e
    return aid, f"failed {last}"
only = set(sys.argv[1:])
todo = [a for a in AVATARS if not only or a[0] in only]
with ThreadPoolExecutor(4) as ex:
    for aid, status in ex.map(gen, todo): print(aid, status, flush=True)
