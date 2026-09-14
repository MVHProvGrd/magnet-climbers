/** Canvas-native fridge objects. Art stays inside the existing collision boxes. */
import type { NoStickZone, PowerKind } from "./types";
const TAU = Math.PI * 2;
function oval(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
}
function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, r = 0) {
  c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill();
}
function line(c: CanvasRenderingContext2D, pts: number[], color: string, width = 2) {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke();
}
function label(c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string) {
  c.fillStyle = color; c.font = `800 ${size}px system-ui`; c.textAlign = "center"; c.fillText(s, x, y);
}
function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  c.fillStyle = color; c.beginPath();
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, d = i % 2 ? r * .45 : r; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
  c.closePath(); c.fill();
}
function tooth(c: CanvasRenderingContext2D, x: number, y: number, scale = 1) {
  c.save(); c.translate(x, y); c.scale(scale, scale); c.fillStyle = "#fff9e6";
  c.beginPath(); c.moveTo(-10, -8); c.bezierCurveTo(-18, -22, 0, -25, 0, -18);
  c.bezierCurveTo(17, -26, 19, -9, 11, 7); c.bezierCurveTo(7, 20, 4, 17, 2, 4);
  c.bezierCurveTo(-3, -2, -3, 19, -9, 15); c.closePath(); c.fill(); c.restore();
}

