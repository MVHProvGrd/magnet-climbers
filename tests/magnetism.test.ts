import assert from "node:assert/strict";
import "./audio.test";
import "./creatures.test";
import { test } from "node:test";
import { Game } from "../src/game/game";
import { DOOR_SEAM, World } from "../src/game/world";
import { UPGRADES, type UpgradeKey } from "../src/game/config";
import { attachGrip, braceLanding, findContacts, limbTip, LIMB_TIPS, rotate, stepGrip } from "../src/game/magnetism";
import { flightLimb, LIMB_ROOTS, resetRagdoll, stepRagdoll } from "../src/game/ragdoll";
import { FRIDGE_ITEMS, BUMPER_ITEMS, itemZone } from "../src/game/items";
import { howToSections, boostItems, hazardItems } from "../src/game/how-to-play";
import { populateSetPiece, SET_PIECES } from "../src/game/world-patterns";
import { fingerJoints, handTouches, handWorldPoint, SWIPE_DURATION, type KidHand } from "../src/game/kid-hand";
import { gadgetPose, gadgetZone, GADGET_KINDS } from "../src/game/gadgets";
import { cloneTricks, freshTricks, registerTrick } from "../src/game/tricks";
import { EFFECTS, MUSIC_STEP, musicStep } from "../src/game/music-score";
import { setSound } from "../src/game/audio";
import type { Climber, NoStickZone } from "../src/game/types";

setSound(false);
const levels = Object.fromEntries(UPGRADES.map((u) => [u.key, 0])) as Record<UpgradeKey, number>;
const events = { onPower() {}, onGameOver() {}, onCoins() {}, onGems() {} };
function game(rules: "crew" | "solo" = "solo") { return new Game(levels, events, { seed: 12345, rules }); }
function surface(zones: NoStickZone[] = []) {
  const world = new World(42, 0);
  world.segments = [{ y: -1000, h: 2000, zones, bumpers: [], powerUps: [] }];
  return world;
}
function climber(angle = 0, spin = 3): Climber {
  return { ...game().climbers[0], x: 100, y: -100, angle, spin, vx: 0, vy: 30, state: "flying", grip: undefined };
}

test("landing direction produces feet, hands, single-tip, and flat grips", () => {
  for (const [angle, spin, pose] of [[0, 3, "feet"], [Math.PI, 3, "hands"], [0.8, 3, "single"], [0.2, 0, "flat"]] as const) {
    const c = climber(angle, spin);
    assert.ok(attachGrip(c, findContacts(c, surface(), 4)));
    assert.equal(c.grip?.pose, pose);
  }
});

test("mixed contacts and narrow islands use real steel, never the body center", () => {
  const c = climber(0, 0);
  const contacts = findContacts(c, surface(), 0).filter((p) => p.limb === 0 || p.limb === 3);
  attachGrip(c, contacts);
  assert.equal(c.grip?.pose, "mixed");
  const glass: NoStickZone = { x: 0, y: -300, w: 190, h: 300, kind: "glass" };
  assert.equal(findContacts(climber(), surface([glass]), 8).length, 0);
  const island: NoStickZone = { x: 77, y: -123, w: 5, h: 6, kind: "trim", hue: -1 };
  const world = surface([glass, island]);
  const only = findContacts(climber(), world, 0);
  assert.deepEqual(only.map((p) => p.limb), [0]);
  assert.ok(world.isMetal(only[0].x, only[0].y));
});

test("nearest metal respects seam, corners, fridge bounds, and snap radius", () => {
  const world = surface();
  assert.equal(world.nearestMetal(200, -100, 4), null);
  const edge = world.nearestMetal(200, -100, 6)!;
  assert.ok(edge && world.isMetal(edge.x, edge.y));
  assert.equal(world.nearestMetal(-10, -100, 9), null);
  assert.deepEqual(world.nearestMetal(-10, -100, 10), { x: 0, y: -100 });
  const corner = surface([{ x: 80, y: -130, w: 40, h: 60, kind: "glass" }]);
  const point = corner.nearestMetal(82, -128, 3)!;
  assert.ok(point && corner.isMetal(point.x, point.y));
});

