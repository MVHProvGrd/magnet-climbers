import assert from "node:assert/strict";
import { test } from "node:test";
import { Game } from "../src/game/game";
import { World } from "../src/game/world";
import { UPGRADES, type UpgradeKey } from "../src/game/config";
import { attachGrip, braceLanding, findContacts, limbTip, LIMB_TIPS, rotate, stepGrip } from "../src/game/magnetism";
import { flightLimb, LIMB_ROOTS, resetRagdoll, stepRagdoll } from "../src/game/ragdoll";
import { FRIDGE_ITEMS, itemZone } from "../src/game/items";
import { populateSetPiece, SET_PIECES } from "../src/game/world-patterns";
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
  g.world.segments[0].bumpers.push({ x: c.x - 10, y: c.y - 10, w: 20, h: 20, vx: 10, minX: 0, maxX: 400, label: "test", hue: 0 });
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
  assert.equal(FRIDGE_ITEMS.length, 38);
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
  assert.equal(modern.snapshot()!.worldVersion, 2);
  assert.ok(modern.world.segments.some((s) => s.zones.some((z) => z.itemId)));
});