export const PAPER_ADDITIONS = ["Midnight Pizza Menu", "Lost Sock Notice", "Moon Camp Postcard", "Tiny Chef Recipe", "School Aquarium Trip", "Kitchen Gig Ticket", "Fridge Family Portrait", "Secret Treasure Map", "Plant Watering Rota", "Monster Math Homework", "Breakfast Blueprint", "Dog Ate My Shopping List"];
/** Twelve distinct compositions, not recolors of the old drawings. 100x100. */
export function drawPaperPrint(c: CanvasRenderingContext2D, variant: number) {
  c.save(); c.beginPath(); c.rect(0, 0, 100, 100); c.clip(); c.lineCap = "round"; c.lineJoin = "round";
  box(c, 0, 0, 100, 100, ["#fff2d5", "#ffe7b3", "#d7e7f3", "#eef2cc"][variant % 4]);
  switch (variant % 12) {
    case 0:
      box(c, 0, 0, 100, 22, "#b9413c"); label(c, "MIDNIGHT PIZZA", 50, 15, 10, "#fff6df");
      oval(c, 31, 49, 22, 22, "#b9743d"); oval(c, 31, 48, 19, 19, "#ffd468");
      for (const [x,y] of [[22,39],[38,40],[27,54],[40,55]]) oval(c,x,y,4,4,"#bd4338");
      for (let i=0;i<4;i++) { line(c,[60,34+i*10,91,34+i*10],"#946f51",2); }
      label(c,"OPEN UNTIL THE MOON SETS",50,83,6,"#763f34"); label(c,"EXTRA CHEESE? ALWAYS.",50,93,6,"#763f34"); break;
    case 1:
      label(c,"MISSING",50,19,17,"#4b4853"); label(c,"ONE VERY GOOD SOCK",50,29,6,"#4b4853");
      box(c,36,36,23,33,"#6b9cb8",3); box(c,23,61,36,16,"#6b9cb8",7);
      for (let i=0;i<3;i++) box(c,36,39+i*7,23,3,"#e6d886");
      for(let i=0;i<7;i++) line(c,[9+i*13,88,9+i*13,100],"#847262",1);
      label(c,"LAST SEEN: LAUNDRY",50,86,7,"#4b4853"); break;
    case 2:
      box(c,5,5,90,70,"#203957"); for(let i=0;i<9;i++) star(c,12+i*9,12+(i%3)*12,2,"#fff1b1");
      oval(c,73,25,13,13,"#f4e3b4"); oval(c,49,76,57,27,"#b6c1c9");
      c.fillStyle="#de765b"; c.beginPath(); c.moveTo(22,64); c.lineTo(43,36); c.lineTo(63,65); c.fill();
      c.fillStyle="#59394c"; c.beginPath(); c.moveTo(38,64); c.lineTo(43,45); c.lineTo(49,65); c.fill();
      label(c,"GREETINGS FROM MOON CAMP",50,90,6,"#344a58"); break;
    case 3:
      label(c,"GRANDMA'S PANCAKES",50,15,8,"#65674c");
      for(let i=0;i<4;i++) { box(c,9,25+i*11,5,5,"#cacc91"); line(c,[21,27+i*11,66,27+i*11],"#97946f",1.5); }
      oval(c,56,78,32,9,"#8fadb6"); for(let i=0;i<3;i++) oval(c,55,75-i*5,24,7,"#d5a15c");
      box(c,48,58,13,8,"#ffe582",2); label(c,"FLIP WITH CONFIDENCE",50,95,6,"#65674c"); break;
    case 4:
      box(c,0,0,100,100,"#b9e2e2"); label(c,"AQUARIUM FIELD TRIP",50,15,8,"#246779");
      oval(c,49,49,31,20,"#5d9baa"); c.fillStyle="#5d9baa"; c.beginPath(); c.moveTo(70,46); c.lineTo(92,34); c.lineTo(91,62); c.fill();
      oval(c,31,44,3,3,"#fff"); oval(c,31,44,1.5,1.5,"#294452");
      for(let i=0;i<3;i++) oval(c,14+i*7,25+i*8,2,2,"#fff");
      label(c,"THURSDAY / BRING A LUNCH",50,81,6,"#246779"); label(c,"permission slip signed?",50,92,6,"#246779"); break;
    case 5:
      box(c,0,0,100,100,"#e8b1ba"); box(c,7,8,86,83,"#392c50",4);
      label(c,"THE DISH RACKS",50,26,10,"#ffe88f"); label(c,"LIVE IN THE KITCHEN",50,37,6,"#f3ced8");
      oval(c,50,62,20,16,"#cc647f"); line(c,[30,43,70,77],"#ffe6a5",3); line(c,[71,43,30,77],"#ffe6a5",3);
      label(c,"FRIDAY 8PM / ADMIT ONE",50,86,6,"#f3ced8"); break;
    case 6:
      label(c,"MY WEIRD FAMILY",50,14,8,"#667787");
      for(let i=0;i<3;i++) { const x=20+i*29, y=36+(i%2)*8;
        oval(c,x,y,8,9,["#e59e70","#7fa9c5","#86b578"][i]); line(c,[x,y+10,x,y+31],"#596f89",3);
        line(c,[x-10,y+18,x,y+14,x+10,y+18],"#596f89",2); line(c,[x-8,y+40,x,y+30,x+8,y+40],"#596f89",2); }
      label(c,"YES, THE CAT COUNTS",50,93,7,"#667787"); break;
    case 7:
      box(c,0,0,100,100,"#dfc697"); label(c,"OPERATION: SNACKS",50,15,8,"#78523b");
      c.setLineDash([3,4]); c.strokeStyle="#8b6650"; c.lineWidth=2; c.beginPath(); c.moveTo(15,76); c.bezierCurveTo(83,96,7,23,79,35); c.stroke(); c.setLineDash([]);
      line(c,[72,27,85,41],"#bd4545",4); line(c,[85,27,72,41],"#bd4545",4);
      for(const [x,y] of [[20,35],[68,74]]) { c.fillStyle="#66825c"; c.beginPath(); c.moveTo(x-8,y+8); c.lineTo(x,y-12); c.lineTo(x+8,y+8); c.fill(); }
      label(c,"X MARKS THE BISCUITS",50,95,6,"#78523b"); break;
    case 8:
      label(c,"WATER ME, MAYBE",50,15,9,"#477654");
      box(c,33,57,34,24,"#c98768",4); line(c,[50,58,50,32],"#588563",3);
      for(const [x,y] of [[39,36],[60,27],[39,49],[61,45]]) oval(c,x,y,11,5,"#77a873");
      for(let i=0;i<7;i++) box(c,10+i*12,89,8,7,i===2?"#5f967d":"#e1d8b1"); break;
    case 9:
      for(let y=20;y<100;y+=12) line(c,[5,y,95,y],"#b7cbd8",.6); line(c,[15,0,15,100],"#d69b9b",1);
      label(c,"MONSTER MATH",55,15,9,"#5c6380"); label(c,"2 + 2 = ROAR",53,34,9,"#5c6380");
      oval(c,50,62,23,19,"#90b77a"); for(const x of [40,58]) { oval(c,x,55,5,5,"#fff"); oval(c,x,55,2,2,"#374754"); }
      line(c,[36,69,64,69],"#374754",2); star(c,83,83,9,"#d67c63"); break;
    case 10:
      box(c,0,0,100,100,"#3a6684"); label(c,"BREAKFAST Mk. IV",50,15,9,"#eff6d9");
      c.strokeStyle="#d7e7d4"; c.lineWidth=1; c.strokeRect(20,30,60,42); c.strokeRect(27,37,46,25);
      oval(c,39,49,8,8,"#fff0bf"); oval(c,39,49,4,4,"#dfbb66");
      line(c,[10,80,90,80],"#d7e7d4",1); line(c,[10,77,10,83],"#d7e7d4",1); line(c,[90,77,90,83],"#d7e7d4",1);
      label(c,"PATENT PENDING",50,93,7,"#eff6d9"); break;
    case 11:
      label(c,"SHOPPING LIST",50,16,10,"#6c665d");
      for(let i=0;i<4;i++) label(c,["milk","eggs","dog treats","MORE dog treats"][i],48,32+i*12,8,"#766d60");
      for(const x of [86,94,82]) oval(c,x,75+(x%3)*6,8,9,"#c6d2d5");
      for(const [x,y] of [[25,86],[64,84]]) { oval(c,x,y,4,3,"#bd9773"); for(let k=0;k<3;k++) oval(c,x-4+k*4,y-5,1.5,2,"#bd9773"); } break;
  }
  c.restore();
}

