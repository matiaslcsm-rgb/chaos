'use strict';

// The combat simulation: units, orders, attacks, statuses, projectiles, zones and damage.
// No DOM and no real time in here, so tests and simulated matches can run it headless.
// Distances are Dota units, time is seconds. Abilities plug in through hooks (see abilities.js).

const ARENA = { width: 2000, height: 1125 };
const HERO_RADIUS = 28;
const HERO_ACQUIRE_RANGE = 800;
const MAX_EVENTS = 500;
const MIN_MOVE_SPEED = 100;

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
  return { time: 0, units: [], projectiles: [], zones: [], timers: [], events: [], rng: makeRng(seed), nextId: 1 };
}

// ---- Stats and statuses ----

// A status (modifier) is { id, sourceId, duration, stacks, stats, flags, tick, passive }.
// stats: armor, magicResist, attackSpeed, attackRange, damage, damagePct, moveSpeedPct, evasion,
//        hpRegen, manaRegen, manaRegenPct.  flags: stunned, rooted, disarmed, silenced, taunted.
function recomputeStats(unit) {
  const stats = Object.assign({}, unit.baseStats);
  const flags = {};
  let movePct = 0;
  let damagePct = 0;
  let manaRegenPct = 0;
  let dodge = 1;
  for (const mod of unit.mods) {
    const n = mod.stacks || 1;
    const s = mod.stats || {};
    stats.armor += (s.armor || 0) * n;
    stats.magicResist += (s.magicResist || 0) * n;
    stats.attackSpeed += (s.attackSpeed || 0) * n;
    stats.attackRange += (s.attackRange || 0) * n;
    stats.hpRegen += (s.hpRegen || 0) * n;
    stats.manaRegen += (s.manaRegen || 0) * n;
    stats.damageMin += (s.damage || 0) * n;
    stats.damageMax += (s.damage || 0) * n;
    damagePct += (s.damagePct || 0) * n;
    movePct += (s.moveSpeedPct || 0) * n;
    manaRegenPct += (s.manaRegenPct || 0) * n;
    if (s.evasion) dodge *= 1 - s.evasion;
    for (const flag of mod.flags || []) flags[flag] = mod;
  }
  // Percentage damage is based on the unit's own damage, like in Dota.
  stats.damageMin += unit.baseStats.damageMin * damagePct / 100;
  stats.damageMax += unit.baseStats.damageMax * damagePct / 100;
  stats.manaRegen *= 1 + manaRegenPct / 100;
  stats.evasion = 1 - dodge;
  if (unit.baseStats.moveSpeed > 0) {
    stats.moveSpeed = Math.max(MIN_MOVE_SPEED, unit.baseStats.moveSpeed * (1 + movePct / 100));
  }
  Object.assign(stats, attackTiming(stats.baseAttackTime, stats.baseAttackPoint, stats.attackSpeed));
  unit.stats = stats;
  unit.flags = flags;
}

function findMod(unit, id) {
  return unit.mods.find((mod) => mod.id === id) || null;
}

// Adds a status, or refreshes it (and adds a stack) if the same source already applied it.
function addMod(sim, target, spec) {
  if (target.dead) return null;
  let mod = target.mods.find((m) => m.id === spec.id && m.sourceId === spec.sourceId);
  if (mod) {
    Object.assign(mod, spec, { stacks: spec.maxStacks ? Math.min(spec.maxStacks, mod.stacks + 1) : 1 });
  } else {
    mod = Object.assign({ stacks: 1, tickTimer: 0 }, spec);
    target.mods.push(mod);
  }
  recomputeStats(target);
  return mod;
}

function removeMod(unit, id) {
  unit.mods = unit.mods.filter((mod) => mod.id !== id);
  recomputeStats(unit);
}

function stepMods(sim, unit, dt) {
  let expired = false;
  for (const mod of unit.mods) {
    if (mod.tick) {
      mod.tickTimer += dt;
      while (mod.tickTimer >= mod.tick.interval && !unit.dead) {
        mod.tickTimer -= mod.tick.interval;
        mod.tick.run(mod, unit);
      }
    }
    mod.duration -= dt;
    if (mod.duration <= 0) expired = true;
  }
  if (expired) unit.mods = unit.mods.filter((mod) => mod.duration > 0);
}

