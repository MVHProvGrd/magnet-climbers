"""Chat avatars: cartoon sticker busts on flat magenta, keyed later by chroma-cut.py. Needs GEMINI_API_KEY in the env."""
import json, base64, urllib.request, os, time, sys
from concurrent.futures import ThreadPoolExecutor
K = os.environ["GEMINI_API_KEY"]
OUT = os.path.dirname(os.path.abspath(__file__))
AVATARS = json.load(open(os.path.join(OUT, "avatars.json")))
STYLE = ("Cute cartoon sticker portrait, head and shoulders, centred, facing the viewer, big simple eyes, thick dark outlines, "
  "flat bright colours with soft cel shading and a subtle glossy sticker highlight, rounded friendly shapes, kids' game avatar style. "
  "No text, no frame, no drop shadow, generous clear margins. IMPORTANT: place the character against a completely FLAT SOLID PURE "
  "MAGENTA background, hex #FF00FF, filling every pixel that is not the character; no checkerboard, gradient or scenery. "
  "No pink or magenta or purple anywhere on the character.")
def gen(entry):
    aid, _, desc = entry
    path = f"{OUT}/sources/{aid}-magenta.png"
    if os.path.exists(path): return aid, "skip"
    body = {"contents": [{"parts": [{"text": f"{desc}. {STYLE}"}]}], "generationConfig": {"responseModalities": ["IMAGE"]}}
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