export const BUSINESS_MAGNETS = [
  ["Bright Smile Dentist", "DENTIST"], ["Midnight Pizza", "PIZZA"], ["Happy Paws Vet", "VET"],
  ["Emergency Plumber", "PLUMBER"], ["Takeaway Noodles", "NOODLES"], ["Library Due Date", "LIBRARY"],
  ["School Bus Hotline", "SCHOOL"], ["Corner Bakery", "BAKERY"],
] as const;
/** Printed vinyl advertising magnets: 100x60, with actual miniature business art. */
export function drawBusinessMagnet(c: CanvasRenderingContext2D, index: number) {
  c.save(); c.beginPath(); c.rect(0,0,100,60); c.clip();
  const ink=["#377e92","#b73f33","#597d59","#356995","#a54b39","#645e86","#ac7834","#95554b"][index%8];
  box(c,0,0,100,60,"#faf0d9",4); box(c,0,0,100,5,ink); box(c,0,48,100,12,ink);
  switch(index%8) {
    case 0: tooth(c,21,27,.7); star(c,33,14,4,"#dfc06e"); break;
    case 1: oval(c,22,27,15,15,"#c48247"); oval(c,22,26,12,12,"#edc05b"); for(const [x,y] of [[16,21],[26,24],[20,32]]) oval(c,x,y,3,3,"#b53c33"); break;
    case 2: oval(c,21,31,9,7,ink); for(let i=0;i<3;i++) oval(c,12+i*9,18,4,5,ink); break;
    case 3: line(c,[13,39,29,17],ink,7); c.strokeStyle=ink; c.lineWidth=4; c.beginPath(); c.arc(29,15,8,0,Math.PI*1.5); c.stroke(); break;
    case 4: oval(c,22,29,17,10,ink); oval(c,22,26,17,5,"#e4c27d"); line(c,[12,11,30,30],"#665547",2); line(c,[22,8,34,29],"#665547",2); break;
    case 5: box(c,9,14,26,27,ink,2); box(c,13,17,18,21,"#fff5dd"); line(c,[22,17,22,38],ink,1); break;
    case 6: box(c,7,16,29,23,"#e3bb4d",4); box(c,11,19,21,9,"#546f7b",2); oval(c,13,40,4,4,"#424653"); oval(c,31,40,4,4,"#424653"); break;
    case 7: oval(c,22,27,17,10,"#c58b50"); for(let i=0;i<3;i++) line(c,[13+i*7,21,16+i*7,29],"#f8d694",2); break;
  }
  label(c,BUSINESS_MAGNETS[index%8][1],68,23,10,ink);
  label(c,["KEEP SMILING","HOT & FRESH","SMALL PAWS","24 HOUR HELP","WOK THIS WAY","ONE MORE BOOK","SAFE RIDES","FRESH AT DAWN"][index%8],67,34,4.5,ink);
  line(c,[45,41,89,41],ink,.8); label(c,"555 • 01"+String(index).padStart(2,"0"),50,56,7,"#fff5df");
  c.restore();
}