// ---- Units ----

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
    castTime: null,
    channel: null,
    knock: null,
    attackCooldown: 0,
    mods: [],
    abilities: [],
    dead: false,
  }, props);
  unit.baseStats = Object.assign({ evasion: 0 }, props.stats);
  recomputeStats(unit);
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
    skillPoints: level,
    team,
    x,
    y,
    radius: HERO_RADIUS,
    acquireRange: HERO_ACQUIRE_RANGE,
    stats: heroStats(heroData, level),
  });
}

function setHeroLevel(hero, level) {
  hero.skillPoints += level - hero.level;
  hero.level = level;
  hero.baseStats = Object.assign({ evasion: 0 }, heroStats(hero.data, level));
  recomputeStats(hero);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function findUnit(sim, id) {
  return sim.units.find((unit) => unit.id === id && !unit.dead) || null;
}

function enemiesNear(sim, team, point, radius) {
  return sim.units.filter((unit) => !unit.dead && unit.team !== team && distance(unit, point) <= radius);
}

function nearestEnemy(sim, unit, maxRange, skip) {
  let best = null;
  let bestDistance = maxRange;
  for (const other of sim.units) {
    if (other.dead || other.team === unit.team || (skip && skip.has(other.id))) continue;
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

// ---- Orders ----

// A new order always interrupts an attack or a cast that has not gone off yet, and any channel.
function cancelWindup(unit) {
  if (unit.windup !== null) {
    unit.windup = null;
    unit.attackCooldown = 0;
  }
  unit.castTime = null;
}

function giveOrder(unit, order) {
  cancelWindup(unit);
  unit.channel = null;
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

// ---- Events, timers, zones ----

function pushEvent(sim, event) {
  if (sim.events.length >= MAX_EVENTS) sim.events.shift();
  sim.events.push(event);
}

function after(sim, delay, run) {
  sim.timers.push({ time: sim.time + delay, run });
}

// A zone is an area that does something every `interval` for `duration`. It can follow a unit,
// and it ends early if that unit was channeling it and stopped.
function addZone(sim, spec) {
  const zone = Object.assign({ timer: 0, age: 0, followId: null, channelOf: null }, spec);
  sim.zones.push(zone);
  return zone;
}

function stepZones(sim, dt) {
  sim.zones = sim.zones.filter((zone) => {
    if (zone.followId !== null) {
      const owner = findUnit(sim, zone.followId);
      if (!owner) return false;
      zone.x = owner.x;
      zone.y = owner.y;
    }
    if (zone.channelOf !== null) {
      const owner = findUnit(sim, zone.channelOf);
      if (!owner || owner.channel !== zone) return false;
    }
    zone.age += dt;
    zone.timer += dt;
    while (zone.timer >= zone.interval) {
      zone.timer -= zone.interval;
      zone.run(zone);
    }
    if (zone.age < zone.duration) return true;
    if (zone.channelOf !== null) findUnit(sim, zone.channelOf).channel = null;
    return false;
  });
}

function stepTimers(sim) {
  const due = sim.timers.filter((timer) => timer.time <= sim.time);
  if (!due.length) return;
  sim.timers = sim.timers.filter((timer) => timer.time > sim.time);
  for (const timer of due) timer.run();
}

// ---- Damage and attacks ----

// Runs a hook on every learned ability of a unit. Defined by abilities.js; creeps have none.
function runHooks(sim, unit, hook, ...args) {
  for (const ability of unit.abilities) {
    if (ability.level > 0 && ability.def[hook]) ability.def[hook](abilityContext(sim, unit, ability), ...args);
  }
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
    target.channel = null;
    pushEvent(sim, { type: 'death', unitId: target.id, killerId: source ? source.id : null, x: target.x, y: target.y });
  } else if (source && source.team !== target.team) {
    runHooks(sim, target, 'onDamaged', source, dealt);
  }
  return dealt;
}

// An attack that reaches its target: it can miss, then hurts, then triggers attack effects.
function landAttack(sim, attacker, target, attack) {
  if (target.dead) return;
  if (sim.rng() < target.stats.evasion) {
    pushEvent(sim, { type: 'miss', x: target.x, y: target.y });
    return;
  }
  const dealt = applyDamage(sim, attacker, target, attack.damage, 'physical');
  if (attack.crit) pushEvent(sim, { type: 'crit', x: target.x, y: target.y, amount: dealt });
  if (!attacker.dead) runHooks(sim, attacker, 'onAttackLanded', target, attack, dealt);
  if (!target.dead) runHooks(sim, target, 'onAttacked', attacker);
}

function rollAttackDamage(sim, unit) {
  const { damageMin, damageMax } = unit.stats;
  return Math.round(damageMin + sim.rng() * (damageMax - damageMin));
}

function launchAttack(sim, unit, target) {
  const attack = { damage: rollAttackDamage(sim, unit) };
  runHooks(sim, unit, 'onAttackStart', target, attack);
  if (unit.stats.projectileSpeed > 0) {
    sim.projectiles.push({
      x: unit.x,
      y: unit.y,
      targetId: target.id,
      speed: unit.stats.projectileSpeed,
      onHit: (hitTarget) => landAttack(sim, unit, hitTarget, attack),
    });
  } else {
    landAttack(sim, unit, target, attack);
  }
}

// ---- Movement ----

// Returns true once the unit reaches the point.
function moveToward(unit, x, y, dt) {
  if (unit.flags.rooted) return false;
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

// Forced movement (knockbacks, leaps). The unit cannot act until it ends.
function knockUnit(unit, toX, toY, duration, onEnd) {
  cancelWindup(unit);
  unit.channel = null;
  unit.knock = { vx: (toX - unit.x) / duration, vy: (toY - unit.y) / duration, timeLeft: duration, onEnd: onEnd || null };
}

function knockAway(unit, from, dist, duration) {
  const angle = distance(unit, from) > 0 ? Math.atan2(unit.y - from.y, unit.x - from.x) : 0;
  knockUnit(unit, unit.x + Math.cos(angle) * dist, unit.y + Math.sin(angle) * dist, duration);
}

function stepKnock(unit, dt) {
  const knock = unit.knock;
  const step = Math.min(dt, knock.timeLeft);
  unit.x += knock.vx * step;
  unit.y += knock.vy * step;
  knock.timeLeft -= dt;
  if (knock.timeLeft <= 0) {
    unit.knock = null;
    if (knock.onEnd) knock.onEnd();
  }
}

// ---- Unit step ----

function stepAttack(sim, unit, target, dt) {
  unit.facing = Math.atan2(target.y - unit.y, target.x - unit.x);
  if (unit.flags.disarmed) {
    cancelWindup(unit);
    return;
  }
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
  recomputeStats(unit);
  unit.hp = Math.min(unit.stats.maxHp, unit.hp + unit.stats.hpRegen * dt);
  unit.mana = Math.min(unit.stats.maxMana, unit.mana + unit.stats.manaRegen * dt);
  unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);
  stepAbilityTimers(unit, dt);
  stepMods(sim, unit, dt);
  if (unit.dead) return;

  if (unit.knock) {
    stepKnock(unit, dt);
    return;
  }
  if (unit.flags.stunned) {
    cancelWindup(unit);
    unit.channel = null;
    return;
  }
  if (unit.channel) return;

  if (unit.order.type === 'cast') {
    stepCastOrder(sim, unit, dt);
    return;
  }

  let target = null;
  if (unit.flags.taunted) {
    target = findUnit(sim, unit.flags.taunted.sourceId);
  } else if (unit.order.type === 'attack') {
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

// Projectiles either home on a unit (and fizzle if it dies) or fly to a point.
function stepProjectiles(sim, dt) {
  const flying = sim.projectiles;
  sim.projectiles = [];
  for (const projectile of flying) {
    const target = projectile.targetId ? findUnit(sim, projectile.targetId) : null;
    if (projectile.targetId && !target) continue;
    const goal = target || projectile;
    const dx = (target ? goal.x : goal.toX) - projectile.x;
    const dy = (target ? goal.y : goal.toY) - projectile.y;
    const d = Math.hypot(dx, dy);
    const step = projectile.speed * dt;
    if (d <= step) {
      projectile.onHit(target);
      continue;
    }
    projectile.x += (dx / d) * step;
    projectile.y += (dy / d) * step;
    sim.projectiles.push(projectile);
  }
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
  stepZones(sim, dt);
  stepTimers(sim);
  // Dead creeps leave the arena; a dead hero stays so the match can read its state.
  sim.units = sim.units.filter((unit) => !unit.dead || unit.kind === 'hero');
  separateUnits(sim);
}