test("single-hand catch swings under a fixed tip and damps without drift", () => {
  const c = climber(0.7, 3);
  attachGrip(c, findContacts(c, surface(), 0).filter((p) => p.limb === 0));
  c.state = "stuck";
  const anchor = { ...c.grip!.contacts[0] }, initialAngle = c.angle;
  for (let i = 0; i < 2400; i++) {
    stepGrip(c, 1 / 120);
    const offset = rotate(LIMB_TIPS[0], c.angle);
    assert.ok(Math.hypot(c.x + offset.x - anchor.x, c.y + offset.y - anchor.y) < 1e-8);
    assert.ok(Number.isFinite(c.x + c.y + c.angle));
  }
  assert.notEqual(c.angle, initialAngle);
  assert.ok(c.y > anchor.y + 25);
  assert.ok(Math.abs(c.grip!.angularVelocity) < 0.001);
});

test("relaunch clears contacts and seeded flings reproduce physical state", () => {
  const a = game(), b = game();
  a.launch(a.climbers[0], { x: 95, y: -610 });
  b.launch(b.climbers[0], { x: 95, y: -610 });
  assert.equal(a.climbers[0].grip, undefined);
  for (let i = 0; i < 300; i++) { a.update(1 / 120); b.update(1 / 120); }
  assert.deepEqual(a.climbers, b.climbers);
  assert.equal(a.climbers[0].state, "stuck");
  for (const p of a.climbers[0].grip!.contacts) assert.ok(a.world.isMetal(p.x, p.y));
});

test("snapshot independently copies grip state and resumes the pendulum exactly", () => {
  const g = game();
  g.phase = "running";
  const c = g.climbers[0];
  c.grip = undefined; c.angle = 0.8;
  attachGrip(c, findContacts(c, g.world, 0).filter((p) => p.limb === 0));
  const snap = g.snapshot()!;
  const restored = Game.restore(levels, events, snap);
  for (let i = 0; i < 60; i++) { g.update(1 / 120); restored.update(1 / 120); }
  assert.deepEqual(g.climbers, restored.climbers);
  assert.equal(snap.climbers[0].grip!.age, 0);
  restored.climbers[0].grip!.contacts[0].x += 10;
  assert.notEqual(restored.climbers[0].grip!.contacts[0].x, snap.climbers[0].grip!.contacts[0].x);
});

test("legacy v1 snapshots gain legal contacts without erasing the run", () => {
  const g = game(); g.phase = "running";
  const snap = g.snapshot()!;
  delete snap.climbers[0].grip;
  const restored = Game.restore(levels, events, snap);
  assert.equal(restored.phase, "running");
  assert.ok(restored.climbers[0].grip?.contacts.length);
});

test("snapshot retains staggered crew flings", () => {
  const g = game("crew"), c = g.climbers[0];
  g.selectedId = c.id;
  g.drag = { start: { x: c.x, y: c.y }, cur: { x: c.x, y: c.y + 115 } };
  g.pointerUp();
  const snap = g.snapshot()!;
  assert.equal(snap.pendingLaunches?.length, 2);
  const restored = Game.restore(levels, events, snap);
  for (let i = 0; i < 150; i++) { g.update(1 / 120); restored.update(1 / 120); }
  assert.deepEqual(g.climbers, restored.climbers);
});

test("bumpers release the physical grip", () => {
  const g = game(), c = g.climbers[0];
  g.world.segments[0].bumpers.push({ x: c.x - 10, y: c.y - 10, w: 20, h: 20, vx: 10, minX: 0, maxX: 400, label: "test", hue: 0, motion: "slide", vy: 0, minY: c.y - 10, maxY: c.y - 10 });
  g.update(1 / 120);
  assert.equal(c.state, "flying");
  assert.equal(c.grip, undefined);
});

test("airborne joints change independently, remain bounded, and share magnetic tips", () => {
  const c = climber(0.3, 5); c.vx = 200; c.vy = -610; resetRagdoll(c);
  const initial = JSON.stringify(c.ragdoll!.limbs);
  for (let frame = 0; frame < 1200; frame++) {
    c.vy += 800 / 120; c.angle += c.spin / 120;
    if (frame % 60 === 0) c.vx *= -1;
    stepRagdoll(c, 1 / 120);
    for (let i = 0; i < 4; i++) {
      const limb = flightLimb(c, i)!;
      assert.ok(Math.hypot(limb.tip.x - LIMB_ROOTS[i].x, limb.tip.y - LIMB_ROOTS[i].y) <= 26.00001);
      assert.ok(Math.abs(c.ragdoll!.limbs[i].bend) <= 1.9);
      const offset = rotate(limb.tip, c.angle);
      assert.deepEqual(limbTip(c, i), { x: c.x + offset.x, y: c.y + offset.y });
      assert.ok(Object.values(c.ragdoll!.limbs[i]).every(Number.isFinite));
    }
  }
  assert.notEqual(JSON.stringify(c.ragdoll!.limbs), initial);
  assert.notEqual(c.ragdoll!.limbs[0].bend, c.ragdoll!.limbs[1].bend);
});

