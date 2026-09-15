/** Canvas-native fridge objects. Art stays inside the existing collision boxes. */
import type { NoStickZone, PowerKind } from "./types";
const TAU = Math.PI * 2;
function oval(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string | CanvasGradient | CanvasPattern) {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
}
function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string | CanvasGradient | CanvasPattern, r = 0) {
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

/** Real-material pickup props: no mascots, no stickers, just recognizable objects. */
export function drawPickupObject(c: CanvasRenderingContext2D, kind: PowerKind) {
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  const shadow = (x: number, y: number, rx: number, ry: number) => oval(c, x, y, rx, ry, "rgba(22,30,38,.22)");
  if (kind === "coin") {
    shadow(2, 15, 15, 3); const edge = c.createLinearGradient(-15, -12, 14, 15); edge.addColorStop(0, "#f5d879"); edge.addColorStop(.48, "#a66d25"); edge.addColorStop(1, "#6d481d"); oval(c, 1, 1, 15, 16, "#70491d"); oval(c, -1, -2, 14, 15, edge);
    c.strokeStyle = "#f4d578"; c.lineWidth = 1; c.beginPath(); c.arc(-1, -2, 10, 0, TAU); c.stroke();
    for (let i = 0; i < 18; i++) { const a = i * TAU / 18; line(c, [-1 + Math.cos(a) * 11, -2 + Math.sin(a) * 11, -1 + Math.cos(a) * 13, -2 + Math.sin(a) * 13], "#c18a35", .8); }
    label(c, "+", -1, 3, 13, "#9a641e");
  }
  if (kind === "gem") {
    shadow(2, 15, 14, 3); c.fillStyle = "#347d9b"; c.beginPath(); c.moveTo(-14, -6); c.lineTo(-6, -16); c.lineTo(8, -14); c.lineTo(15, -3); c.lineTo(1, 16); c.closePath(); c.fill();
    c.fillStyle = "#73d3e4"; c.beginPath(); c.moveTo(-10, -6); c.lineTo(-4, -12); c.lineTo(7, -11); c.lineTo(11, -3); c.lineTo(0, 11); c.closePath(); c.fill();
    c.fillStyle = "#bff5f4"; c.beginPath(); c.moveTo(-4, -12); c.lineTo(0, -3); c.lineTo(7, -11); c.lineTo(11, -3); c.lineTo(0, 1); c.closePath(); c.fill();
    c.fillStyle = "rgba(255,255,255,.7)"; c.beginPath(); c.moveTo(-4, -12); c.lineTo(-9, -6); c.lineTo(-2, -7); c.closePath(); c.fill();
  }
  if (kind === "candy") {
    // wrapped sweet: twisted cellophane ends, red-and-white swirl body
    shadow(1, 15, 16, 3); oval(c, 0, 0, 11, 9, "#f4f4f4"); oval(c, 0, 0, 9, 7, "#e5484d");
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4; line(c, [0, 0, Math.cos(a) * 8, Math.sin(a) * 6], "#fff", 2.2); }
    for (const s of [-1, 1]) { c.fillStyle = "rgba(220,235,245,.85)"; c.beginPath(); c.moveTo(s * 11, 0); c.lineTo(s * 19, -7); c.lineTo(s * 17, 0); c.lineTo(s * 19, 7); c.closePath(); c.fill(); }
  }
  if (kind === "heart") {
    shadow(1, 15, 19, 3); const tin = c.createLinearGradient(-18, -14, 18, 14); tin.addColorStop(0, "#fff6dc"); tin.addColorStop(.45, "#e8d5ae"); tin.addColorStop(1, "#a98c68"); box(c, -18, -12, 36, 26, "#836a52", 6); box(c, -16, -14, 32, 24, tin, 5);
    box(c, -5, -9, 10, 18, "#d45257", 1); box(c, -12, -3, 24, 7, "#d45257", 1); line(c, [-11, -14, -11, -17, 11, -17, 11, -14], "#99775b", 2);
    line(c, [-12, 8, 12, 8], "rgba(110,84,58,.35)", 1);
  }
  if (kind === "magnet") {
    shadow(0, 16, 19, 3); c.strokeStyle = "#4d2e2c"; c.lineWidth = 15; c.beginPath(); c.moveTo(-13, -13); c.lineTo(-13, 1); c.bezierCurveTo(-13, 20, 13, 20, 13, 1); c.lineTo(13, -13); c.stroke();
    const red = c.createLinearGradient(-14, -14, 14, 12); red.addColorStop(0, "#f18476"); red.addColorStop(.45, "#cb413f"); red.addColorStop(1, "#7f292d"); c.strokeStyle = red; c.lineWidth = 11; c.stroke();
    const cap = c.createLinearGradient(0, -16, 0, -5); cap.addColorStop(0, "#fffdf0"); cap.addColorStop(.5, "#c9d5d5"); cap.addColorStop(1, "#70828a"); box(c, -19, -17, 11, 10, cap, 1); box(c, 8, -17, 11, 10, cap, 1);
    line(c, [-15, -15, -9, -15], "rgba(255,255,255,.85)", 1); line(c, [11, -15, 17, -15], "rgba(255,255,255,.85)", 1);
  }
  if (kind === "slowmo") {
    shadow(1, 15, 18, 3); const body = c.createLinearGradient(-16, -12, 16, 14); body.addColorStop(0, "#f19b71"); body.addColorStop(.5, "#c75e4d"); body.addColorStop(1, "#88423e"); oval(c, 1, 3, 17, 15, "#74413b"); oval(c, 0, 0, 15, 13, body);
    const face = c.createRadialGradient(-5, -6, 1, 0, 0, 12); face.addColorStop(0, "#fff9df"); face.addColorStop(1, "#d6c29c"); oval(c, -2, -2, 10, 10, face);
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; line(c, [-2 + Math.cos(a) * 7, -2 + Math.sin(a) * 7, -2 + Math.cos(a) * 9, -2 + Math.sin(a) * 9], "#6a584b", i % 3 === 0 ? 1.5 : .8); }
    line(c, [-2, -2, -2, -8, 4, 1], "#4b4944", 1.8); oval(c, -2, -2, 1.5, 1.5, "#4b4944"); box(c, -7, -17, 10, 4, "#74915f", 2);
  }
  if (kind === "reach") {
    shadow(2, 14, 18, 3); const caseG = c.createLinearGradient(-16, -12, 4, 13); caseG.addColorStop(0, "#ffe28a"); caseG.addColorStop(.55, "#e9b64f"); caseG.addColorStop(1, "#a96d32"); box(c, -18, -13, 25, 27, "#8b6337", 6); box(c, -15, -11, 20, 22, caseG, 5); box(c, -10, -7, 10, 10, "#da8052", 3);
    box(c, 3, -5, 20, 9, "#aeb9b6", 2); box(c, 4, -3, 20, 5, "#fbf0c3", 1); for (let i = 0; i < 6; i++) line(c, [7 + i * 3, -3, 7 + i * 3, i % 2 ? 0 : 1], "#75644f", .8); line(c, [23, -6, 23, 6], "#e4eee8", 2);
  }
  if (kind === "extra") {
    shadow(0, 17, 15, 3); box(c, -15, -18, 30, 36, "#aa8450", 7); box(c, -12, -16, 24, 31, "#d7b46b", 5); box(c, -8, -11, 16, 23, "#345769", 4);
    oval(c, 0, -3, 4, 4, "#d7e2c0"); line(c, [0, 2, 0, 9], "#d7e2c0", 2.5); line(c, [-5, 4, 0, 5, 5, 4], "#d7e2c0", 2); line(c, [-4, 13, 0, 8, 4, 13], "#d7e2c0", 2);
    line(c, [-8, -14, 8, -14], "rgba(255,244,187,.65)", 1);
  }
  c.restore();
}