/** A real-looking horseshoe magnet mounted on a colored steel backing. */
export function drawFieldMagnet(c: CanvasRenderingContext2D, z: NoStickZone, repel: boolean) {
  c.save(); c.translate(z.x,z.y); c.scale(z.w/100,z.h/100);
  const color=repel?"#ce4c44":"#438cb9";
  box(c,0,0,100,100,repel?"#773c39":"#294f69",8);
  const g=c.createLinearGradient(0,0,100,100); g.addColorStop(0,"#fcf1cf"); g.addColorStop(.25,color); g.addColorStop(1,repel?"#8e2d36":"#245575");
  c.fillStyle=g; c.fillRect(3,3,94,94);
  c.strokeStyle="#263444"; c.lineWidth=22; c.beginPath(); c.moveTo(26,22); c.lineTo(26,48); c.bezierCurveTo(26,80,74,80,74,48); c.lineTo(74,22); c.stroke();
  c.strokeStyle=color; c.lineWidth=18; c.stroke();
  box(c,17,16,18,18,"#dbe4e6",2); box(c,65,16,18,18,"#dbe4e6",2);
  line(c,[21,19,31,19],"#fff",2); line(c,[69,19,79,19],"#fff",2);
  for(const side of [-1,1]) {
    const x=50+side*12, sign=repel?side:-side;
    line(c,[x-sign*4,42,x+sign*4,42,x+sign,38],"#fff1d2",2);
    line(c,[x+sign*4,42,x+sign,46],"#fff1d2",2);
  }
  label(c,repel?"N":"S",50,90,11,"#f5e8c8"); c.restore();
}