test("upright feet and handstands settle with fixed legal tips, but never brace on glass", () => {
  for (const [angle, pose, target] of [[0.8, "feet", 0], [Math.PI - 0.6, "hands", Math.PI], [Math.PI * 6 + 0.6, "feet", Math.PI * 6]] as const) {
    const c = climber(angle);
    assert.ok(braceLanding(c, surface())); c.state = "stuck";
    const contacts = JSON.stringify(c.grip!.contacts);
    for (let i = 0; i < 300; i++) stepGrip(c, 1 / 120);
    assert.equal(c.grip!.pose, pose); assert.ok(Math.abs(c.angle - target) < 0.001);
    assert.equal(JSON.stringify(c.grip!.contacts), contacts);
  }
  assert.equal(braceLanding(climber(), surface([{ x: 0, y: -300, w: 190, h: 300, kind: "glass" }])), false);
});

test("mid-flight saves deep-copy joints and resume the identical physical trajectory", () => {
  const g = game(); g.launch(g.climbers[0], { x: 70, y: -640 });
  for (let i = 0; i < 20; i++) g.update(1 / 120);
  const snap = g.snapshot()!, json = JSON.stringify(snap);
  const restored = Game.restore(levels, events, JSON.parse(json));
  for (let i = 0; i < 220; i++) { g.update(1 / 120); restored.update(1 / 120); }
  assert.deepEqual(g.climbers, restored.climbers);
  assert.equal(JSON.stringify(snap), json);
  assert.notEqual(g.climbers[0].ragdoll!.limbs[0], snap.climbers[0].ragdoll!.limbs[0]);
});

test("item IDs are unique and every surface has matching physical behavior", () => {
  assert.equal(FRIDGE_ITEMS.length, 92);
  assert.equal(new Set(FRIDGE_ITEMS.map((item) => item.id)).size, FRIDGE_ITEMS.length);
  for (const item of FRIDGE_ITEMS.filter((item) => item.kind)) {
    const z = itemZone(item.id, 20, -200, 80, 80), world = surface([z]);
    assert.equal(world.isMetal(60, -160), !!item.metal, item.id);
  }
});

test("all new layouts preserve their steel lane and real handle holds", () => {
  for (const pattern of SET_PIECES) for (const right of [false, true]) {
    const world = surface(), seg = world.segments[0]; seg.y = -340; seg.h = 340;
    populateSetPiece(seg, pattern, right);
    for (let y = -340; y <= 0; y += 4) for (let x = right ? 336 : 0; x <= (right ? 399 : 63); x += 3) assert.ok(world.isMetal(x, y), `${pattern}: lane ${x},${y}`);
    for (const z of seg.zones.filter((z) => z.hue === -1)) {
      // A hold crossing the door seam still has usable metal on either side.
      assert.ok(world.isMetal(z.x + 10, z.y + 12));
      assert.ok(z.w >= 56);
    }
  }
});

test("old saves retain v1 terrain, new worlds save their generation version", () => {
  const old = new Game(levels, events, { seed: 12345, worldVersion: 1 }); old.phase = "running";
  const snap = old.snapshot()!; delete snap.worldVersion;
  const restored = Game.restore(levels, events, snap);
  assert.equal(restored.world.version, 1);
  assert.deepEqual(restored.world.segments, old.world.segments);
  const modern = game(); modern.phase = "running";
  assert.equal(modern.snapshot()!.worldVersion, 13);
  assert.ok(modern.world.segments.some((s) => s.zones.some((z) => z.itemId)));
});

test("new paper and business art spawns in v6; v5 restores retain their original pools", () => {
  const newIds = new Set<string>();
  for (let seed = 1; seed <= 12; seed++) {
    const old = new World(seed, 0, 5), current = new World(seed, 0, 6);
    old.generateTo(100); current.generateTo(100);
    for (const segment of old.segments) {
      for (const z of segment.zones) assert.ok(!z.itemId?.startsWith("paper-new-"));
      for (const b of segment.bumpers) assert.ok(!b.itemId?.startsWith("business-"));
    }
    for (const segment of current.segments) {
      for (const z of segment.zones) if (z.itemId) newIds.add(z.itemId);
      for (const b of segment.bumpers) if (b.itemId) newIds.add(b.itemId);
    }
    const regenerated = new World(seed, 0, 5); regenerated.generateTo(100);
    assert.deepEqual(regenerated.segments, old.segments);
  }
  for (const item of FRIDGE_ITEMS.filter(i => i.id.startsWith("paper-new-") || i.id.startsWith("business-"))) {
    assert.ok(newIds.has(item.id), `unreachable artwork: ${item.id}`);
  }
  const old = new Game(levels, events, { seed: 77, worldVersion: 5 }); old.phase = "running";
  const restored = Game.restore(levels, events, old.snapshot()!);
  assert.equal(restored.world.version, 5); assert.deepEqual(restored.world.segments, old.world.segments);
});

