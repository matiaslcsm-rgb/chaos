'use strict';

// Ability engine: levels, mana, cooldowns, charges, casting, and the parts abilities are built from.
// What each ability does lives in abilityDefs.js; its numbers come from data/dota/abilities.json.

const BASIC_MAX_LEVEL = 4;
const ULT_MAX_LEVEL = 3;
const ULT_HERO_LEVELS = [6, 12, 18];
const MULTICAST_DELAY = 0.6;
const BASIC_HOTKEYS = ['q', 'w', 'e', 'd', 'f'];
const ULT_HOTKEY = 'r';

// ---- Reading numbers from the Dota data ----

// Values come as "60%", "-25" or one string per level.
function levelValue(value, level) {
  const raw = Array.isArray(value) ? value[Math.min(Math.max(level, 1), value.length) - 1] : value;
  return parseFloat(raw);
}

function abilityValue(ability, key) {
  const attrib = (DB.abilities[ability.key].attrib || []).find((entry) => entry.key === key);
  if (!attrib) throw new Error(`${ability.key} has no value "${key}"`);
  return levelValue(attrib.value, ability.level);
}

function abilityOptional(ability, key) {
  const attrib = (DB.abilities[ability.key].attrib || []).find((entry) => entry.key === key);
  return attrib ? levelValue(attrib.value, ability.level) : 0;
}

function abilityCooldown(ability) {
  const cooldown = DB.abilities[ability.key].cd;
  return cooldown === undefined ? 0 : levelValue(cooldown, ability.level);
}

function abilityManaCost(ability) {
  const cost = DB.abilities[ability.key].mc;
  return cost === undefined ? 0 : levelValue(cost, ability.level);
}

function abilityCastRange(ability) {
  return abilityOptional(ability, 'abilitycastrange');
}

// Radius of the area an ability affects, for the targeting preview. 0 if it has none.
function abilityAoe(ability) {
  return ability.def.aoe ? abilityValue(ability, ability.def.aoe) : 0;
}

// Dota's layout: basic abilities on Q W E D F in order, the ultimate on R.
// A second ultimate (possible once abilities are drafted) takes the next free basic key.
function abilityHotkeys(abilities) {
  const free = BASIC_HOTKEYS.slice();
  let ultFree = true;
  return abilities.map((ability) => {
    if (ability.def.ult && ultFree) {
      ultFree = false;
      return ULT_HOTKEY;
    }
    return free.shift() || null;
  });
}

// What an ability's code receives: who casts, on what, and `v` to read its numbers.
function abilityContext(sim, caster, ability, target, point) {
  return {
    sim,
    caster,
    ability,
    target: target || null,
    point: point || null,
    v: (key) => abilityValue(ability, key),
    dmg: () => levelValue(DB.abilities[ability.key].dmg, ability.level),
  };
}

// ---- Learning ----

function newAbility(key) {
  if (!ABILITY_DEFS[key]) throw new Error(`no definition for ability ${key}`);
  return { key, def: ABILITY_DEFS[key], level: 0, cooldown: 0, charges: 0, chargeTimer: 0, autocast: true };
}

function giveAbilities(unit, keys) {
  unit.abilities = keys.map(newAbility);
}

// Adds one more ability (a draft pick). It starts unlearned, like the rest.
function addAbility(unit, key) {
  unit.abilities.push(newAbility(key));
}

function maxAbilityLevel(ability) {
  return ability.def.maxLevel || (ability.def.ult ? ULT_MAX_LEVEL : BASIC_MAX_LEVEL);
}

// Dota's rule: ultimates at hero level 6/12/18, the rest at most one level every two hero levels.
function heroLevelForNextLevel(ability) {
  return ability.def.ult ? ULT_HERO_LEVELS[ability.level] : ability.level * 2 + 1;
}

// Why an ability cannot be levelled right now ('max' | 'points' | 'heroLevel'), or null if it can.
function levelProblem(hero, ability) {
  if (ability.level >= maxAbilityLevel(ability)) return 'max';
  if (hero.skillPoints <= 0) return 'points';
  if (hero.level < heroLevelForNextLevel(ability)) return 'heroLevel';
  return null;
}

function canLevelAbility(hero, ability) {
  return levelProblem(hero, ability) === null;
}

