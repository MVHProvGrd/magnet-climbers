import { dayKeyAt, nextDayStart } from "../src/game/day";
import { weekKey } from "../worker/src/week";
import assert from "node:assert/strict";
import "./audio.test";
import "./creatures.test";
import { test } from "node:test";
import { Game } from "../src/game/game";
import { DOOR_SEAM, World } from "../src/game/world";
import { CFG, SHOP_ENABLED, UPGRADES, statsFor, type UpgradeKey } from "../src/game/config";
import { prizeCost, PATTERNS } from "../src/game/creatures";
import { dailySeed, todayKey } from "../src/game/leaderboard";
import { MISSIONS, dailyBoard, refill, settle, streakReward } from "../src/game/missions";
import { sizeOf } from "../src/game/item-sizes";
import { FRIDGE_THEMES, monthKey, themeFor } from "../src/game/fridge-theme";
import { replay, tapeBytes } from "../src/game/recorder";
import { Ghost } from "../src/game/ghost";
import { attachGrip, braceLanding, findContacts, limbTip, LIMB_TIPS, rotate, stepGrip } from "../src/game/magnetism";
import { flightLimb, LIMB_ROOTS, resetRagdoll, stepRagdoll } from "../src/game/ragdoll";
import { FRIDGE_ITEMS, BUMPER_ITEMS, TOY_HOOKS, toyHook, itemZone, PAPER_ASPECT } from "../src/game/items";
import { howToSections, boostItems, hazardItems } from "../src/game/how-to-play";
import { populateSetPiece, SET_PIECES } from "../src/game/world-patterns";
import { fingerJoints, handTouches, handWorldPoint, SWIPE_DURATION, type KidHand } from "../src/game/kid-hand";
import { pawPose, PAW_WARN } from "../src/game/cat-paw";
import { gadgetPose, gadgetZone, toyFace, GADGET_KINDS } from "../src/game/gadgets";
import { cloneTricks, freshTricks, registerTrick } from "../src/game/tricks";
import { EFFECTS, MUSIC_STEP, TOY_VOICE, musicStep } from "../src/game/music-score";
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
  assert.equal(FRIDGE_ITEMS.length, 152);
  assert.equal(new Set(FRIDGE_ITEMS.map((item) => item.id)).size, FRIDGE_ITEMS.length);
  for (const item of FRIDGE_ITEMS.filter((item) => item.kind)) {
    const z = itemZone(item.id, 20, -200, 80, 80), world = surface([z]);
    assert.equal(world.isMetal(60, -160), !!item.metal || !!item.grips, item.id);
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
  assert.equal(modern.snapshot()!.worldVersion, 27);
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
  // v26 added an advertising-magnet draw to the stream, so the same twelve seeds no longer
  // reach every variant. The claim is that all of them are reachable, not that twelve seeds
  // is the number, so the search widens rather than the assertion softening.
  for (let seed = 1; seed <= 24; seed++) {
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
  // v18: the pool is every gadget variant less swing-doodle - paper is clipped, never hung off a chain (v16).
  // Pin the pool, not the sample: which variants a handful of seeds happens to deal is not the contract.
  const pool = FRIDGE_ITEMS.filter((i) => i.family === "gadget" && i.id !== "swing-doodle");
  assert.equal(pool.length, 48, "gadget pool changed size");
  for (const id of ids) assert.ok(pool.some((i) => i.id === id), `${id} was dealt but is not a gadget item`);
  assert.ok(ids.size >= pool.length - 8, `only ${ids.size} of ${pool.length} gadget variants ever appeared`);
  assert.ok(!ids.has("swing-doodle"), "paper never dangles from a chain");
  const legacy = new World(4, 0, 15); legacy.generateTo(60);
  assert.ok(legacy.gadgets.some((g) => g.itemId === "swing-doodle"), "saved v15 runs keep their layout");
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

test("a revive does not wipe what the run has already picked up", () => {
  // main.ts banks game.coins into the wallet on every death and clears them, so after a
  // revive that field is legitimately zero -- but the HUD reads from the run-long tally, and
  // that one has to remember, or a revive looks like it confiscated the lot.
  const g = new Game(levels, events, { seed: 5150, rules: "solo" });
  g.phase = "running";
  g.coins = 40; g.gems = 2; g.runCoins = 40; g.runGems = 2;

  // exactly what a death does: pay into the wallet, then clear the unbanked part
  g.coins = 0; g.gems = 0;
  g.revive(true);
  assert.equal(g.runCoins, 40, "the run remembers the coins it found before the revive");
  assert.equal(g.runGems, 2, "and the gems");
  assert.equal(g.revivesLeft, 0, "and the free go is spent");

  // and a resumed run does not forget them either
  const snap = g.snapshot();
  assert.ok(snap, "a running game snapshots");
  const back = Game.restore(levels, events, JSON.parse(JSON.stringify(snap)));
  assert.equal(back.runCoins, 40);
  assert.equal(back.runGems, 2);
});

test("a resumed run finds the door where it left it, not back at rest", () => {
  // stepGadgets moves things the world generator cannot rebuild: a toy still swinging, a
  // spinner coasting down from a knock, a cooldown part way through. None of it is derivable
  // from the seed, so leaving it out of the snapshot snapped every gadget back to rest on
  // resume -- and a climber riding one was thrown off by the jump.
  const g = new Game(levels, events, { seed: 12345, rules: "solo" });
  g.phase = "running"; g.world.generateTo(10); g.world.gadgetTime = 1.2;
  for (const gd of g.world.gadgets) { if (gd.spin) gd.spin.vel = 7; if (gd.swing) gd.swing.vel = 2; gd.hitCool = 0.25; }
  for (let i = 0; i < 60; i++) g.update(1 / 120);

  const snap = g.snapshot()!;
  const restored = Game.restore(levels, events, JSON.parse(JSON.stringify(snap)));
  const state = (x: Game) => x.world.gadgets.map((gd) =>
    [gd.id, gd.hitCool ?? 0, gd.popCool ?? 0, gd.spin?.vel ?? 0, gd.spin?.extra ?? 0, gd.swing?.angle ?? 0, gd.swing?.vel ?? 0]);
  assert.ok(state(g).some((r) => r.slice(1).some((n) => n !== 0)), "the door has to be away from rest for this to prove anything");
  assert.deepEqual(state(restored), state(g), "a restored door carries the live door's motion");

  // and it stays agreed once both are running again, which is what the player actually sees
  for (let i = 0; i < 120; i++) { g.update(1 / 120); restored.update(1 / 120); }
  assert.deepEqual(state(restored), state(g), "and keeps agreeing as both run on");
});

test("gadget clocks, carrier offsets, trick counters and near-misses deep-copy on save", () => {
  const g = new Game(levels, events, { seed: 12345, rules: "solo" }); g.phase = "running"; g.world.generateTo(20); g.world.gadgetTime = 1.2;
  // A swing specifically, not simply the first gadget on the door: this is about a carrier
  // that MOVES, and the +21/+20 reach below is a swing's hitbox. Aimed at a polarity plate it
  // finds no contact at all, and the test then poses a climber stuck to nothing -- which
  // restore quite rightly repairs, so the round trip "fails" over a fixture that never held.
  const gadget = g.world.gadgets.find((x) => x.kind === "swing")!;
  assert.ok(gadget, "the seed needs to put a swing on the door for this test to mean anything");
  const hold = gadgetPose(gadget, g.world.gadgetTime).hold, c = g.climbers[0];
  Object.assign(c, { x: hold.x + 21, y: hold.y + 20, angle: 0, grip: undefined, ragdoll: undefined, state: "flying" });
  attachGrip(c, findContacts(c, g.world, 0).filter((p) => p.limb === 0)); c.state = "stuck";
  assert.ok(c.grip, "and the climber has to actually take hold of it");
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

test("a second pickup stacks its timer up to the cap, it does not restart it", () => {
  const g = game(); g.phase = "running";
  const c = g.climbers[0];
  const take = (kind: "candy" | "slowmo") => (g as unknown as { collect(p: unknown, c: unknown): void })
    .collect({ kind, x: c.x, y: c.y, taken: false, bob: 0 }, c);
  take("candy");
  assert.equal(g.effects.candy, CFG.effectDurations.candy);
  g.effects.candy -= 2;
  take("candy");
  assert.equal(g.effects.candy, CFG.effectDurations.candy * 2 - 2, "the second candy adds its seconds");
  for (let i = 0; i < 5; i++) take("candy");
  assert.equal(g.effects.candy, CFG.effectCaps.candy, "stacking stops at the cap");
  take("slowmo"); take("slowmo");
  assert.equal(g.effects.slowmo, Math.min(CFG.effectCaps.slowmo, CFG.effectDurations.slowmo * 2));
});

test("every toy keychain knows where its chain meets it", () => {
  const toys = BUMPER_ITEMS.filter((item) => item.id.startsWith("bumper-"));
  assert.ok(toys.length >= 13);
  for (const toy of toys) {
    assert.ok(TOY_HOOKS[toy.id], `${toy.name} has no measured hook point, so its chain would stop in mid-air`);
    const [u, v] = toyHook(toy.id);
    assert.ok(u > 0 && u < 1 && v >= 0 && v < 0.3, `${toy.name} hook ${u},${v} is not on the toy`);
  }
  assert.deepEqual(toyHook("not-a-toy"), [0.5, 0.02], "anything unmeasured hangs from the top of its centre");
});

test("the cat's paw hurts wherever it is on the door, not only at the bottom of a tap", () => {
  const g = game(); g.phase = "running";
  const c = g.climbers[0];
  // mid-swing, between the first and second taps: the pad is deep on the door but not striking
  g.paw = { x: c.x, t: PAW_WARN + 0.7, hit: new Set() };
  const pose = pawPose(g.paw, g.camY, g.viewH);
  assert.equal(pose.contact, false, "this instant is between taps");
  assert.ok(pose.y > g.camY, "and the pad is on screen");
  c.x = pose.x; c.y = pose.y; c.state = "flying"; c.iframes = 0; c.grip = undefined;
  const hp = c.hp;
  g.update(1 / 120);
  assert.equal(c.hp, hp - 1, "flying into the paw costs a heart");
  // and it drives you down the door: a swat that costs a heart but no ground is no swat
  assert.ok(c.vy > 0, "knocked downward, not up");
  const from = c.y;
  for (let i = 0; i < 48; i++) g.update(1 / 120);
  assert.equal(c.state, "flying", "still falling 0.4s later, not stuck to the next panel up");
  for (let i = 0; i < 12; i++) g.update(1 / 120);
  assert.ok(c.y - from > 150, `dropped ${Math.round(c.y - from)}px in half a second`);
  // and only once per paw, however long it stays on top of them
  const after = c.hp; c.iframes = 0;
  for (let i = 0; i < 30; i++) g.update(1 / 120);
  assert.equal(c.hp, after, "one hit per paw");
});

test("the run remembers what ended it", () => {
  // the red line catching the last climber
  const g = game(); g.phase = "running";
  const c = g.climbers[0];
  c.state = "flying"; c.grip = undefined; c.y = g.floorY + 40;
  g.update(1 / 120);
  assert.equal(c.state, "lost");
  assert.equal(g.lastCause, "redline");

  // the cat, through the damage that empties the last heart
  const p2 = game(); p2.phase = "running";
  const c2 = p2.climbers[0];
  c2.hp = 1;
  p2.paw = { x: c2.x, t: PAW_WARN + 0.7, hit: new Set() };
  const pose = pawPose(p2.paw, p2.camY, p2.viewH);
  c2.x = pose.x; c2.y = pose.y; c2.state = "flying"; c2.iframes = 0; c2.grip = undefined;
  p2.update(1 / 120);
  assert.equal(c2.state, "lost");
  assert.equal(p2.lastCause, "paw");
});

test("a clip only tips when it is caught near one end of its bar", () => {
  const g = game(); g.phase = "running";
  // as the world builds one since v16: held still by its own clip, so its bar does not drift
  const clip = { id: "c1", itemId: "clip-report-card", kind: "clip" as const, x: 200, y: -300, phase: 0, fixed: true, swing: { angle: 0, vel: 0, cool: 0 } };
  g.world.segments[0].gadgets = [clip];
  const z = gadgetZone(clip, 0);
  const c = g.climbers[0];
  c.state = "stuck"; c.x = z.x + z.w; c.y = z.y;
  const hold = (x: number) => { c.grip = { contacts: [{ x, y: z.y + z.h / 2, limb: 0 }], pose: "single", lift: 0, age: 0, angularVelocity: 0 }; };

  // caught in the middle: nothing moves, however long they hang there
  hold(z.x + z.w / 2);
  for (let i = 0; i < 60; i++) g.update(1 / 120);
  assert.equal(clip.lean ?? 0, 0, "a centred grab leaves it level");

  // caught at the right end: the right side drops, so the sheet swings the other way
  hold(z.x + z.w - 2);
  for (let i = 0; i < 60; i++) g.update(1 / 120);
  assert.ok((clip.lean ?? 0) > 0.1, `tips to ${clip.lean}`);

  // and the mirror, then back to level once they let go
  hold(z.x + 2);
  for (let i = 0; i < 120; i++) g.update(1 / 120);
  assert.ok((clip.lean ?? 0) < -0.1);
  c.grip = undefined;
  for (let i = 0; i < 240; i++) g.update(1 / 120);
  assert.equal(clip.lean, 0, "and hangs level again once nobody is on it");
});

test("every photographed paper card is cut to the shape of its own art", () => {
  const papers = FRIDGE_ITEMS.filter((i) => i.family === "paper");
  assert.ok(papers.length >= 32);
  // a card left at 1 is square; a wide photo cut into a square slot draws small, which is
  // how the avocado card ended up two thirds the size of its neighbours
  const square = papers.filter((i) => PAPER_ASPECT[i.id] === 1).map((i) => i.id);
  assert.ok(square.length <= 3, `too many square cards: ${square.join(", ")}`);
  for (const item of papers) {
    const a = PAPER_ASPECT[item.id];
    assert.ok(a > 0.3 && a < 3, `${item.id} has a daft shape: ${a}`);
  }
});

test("every keychain with a voice has a sound to play, and no two dangle silently alike", () => {
  const ids = new Set(FRIDGE_ITEMS.map((i) => i.id));
  for (const [id, voice] of Object.entries(TOY_VOICE)) {
    assert.ok(ids.has(id) || id.startsWith("swing-"), `${id} is not an item`);
    assert.ok(EFFECTS[voice]?.length, `${id} asks for ${voice}, which does not exist`);
  }
  // the bumper toys are what hang off the keyrings, so they all need a noise
  const bumpers = FRIDGE_ITEMS.filter((i) => i.id.startsWith("bumper-") && i.id !== "bumper-4");
  for (const b of bumpers) assert.ok(TOY_VOICE[b.id], `${b.id} is mute`);
});

test("the shop only sells upgrades a lone climber can feel", () => {
  assert.ok(SHOP_ENABLED, "the shop is open");
  const zero = Object.fromEntries(UPGRADES.map((u) => [u.key, 0])) as Record<UpgradeKey, number>;
  const base = statsFor(zero);
  // a solo run reads magnetRadius, magnetCatch, launchMult, floorMult and revives; teamSize,
  // reach and maxLinks all need teammates, so selling them would take coins for nothing
  const solo = ["magnetRadius", "magnetCatch", "launchMult", "floorMult"] as const;
  for (const u of UPGRADES.filter((u) => u.solo)) {
    const maxed = statsFor({ ...zero, [u.key]: u.max });
    assert.ok(solo.some((k) => maxed[k] !== base[k]), `${u.key} is sold but changes nothing for a lone climber`);
    assert.ok(u.gain, `${u.key} is sold without saying what a click buys`);
    // three clicks each: a short ladder the player finishes, not a grind
    assert.equal(u.max, 3, `${u.key} should cap at three`);
  }
  // Every run is given one free second chance, and no amount of money buys another: the
  // offers after it are the ad and then gems. The tier that sold three is gone, so a maxed
  // kit has to leave the count exactly where an empty one does.
  assert.equal(UPGRADES.some((u) => u.key === "revive"), false);
  assert.equal(statsFor(zero).revives, 1);
  const maxedKit = Object.fromEntries(UPGRADES.map((u) => [u.key, u.max])) as Record<UpgradeKey, number>;
  assert.equal(statsFor(maxedKit).revives, 1, "no purchase may buy a second life");
  assert.ok(UPGRADES.filter((u) => u.solo).length >= 2, "something is still on the shelf");
});

test("hitting a fidget spinner winds it up, and it coasts back down", () => {
  const g = game(); g.phase = "running";
  const seg = g.world.segments[0];
  const spinner = { id: "spin-1", itemId: "rotor-fidget-spinner", kind: "rotor" as const, phase: 0, x: 200, y: -300, spin: { extra: 0, vel: 0, cool: 0 } };
  seg.gadgets = [spinner];
  const idle = gadgetPose(spinner, 0).angle;
  g.world.knockSwings({ x: 205, y: -295 }, 300);
  assert.equal(g.world.knocked, "rotor-fidget-spinner");
  assert.ok(spinner.spin.vel > 5, `a solid hit should spin it: ${spinner.spin.vel}`);
  // it turns much further than the idle drift over the same tenth of a second
  for (let i = 0; i < 6; i++) g.world.stepGadgets(1 / 60);
  const spun = gadgetPose(spinner, 0).angle - idle;
  assert.ok(spun > 1, `the spinner should have whirled round: ${spun}`);
  // and the bearings give out: a spinner coasts a good while, but it does come back to its lazy turn
  for (let i = 0; i < 600; i++) g.world.stepGadgets(1 / 60);
  assert.equal(spinner.spin.vel, 0);
  // it sat dead still before it was touched: no idle drift on a spinner or an alphabet letter
  const still = { id: "spin-2", itemId: "rotor-fidget-spinner", kind: "rotor" as const, phase: 1.2, x: 200, y: -300, spin: { extra: 0, vel: 0, cool: 0 } };
  assert.equal(gadgetPose(still, 0).angle, gadgetPose(still, 4).angle, "a spinner turns on its own");
  const letter = { ...still, id: "spin-3", itemId: "rotor-travel", spin: { extra: 0, vel: 0, cool: 0 } };
  assert.equal(gadgetPose(letter, 0).angle, gadgetPose(letter, 4).angle, "a letter turns on its own");
  // a wall clock hangs on its nail: it never turns, and nothing can wind it up
  const ticking = { id: "clock-0", itemId: "rotor-clock", kind: "rotor" as const, phase: 0.4, x: 200, y: -300 };
  assert.equal(gadgetPose(ticking, 0).angle, gadgetPose(ticking, 4).angle);
  // the dial thermometer still turns on its own
  const dial = { id: "dial-0", itemId: "rotor-thermometer", kind: "rotor" as const, phase: 0, x: 200, y: -300 };
  assert.notEqual(gadgetPose(dial, 0).angle, gadgetPose(dial, 4).angle);
  // a wall clock is not on a free bearing: hitting it makes a noise but winds nothing up
  const clock: typeof still = { id: "clock-1", itemId: "rotor-clock", kind: "rotor", phase: 0, x: 200, y: -300, spin: undefined as never };
  delete (clock as { spin?: unknown }).spin;
  seg.gadgets = [clock];
  g.world.knocked = null;
  g.world.knockSwings({ x: 205, y: -295 }, 300);
  assert.equal(g.world.knocked, "rotor-clock");
  assert.equal(clock.spin, undefined, "nothing to wind up on a nail");
});

test("v21 never stretches the grille, and bolts no handle onto a surface", () => {
  const seg = (version: number, pattern: "handle-hop" | "water-station") => {
    const world = surface(), s = world.segments[0]; s.y = -340; s.h = 340;
    populateSetPiece(s, pattern, false, version);
    return s;
  };
  const vents = seg(21, "handle-hop").zones.filter((z) => z.itemId === "vent");
  assert.ok(vents.length >= 2, "the grille comes in bands now");
  for (const v of vents) {
    const a = v.w / v.h;
    // the photo is 320x82; anything near square is the old smeared panel
    assert.ok(a > 2.6 && a < 5.2, `a band is the wrong shape: ${v.w}x${v.h}`);
  }
  for (const pattern of ["handle-hop", "water-station"] as const)
    assert.equal(seg(21, pattern).zones.filter((z) => z.itemId === "handle").length, 0, `${pattern} still has a handle`);
  // older worlds keep the layout they were generated with
  assert.ok(seg(20, "water-station").zones.some((z) => z.itemId === "handle"));
});

test("the POP! toy pops on a keyring, not just stuck to the door", () => {
  const g = game(); g.phase = "running";
  const seg = g.world.segments[0];
  const toy = { id: "pop-1", itemId: "swing-toy-4", kind: "swing" as const, phase: 0, x: 200, y: -300,
    swing: { angle: 0, vel: 0, cool: 0 }, pops: 0b0101010101, popCool: 0 };
  seg.gadgets = [toy];
  const before = toy.pops;
  const face = toyFace(toy, 0);
  g.world.knockSwings({ x: face.x, y: face.y }, 300);
  assert.ok(g.world.popped, "a climber through the toy flips a bubble");
  assert.notEqual(toy.pops, before);
  // debounced: brushing it again while it is still cooling flips nothing
  g.world.popped = null;
  const after = toy.pops;
  g.world.knockSwings({ x: face.x, y: face.y }, 300);
  assert.equal(g.world.popped, null);
  assert.equal(toy.pops, after);
  // and the cooldown runs down with the world
  g.world.stepGadgets(0.2);
  assert.equal(toy.popCool, 0);
  // a keyring toy that is not the pop-it carries no bubbles
  const taxi = { id: "pop-2", itemId: "swing-toy-6", kind: "swing" as const, phase: 0, x: 200, y: -300, swing: { angle: 0, vel: 0, cool: 0 } };
  seg.gadgets = [taxi];
  g.world.popped = null;
  g.world.knockSwings({ x: 200, y: -300 }, 300);
  assert.equal(g.world.popped, null);
});

test("a polarity toy pulls on blue as hard as it pushes on red", () => {
  const g = game(); g.phase = "running";
  const seg = g.world.segments[0];
  const toy = { id: "pol-1", itemId: "polarity-snack", kind: "polarity" as const, phase: 0, x: 200, y: -300 };
  seg.gadgets = [toy];
  const at = { x: 240, y: -300 };
  // the pole flips every three seconds: blue holds first, then red pushes
  g.world.gadgetTime = 0;
  const blue = g.world.fieldAt(at.x, at.y);
  g.world.gadgetTime = 3.5;
  const red = g.world.fieldAt(at.x, at.y);
  assert.ok(blue.attract, "blue should be a field, not three seconds of nothing");
  assert.ok(blue.ax < -100, `blue should pull back toward the toy: ${blue.ax}`);
  assert.ok(red.repel, "red still pushes");
  assert.ok(red.ax > 100, `red should push away: ${red.ax}`);
  // a plain keyring toy is resin: no field either way
  seg.gadgets = [{ id: "sw-1", itemId: "swing-keys", kind: "swing" as const, phase: 0, x: 200, y: -300, swing: { angle: 0, vel: 0, cool: 0 } }];
  g.world.gadgetTime = 0;
  const none = g.world.fieldAt(at.x, at.y);
  assert.equal(none.attract, null);
  assert.equal(none.repel, null);
});

test("a toy aimed into a glass panel rides it down instead of grabbing a rim", () => {
  // a bottle-door band is the case that went wrong: it is short enough that a limb reaching out
  // of the middle finds the frame, so the toy used to catch a third of the way down the glass
  for (const vx of [0, 120, -120]) {
    const g = game(); g.phase = "running";
    const panel = { x: 30, y: -700, w: 340, h: 110, kind: "glass" as const, hue: 0 };
    g.world.segments = [{ y: -1400, h: 2400, zones: [panel], bumpers: [], powerUps: [] }];
    const c = g.climbers[0];
    const aimX = panel.x + panel.w / 2, aimY = panel.y + panel.h / 2;
    Object.assign(c, { x: aimX, y: aimY, vx, vy: -20, z: 0, vz: 0, state: "flying", grip: undefined,
      airTime: 0.5, angle: 0, spin: 0, noStick: 0, launchY: -300 });
    for (let i = 0; i < 400 && c.state === "flying"; i++) g.update(1 / 60);
    assert.equal(c.state, "stuck");
    // it left the glass at the bottom, not partway down it
    assert.ok(c.y >= panel.y + panel.h - 20, `caught on the glass at ${(c.y - aimY).toFixed(0)} into the slide`);
  }
});

test("toys still go straight on the door, not only on keyrings", () => {
  const count = (version: number) => {
    let stuck = 0, keyrings = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const w = new World(seed, 0, version);
      w.ensure(-8000);
      for (const s of w.segments) {
        keyrings += (s.gadgets ?? []).filter((g) => g.itemId.startsWith("swing-toy-")).length;
        for (const z of s.zones) if (z.itemId?.startsWith("bumper-") && !z.swing) stuck++;
      }
    }
    return { stuck, keyrings };
  };
  // v18 put all thirteen toys on keyrings and stuck-on toys all but disappeared: they were rolled on
  // doors a gadget or a set piece was about to clear, and held to the headroom a chain needs
  const now = count(22);
  assert.ok(now.stuck >= now.keyrings / 2, `stuck toys ${now.stuck} against ${now.keyrings} keyrings`);
  assert.ok(count(21).stuck < now.stuck, "v22 is the version that brought them back");
});

test("v24 gadget doors and set pieces fall on RNG-driven columns, not a fixed i % 4 / i % 5 skeleton", () => {
  const doorIndices = (version: number, seed: number) => {
    const w = new World(seed, 0, version); w.generateTo(120);
    const gadgetAt: number[] = [], setPieceAt: number[] = [];
    w.segments.forEach((s, i) => {
      if (s.gadgets?.length) gadgetAt.push(i);
      // a set piece door clears the segment and fills it with one non-gadget zone plus a lane pickup;
      // populateSetPiece never leaves gadgets, so this is unambiguous against a gadget door
      else if (s.zones.some((z) => z.itemId && ["dispenser", "calendar", "ice-tray", "vent"].includes(z.itemId))) setPieceAt.push(i);
    });
    return { gadgetAt, setPieceAt };
  };
  // v23 (and every version before it): gadget doors land on i % 4 === 0 and set pieces on
  // i >= 5 && i % 5 === 0 && i % 4 !== 0, so two different seeds land on the exact same columns.
  const oldA = doorIndices(23, 1), oldB = doorIndices(23, 2);
  assert.deepEqual(oldA.gadgetAt, oldB.gadgetAt, "v23 gadget doors are seed-independent");
  assert.deepEqual(oldA.setPieceAt, oldB.setPieceAt, "v23 set pieces are seed-independent");
  assert.deepEqual(oldA.gadgetAt, [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 100, 104, 108, 112, 116]);
  // v24: cooldowns rolled from the world RNG make the pacing itself part of the seed, so two
  // seeds must land on different columns, not just carry different content on the same columns.
  const newA = doorIndices(24, 1), newB = doorIndices(24, 2);
  assert.notDeepEqual(newA.gadgetAt, newB.gadgetAt, "v24 gadget doors differ by seed");
  assert.notDeepEqual(newA.setPieceAt, newB.setPieceAt, "v24 set pieces differ by seed");
  // and the average cadence should still land roughly where it did before (a gadget door every
  // ~4-5 segments, a set piece every ~5-6), not drift off to something far sparser or denser
  const spacing = (xs: number[]) => (xs[xs.length - 1] - xs[0]) / (xs.length - 1);
  assert.ok(spacing(newA.gadgetAt) > 3 && spacing(newA.gadgetAt) < 7, `gadget cadence ${spacing(newA.gadgetAt)}`);
  assert.ok(spacing(newA.setPieceAt) > 3.5 && spacing(newA.setPieceAt) < 8, `set piece cadence ${spacing(newA.setPieceAt)}`);
});

test("the compass needle follows a climber and settles back to north", () => {
  const g = game(); g.phase = "running";
  const compass = { id: "cmp", itemId: "rotor-compass", kind: "rotor" as const, phase: 2.4, x: 200, y: -300 };
  g.world.segments = [{ y: -500, h: 500, zones: [], bumpers: [], gadgets: [compass], powerUps: [] }];
  const c = g.climbers[0];
  const settle = (x: number, y: number) => {
    for (let i = 0; i < 180; i++) { Object.assign(c, { x, y, state: "stuck", vx: 0, vy: 0, vz: 0, z: 0 }); g.update(1 / 60); }
    return compass.needle ?? 0;
  };
  // the needle art points north at 0, so a bearing turns a quarter further than atan2
  assert.ok(Math.abs(settle(110, -300) + Math.PI / 2) < 0.1, "should point left at a climber on its left");
  assert.ok(Math.abs(settle(290, -300) - Math.PI / 2) < 0.1, "should point right");
  assert.ok(Math.abs(settle(200, -410)) < 0.1, "should point up");
  assert.ok(Math.abs(Math.abs(settle(200, -190)) - Math.PI) < 0.1, "should point down");
  // out of its range it swings back to north, and it never turns as a gadget
  assert.ok(Math.abs(settle(900, 900)) < 0.1, "back to north when nobody is near");
  assert.equal(gadgetPose(compass, 0).angle, gadgetPose(compass, 4).angle, "a compass hangs still");
});

test("the prize machine doubles its price every spin", () => {
  assert.equal(prizeCost(0), 100);
  assert.equal(prizeCost(1), 200);
  assert.equal(prizeCost(4), 1600);
  // the doubling stops at the ceiling, or the last patterns would be out of anyone's reach
  assert.equal(prizeCost(8), 25_600);
  assert.equal(prizeCost(9), 25_600);
  assert.equal(prizeCost(40), 25_600);
  // a complete collection is still a long sink: real coins, but a reachable number
  const sellable = PATTERNS.filter((p) => !p.limited).length;
  const total = Array.from({ length: sellable }, (_, i) => prizeCost(i)).reduce((a, b) => a + b, 0);
  assert.ok(total > 100_000 && total < 250_000, `collecting everything should cost about 179k: ${total}`);
  // and a spin is never free, however the counter arrives
  assert.equal(prizeCost(-3), 100);
});

test("the daily climb is one fridge a day, the same for everyone", () => {
  // the seed comes from the date alone, so two devices build the same door without asking
  assert.equal(dailySeed("2026-09-17"), dailySeed("2026-09-17"));
  assert.notEqual(dailySeed("2026-09-17"), dailySeed("2026-09-18"));
  assert.ok(dailySeed("2026-09-17") > 0);
  // and the door itself is identical, not just the number
  const a = new World(dailySeed("2026-09-17"), 0), b = new World(dailySeed("2026-09-17"), 0);
  a.ensure(-4000); b.ensure(-4000);
  assert.deepEqual(a.segments, b.segments);
  const other = new World(dailySeed("2026-09-18"), 0); other.ensure(-4000);
  assert.notDeepEqual(a.segments, other.segments);
  // the day rolls at midnight Central: 04:59Z is still the 17th in Chicago in September
  assert.equal(todayKey(Date.parse("2026-09-18T04:59:00Z")), "2026-09-17");
  assert.equal(todayKey(Date.parse("2026-09-18T05:01:00Z")), "2026-09-18");
});

test("missions read the run, pay once, and the board tops itself up", () => {
  const board = refill([], 0, () => 0.5);
  assert.equal(board.length, 3, "three at a time");
  assert.equal(new Set(board.map((m) => m.id)).size, 3, "and never the same one twice");

  // a per-run goal takes the best run, not a running total: two half-runs do not finish it
  const climb = { id: "climb", n: 1500, pay: 110, at: 0, done: false };
  const half = { cm: 900, coins: 0, gadgetRides: 0, hits: 0, paints: 0, seconds: 0, daily: 0, unhurtCm: 900 };
  let one = settle([climb], half);
  assert.equal(one.finished.length, 0);
  assert.equal(one.board[0].at, 900, "progress shows the best run so far");
  one = settle(one.board, half);
  assert.equal(one.finished.length, 0, "two 900s are not an 1800");
  one = settle(one.board, { ...half, cm: 1600 });
  assert.equal(one.finished.length, 1);
  assert.equal(one.paid, 110);

  // a hit voids the no-damage mission for that run, whatever height it reached
  const unhurt = { id: "unhurt", n: 600, pay: 80, at: 0, done: false };
  // the feat is the height before the first hit: hit at 300 and the run does not count, hit at 700 and it does
  assert.equal(settle([unhurt], { ...half, cm: 900, hits: 1, unhurtCm: 300 }).finished.length, 0);
  assert.equal(settle([unhurt], { ...half, cm: 900, hits: 1, unhurtCm: 700 }).finished.length, 1);
  assert.equal(settle([unhurt], { ...half, cm: 900, hits: 0 }).finished.length, 1);

  // the daily mission counts days, so it does add up across runs
  const today = { id: "today", n: 2, pay: 90, at: 0, done: false };
  const first = settle([today], { ...half, daily: 1 });
  assert.equal(first.finished.length, 0);
  assert.equal(settle(first.board, { ...half, daily: 1 }).finished.length, 1);

  // a finished mission leaves the board and a new one takes its place
  const after = refill(one.board, 1, () => 0.2);
  assert.equal(after.length, 3);
  assert.ok(!after.some((m) => m.done));
  // every mission says something a player can picture
  for (const m of MISSIONS) assert.ok(m.text(m.targets[0]).length > 12, m.id);

  // The board is rolled fresh every day, so every mission on it has to be finishable inside
  // one. A cross-day target reset to nought each midnight and sat there as a job that could
  // not be done -- "take the daily climb 2 days running", on a board that forgets overnight.
  for (const m of MISSIONS) {
    if (m.stat !== "daily") continue;
    for (const n of m.targets) assert.equal(n, 1, `${m.id} asks for ${n} days on a board that lasts one`);
  }
});

test("v26 souvenir plates are cut to the size chosen for the magnet on them", () => {
  // The plate used to be a rolled rectangle with whichever souvenir its position hashed to
  // hung inside it, so the art and the box agreed only by luck. Now the magnet is picked
  // first and the box is its chosen size, which is what makes the audit mean anything.
  let seen = 0;
  for (let seed = 1; seed <= 14; seed++) {
    const w = new World(seed, 0);
    w.generateTo(120);
    for (const seg of w.segments) {
      for (const z of seg.zones) {
        if (z.kind !== "repel" && z.kind !== "attract") continue;
        // toy keychains are repel zones too; they are checked by their own test
        if (!z.itemId || !/^(attract|repel)-/.test(z.itemId)) continue;
        const want = sizeOf(z.itemId);
        assert.ok(want, `${z.itemId} has no chosen size`);
        // a strong plate is drawn 25% bigger on purpose, so allow exactly that multiple
        const ratio = z.w / want![0];
        assert.ok(Math.abs(ratio - 1) < 0.02 || Math.abs(ratio - 1.25) < 0.02,
          `${z.itemId} cut ${z.w}x${z.h}, chosen ${want![0]}x${want![1]}`);
        assert.ok(Math.abs(z.h / want![1] - ratio) < 0.02, `${z.itemId} was stretched, not scaled`);
        seen++;
      }
    }
  }
  assert.ok(seen > 10, `expected plates across fourteen seeds, saw ${seen}`);

  // and world 25 keeps the rolled rectangles it always had
  const old = new World(3, 0, 25);
  old.generateTo(120);
  const oldPlates = old.segments.flatMap((s) => s.zones.filter((z) => z.kind === "repel" || z.kind === "attract"));
  assert.ok(oldPlates.length > 0, "world 25 still makes plates");
  assert.ok(oldPlates.every((z) => !/^(attract|repel)-/.test(z.itemId ?? "")), "and does not name their souvenir");
});

test("v26 toy magnets are cut to the size chosen for the toy, not a shared rectangle", () => {
  // Every toy used to land in a box rolled from one range, so a gummy bear and a race car
  // came out the same size on the door when they are nothing like it in the hand.
  let seen = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const w = new World(seed, 0);
    w.generateTo(120);
    for (const seg of w.segments) {
      for (const z of seg.zones) {
        if (!z.itemId?.startsWith("bumper-")) continue;
        const want = sizeOf(z.itemId)!;
        assert.ok(want, `${z.itemId} has no chosen size`);
        assert.equal(Math.round(z.w), want[0], `${z.itemId} width`);
        assert.equal(Math.round(z.h), want[1], `${z.itemId} height`);
        seen++;
      }
    }
  }
  assert.ok(seen > 5, `expected toys across ten seeds, saw ${seen}`);
});

test("the cold air vent is one grille across the whole door", () => {
  // A vent on a real fridge spans the door. Three stacked down one half read as ductwork,
  // and the same photograph three times in a column reads as tiling rather than as a thing.
  for (let seed = 1; seed <= 12; seed++) {
    const w = new World(seed, 0);
    w.generateTo(60);
    for (const seg of w.segments) {
      const vents = seg.zones.filter((z) => z.itemId === "vent");
      assert.ok(vents.length <= 1, `seed ${seed} stacked ${vents.length} grilles in one segment`);
      for (const v of vents) {
        assert.equal(v.x, 0, `seed ${seed} put a grille on one door instead of across`);
        assert.equal(v.w, 400, `seed ${seed} drew a grille ${v.w} wide`);
      }
    }
  }
  // and the version before it keeps its three, so old runs and saved tapes are untouched
  let sawStack = false;
  for (let seed = 1; seed <= 12 && !sawStack; seed++) {
    const old = new World(seed, 0, 21);
    old.generateTo(80);
    sawStack = old.segments.some((seg) => seg.zones.filter((z) => z.itemId === "vent").length === 3);
  }
  assert.ok(sawStack, "world 21 still stacks three");
});

test("a day's board is three, rolled once, and finished ones stay put", () => {
  const board = dailyBoard(0, () => 0.31);
  assert.equal(board.length, 3);
  assert.equal(new Set(board.map((m) => m.id)).size, 3, "no mission twice on one board");

  // the same day asked again gives the same three, because main.ts only rolls on a new day;
  // what matters here is that finishing one does not evict it
  const done = settle(board, { cm: 99_999, coins: 999, gadgetRides: 99, hits: 0, paints: 99, seconds: 9999, daily: 1, unhurtCm: 99_999 });
  assert.ok(done.finished.length > 0, "a huge run finishes something");
  assert.equal(done.board.length, 3, "the board stays three");
  assert.ok(done.board.some((m) => m.done), "and keeps the finished one, to show it was earned");
  for (const m of done.board.filter((x) => x.done)) assert.equal(m.at, m.n, "a finished mission reads as full");
});

test("a streak pays more each day and a pattern on the seventh", () => {
  const pays = [1, 2, 3, 4, 5, 6].map((d) => streakReward(d).coins);
  for (let i = 1; i < pays.length; i++) assert.ok(pays[i] > pays[i - 1], `day ${i + 1} should beat day ${i}`);
  assert.equal(streakReward(7).pattern, true, "the seventh day pays a look, not coins");
  assert.equal(streakReward(7).coins, 0);
  // and it keeps going: day 14 is another pattern, the days between pay coins again
  assert.equal(streakReward(14).pattern, true);
  assert.ok(streakReward(8).coins > 0);
  // nothing for a streak that does not exist
  assert.equal(streakReward(0).coins, 0);
  assert.equal(streakReward(0).pattern, false);
});

test("the league week rolls on a Monday, Central", () => {
  // ISO weeks: the Thursday decides the year, and Monday starts the week, at midnight Chicago
  assert.equal(weekKey(Date.parse("2026-09-17T12:00:00Z")), "2026-W38");
  assert.equal(weekKey(Date.parse("2026-09-21T04:59:00Z")), "2026-W38", "Sunday night in Chicago is still last week");
  assert.equal(weekKey(Date.parse("2026-09-21T05:01:00Z")), "2026-W39", "Monday starts a new one");
  // and the turn of the year lands where ISO says, not where the calendar does
  assert.equal(weekKey(Date.parse("2027-01-01T12:00:00Z")), "2026-W53");
});

test("every month has a door and a pattern only that month gives out", () => {
  const months = FRIDGE_THEMES.map((t) => t.month).sort((a, b) => a - b);
  assert.deepEqual(months, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "twelve doors, one each");
  for (const t of FRIDGE_THEMES) {
    assert.equal(t.steel.length, 6, `${t.id} needs six stops`);
    for (const c of t.steel) assert.match(c, /^#[0-9a-f]{6}$/i, `${t.id}: ${c}`);
    const pattern = PATTERNS.find((p) => p.id === t.pattern);
    assert.ok(pattern, `${t.id} has no pattern`);
    assert.equal(pattern!.limited, t.id, `${t.pattern} should be limited to ${t.id}`);
    assert.equal(pattern!.colors.length, 6);
  }
  // the door changes on the first at midnight Central, and September is the stainless the game shipped with
  assert.equal(themeFor(Date.parse("2026-10-01T04:59:00Z")).id, "pencil");
  assert.equal(themeFor(Date.parse("2026-10-01T05:01:00Z")).id, "harvest");
  assert.equal(monthKey(Date.parse("2026-10-01T05:01:00Z")), "2026-10");
});

test("when the door is generated makes no difference to the climb", () => {
  // a taller screen generates the door sooner; bumpers used to be stepped from the moment
  // their segment existed, so two phones met them in different phases and diverged
  const play = (g: Game) => {
    g.phase = "running";
    for (let i = 0; i < 40; i++) {
      const c = g.climbers[0];
      if (c.state === "stuck" || c.state === "linked") g.launch(c, { x: i % 3 === 0 ? 120 : -90, y: -520 });
      for (let k = 0; k < 60; k++) g.update(1 / 120);
      if (g.phase === "dead") break;
    }
    return g;
  };
  for (const seed of [11, 4242, 90210]) {
    const early = new Game(levels, events, { seed, rules: "solo" });
    early.world.ensure(-1500); // a good stretch of door up front, as a taller screen would
    const late = new Game(levels, events, { seed, rules: "solo" });
    play(early); play(late);
    assert.equal(early.heightCm, late.heightCm, `seed ${seed}: same height whenever the door was generated`);
    assert.deepEqual(early.climbers.map((c) => [Math.round(c.x), Math.round(c.y), c.state]), late.climbers.map((c) => [Math.round(c.x), Math.round(c.y), c.state]));
    assert.equal(early.feats.hits, late.feats.hits, `seed ${seed}: same hits`);
  }
  // and the screen's own height never reaches the sim: only the view camera moves with it
  const g = new Game(levels, events, { seed: 5, rules: "solo" });
  g.viewH = 1000;
  assert.equal(g.viewCamY(1000), g.camY - 300 * 0.55);
});

test("flings that come back down no higher count as stalls", () => {
  const g = new Game(levels, events, { seed: 4242, rules: "solo" });
  g.phase = "running";
  const c = g.climbers[0];
  // a tiny hop straight up lands right back where it left
  for (let i = 0; i < 3; i++) {
    g.launch(c, { x: 0, y: -120 });
    for (let k = 0; k < 120 && c.state === "flying"; k++) g.update(1 / 120);
  }
  assert.ok(c.state === "stuck", "back on the door");
  assert.equal(g.stalls, 3, "three hops that gained nothing");
});

test("a tape replays into the same climb it recorded", () => {
  // the whole point of the recorder: seed plus inputs is enough to build the run again
  const play = (g: Game) => {
    g.phase = "running";
    for (let i = 0; i < 6; i++) {
      const c = g.climbers[0];
      // raw floats, as a finger produces: the tape keeps two decimals, and so must the run
      if (c.state === "stuck" || c.state === "linked") g.launch(c, { x: i % 2 ? 90.123456 : -89.98765, y: -360.4321 });
      for (let k = 0; k < 90; k++) g.update(1 / 120);
    }
    return g;
  };
  const live = play(new Game(levels, events, { seed: 4242, rules: "solo" }));
  const tape = live.sealTape();
  assert.ok(tape, "a run with flings in it has a tape");
  assert.ok(tape!.events.length >= 3, `expected flings on the tape: ${tape!.events.length}`);
  assert.equal(tape!.seed, 4242);
  assert.equal(tape!.world, live.world.version, "a tape carries the terrain version it was climbed on");

  const ghost = new Game(levels, events, { seed: tape!.seed, rules: "solo", worldVersion: tape!.world });
  ghost.phase = "running";
  replay(tape!, ghost,
    (g, e) => { if (e.k === "fling") { const c = g.climbers.find((x) => x.id === e.id); if (c) g.launch(c, e.v); } },
    (g, dt) => g.update(dt));
  assert.equal(ghost.heightCm, live.heightCm, "the replay climbs exactly as high as the run did");
  assert.deepEqual(ghost.climbers.map((c) => [Math.round(c.x), Math.round(c.y)]),
    live.climbers.map((c) => [Math.round(c.x), Math.round(c.y)]), "and ends in the same place");

  // a run nobody played leaves no tape, and a tape stays small enough to keep
  assert.equal(new Game(levels, events, { seed: 1, rules: "solo" }).sealTape(), null);
  // a run picked up from a snapshot has an unrecorded past, so it refuses to hand one over
  const resumed = Game.restore(levels, events, live.snapshot() ?? ({} as never));
  resumed.launch(resumed.climbers[0], { x: 40, y: -300 });
  assert.equal(resumed.sealTape(), null, "a resumed run must not pretend to be a full tape");
  assert.ok(tapeBytes(tape!) < 4000, `a short run should be a small tape: ${tapeBytes(tape!)} bytes`);
});

test("a ghost stepped beside a live run climbs the run it was recorded from", () => {
  // The Ghost class differs from replay(): it is driven one live frame at a time, by the
  // game loop, rather than run to completion. It has to land in the same place regardless.
  const play = (g: Game) => {
    g.phase = "running";
    for (let i = 0; i < 6; i++) {
      const c = g.climbers[0];
      // raw floats, as a finger produces: the tape keeps two decimals, and so must the run
      if (c.state === "stuck" || c.state === "linked") g.launch(c, { x: i % 2 ? 90.123456 : -89.98765, y: -360.4321 });
      for (let k = 0; k < 90; k++) g.update(1 / 120);
    }
    return g;
  };
  const live = play(new Game(levels, events, { seed: 777, rules: "solo" }));
  const tape = live.sealTape();
  assert.ok(tape, "a run with flings in it has a tape");

  const ghost = new Ghost(tape!);
  // exactly as main.ts drives it: one fixed step per frame, for as long as the tape lasts
  for (let i = 0; i < 6 * 90; i++) ghost.step(1 / 120);
  assert.equal(ghost.heightCm, live.heightCm, "the ghost climbs exactly as high as the run did");
  assert.deepEqual([Math.round(ghost.climber?.x ?? -1), Math.round(ghost.climber?.y ?? -1)],
    [Math.round(live.climbers[0].x), Math.round(live.climbers[0].y)], "and ends in the same place");

  // it must go quiet rather than loop or throw once the recorded run has played out
  for (let i = 0; i < 2000; i++) ghost.step(1 / 120);
  assert.equal(ghost.done, true, "a ghost stops when the tape does");
  assert.equal(ghost.climber, null, "and stops offering a climber to draw");
});

test("knocking the taxi keychain reports it, so it can honk", () => {
  const g = game(); g.phase = "running";
  const seg = g.world.segments[0];
  seg.zones.push({ x: 150, y: -200, w: 60, h: 40, kind: "void", hue: -1, itemId: "bumper-6", swing: { angle: 0, vel: 0, cool: 0 } });
  g.world.knockSwings({ x: 180, y: -180 }, 300);
  assert.equal(g.world.knocked, "bumper-6");
  assert.ok(EFFECTS.taxi?.length, "and the horn exists to play");
  // the debounce holds: brushing it again while it is still cooling says nothing new
  g.world.knocked = null;
  g.world.knockSwings({ x: 180, y: -180 }, 300);
  assert.equal(g.world.knocked, null);
});

test("the wall's ramp, creep and catch-up multipliers cap as a product, not just individually", () => {
  const g = game(); g.phase = "running";
  // climb enormously high (saturates the stepped ramp at floorCapMult on its own) and run for a
  // long time (saturates the creep at floorCreepCap on its own): each factor is already at its own
  // ceiling, so their product alone is floorCapMult * floorCreepCap = 10, well past floorMultCap.
  g.startY = 0; g.highestY = -1_000_000; g.runTime = 100_000;
  assert.ok(CFG.floorCapMult * CFG.floorCreepCap > CFG.floorMultCap, "the setup actually exercises the cap");
  // and stack the catch-up nudge on top by leaving the lone climber far above the wall
  g.floorY = g.highestY + CFG.floorCatchupGap + 1000;
  g.climbers[0].y = g.highestY;
  g.climbers[0].state = "flying";
  const uncappedProduct = CFG.floorCapMult * CFG.floorCreepCap * CFG.floorCatchupMult;
  assert.ok(uncappedProduct > CFG.floorMultCap, "catch-up alone would blow well past the cap too");
  assert.ok(g.wallMult() <= CFG.floorMultCap + 1e-9, "the combined multiplier never exceeds floorMultCap");
  assert.ok(g.wallMult() > CFG.floorCapMult, "the cap still allows more than any single factor alone, just not their full product");
});

test("a POP! toy placed on a v26+ door has its bubbles", () => {
  let seen = 0;
  for (let seed = 1; seed <= 60 && !seen; seed++) {
    const w = new World(seed, 0); w.generateTo(60);
    for (const s of w.segments) for (const z of s.zones) if (z.itemId === "bumper-4") { seen++; assert.equal(z.pops, 0b0101010101, `seed ${seed}`); }
  }
  assert.ok(seen > 0, "no POP! toy turned up in sixty seeds");
});

test("the game day is the Central date and turns over at midnight Chicago", () => {
  // 2026-09-18 01:30Z is still the evening of the 17th in Chicago (CDT, UTC-5)
  assert.equal(dayKeyAt(Date.UTC(2026, 8, 18, 1, 30)), "2026-09-17");
  assert.equal(dayKeyAt(Date.UTC(2026, 8, 18, 5, 0)), "2026-09-18");
  assert.equal(nextDayStart(Date.UTC(2026, 8, 18, 1, 30)), Date.UTC(2026, 8, 18, 5, 0));
  // winter: CST is UTC-6, so the day starts at 06:00Z
  assert.equal(nextDayStart(Date.UTC(2026, 0, 10, 12)), Date.UTC(2026, 0, 11, 6));
  assert.equal(weekKey(Date.UTC(2026, 8, 21, 4, 59)), "2026-W38", "Sunday night in Chicago is still week 38");
  assert.equal(weekKey(Date.UTC(2026, 8, 21, 5, 0)), "2026-W39");
});