test("kid hand follows a curved, mirrored route; palm and fingertips share the visible transform", () => {
  const ys: number[] = [];
  for (let i = 0; i <= 20; i++) {
    const left: KidHand = { side: -1, y: -100, x: 0, phase: "sweep", t: SWIPE_DURATION * i / 20, hit: new Set() };
    const right: KidHand = { ...left, side: 1 };
    const l = handWorldPoint(left, { x: 0, y: 0 }), r = handWorldPoint(right, { x: 0, y: 0 });
    assert.ok(Math.abs(l.x + r.x - 400) < 1e-8); assert.equal(l.y, r.y); ys.push(l.y);
    for (const h of [left, right]) {
      assert.ok(handTouches(h, handWorldPoint(h, { x: 0, y: 0 })));
      for (const finger of fingerJoints(h)) for (const point of finger.points) assert.ok(handTouches(h, handWorldPoint(h, point), 0));
      assert.equal(handTouches(h, handWorldPoint(h, { x: -95, y: 0 })), false, "forearm cannot hit");
      assert.equal(handTouches({ ...h, phase: "warn" }, l), false);
      assert.equal(handTouches({ ...h, phase: "retract" }, l), false);
    }
  }
  assert.ok(Math.max(...ys) - Math.min(...ys) > 150, "not a straight flying hand");
});

test("swat deals one hit, releases magnets, adds tumble, and cannot hit again during that swipe", () => {
  const g = game(), c = g.climbers[0]; g.phase = "running";
  g.hand = { side: -1, y: -100, x: 0, phase: "sweep", t: 0.35, hit: new Set() };
  Object.assign(c, handWorldPoint(g.hand, { x: 0, y: 0 }));
  g.update(1 / 120);
  assert.equal(c.hp, 2); assert.equal(c.state, "flying"); assert.equal(c.grip, undefined);
  assert.ok(c.ragdoll); assert.equal(c.spin, 7); assert.ok(g.hand.hit.has(c.id));
  c.iframes = 0; Object.assign(c, handWorldPoint(g.hand, { x: 0, y: 0 }));
  g.update(1 / 120); assert.equal(c.hp, 2);
});

test("active hand and next attack survive a JSON save/resume; Chill remains hand-free", () => {
  const g = game(); g.phase = "running";
  g.hand = { side: 1, y: -180, x: 0, phase: "sweep", t: 0.23, hit: new Set([99]) };
  const saved = JSON.stringify(g.snapshot()), restored = Game.restore(levels, events, JSON.parse(saved));
  assert.deepEqual(g.hand, restored.hand);
  for (let i = 0; i < 160; i++) { g.update(1 / 120); restored.update(1 / 120); }
  assert.deepEqual(g.climbers, restored.climbers); assert.deepEqual(g.hand, restored.hand);
  assert.equal(g.nextHandAt, restored.nextHandAt);
  const chill = new Game(levels, events, { seed: 12345, rules: "solo", chill: true }); chill.phase = "running"; chill.nextHandAt = 0;
  for (let i = 0; i < 240; i++) chill.update(1 / 120);
  assert.equal(chill.hand, null);
});

test("pre-health saves keep original world generation and acquire default health", () => {
  const g = new Game(levels, events, { seed: 12345, worldVersion: 0 }); g.phase = "running";
  const snap = JSON.parse(JSON.stringify(g.snapshot())); delete snap.worldVersion;
  for (const c of snap.climbers) { delete c.hp; delete c.iframes; }
  const restored = Game.restore(levels, events, snap);
  assert.equal(restored.world.version, 0); assert.deepEqual(g.world.segments, restored.world.segments);
  assert.equal(restored.climbers[0].hp, 3); assert.equal(restored.climbers[0].iframes, 0);
});

