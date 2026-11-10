'use strict';

// The combat simulation: units, orders, attacks, projectiles and damage.
// No DOM and no real time in here, so tests and simulated matches can run it headless.
// Distances are Dota units, time is seconds.

const ARENA = { width: 2000, height: 1125 };
const HERO_RADIUS = 28;
const HERO_ACQUIRE_RANGE = 800;
const MAX_EVENTS = 500;

// mulberry32: small seeded generator so a match can be replayed exactly.
function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSim(seed) {
  return { time: 0, units: [], projectiles: [], events: [], rng: makeRng(seed), nextId: 1 };
}

function addUnit(sim, props) {
  const unit = Object.assign({
    id: sim.nextId++,
    team: 0,
    kind: 'creep',
    name: '',
    x: 0,
    y: 0,
    radius: 24,
    facing: -Math.PI / 2,
    acquireRange: Infinity,
    order: { type: 'idle' },
    windup: null,
    windupTargetId: null,
    attackCooldown: 0,
    dead: false,
  }, props);
  unit.hp = unit.stats.maxHp;
  unit.mana = unit.stats.maxMana;
  sim.units.push(unit);
  return unit;
}

function addHero(sim, heroData, level, team, x, y) {
  return addUnit(sim, {
    kind: 'hero',
    name: heroData.localized_name,
    data: heroData,
    level,
    team,
    x,
    y,
    radius: HERO_RADIUS,
    acquireRange: HERO_ACQUIRE_RANGE,
    stats: heroStats(heroData, level),
  });
}

function setHeroLevel(hero, level) {
  hero.level = level;
  hero.stats = heroStats(hero.data, level);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function findUnit(sim, id) {
  return sim.units.find((unit) => unit.id === id && !unit.dead) || null;
}

function nearestEnemy(sim, unit, maxRange) {
  let best = null;
  let bestDistance = maxRange;
  for (const other of sim.units) {
    if (other.dead || other.team === unit.team) continue;
    const d = distance(unit, other);
    if (d <= bestDistance) {
      best = other;
      bestDistance = d;
    }
  }
  return best;
}

function inAttackRange(unit, target) {
  return distance(unit, target) - unit.radius - target.radius <= unit.stats.attackRange;
}

// Orders. A new order always interrupts an attack that has not landed yet.
function cancelWindup(unit) {
  if (unit.windup !== null) {
    unit.windup = null;
    unit.attackCooldown = 0;
  }
}

function giveOrder(unit, order) {
  cancelWindup(unit);
  unit.order = order;
}

function orderMove(unit, x, y) {
  giveOrder(unit, { type: 'move', x, y });
}

function orderAttack(unit, target) {
  giveOrder(unit, { type: 'attack', targetId: target.id });
}

function orderAttackMove(unit, x, y) {
  giveOrder(unit, { type: 'attackMove', x, y });
}

function orderStop(unit) {
  giveOrder(unit, { type: 'idle' });
}

function pushEvent(sim, event) {
  if (sim.events.length >= MAX_EVENTS) sim.events.shift();
  sim.events.push(event);
}

function applyDamage(sim, source, target, amount, type) {
  if (target.dead) return 0;
  let dealt = amount;
  if (type === 'physical') dealt *= armorMultiplier(target.stats.armor);
  if (type === 'magical') dealt *= 1 - target.stats.magicResist / 100;
  target.hp -= dealt;
  pushEvent(sim, { type: 'damage', targetId: target.id, x: target.x, y: target.y, amount: dealt, damageType: type });
  if (target.hp <= 0) {
    target.hp = 0;
    target.dead = true;
    pushEvent(sim, { type: 'death', unitId: target.id, killerId: source ? source.id : null, x: target.x, y: target.y });
  }
  return dealt;
}

function launchAttack(sim, unit, target) {
  const { damageMin, damageMax, projectileSpeed } = unit.stats;
  const damage = Math.round(damageMin + sim.rng() * (damageMax - damageMin));
  if (projectileSpeed > 0) {
    sim.projectiles.push({ x: unit.x, y: unit.y, sourceId: unit.id, targetId: target.id, speed: projectileSpeed, damage });
  } else {
    applyDamage(sim, unit, target, damage, 'physical');
  }
}

// Returns true once the unit reaches the point.
function moveToward(unit, x, y, dt) {
  const dx = x - unit.x;
  const dy = y - unit.y;
  const d = Math.hypot(dx, dy);
  const step = unit.stats.moveSpeed * dt;
  if (d <= step) {
    unit.x = x;
    unit.y = y;
    return true;
  }
  unit.x += (dx / d) * step;
  unit.y += (dy / d) * step;
  unit.facing = Math.atan2(dy, dx);
  return false;
}

function stepAttack(sim, unit, target, dt) {
  unit.facing = Math.atan2(target.y - unit.y, target.x - unit.x);
  if (unit.windup !== null && unit.windupTargetId !== target.id) cancelWindup(unit);
  if (unit.windup === null) {
    if (unit.attackCooldown > 0) return;
    unit.windup = unit.stats.attackPoint;
    unit.windupTargetId = target.id;
    unit.attackCooldown = unit.stats.attackInterval;
  }
  unit.windup -= dt;
  if (unit.windup <= 0) {
    unit.windup = null;
    launchAttack(sim, unit, target);
  }
}

function stepUnit(sim, unit, dt) {
  unit.hp = Math.min(unit.stats.maxHp, unit.hp + unit.stats.hpRegen * dt);
  unit.mana = Math.min(unit.stats.maxMana, unit.mana + unit.stats.manaRegen * dt);
  unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);

  let target = null;
  if (unit.order.type === 'attack') {
    target = findUnit(sim, unit.order.targetId);
    if (!target) unit.order = { type: 'idle' };
  }
  // Idle and attack-moving units pick the closest enemy on their own.
  if (!target && (unit.order.type === 'idle' || unit.order.type === 'attackMove')) {
    target = nearestEnemy(sim, unit, unit.acquireRange);
  }

  if (target) {
    if (inAttackRange(unit, target)) {
      stepAttack(sim, unit, target, dt);
    } else {
      cancelWindup(unit);
      moveToward(unit, target.x, target.y, dt);
    }
    return;
  }

  cancelWindup(unit);
  if (unit.order.type === 'move' || unit.order.type === 'attackMove') {
    if (moveToward(unit, unit.order.x, unit.order.y, dt)) unit.order = { type: 'idle' };
  }
}