/** Pickups are collectible fridge toys: chunky silhouettes, soft shadows and a face/detail to remember. */
export function drawPickupObject(c: CanvasRenderingContext2D, kind: PowerKind) {
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  const ink = "#263241";
  const shadow = (x: number, y: number, rx: number, ry: number) => oval(c, x, y, rx, ry, "rgba(9,16,25,.34)");
  if (kind === "coin") {
    shadow(2, 15, 15, 4); oval(c, 1, 1, 16, 17, ink); oval(c, -1, -2, 14, 15, "#e4a83e");
    oval(c, -3, -5, 10, 11, "#ffd86b"); oval(c, -6, -8, 3, 2, "#fff4b6");
    label(c, "+", -2, 2, 15, "#9b6527"); star(c, 7, 7, 4, "#fff0a3");
  }
  if (kind === "gem") {
    shadow(2, 15, 14, 4); c.fillStyle = ink; c.beginPath(); c.moveTo(-15, -5); c.lineTo(-7, -17); c.lineTo(8, -15); c.lineTo(16, -4); c.lineTo(1, 17); c.closePath(); c.fill();
    c.fillStyle = "#42b9da"; c.beginPath(); c.moveTo(-11, -5); c.lineTo(-5, -12); c.lineTo(8, -11); c.lineTo(12, -3); c.lineTo(0, 12); c.closePath(); c.fill();
    c.fillStyle = "#9beeff"; c.beginPath(); c.moveTo(-5, -12); c.lineTo(1, -3); c.lineTo(8, -11); c.lineTo(12, -3); c.lineTo(0, 1); c.closePath(); c.fill();
    line(c, [-11, -5, 0, 1, 0, 12], "#e3fcff", 1.5); star(c, -10, -15, 4, "#fff6be");
  }
  if (kind === "heart") {
    shadow(1, 15, 19, 4); box(c, -18, -12, 36, 28, ink, 8); box(c, -15, -9, 30, 23, "#fff3d3", 6);
    box(c, -5, -7, 10, 19, "#e46678", 2); box(c, -12, -1, 24, 8, "#e46678", 2);
    line(c, [-9, -13, -9, -18, 9, -18, 9, -13], "#d7976e", 3); oval(c, -9, -4, 2, 2, "#fff"); oval(c, 9, -4, 2, 2, "#fff");
  }
  if (kind === "magnet") {
    shadow(0, 16, 19, 4); c.strokeStyle = ink; c.lineWidth = 14; c.beginPath(); c.moveTo(-13, -13); c.lineTo(-13, 1); c.bezierCurveTo(-13, 22, 13, 22, 13, 1); c.lineTo(13, -13); c.stroke();
    c.strokeStyle = "#ef665e"; c.lineWidth = 10; c.stroke(); box(c, -19, -17, 11, 10, ink, 2); box(c, 8, -17, 11, 10, ink, 2);
    box(c, -17, -16, 8, 7, "#f2f0d6", 1); box(c, 9, -16, 8, 7, "#f2f0d6", 1); star(c, 0, -3, 5, "#ffdb63");
    oval(c, -6, -1, 2, 2, "#fff"); oval(c, 6, -1, 2, 2, "#fff");
  }
  if (kind === "slowmo") {
    shadow(1, 15, 18, 4); oval(c, 1, 3, 18, 16, ink); oval(c, 0, 0, 15, 13, "#ef795d"); oval(c, -2, -2, 11, 11, "#fff1d1");
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; line(c, [-2 + Math.cos(a) * 7, -2 + Math.sin(a) * 7, -2 + Math.cos(a) * 9, -2 + Math.sin(a) * 9], "#69584e", 1.5); }
    line(c, [-2, -8, -2, -2, 5, 2], "#69584e", 2.2); line(c, [-8, -14, -2, -20, 5, -14], "#7ca76e", 4); oval(c, -2, -2, 2, 2, "#69584e");
  }
  if (kind === "reach") {
    shadow(2, 14, 18, 4); box(c, -18, -13, 24, 27, ink, 7); box(c, -14, -10, 17, 21, "#efc95f", 5); box(c, -9, -7, 10, 10, "#ed8653", 3);
    box(c, 3, -5, 17, 9, ink, 2); box(c, 4, -3, 17, 6, "#fff2bd", 1); for (let i = 0; i < 5; i++) line(c, [7 + i * 3, -3, 7 + i * 3, 1], "#645a4e", 1);
    line(c, [20, -6, 20, 6], "#d9e6e4", 3); line(c, [20, -6, 23, -3], "#d9e6e4", 2); line(c, [20, 6, 23, 3], "#d9e6e4", 2);
  }
  if (kind === "extra") {
    shadow(0, 17, 15, 4); box(c, -15, -18, 30, 36, ink, 8); box(c, -12, -15, 24, 30, "#f2c970", 6); box(c, -8, -11, 16, 24, "#4e7c8a", 6);
    oval(c, 0, -5, 5, 5, "#b9e6a4"); line(c, [0, 1, 0, 9], "#b9e6a4", 3.5); line(c, [-6, 3, 0, 5, 6, 3], "#b9e6a4", 3); line(c, [-5, 13, 0, 8, 5, 13], "#b9e6a4", 3);
    oval(c, -2, -6, 1, 1, ink); oval(c, 2, -6, 1, 1, ink); star(c, 14, -14, 6, "#fff0a6");
  }
  c.restore();
}