test("a lethal airborne bumper hit cannot re-stick the lost climber", () => {
  const g = game(), c = g.climbers[0]; g.phase = "running";
  c.state = "flying"; c.grip = undefined; c.hp = 1; c.airTime = 0.3; c.vy = 30;
  g.world.segments[0].bumpers.push({ x: c.x - 10, y: c.y - 10, w: 20, h: 20, vx: 0, minX: 0, maxX: 400, label: "test", hue: 0, motion: "slide", vy: 0, minY: c.y - 10, maxY: c.y - 10 });
  g.update(1 / 120);
  assert.equal(c.hp, 0); assert.equal(c.state, "lost"); assert.equal(c.grip, undefined);
});

test("three knuckles flex without changing finger lengths or collision tips", () => {
  const base: KidHand = { side: -1, y: 0, x: 0, phase: "sweep", t: 0, hit: new Set() };
  const open = fingerJoints(base), closed = fingerJoints({ ...base, t: SWIPE_DURATION });
  assert.equal(open.length, 5);
  for (let f = 0; f < 5; f++) {
    assert.equal(open[f].points.length, f === 4 ? 3 : 4);
    for (let i = 1; i < open[f].points.length; i++) {
      const length = (points: { x: number; y: number }[]) => Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
      assert.ok(Math.abs(length(open[f].points) - length(closed[f].points)) < 1e-8);
    }
    assert.notDeepEqual(open[f].points, closed[f].points);
  }
});

test("all gadget themes spawn deterministically; v3 terrain stays gadget-free", () => {
  const ids = new Set<string>();
  for (let seed = 1; seed <= 12; seed++) {
    const a = new World(seed, 0), b = new World(seed, 0), legacy = new World(seed, 0, 3);
    a.generateTo(33); b.generateTo(33); legacy.generateTo(33);
    assert.deepEqual(a.segments, b.segments); assert.equal(legacy.gadgets.length, 0);
    for (const g of a.gadgets) ids.add(g.itemId);
    for (const seg of a.segments.filter((s) => s.gadgets?.length)) {
      for (const time of [0, 1.5, 3, 4.5, 6]) {
        a.gadgetTime = time;
        for (let y = seg.y + 1; y < seg.y + seg.h; y += 12) for (const x of [0, 32, 63, 336, 367, 399]) assert.ok(a.isMetal(x, y), `safe lane ${x},${y}`);
      }
    }
  }
  assert.equal(ids.size, 12);
});

test("gadget holds are real steel, decorative plastic is not, and polarity switches", () => {
  for (const kind of GADGET_KINDS) {
    const w = surface([{ x: 0, y: -1000, w: 190, h: 2000, kind: "trim" }]);
    const gadget = { id: "test", itemId: `${kind}-snack`, kind, x: 100, y: -100, phase: 0 };
    w.segments[0].gadgets = [gadget];
    for (let t = 0; t < 6; t += .25) {
      w.gadgetTime = t; const pose = gadgetPose(gadget, t), z = gadgetZone(gadget, t);
      assert.equal(w.isMetal(pose.hold.x, pose.hold.y), !pose.active);
      assert.equal(!!w.repelAt(pose.hold.x, pose.hold.y), pose.active);
      if (!pose.active) {
        const carrier = w.carrierAt(pose.hold); assert.equal(carrier.carrierId, "test");
        assert.deepEqual(w.carrierPoint(carrier.carrierId!, carrier.carrierOffset!), pose.hold);
        assert.ok(w.nearestMetal(z.x - 1, z.y + z.h / 2, 2));
      }
      assert.equal(w.isMetal(z.x - 3, z.y + z.h / 2), false);
    }
  }
});

test("moving contacts carry climbers and polarity releases them without phantom grips", () => {
  for (const kind of GADGET_KINDS) {
    const g = game(), c = g.climbers[0]; g.phase = "running"; g.nextHandAt = 999;
    const gadget = { id: "carry", itemId: `${kind}-travel`, kind, x: 100, y: -100, phase: 0 };
    g.world.segments = [{ y: -1000, h: 2000, zones: [{ x: 0, y: -1000, w: 190, h: 2000, kind: "trim" }], bumpers: [], powerUps: [], gadgets: [gadget] }];
    const hold = gadgetPose(gadget, 0).hold;
    c.x = hold.x + 21; c.y = hold.y + 20; c.angle = 0; c.grip = undefined; c.ragdoll = undefined; c.state = "flying";
    const contacts = findContacts(c, g.world, 0).filter((p) => p.limb === 0);
    assert.ok(attachGrip(c, contacts)); c.state = "stuck";
    const initial = c.x;
    for (let i = 0; i < 120; i++) {
      g.update(1 / 120); assert.equal(c.state, "stuck");
      const p = c.grip!.contacts[0]; assert.deepEqual({ x: p.x, y: p.y }, gadgetPose(gadget, g.world.gadgetTime).hold);
      assert.ok(Math.hypot(p.x - c.x, p.y - c.y) < 40);
    }
    if (kind !== "polarity") assert.notEqual(c.x, initial);
    if (kind === "polarity") {
      g.world.gadgetTime = 2.999; g.update(1 / 120);
      assert.equal(c.state, "flying"); assert.equal(c.grip, undefined); assert.ok(c.noStick! > 0);
    }
  }
});

