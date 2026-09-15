import json, base64, urllib.request, sys, os, time
K = os.environ["GEMINI_API_KEY"]
OUT = os.path.dirname(os.path.abspath(__file__))
ICONS = {
  "settings": "a small round glossy enamel fridge magnet with a chunky silver gear symbol in relief",
  "guide": "a small glossy enamel fridge magnet shaped like an open field-guide book with a red cover and cream pages",
  "story": "a small glossy enamel fridge magnet shaped like a rolled parchment scroll with a red wax seal",
  "help": "a small round glossy enamel fridge magnet, sky blue, with a bold white question mark in relief",
  "board": "a small glossy enamel fridge magnet shaped like a gold trophy cup",
  "chat": "a small glossy enamel fridge magnet shaped like a white speech bubble with three dots",
}
STYLE = ("Realistic product photograph, front view, soft upper-left light, real enamel and nickel edge, subtle scuffs, no text, "
  "no external shadow, centred with generous clear margins. IMPORTANT: place the object against a completely FLAT SOLID PURE MAGENTA "
  "background, hex #FF00FF, filling every pixel that is not the object; no checkerboard, gradient or scenery. No pink or purple on the object.")
for name, desc in ICONS.items():
    body = {"contents": [{"parts": [{"text": f"{desc}. {STYLE}"}]}], "generationConfig": {"responseModalities": ["IMAGE"]}}
    req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={K}",
        data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    for attempt in range(3):
        try:
            r = json.load(urllib.request.urlopen(req, timeout=120)); break
        except Exception as e:
            print(name, "retry", attempt, e); time.sleep(3)
    else: continue
    parts = r.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    img = next((p["inlineData"]["data"] for p in parts if "inlineData" in p), None)
    if not img: print(name, "no image", json.dumps(r)[:300]); continue
    open(f"{OUT}/{name}-magenta.png", "wb").write(base64.b64decode(img)); print(name, "ok")
