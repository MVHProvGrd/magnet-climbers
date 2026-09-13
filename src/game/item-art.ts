// Code-native illustrations: 100x100 art box, no collision or simulation state.
const TAU = Math.PI * 2;
export function drawObject(c: CanvasRenderingContext2D, id: number) {
  c.save(); c.beginPath(); c.rect(0, 0, 100, 100); c.clip();
  const rect = (x: number, y: number, w: number, h: number, color: string, r = 0) => { c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };
  const oval = (x: number, y: number, rx: number, ry: number, color: string) => { c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };
  const line = (points: number[], color: string, width = 2) => { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(points[0], points[1]); for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]); c.stroke(); };
  const label = (t: string, y: number, color = "#394758", size = 9) => { c.fillStyle = color; c.font = `800 ${size}px system-ui`; c.textAlign = "center"; c.fillText(t, 50, y); };
  const eyes = (x: number, y: number, gap = 9) => { oval(x - gap, y, 2, 2.5, "#334554"); oval(x + gap, y, 2, 2.5, "#334554"); };
  c.lineCap = "round"; c.lineJoin = "round";
  rect(0, 0, 100, 100, ["#fce4cb", "#d9ebd1", "#e0e8fb", "#d5eef2"][id % 4]);
  if (id === 12) {
    oval(50, 49, 32, 31, "#c87e43"); oval(50, 46, 29, 27, "#ed96b5");
    oval(50, 46, 10, 10, "#b97041"); oval(50, 44, 8, 8, "#fce4cb");
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12, x = 50 + Math.cos(a) * 20, y = 46 + Math.sin(a) * 19; line([x, y, x + Math.sin(a) * 4, y + Math.cos(a) * 4], ["#fff7d0", "#7ccddc", "#a569b8"][i % 3], 2.5); }
    label("DONUT WORRY", 93);
  } else if (id === 13) {
    oval(50, 52, 26, 31, "#508b65"); oval(50, 48, 22, 28, "#bdd87c"); oval(50, 58, 12, 13, "#b47852"); eyes(50, 36);
    label("AVO GOOD CLIMB", 93, "#416b52", 8);
  } else if (id === 14) {
    line([27, 67, 14, 57, 17, 70, 39, 70], "#629c75", 9);
    oval(48, 59, 25, 18, "#81b887"); rect(59, 26, 22, 39, "#81b887", 9); rect(63, 29, 27, 17, "#81b887", 7);
    for (let i = 0; i < 4; i++) oval(31 + i * 9, 41 - i * 2, 4, 6, "#edb668");
    line([36, 70, 35, 79, 42, 79], "#629c75", 5); line([60, 70, 62, 79, 68, 79], "#629c75", 5); oval(76, 34, 2, 2, "#334554"); label("TINY BUT MIGHTY", 95, "#416b52", 8);
  } else if (id === 15) {
    for (const [x, y, r] of [[30, 41, 16], [49, 32, 22], [70, 43, 18]]) oval(x, y, r, r, "#fffdf6");
    rect(26, 40, 47, 19, "#fffdf6", 8); eyes(50, 47);
    for (let i = 0; i < 4; i++) line([29 + i * 14, 68, 25 + i * 14, 77], "#72b8d9", 4); label("RAIN CHECK", 96);
  } else if (id === 16) {
    oval(49, 65, 34, 7, "#8bcbd5"); oval(47, 51, 26, 18, "#f8ca54"); oval(64, 32, 16, 17, "#ffdc68");
    rect(73, 34, 18, 8, "#e8974a", 4); oval(68, 27, 2.5, 3, "#334554"); oval(40, 50, 12, 8, "#eeb546"); label("LUCKY DUCK", 92);
  } else if (id === 17) {
    c.fillStyle = "#dca565"; c.beginPath(); c.moveTo(31, 45); c.lineTo(69, 45); c.lineTo(50, 83); c.closePath(); c.fill();
    for (let i = 0; i < 3; i++) line([36 + i * 6, 49, 53 + i * 3, 67 - i * 6], "#b77c49", 1);
    oval(50, 35, 23, 20, "#eaa5bb"); oval(38, 46, 8, 8, "#eaa5bb"); oval(62, 45, 8, 8, "#eaa5bb"); eyes(50, 35); oval(51, 13, 5, 5, "#d86579"); label("SUNDAE SUMMIT", 96, "#7a5364", 8);
  } else if (id === 18) {
    for (let i = 0; i < 3; i++) line([8, 68 + i * 6, 30, 65 + i * 6, 62, 70 + i * 6, 92, 65 + i * 6], "#91c9d7", 2);
    c.fillStyle = "#eaa266"; c.beginPath(); c.moveTo(65, 46); c.lineTo(87, 29); c.lineTo(87, 63); c.closePath(); c.fill();
    oval(46, 45, 27, 18, "#f3ba75"); oval(33, 40, 3, 3, "#334554"); line([48, 37, 58, 45, 48, 52], "#d38d5d", 2); oval(16, 23, 4, 4, "#fff"); label("GONE FISHING", 96);
  } else if (id === 19) {
    line([50, 20, 50, 12], "#637c98", 3); oval(50, 10, 4, 4, "#ed8fa1"); rect(26, 22, 48, 34, "#819fbc", 7); rect(31, 27, 38, 21, "#d7eef0", 4); eyes(50, 36, 10);
    rect(34, 59, 32, 21, "#819fbc", 5); line([29, 63, 21, 72], "#637c98", 5); line([71, 63, 79, 55], "#637c98", 5);
    line([41, 80, 38, 85], "#637c98", 5); line([59, 80, 62, 85], "#637c98", 5); oval(50, 67, 4, 4, "#ed8fa1"); label("BEEP BOOP", 98);
  } else if (id === 20) {
    rect(0, 0, 100, 100, "#536774", 4); rect(4, 3, 92, 94, "#223b4b", 4); rect(15, 15, 70, 64, "#152b39", 4);
    label("WATER + ICE", 11, "#b1d7e1", 5); rect(39, 19, 22, 8, "#71959f", 2); rect(46, 25, 8, 10, "#c2d8db", 1);
    line([50, 36, 50, 58], "#73c9e5", 1.3); rect(36, 54, 28, 21, "#618f9f", 2); rect(38, 55, 24, 3, "#b1e6ef");
    for (let i = 0; i < 8; i++) line([21 + i * 8, 85, 21 + i * 8, 92], "#8da6ad", 2);
    label("NO GRIP", 99, "#b1d7e1", 4);
  } else if (id === 21) {
    rect(0, 0, 100, 100, "#fff3d9"); rect(0, 0, 100, 20, "#df7e83"); label("A VERY BUSY MONTH", 13, "#fff8ec", 6);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 7; j++) {
      const x = 5 + j * 13, y = 25 + i * 13; rect(x, y, 12, 12, (i + j) % 5 === 0 ? "#f8d9b4" : "#f5ead4");
      c.fillStyle = "#807971"; c.font = "4px system-ui"; c.textAlign = "left";
      if (i * 7 + j < 31) c.fillText(String(i * 7 + j + 1), x + 2, y + 5);
    }
    oval(49, 58, 5, 5, "#e99ca5"); label("snacks / naps / climb", 96, "#867466", 5);
  } else if (id === 22) {
    rect(0, 0, 100, 100, "#659bb6", 6); rect(4, 2, 92, 95, "#a2cede", 5);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
      const x = 10 + j * 44, y = 8 + i * 17; rect(x, y, 35, 13, "#57849e", 3); rect(x + 3, y + 1, 29, 10, "#d0edf0", 2); line([x + 7, y + 3, x + 17, y + 3], "#fff", 1);
    }
    label("PLASTIC / NO GRIP", 98, "#355a70", 4);
  }
  c.restore();
}