test("gadget clocks, carrier offsets, trick counters and near-misses deep-copy on save", () => {
  const g = game(); g.phase = "running"; g.world.generateTo(10); g.world.gadgetTime = 1.2;
  const gadget = g.world.gadgets[0], hold = gadgetPose(gadget, g.world.gadgetTime).hold, c = g.climbers[0];
  Object.assign(c, { x: hold.x + 21, y: hold.y + 20, angle: 0, grip: undefined, ragdoll: undefined, state: "flying" });
  attachGrip(c, findContacts(c, g.world, 0).filter((p) => p.limb === 0)); c.state = "stuck";
  g.camY = c.y - 240; g.highestY = c.y; g.floorY = c.y + 800;
  g.hand = { side: -1, y: 500, x: 0, phase: "warn", t: .2, hit: new Set(), near: [99] };
  registerTrick(g.tricks, "HANDSTAND", 35, g.time);
  const snap = g.snapshot()!, saved = JSON.stringify(snap), restored = Game.restore(levels, events, JSON.parse(saved));
  for (let i = 0; i < 120; i++) { g.update(1 / 120); restored.update(1 / 120); }
  assert.deepEqual(g.climbers, restored.climbers); assert.deepEqual(g.tricks, restored.tricks);
  assert.equal(g.world.gadgetTime, restored.world.gadgetTime); assert.equal(JSON.stringify(snap), saved);
  restored.hand?.near?.push(3); assert.deepEqual(snap.hand?.near, [99]);
});

test("original music is deterministic, bounded and layers percussion only outside Chill", () => {
  assert.equal(MUSIC_STEP, .3125);
  for (let i = 0; i < 128; i++) {
    assert.deepEqual(musicStep(i, 0), musicStep(i + 32, 0));
    assert.deepEqual(musicStep(i, 1, true), musicStep(i, 0));
    assert.ok(musicStep(i, 1).length >= musicStep(i, 0).length);
  }
  const voices = [...Object.values(EFFECTS).flat(), ...Array.from({ length: 32 }, (_, i) => musicStep(i, 1)).flat()];
  for (const v of voices) { assert.ok(v.frequency > 0 && v.frequency < 20000); assert.ok(v.duration > .006 && v.duration < 1); assert.ok(v.gain > 0 && v.gain <= .25); }
});

test("moving grips carry an entire linked crew without stretching the chain", () => {
  const g = game("crew"); g.phase = "running"; g.nextHandAt = 999;
  const [root, child, grandchild] = g.climbers;
  const gadget = { id: "chain", itemId: "swing-snack", kind: "swing" as const, x: 100, y: -100, phase: 0 };
  g.world.segments[0].gadgets = [gadget];
  const hold = gadgetPose(gadget, 0).hold;
  Object.assign(root, { x: hold.x + 21, y: hold.y + 20, angle: 0, grip: undefined, ragdoll: undefined, state: "flying" });
  attachGrip(root, findContacts(root, g.world, 0).filter((p) => p.limb === 0)); root.state = "stuck";
  Object.assign(child, { x: root.x, y: root.y + 50, parent: root.id, state: "linked", grip: undefined });
  Object.assign(grandchild, { x: root.x, y: root.y + 100, parent: child.id, state: "linked", grip: undefined });
  for (let i = 0; i < 120; i++) {
    g.update(1 / 120);
    assert.ok(Math.abs(child.x - root.x) < 1e-7); assert.ok(Math.abs(child.y - root.y - 50) < 1e-7);
    assert.ok(Math.abs(grandchild.x - root.x) < 1e-7); assert.ok(Math.abs(grandchild.y - root.y - 100) < 1e-7);
  }
});