function stepProjectiles(sim, dt) {
  sim.projectiles = sim.projectiles.filter((projectile) => {
    const target = findUnit(sim, projectile.targetId);
    if (!target) return false;
    const dx = target.x - projectile.x;
    const dy = target.y - projectile.y;
    const d = Math.hypot(dx, dy);
    const step = projectile.speed * dt;
    if (d <= step) {
      applyDamage(sim, findUnit(sim, projectile.sourceId), target, projectile.damage, 'physical');
      return false;
    }
    projectile.x += (dx / d) * step;
    projectile.y += (dy / d) * step;
    return true;
  });
}

// Units cannot stand on top of each other: overlapping pairs push apart.
function separateUnits(sim) {
  const units = sim.units;
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i];
      const b = units[j];
      const overlap = a.radius + b.radius - distance(a, b);
      if (overlap <= 0) continue;
      const angle = distance(a, b) > 0 ? Math.atan2(b.y - a.y, b.x - a.x) : sim.rng() * Math.PI * 2;
      a.x -= Math.cos(angle) * overlap / 2;
      a.y -= Math.sin(angle) * overlap / 2;
      b.x += Math.cos(angle) * overlap / 2;
      b.y += Math.sin(angle) * overlap / 2;
    }
  }
  for (const unit of units) {
    unit.x = Math.min(ARENA.width - unit.radius, Math.max(unit.radius, unit.x));
    unit.y = Math.min(ARENA.height - unit.radius, Math.max(unit.radius, unit.y));
  }
}

function stepSim(sim, dt) {
  sim.time += dt;
  for (const unit of sim.units) {
    if (!unit.dead) stepUnit(sim, unit, dt);
  }
  stepProjectiles(sim, dt);
  // Dead creeps leave the arena; a dead hero stays so the match can read its state.
  sim.units = sim.units.filter((unit) => !unit.dead || unit.kind === 'hero');
  separateUnits(sim);
}