/** Big non-magnetic fridge objects. They should read by silhouette, not by a caption. */
export function drawObstacleObject(c: CanvasRenderingContext2D, kind: "glass" | "plastic" | "gap" | "vent") {
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  const ink = "#263241";
  if (kind === "glass") {
    box(c, 3, 3, 94, 94, ink, 9); box(c, 8, 8, 84, 84, "#8ed4dc", 6);
    box(c, 13, 13, 74, 74, "#467f96", 3);
    for (const [x, y, w, h, color] of [[20, 24, 22, 19, "#d99767"], [56, 24, 24, 19, "#e9c967"], [26, 51, 18, 17, "#83b879"], [55, 52, 25, 16, "#ce7a87"]] as const) box(c, x, y, w, h, color, 4);
    line(c, [17, 46, 83, 23], "rgba(232,255,255,.72)", 4); line(c, [27, 81, 79, 53], "rgba(232,255,255,.28)", 2);
    oval(c, 28, 31, 3, 3, "#fff5cc"); oval(c, 67, 62, 3, 3, "#fff5cc");
  }
  if (kind === "plastic") {
    box(c, 5, 8, 90, 84, ink, 12); box(c, 10, 13, 80, 74, "#d8e55e", 8);
    box(c, 18, 20, 64, 60, "#7f9d59", 5); for (let x = 24; x <= 76; x += 10) { box(c, x, 23, 4, 54, "#d2e78a", 2); line(c, [x + 1, 25, x + 1, 74], "#5e754e", 1); }
    for (const x of [17, 83]) { oval(c, x, 51, 5, 5, "#f0f3ce"); oval(c, x, 51, 2, 2, "#71837a"); }
    line(c, [18, 17, 82, 17], "rgba(255,255,255,.8)", 3);
  }
  if (kind === "gap") {
    box(c, 5, 4, 90, 92, ink, 9); box(c, 16, 10, 68, 80, "#101820", 5);
    const g = c.createLinearGradient(0, 15, 0, 88); g.addColorStop(0, "#27323b"); g.addColorStop(.5, "#05080c"); g.addColorStop(1, "#33424c");
    c.fillStyle = g; c.fillRect(25, 12, 50, 76);
    for (let y = 20; y < 84; y += 12) line(c, [29, y, 71, y], "rgba(113,138,148,.28)", 2);
    for (const [x, y] of [[20, 28], [78, 64], [82, 19]]) { oval(c, x, y, 3, 3, "#bcebf0"); line(c, [x - 4, y + 5, x + 2, y + 11], "#78c4d2", 1.5); }
  }
  if (kind === "vent") {
    box(c, 4, 8, 92, 84, ink, 12); box(c, 10, 14, 80, 72, "#5c6c76", 8);
    for (let y = 24; y <= 72; y += 12) { box(c, 19, y, 62, 5, "#1c2933", 2); line(c, [22, y + 1, 77, y + 1], "#a7bac0", 1); }
    oval(c, 27, 26, 2, 2, "#e5fbfa"); oval(c, 73, 74, 2, 2, "#e5fbfa");
  }
  c.restore();
}

/** Machined tabs, spring clips and knurled bars all fill the legal silver hold. */
export function drawHardwareGrip(c: CanvasRenderingContext2D, z: { x: number; y: number; w: number; h: number }, variant: number) {
  c.save(); c.translate(z.x,z.y); c.scale(z.w/100,z.h/24);
  const metal=c.createLinearGradient(0,0,0,24);
  metal.addColorStop(0,"#faf9e8"); metal.addColorStop(.25,"#b9c9cf"); metal.addColorStop(.5,"#edf8f7"); metal.addColorStop(1,"#657c8a");
  c.fillStyle=metal; c.fillRect(0,0,100,24);
  c.strokeStyle="#526777"; c.lineWidth=1; c.strokeRect(.5,.5,99,23);
  const v=((variant%4)+4)%4;
  if(v===0) {
    // Key fob clasp: folded ends and a broad brushed center.
    for(const x of [7,88]) { box(c,x,3,5,18,"#718691",2); line(c,[x+1,4,x+1,20],"#fff",1); }
    line(c,[20,7,79,7],"#fff",1); line(c,[20,18,79,18],"#738693",1);
  } else if(v===1) {
    // Binder-clip hinge; the whole backing remains silver and catchable.
    for(let x=28;x<75;x+=6) { line(c,[x,3,x,21],"#667d8b",2); line(c,[x+2,4,x+2,19],"#fff",1); }
    for(const x of [8,86]) oval(c,x,12,5,7,"#c1d2d7");
  } else if(v===2) {
    // Stamped chrome tab with rivets.
    for(const x of [10,90]) { oval(c,x,12,5,6,"#738998"); oval(c,x-1,10,3,3,"#e9f6f5"); }
    line(c,[23,6,77,6,77,18,23,18,23,6],"#9bafb7",1);
  } else {
    for(let x=7;x<95;x+=5) line(c,[x,5,x+3,19],"#8ba0ad",1);
    line(c,[3,3,97,3],"#fff",1.5);
  }
  c.restore();
}