test("Claude's super magnet protection survives the articulated swipe integration", () => {
  const g = game(), c = g.climbers[0]; g.phase = "running"; g.effects.superMagnet = 10;
  g.hand = { side: -1, y: -100, x: 0, phase: "sweep", t: .35, hit: new Set() };
  Object.assign(c, handWorldPoint(g.hand, { x: 0, y: 0 }));
  g.update(1 / 120);
  assert.equal(c.hp, 3); assert.equal(c.state, "stuck"); assert.ok(c.grip); assert.ok(g.hand.hit.has(c.id));
});

test("v7 keeps steel clear of the door seams and thins out set pieces", () => {
  const seed = 777;
  const world = new World(seed, 0, 8); world.generateTo(30);
  const seam = 36;
  for (const s of world.segments) {
    for (const z of s.zones) {
      if (z.kind === "glass" || z.kind === "trim" || z.kind === "void") continue;
      assert.ok(z.y >= s.y + seam - 1, `${z.kind} at ${z.y - s.y} sits on the top seam`);
      assert.ok(z.y + z.h <= s.y + s.h - seam + 1, `${z.kind} ends ${s.y + s.h - (z.y + z.h)} px from the bottom seam`);
    }
  }
  for (const s of world.segments) for (const z of s.zones) {
    if (z.w >= 399 || z.hue === -1) continue; // full-width bands are the puzzle; metal islands are holds
    const crosses = z.x < DOOR_SEAM.x + DOOR_SEAM.w && z.x + z.w > DOOR_SEAM.x;
    assert.ok(!crosses || z.kind === "trim" && !z.itemId, `${z.kind} ${z.itemId ?? ""} at x ${z.x.toFixed(0)}..${(z.x + z.w).toFixed(0)} crosses the centre seam`);
  }
  const old = new World(seed, 0, 6); old.generateTo(30);
  const big = (w: World) => w.segments.filter((s) => s.zones.some((z) => ["dispenser", "calendar", "vent", "ice-tray"].includes(z.itemId ?? ""))).length;
  assert.ok(big(world) < big(old), `set pieces should be rarer: ${big(world)} vs ${big(old)}`);
});

test("russian strings cover the HUD and the dynamic menu lines", async () => {
  const { setLang, t } = await import("../src/game/i18n");
  setLang("ru");
  assert.equal(t("FLING"), "БРОСОК");
  assert.equal(t("FLINGS 2 / 8"), "БРОСКИ 2 / 8");
  assert.equal(t("12 runs · 3.4 m climbed lifetime"), "12 забегов · 3.4 м пройдено за всё время");
  assert.equal(t("YOUR BEST · 120 cm"), "ВАШ РЕКОРД · 120 см");
  assert.equal(t("Glass Ceiling · 4 flings (par 4)"), "Стеклянный потолок · бросков: 4 (норма 4)");
  assert.equal(t("some unknown string"), "some unknown string");
  setLang("en");
  assert.equal(t("FLING"), "FLING");
});

test("v10 keeps field plates off pillar and window segments", () => {
  const world = new World(4242, 0, 10); world.generateTo(60);
  for (const s of world.segments) {
    const lane = s.zones.some((z) => (z.kind === "trim" && !z.itemId && z.h >= 300) || (z.kind === "glass" && z.h >= 280 && z.w < 399));
    const plates = s.zones.filter((z) => z.kind === "repel" || z.kind === "attract");
    assert.ok(!(lane && plates.length), `plate on a lane segment at y ${s.y}`);
  }
});

test("v13 keeps magnets on bare steel: no plate or bumper path over glass, plastic, paper or gaps", () => {
  const soft = new Set(["glass", "trim", "void", "sticker"]);
  const hits = (a: { x: number; y: number; w: number; h: number }, zones: { x: number; y: number; w: number; h: number; kind: string }[]) =>
    zones.some((o) => soft.has(o.kind) && a.x < o.x + o.w && a.x + a.w > o.x && a.y < o.y + o.h && a.y + a.h > o.y);
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const world = new World(seed, 0, 13); world.generateTo(80);
    for (const s of world.segments) {
      for (const z of s.zones) if (z.kind === "repel" || z.kind === "attract") assert.ok(!hits(z, s.zones), `${z.kind} plate over non-steel, seed ${seed} y ${s.y}`);
      // a lift (vx 0) only ever occupies its own column; sliders and zigzags sweep the full width
      for (const b of s.bumpers) assert.ok(!hits(b.vx === 0 ? { x: b.x, y: b.minY, w: b.w, h: b.maxY - b.minY + b.h } : { x: b.minX, y: b.minY, w: b.maxX - b.minX + b.w, h: b.maxY - b.minY + b.h }, s.zones), `bumper path over non-steel, seed ${seed} y ${s.y}`);
    }
  }
});