// Passive stat bonuses (abilities and items) are statuses that never expire, rebuilt whenever
// a level, a toggle or the inventory changes.
function refreshPassives(unit) {
  unit.mods = unit.mods.filter((mod) => !mod.passive);
  unit.items.forEach((item, slot) => {
    unit.mods.push({ id: `item:${slot}`, passive: true, sourceId: unit.id, duration: Infinity, stacks: 1, tickTimer: 0, stats: itemStats(unit, item) });
  });
  for (const ability of unit.abilities) {
    if (ability.level > 0 && ability.def.stats) {
      unit.mods.push({
        id: `passive:${ability.key}`,
        passive: true,
        sourceId: unit.id,
        duration: Infinity,
        stacks: 1,
        tickTimer: 0,
        stats: ability.def.stats(abilityContext(null, unit, ability)),
      });
    }
  }
  recomputeStats(unit);
}

function levelUpAbility(hero, index) {
  const ability = hero.abilities[index];
  if (!ability || !canLevelAbility(hero, ability)) return false;
  ability.level++;
  hero.skillPoints--;
  if (ability.def.charges) ability.charges = abilityValue(ability, ability.def.charges.count);
  refreshPassives(hero);
  return true;
}

function toggleAutocast(unit, index) {
  const ability = unit.abilities[index];
  ability.autocast = !ability.autocast;
  refreshPassives(unit);
}

function stepAbilityTimers(unit, dt) {
  for (const ability of unit.abilities) {
    ability.cooldown = Math.max(0, ability.cooldown - dt);
    const charges = ability.def.charges;
    if (charges && ability.level > 0 && ability.charges < abilityValue(ability, charges.count)) {
      ability.chargeTimer -= dt;
      if (ability.chargeTimer <= 0) {
        ability.charges++;
        ability.chargeTimer = abilityValue(ability, charges.restore);
      }
    }
  }
}

// ---- Casting ----

// Why an ability cannot be cast right now, or null if it can.
function castProblem(unit, ability) {
  if (ability.level === 0) return 'unlearned';
  if (ability.def.cast === 'passive' || ability.def.cast === 'toggle') return 'passive';
  if (unit.flags.silenced || unit.flags.stunned) return 'silenced';
  if (ability.def.charges && ability.charges <= 0) return 'charges';
  if (ability.cooldown > 0) return 'cooldown';
  if (unit.mana < abilityManaCost(ability)) return 'mana';
  return null;
}

// Orders a cast. `target` is a unit (unit-target abilities) or a point {x, y}. Returns the problem, if any.
function orderCast(unit, index, target) {
  const ability = unit.abilities[index];
  const problem = castProblem(unit, ability);
  if (problem) return problem;
  const cast = ability.def.cast;
  const order = { type: 'cast', index, targetId: null };
  if (cast === 'ally') order.targetId = unit.id;
  if (cast === 'unit') order.targetId = target.id;
  if (cast === 'point') Object.assign(order, { x: target.x, y: target.y });
  giveOrder(unit, order);
  return null;
}

function releaseAbility(c) {
  const def = c.ability.def;
  if (!def.projectile) {
    def.hit(c);
    return;
  }
  const projectile = {
    x: c.caster.x,
    y: c.caster.y,
    speed: c.v(def.projectile),
    onHit: (hitTarget) => def.hit(Object.assign({}, c, { target: hitTarget || c.target })),
  };
  if (c.target) projectile.targetId = c.target.id;
  else Object.assign(projectile, { toX: c.point.x, toY: c.point.y });
  c.sim.projectiles.push(projectile);
}

function fireAbility(sim, unit, ability, target, point) {
  unit.mana -= abilityManaCost(ability);
  ability.cooldown = abilityCooldown(ability);
  const charges = ability.def.charges;
  if (charges) {
    if (ability.charges >= abilityValue(ability, charges.count)) ability.chargeTimer = abilityValue(ability, charges.restore);
    ability.charges--;
  }
  const c = abilityContext(sim, unit, ability, target, point);
  const release = () => releaseAbility(c);
  pushEvent(sim, { type: 'cast', unitId: unit.id, key: ability.key });
  release();
  runHooks(sim, unit, 'onCast', ability, release);
}