/** Big non-magnetic fridge objects, rendered like actual door hardware and material. */
export function drawObstacleObject(c: CanvasRenderingContext2D, kind: "glass" | "plastic" | "gap" | "vent") {
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  if (kind === "glass") {
    const bezel = c.createLinearGradient(0, 0, 100, 100); bezel.addColorStop(0, "#f2f4ee"); bezel.addColorStop(.42, "#b8c2c4"); bezel.addColorStop(1, "#65737b");
    box(c, 3, 3, 94, 94, "#596870", 7); box(c, 7, 7, 86, 86, bezel, 5);
    const glass = c.createLinearGradient(12, 10, 85, 88); glass.addColorStop(0, "#bfe7e7"); glass.addColorStop(.45, "#6da5ae"); glass.addColorStop(1, "#284c5d"); box(c, 12, 12, 76, 76, glass, 2);
    box(c, 17, 49, 66, 2, "rgba(231,247,240,.38)"); box(c, 17, 72, 66, 2, "rgba(231,247,240,.28)");
    for (const [x, y, w, h, color] of [[22, 27, 18, 15, "rgba(224,166,109,.72)"], [58, 28, 18, 14, "rgba(238,210,119,.72)"], [28, 55, 13, 10, "rgba(144,185,132,.7)"], [56, 56, 19, 11, "rgba(206,126,133,.62)"]] as const) box(c, x, y, w, h, color, 2);
    line(c, [15, 46, 86, 21], "rgba(255,255,255,.72)", 3); line(c, [28, 86, 83, 55], "rgba(235,255,255,.22)", 2);
  }
  if (kind === "plastic") {
    const base = c.createLinearGradient(0, 0, 100, 100); base.addColorStop(0, "#eef3e4"); base.addColorStop(.35, "#aebba8"); base.addColorStop(1, "#53635e"); box(c, 5, 8, 90, 84, base, 9); box(c, 13, 16, 74, 68, "#6d8175", 5);
    for (let x = 20; x <= 80; x += 10) { box(c, x, 20, 4, 60, "#b8c8a8", 1); line(c, [x + 1, 22, x + 1, 78], "rgba(255,255,255,.38)", 1); line(c, [x + 4, 23, x + 4, 78], "rgba(35,50,48,.35)", 1); }
    for (const x of [16, 84]) { oval(c, x, 50, 4, 4, "#d6ded2"); oval(c, x, 50, 1.5, 1.5, "#63736f"); }
    line(c, [18, 18, 82, 18], "rgba(255,255,255,.65)", 2);
  }
  if (kind === "gap") {
    const outer = c.createLinearGradient(0, 0, 100, 100); outer.addColorStop(0, "#6f7a7e"); outer.addColorStop(.5, "#263038"); outer.addColorStop(1, "#0e151a"); box(c, 5, 4, 90, 92, outer, 8); box(c, 17, 10, 66, 80, "#11191e", 4);
    const rubber = c.createLinearGradient(0, 12, 0, 88); rubber.addColorStop(0, "#3f4a4e"); rubber.addColorStop(.4, "#080c0f"); rubber.addColorStop(1, "#354147"); box(c, 25, 12, 50, 76, rubber, 3);
    for (let y = 20; y < 84; y += 11) line(c, [29, y, 71, y], "rgba(165,187,189,.18)", 1); line(c, [21, 13, 21, 87], "rgba(224,242,239,.22)", 2); line(c, [79, 13, 79, 87], "rgba(0,0,0,.35)", 2);
    for (const [x, y] of [[20, 28], [78, 64], [82, 19]]) { oval(c, x, y, 2.5, 2.5, "#c3e6e4"); line(c, [x - 3, y + 4, x + 1, y + 9], "#87bdc5", 1); }
  }
  if (kind === "vent") {
    const frame = c.createLinearGradient(0, 0, 0, 100); frame.addColorStop(0, "#e2e6e5"); frame.addColorStop(.45, "#89959a"); frame.addColorStop(1, "#4a565d"); box(c, 4, 8, 92, 84, frame, 10); box(c, 11, 15, 78, 70, "#354149", 6);
    for (let y = 23; y <= 73; y += 11) { box(c, 19, y, 62, 5, "#172126", 2); line(c, [22, y + 1, 77, y + 1], "rgba(207,224,223,.42)", 1); }
    oval(c, 22, 21, 2, 2, "#e7f7f1"); oval(c, 78, 78, 2, 2, "#e7f7f1");
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