test("super magnet grips glass, plastic and paper but never an open gap or a hanging toy", () => {
  const world = new World(9, 0, 13); world.generateTo(30);
  const seg = world.segments[3]; seg.zones = [
    { x: 0, y: seg.y + 20, w: 100, h: 80, kind: "glass" }, { x: 120, y: seg.y + 20, w: 60, h: 80, kind: "void" },
    { x: 220, y: seg.y + 20, w: 60, h: 40, kind: "repel", power: 0.35, itemId: "bumper-1", swing: { angle: 0, vel: 0, cool: 0 } },
  ];
  assert.equal(world.isMetal(50, seg.y + 60), false);
  world.superGrip = true;
  assert.equal(world.isMetal(50, seg.y + 60), true, "glass grips under super magnet");
  assert.equal(world.isMetal(150, seg.y + 60), false, "gaps never grip");
  assert.equal(world.isMetal(250, seg.y + 40), false, "toys never grip");
});

test("how to play covers every surface and family, with counts derived from the real item list", () => {
  const sections = howToSections();
  const rows = sections.flatMap((s) => s.rows);
  // A zero count means a derivation predicate broke; the page would quietly claim a rule covers nothing.
  for (const row of rows) if (row.count !== undefined) assert.ok(row.count > 0, `"${row.name}" counts nothing`);
  // Every surface must be explained by exactly one rule, so a new kind can never ship unmentioned.
  const surfaces = FRIDGE_ITEMS.filter((i) => i.family === "surface");
  const byRule = {
    attract: surfaces.filter((i) => i.kind === "attract").length,
    repel: surfaces.filter((i) => i.kind === "repel").length,
    metal: surfaces.filter((i) => i.metal && i.kind !== "attract").length,
    nonMetal: surfaces.filter((i) => !i.metal && ["glass", "trim", "void", "sticker"].includes(i.kind!)).length,
  };
  assert.equal(byRule.attract + byRule.repel + byRule.metal + byRule.nonMetal, surfaces.length, "a surface kind is missing from the how-to page");
  // Every mechanic must be NAMED, not merely counted: a count moves on its own when an item is
  // added, the prose beside it does not, and that is how candy and the cat paw went missing.
  // Boost and hazard rows are generated from these same lists, so today this cannot fail --
  // it is a tripwire for the regression of hand-writing those rows again, which is what broke.
  const named = rows.map((r) => `${r.name} ${r.text}`).join("   ");
  for (const item of [...boostItems(), ...hazardItems()])
    assert.ok(named.includes(item.name), `"${item.name}" exists in the game but the how-to page never names it`);
  assert.ok(sections.some((s) => /hurt/i.test(s.title)) && sections.some((s) => /hold/i.test(s.title)), "page must keep its helps/hurts split");
  // The guide used to guarantee this; it is the item list's own invariant, so it outlives that screen.
  const ids = FRIDGE_ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate item id");
});

test("a refused launch (ladder rung, unlocked hanger) never spends a fling", () => {
  const g = game("crew"); g.phase = "running";
  const [a, b, c] = g.climbers;
  // a three-high stack: a and b are ladder rungs, c on top is linked but not locked
  a.state = "stuck"; b.state = "linked"; b.parent = a.id; b.locked = true; c.state = "linked"; c.parent = b.id; c.locked = false;
  const before = g.flings;
  assert.equal(g.launch(a, { x: 0, y: -400 }), false);
  assert.equal(g.launch(b, { x: 0, y: -400 }), false);
  g.selectedId = a.id; g.drag = { start: { x: a.x, y: a.y }, cur: { x: a.x, y: a.y + 120 } }; g.pointerUp();
  assert.equal(g.flings, before, "a fling that never happened must not count");
  c.parent = null; c.state = "flying"; b.parent = null; b.state = "flying";
  assert.equal(g.launch(a, { x: 0, y: -400 }), true);
});

test("style points are gone: tricks and near misses pay nothing", () => {
  const g = game();
  g.phase = "running";
  const before = g.coins;
  // drive the paths that used to score: a landing and a hand near miss
  const c = g.climbers[0];
  for (let i = 0; i < 240; i++) g.update(1 / 120);
  assert.equal(g.tricks.score, 0, "no score accrues");
  assert.equal(g.coins, before, "and no coins are paid for how you land");
  assert.ok(c, "climber still exists");
});