// Walks into range, waits the cast time, then fires. Called by the simulation for 'cast' orders.
function stepCastOrder(sim, unit, dt) {
  const order = unit.order;
  const ability = unit.abilities[order.index];
  let target = null;
  if (order.targetId !== null) target = findUnit(sim, order.targetId);
  if (castProblem(unit, ability) || (order.targetId !== null && !target)) {
    unit.castTime = null;
    unit.order = { type: 'idle' };
    return;
  }
  const point = target || (order.x !== undefined ? { x: order.x, y: order.y } : null);
  if (point && point !== unit) {
    const reach = abilityCastRange(ability) + (target ? unit.radius + target.radius : 0);
    if (distance(unit, point) > reach) {
      unit.castTime = null;
      moveToward(unit, point.x, point.y, dt);
      return;
    }
    unit.facing = Math.atan2(point.y - unit.y, point.x - unit.x);
  }
  if (unit.castTime === null) unit.castTime = abilityOptional(ability, 'abilitycastpoint');
  unit.castTime -= dt;
  if (unit.castTime > 0) return;
  unit.castTime = null;
  unit.order = { type: 'idle' };
  fireAbility(sim, unit, ability, target, point ? { x: point.x, y: point.y } : null);
}

// ---- Parts: the pieces ability definitions are made of ----

const neg = (value) => -Math.abs(value);

function spellDamage(c, target, amount, type) {
  return applyDamage(c.sim, c.caster, target, amount * (1 + c.caster.stats.spellAmp / 100), type || 'magical');
}

// Applies a status named after the ability, so each ability's effects refresh instead of piling up.
function status(c, target, name, duration, spec) {
  return addMod(c.sim, target, Object.assign({ id: `${c.ability.key}:${name}`, sourceId: c.caster.id, duration }, spec));
}

function stun(c, target, duration) {
  return status(c, target, 'stun', duration, { flags: ['stunned'] });
}

// Damage over time for a status. `perSecond` can be a function of the status (for stacks).
function dot(c, perSecond, type, interval) {
  const every = interval || 1;
  return {
    interval: every,
    run: (mod, unit) => spellDamage(c, unit, (typeof perSecond === 'function' ? perSecond(mod) : perSecond) * every, type),
  };
}

function enemiesOf(c, point, radius) {
  return enemiesNear(c.sim, c.caster.team, point, radius);
}

function attackDamageOf(unit) {
  return (unit.stats.damageMin + unit.stats.damageMax) / 2;
}

// Visual hints for the renderer; they do not affect the simulation.
function fxRing(c, point, radius, color) {
  pushEvent(c.sim, { type: 'fx', kind: 'ring', x: point.x, y: point.y, radius, color });
}

function fxLine(c, from, to, color) {
  pushEvent(c.sim, { type: 'fx', kind: 'line', x1: from.x, y1: from.y, x2: to.x, y2: to.y, color });
}

// Jumps from unit to unit: `hit(unit, n)` runs on each, n = 0 for the first. No unit is hit twice.
function chain(c, first, count, radius, delay, color, hit) {
  const seen = new Set();
  const jump = (target, from, n) => {
    seen.add(target.id);
    fxLine(c, from, target, color);
    hit(target, n);
    if (n + 1 >= count) return;
    const origin = { team: c.caster.team, x: target.x, y: target.y };
    after(c.sim, delay, () => {
      const next = nearestEnemy(c.sim, origin, radius, seen);
      if (next) jump(next, origin, n + 1);
    });
  };
  jump(first, c.caster, 0);
}

// The caster's own copy of another ability, or a level 1 stand-in if it does not have it.
function borrowAbility(c, key) {
  const owned = c.caster.abilities.find((ability) => ability.key === key && ability.level > 0);
  return abilityContext(c.sim, c.caster, owned || { key, level: 1, def: ABILITY_DEFS[key] });
}

function teleportNextTo(unit, target) {
  const angle = distance(unit, target) > 0 ? Math.atan2(unit.y - target.y, unit.x - target.x) : 0;
  const gap = unit.radius + target.radius + 4;
  unit.x = target.x + Math.cos(angle) * gap;
  unit.y = target.y + Math.sin(angle) * gap;
}

function isFacing(unit, target, halfAngle) {
  const angle = Math.atan2(target.y - unit.y, target.x - unit.x);
  const diff = Math.abs(Math.atan2(Math.sin(angle - unit.facing), Math.cos(angle - unit.facing)));
  return diff <= halfAngle;
}
