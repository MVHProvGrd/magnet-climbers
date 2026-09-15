// Reach pickup: glossy blue button badge with a bold navy double-headed arrow.
import { createCanvas } from "../../../node_modules/.cache/magnet-climbers-visual/node_modules/@napi-rs/canvas/index.js";
import { writeFileSync } from "node:fs";
const S = 256, c = createCanvas(S, S), ctx = c.getContext("2d");
const cx = S / 2, cy = S / 2 + 4, R = 100;
ctx.translate(cx, cy); ctx.rotate(-0.12);
// drop shadow
ctx.save(); ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 10;
ctx.fillStyle = "#1c3a52"; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
// metal rim
let g = ctx.createLinearGradient(-R, -R, R, R);
g.addColorStop(0, "#f4f7fa"); g.addColorStop(.45, "#9aa6b2"); g.addColorStop(.55, "#dfe5ea"); g.addColorStop(1, "#5d6873");
ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
// face
const rf = R - 9;
g = ctx.createRadialGradient(-rf * .35, -rf * .45, rf * .1, 0, 0, rf);
g.addColorStop(0, "#b9ecff"); g.addColorStop(.35, "#63c3ec"); g.addColorStop(.8, "#2a8fc0"); g.addColorStop(1, "#1a6b98");
ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rf, 0, Math.PI * 2); ctx.fill();
// inner edge darkening
g = ctx.createRadialGradient(0, 0, rf * .8, 0, 0, rf);
g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,30,60,.35)");
ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rf, 0, Math.PI * 2); ctx.fill();
// arrow
function arrow(dx, dy, col) {
  const L = 66, H = 22, hd = 30, w = 13;
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(-L, 0); ctx.lineTo(-L + hd, -H); ctx.lineTo(-L + hd, -w); ctx.lineTo(L - hd, -w); ctx.lineTo(L - hd, -H);
  ctx.lineTo(L, 0); ctx.lineTo(L - hd, H); ctx.lineTo(L - hd, w); ctx.lineTo(-L + hd, w); ctx.lineTo(-L + hd, H); ctx.closePath();
  ctx.save(); ctx.translate(dx, dy); ctx.fill(); ctx.restore();
}
ctx.save(); ctx.beginPath(); ctx.arc(0, 0, rf, 0, Math.PI * 2); ctx.clip();
arrow(0, 3, "rgba(255,255,255,.35)");
arrow(0, 0, "#12314d");
ctx.restore();
// gloss highlight
ctx.save(); ctx.beginPath(); ctx.arc(0, 0, rf, 0, Math.PI * 2); ctx.clip();
g = ctx.createLinearGradient(0, -rf, 0, 0);
g.addColorStop(0, "rgba(255,255,255,.7)"); g.addColorStop(1, "rgba(255,255,255,0)");
ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-6, -rf * .55, rf * .78, rf * .42, 0, 0, Math.PI * 2); ctx.fill();
ctx.restore();
// small specular
ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.ellipse(-52, -58, 14, 8, -0.6, 0, Math.PI * 2); ctx.fill();
writeFileSync(new URL("./reach-badge-v1.png", import.meta.url), c.toBuffer("image/png"));
// preview sheet at 46 px on light + dark
const p = createCanvas(240, 120), pc = p.getContext("2d");
pc.fillStyle = "#eef1f4"; pc.fillRect(0, 0, 120, 120); pc.fillStyle = "#1b1f26"; pc.fillRect(120, 0, 120, 120);
pc.drawImage(c, 37, 37, 46, 46); pc.drawImage(c, 157, 37, 46, 46);
writeFileSync(new URL("./preview-46px.png", import.meta.url), p.toBuffer("image/png"));
