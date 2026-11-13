'use strict';

// Tests run in the browser at tests.html. Every mechanic gets one.

const TEST_STEP = 1 / 60;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'assertion failed');
}

function assertNear(actual, expected, tolerance, message) {
  assert(Math.abs(actual - expected) <= tolerance, `${message || 'value'}: expected ${expected}, got ${actual}`);
}

function runFor(sim, seconds) {
  for (let t = 0; t < seconds; t += TEST_STEP) stepSim(sim, TEST_STEP);
}

// Steps a match, taking a random ability whenever the draft opens.
function stepPlaying(game) {
  if (game.draft) skipDraft(game);
  stepGame(game, TEST_STEP);
}

function addTestCreep(sim, x, y, overrides) {
  return addUnit(sim, {
    kind: 'creep',
    team: CREEP_TEAM,
    x,
    y,
    stats: Object.assign(creepStats(creepType('melee'), 1), overrides),
  });
}

test('batch 1 loads with 10 heroes and their abilities', () => {
  const heroes = batchHeroes();
  assert(heroes.length === 10, `heroes: ${heroes.length}`);
  for (const hero of heroes) {
    assert(hero.data, 'hero data missing');
    assert(hero.abilities.length >= 4, `${hero.data.localized_name} has ${hero.abilities.length} abilities`);
    assert(hero.abilities.every((ability) => ability.dname), `${hero.data.localized_name} has an unknown ability`);
  }
});

test('every batch item exists and its recipe closes inside the batch', () => {
  for (const key of DB.batch.items) {
    const item = DB.items[key];
    assert(item && item.cost > 0, `item ${key}`);
    for (const part of item.components || []) assert(DB.batch.items.includes(part), `${key} needs ${part}`);
  }
});

test('hero stats follow the Dota formulas', () => {
  const sven = heroByName('Sven');
  const level1 = heroStats(sven, 1);
  assertNear(level1.maxHp, sven.base_health + sven.base_str * 22, 0.001, 'max hp');
  assertNear(level1.maxMana, sven.base_mana + sven.base_int * 12, 0.001, 'max mana');
  assertNear(level1.armor, sven.base_armor + sven.base_agi / 6, 0.001, 'armor');
  assertNear(level1.damageMin, sven.base_attack_min + sven.base_str, 0.001, 'damage');
  assertNear(level1.attackInterval, sven.attack_rate / ((sven.base_attack_time + sven.base_agi) / 100), 0.001, 'attack interval');
  const level5 = heroStats(sven, 5);
  assertNear(level5.str, sven.base_str + sven.str_gain * 4, 0.001, 'strength at level 5');
  assert(level5.maxHp > level1.maxHp, 'hp grows with level');
});

test('armor reduces physical damage', () => {
  assertNear(armorMultiplier(0), 1, 1e-9, 'no armor');
  assertNear(armorMultiplier(10), 0.625, 1e-9, '10 armor');
  assert(armorMultiplier(-5) > 1, 'negative armor amplifies');
});

test('a melee hero walks to a creep and kills it', () => {
  const sim = createSim(1);
  const hero = addHero(sim, heroByName('Sven'), 1, HERO_TEAM, 500, 500);
  const creep = addTestCreep(sim, 900, 500, { moveSpeed: 0, damageMin: 0, damageMax: 0 });
  orderAttack(hero, creep);
  runFor(sim, 20);
  assert(creep.dead, 'creep should be dead');
  assert(!hero.dead && hero.hp === hero.stats.maxHp, 'hero took no damage');
  assert(hero.x > 700, 'hero walked toward the creep');
});

test('a ranged attack travels as a projectile before it hurts', () => {
  const sim = createSim(1);
  const hero = addHero(sim, heroByName('Sniper'), 1, HERO_TEAM, 500, 500);
  const creep = addTestCreep(sim, 900, 500, { moveSpeed: 0, damageMin: 0, damageMax: 0, attackRange: 0 });
  orderAttack(hero, creep);
  let sawProjectile = false;
  for (let t = 0; t < 3 && creep.hp === creep.stats.maxHp; t += TEST_STEP) {
    stepSim(sim, TEST_STEP);
    if (sim.projectiles.length) {
      sawProjectile = true;
      assert(creep.hp === creep.stats.maxHp || sim.projectiles.length === 0, 'no damage while in flight');
    }
  }
  assert(sawProjectile, 'a projectile was launched');
  assert(creep.hp < creep.stats.maxHp, 'the projectile landed');
  assertNear(hero.x, 500, 0.001, 'sniper did not need to walk');
});

test('moving cancels an attack that has not landed', () => {
  const sim = createSim(1);
  const hero = addHero(sim, heroByName('Sven'), 1, HERO_TEAM, 500, 500);
  const creep = addTestCreep(sim, 560, 500, { moveSpeed: 0, damageMin: 0, damageMax: 0 });
  orderAttack(hero, creep);
  stepSim(sim, TEST_STEP);
  assert(hero.windup !== null, 'attack wind-up started');
  orderMove(hero, 100, 500);
  runFor(sim, 1);
  assert(creep.hp === creep.stats.maxHp, 'the cancelled attack did no damage');
  assert(hero.attackCooldown === 0, 'a cancelled attack does not use the cooldown');
});

test('an idle hero defends itself', () => {
  const sim = createSim(1);
  const hero = addHero(sim, heroByName('Luna'), 1, HERO_TEAM, 500, 500);
  const creep = addTestCreep(sim, 800, 500, {});
  runFor(sim, 20);
  assert(creep.dead, 'creep should be dead');
  assert(!hero.dead, 'hero survived one creep');
});

test('units do not stand on top of each other', () => {
  const sim = createSim(1);
  const a = addTestCreep(sim, 500, 500, { moveSpeed: 0 });
  const b = addTestCreep(sim, 500, 500, { moveSpeed: 0 });
  runFor(sim, 0.5);
  assert(distance(a, b) >= a.radius + b.radius - 0.001, 'units were pushed apart');
});

test('clearing a wave starts the next round one level higher', () => {
  const game = createGame(heroByName('Sven'), 7);
  for (let t = 0; t < 120 && game.round < 2; t += TEST_STEP) stepPlaying(game);
  assert(game.round === 2, `reached round ${game.round}, phase ${game.phase}`);
  assert(game.hero.level === 2, `hero level ${game.hero.level}`);
});

test('the match ends when the hero dies', () => {
  const game = createGame(heroByName('Crystal Maiden'), 7);
  game.hero.baseStats = Object.assign({}, game.hero.baseStats, { maxHp: 1, hpRegen: 0 });
  game.hero.hp = 1;
  for (let t = 0; t < 60 && game.phase !== 'lost'; t += TEST_STEP) stepPlaying(game);
  assert(game.phase === 'lost', `phase ${game.phase}`);
});

test('the same seed plays the same match', () => {
  const play = () => {
    const game = createGame(heroByName('Viper'), 42);
    for (let t = 0; t < 30; t += TEST_STEP) stepPlaying(game);
    return `${game.round} ${game.hero.hp} ${game.hero.x} ${game.sim.units.length} ${game.hero.abilities.map((ability) => ability.key)}`;
  };
  assert(play() === play(), 'two runs with one seed differ');
});

// ---- Abilities ----

function batchAbilities(heroData) {
  return DB.batch.heroes.find((entry) => entry.key === heroData.name).abilities;
}

// A hero with its batch abilities that only does what the test orders.
function addTestHero(sim, name, level, x, y, team) {
  const data = heroByName(name);
  const hero = addHero(sim, data, level, team === undefined ? HERO_TEAM : team, x, y);
  giveAbilities(hero, batchAbilities(data));
  hero.acquireRange = 0;
  return hero;
}

// Sets an ability's level directly, skipping the levelling rules. Returns its index.
function teach(hero, key, level) {
  const index = hero.abilities.findIndex((ability) => ability.key === key);
  assert(index !== -1, `${hero.name} does not have ${key}`);
  const ability = hero.abilities[index];
  ability.level = level || 1;
  if (ability.def.charges) ability.charges = abilityValue(ability, ability.def.charges.count);
  refreshPassives(hero);
  return index;
}

function fillMana(hero) {
  hero.baseStats.maxMana = 99999;
  recomputeStats(hero);
  hero.mana = 99999;
}

// A creep that stands still and never attacks unless the overrides say otherwise.
function addDummy(sim, x, y, overrides) {
  const creep = addTestCreep(sim, x, y, Object.assign({ maxHp: 5000, moveSpeed: 0, damageMin: 0, damageMax: 0 }, overrides));
  creep.acquireRange = 0;
  return creep;
}

function hitsOn(sim, unit) {
  return sim.events.filter((event) => event.type === 'damage' && event.targetId === unit.id).length;
}

// Steps until `done()` is true; fails if it takes longer than `seconds`. Returns the time it took.
function runUntil(sim, seconds, done, what) {
  for (let t = 0; t < seconds; t += TEST_STEP) {
    if (done()) return t;
    stepSim(sim, TEST_STEP);
  }
  assert(done(), `timed out waiting for ${what}`);
  return seconds;
}

test('hotkeys: basics on Q W E D F in order, the ultimate on R', () => {
  const keysOf = (name) => {
    const hero = addTestHero(createSim(1), name, 1, 500, 500);
    return abilityHotkeys(hero.abilities).join('');
  };
  assert(keysOf('Sven') === 'qwer', `Sven: ${keysOf('Sven')}`);
  assert(keysOf('Sniper') === 'qwedr', `Sniper: ${keysOf('Sniper')}`);
  assert(keysOf('Zeus') === 'qwedr', `Zeus: ${keysOf('Zeus')}`);
  const drafted = ['luna_eclipse', 'sven_warcry', 'zuus_arc_lightning', 'sven_gods_strength', 'axe_counter_helix']
    .map((key) => ({ key, def: ABILITY_DEFS[key] }));
  assert(abilityHotkeys(drafted).join('') === 'rqwed', `drafted: ${abilityHotkeys(drafted).join('')}`);
});

test('levelling: basics one level every two hero levels, ultimate at 6/12/18', () => {
  const sim = createSim(1);
  const sven = addTestHero(sim, 'Sven', 1, 500, 500);
  const [bolt, , warcry, ult] = sven.abilities;
  assert(sven.skillPoints === 1, 'one point at level 1');
  assert(levelProblem(sven, ult) === 'heroLevel', 'no ultimate at level 1');
  assert(levelUpAbility(sven, 0) && bolt.level === 1 && sven.skillPoints === 0, 'spent the point on Storm Hammer');
  assert(levelProblem(sven, warcry) === 'points', 'no points left');
  setHeroLevel(sven, 2);
  assert(levelProblem(sven, bolt) === 'heroLevel', 'Storm Hammer 2 needs hero level 3');
  assert(levelUpAbility(sven, 2), 'Warcry at level 2');
  setHeroLevel(sven, 3);
  assert(levelUpAbility(sven, 0) && bolt.level === 2, 'Storm Hammer 2 at level 3');
  setHeroLevel(sven, 5);
  assert(!levelUpAbility(sven, 3), 'ultimate still locked at level 5');
  setHeroLevel(sven, 6);
  assert(levelUpAbility(sven, 3) && ult.level === 1, 'ultimate at level 6');
  assert(levelProblem(sven, ult) === 'heroLevel' && heroLevelForNextLevel(ult) === 12, 'ultimate 2 waits for level 12');
  setHeroLevel(sven, 18);
  assert(levelUpAbility(sven, 3) && levelUpAbility(sven, 3) && ult.level === 3, 'ultimate maxed at 18');
  assert(levelProblem(sven, ult) === 'max', 'ultimate stops at 3');
  while (levelUpAbility(sven, 0));
  assert(bolt.level === 4 && levelProblem(sven, bolt) === 'max', 'basics stop at 4');
  const sniper = addTestHero(sim, 'Sniper', 10, 600, 500);
  const grenade = sniper.abilities.findIndex((ability) => ability.key === 'sniper_concussive_grenade');
  assert(levelUpAbility(sniper, grenade) && !levelUpAbility(sniper, grenade), 'one-level abilities stop at 1');
});

test('casting spends mana and starts the cooldown', () => {
  const sim = createSim(1);
  const sven = addTestHero(sim, 'Sven', 1, 500, 500);
  const index = teach(sven, 'sven_storm_bolt');
  const ability = sven.abilities[index];
  const creep = addDummy(sim, 800, 500);
  const manaBefore = sven.mana;
  assert(orderCast(sven, index, creep) === null, 'the order was accepted');
  runUntil(sim, 3, () => ability.cooldown > 0, 'the cast');
  assertNear(sven.mana, manaBefore - abilityManaCost(ability), 1, 'mana');
  assertNear(ability.cooldown, abilityCooldown(ability), 0.05, 'cooldown');
  assert(castProblem(sven, ability) === 'cooldown', 'cannot cast again yet');
  runFor(sim, abilityCooldown(ability) + 0.1);
  assert(ability.cooldown === 0, 'the cooldown ran out');
});

test('castProblem names what stops a cast', () => {
  const sim = createSim(1);
  const sven = addTestHero(sim, 'Sven', 1, 500, 500);
  const [bolt, cleave] = sven.abilities;
  assert(castProblem(sven, bolt) === 'unlearned', 'unlearned');
  teach(sven, 'sven_storm_bolt');
  teach(sven, 'sven_great_cleave');
  assert(castProblem(sven, bolt) === null, 'ready');
  assert(castProblem(sven, cleave) === 'passive', 'passive');
  sven.mana = 0;
  assert(castProblem(sven, bolt) === 'mana', 'mana');
  sven.mana = sven.stats.maxMana;
  bolt.cooldown = 5;
  assert(castProblem(sven, bolt) === 'cooldown', 'cooldown');
  bolt.cooldown = 0;
  addMod(sim, sven, { id: 'test:silence', sourceId: 0, duration: 5, flags: ['silenced'] });
  assert(castProblem(sven, bolt) === 'silenced', 'silenced');
  removeMod(sven, 'test:silence');
  addMod(sim, sven, { id: 'test:stun', sourceId: 0, duration: 5, flags: ['stunned'] });
  assert(castProblem(sven, bolt) === 'silenced', 'stunned');
  assert(orderCast(sven, 0, sven) === 'silenced' && sven.order.type === 'idle', 'a refused order changes nothing');

  const viper = addTestHero(sim, 'Viper', 1, 700, 500);
  assert(castProblem(viper, viper.abilities[teach(viper, 'viper_poison_attack')]) === 'passive', 'toggles are not cast');
  const sniper = addTestHero(sim, 'Sniper', 1, 900, 500);
  const shrapnel = sniper.abilities[teach(sniper, 'sniper_shrapnel')];
  shrapnel.charges = 0;
  assert(castProblem(sniper, shrapnel) === 'charges', 'charges');
});

test('the caster walks into range before casting', () => {
  const sim = createSim(1);
  const sven = addTestHero(sim, 'Sven', 1, 200, 500);
  const index = teach(sven, 'sven_storm_bolt');
  const ability = sven.abilities[index];
  const creep = addDummy(sim, 1500, 500);
  orderCast(sven, index, creep);
  runFor(sim, 0.5);
  assert(sven.x > 200 && ability.cooldown === 0, 'walking, not cast yet');
  runUntil(sim, 10, () => ability.cooldown > 0, 'the cast');
  const reach = abilityCastRange(ability) + sven.radius + creep.radius;
  assert(distance(sven, creep) <= reach + 0.001, `cast from ${distance(sven, creep)}, reach ${reach}`);
  assert(distance(sven, creep) > reach - 10, 'stopped as soon as it was in range');
});

test('a spell projectile delays the hit', () => {
  const sim = createSim(1);
  const sven = addTestHero(sim, 'Sven', 1, 500, 500);
  const index = teach(sven, 'sven_storm_bolt');
  const creep = addDummy(sim, 1100, 500);
  orderCast(sven, index, creep);
  runUntil(sim, 3, () => sven.abilities[index].cooldown > 0, 'the cast');
  assert(sim.projectiles.length === 1 && creep.hp === 5000, 'the hammer is in flight and nothing was hit yet');
  const flight = runUntil(sim, 3, () => creep.hp < 5000, 'the hit');
  assertNear(flight, 600 / abilityValue(sven.abilities[index], 'bolt_speed'), 0.1, 'flight time');
});

test('stun: the target cannot act until it wears off', () => {
  const sim = createSim(1);
  const sven = addTestHero(sim, 'Sven', 1, 500, 500);
  fillMana(sven);
  const index = teach(sven, 'sven_storm_bolt');
  const creep = addTestCreep(sim, 800, 500, { maxHp: 5000, moveSpeed: 0, damageMin: 10, damageMax: 10, attackRange: 2000 });
  runFor(sim, 2);
  assert(hitsOn(sim, sven) > 0, 'the creep attacks while it can');
  orderCast(sven, index, creep);
  runUntil(sim, 3, () => creep.flags.stunned, 'the stun');
  sim.events.length = 0;
  const duration = abilityValue(sven.abilities[index], 'bolt_stun_duration');
  runFor(sim, duration - 0.1);
  assert(hitsOn(sim, sven) === 0, 'no attacks while stunned');
  runFor(sim, 3);
  assert(!creep.flags.stunned && hitsOn(sim, sven) > 0, 'it attacks again afterwards');
});

test('slow: the target moves slower until it wears off', () => {
  const sim = createSim(1);
  const maiden = addTestHero(sim, 'Crystal Maiden', 1, 500, 500);
  const index = teach(maiden, 'crystal_maiden_crystal_nova');
  const ability = maiden.abilities[index];
  const creep = addDummy(sim, 900, 500, { moveSpeed: 300 });
  orderCast(maiden, index, { x: 900, y: 500 });
  runUntil(sim, 3, () => creep.stats.moveSpeed < 300, 'the slow');
  const slow = Math.abs(abilityValue(ability, 'movespeed_slow'));
  assertNear(creep.stats.moveSpeed, 300 * (1 - slow / 100), 0.001, 'slowed speed');
  assert(creep.hp < 5000, 'the nova also hurt');
  assert(unitStatusLabels(creep).some((label) => label.text === 'lento'), 'shown as slowed');
  runFor(sim, abilityValue(ability, 'duration') + 0.5);
  assert(creep.stats.moveSpeed === 300, 'back to normal');
});

test('root: the target cannot move or attack, and takes damage over time', () => {
  const sim = createSim(1);
  const maiden = addTestHero(sim, 'Crystal Maiden', 1, 500, 500);
  const index = teach(maiden, 'crystal_maiden_frostbite');
  const creep = addDummy(sim, 900, 500, { moveSpeed: 300 });
  orderCast(maiden, index, creep);
  runUntil(sim, 3, () => creep.flags.rooted, 'the root');
  assert(creep.flags.disarmed, 'Frostbite also disarms');
  orderMove(creep, 1500, 500);
  const x = creep.x;
  runFor(sim, 1);
  assertNear(creep.x, x, 0.001, 'rooted in place');
  assert(creep.hp < 5000, 'damage over time');
  runFor(sim, abilityValue(maiden.abilities[index], 'duration') + 1);
  assert(!creep.flags.rooted && creep.x > x + 100, 'walks again afterwards');
});

test('silence: the target cannot cast', () => {
  const sim = createSim(1);
  const skywrath = addTestHero(sim, 'Skywrath Mage', 1, 500, 500);
  const index = teach(skywrath, 'skywrath_mage_ancient_seal');
  const enemy = addTestHero(sim, 'Sven', 1, 900, 500, CREEP_TEAM);
  const bolt = enemy.abilities[teach(enemy, 'sven_storm_bolt')];
  orderCast(skywrath, index, enemy);
  runUntil(sim, 3, () => enemy.flags.silenced, 'the silence');
  assert(castProblem(enemy, bolt) === 'silenced', 'silenced heroes cannot cast');
  assert(orderCast(enemy, 0, skywrath) === 'silenced', 'the order is refused');
  runFor(sim, abilityValue(skywrath.abilities[index], 'seal_duration') + 0.5);
  assert(castProblem(enemy, bolt) === null, 'can cast again afterwards');
});

test('disarm and knockback: the grenade pushes away and stops attacks', () => {
  const sim = createSim(1);
  const sniper = addTestHero(sim, 'Sniper', 1, 300, 500);
  const index = teach(sniper, 'sniper_concussive_grenade');
  const ability = sniper.abilities[index];
  const creep = addTestCreep(sim, 800, 500, { maxHp: 5000, moveSpeed: 0, damageMin: 10, damageMax: 10, attackRange: 2000 });
  orderCast(sniper, index, { x: 750, y: 500 });
  runUntil(sim, 3, () => creep.flags.disarmed, 'the grenade');
  sim.events.length = 0;
  runFor(sim, abilityValue(ability, 'debuff_duration') - 0.2);
  assert(hitsOn(sim, sniper) === 0, 'no attacks while disarmed');
  assertNear(creep.x, 800 + abilityValue(ability, 'knockback_distance'), 1, 'pushed away from the blast');
  runFor(sim, 3);
  assert(!creep.flags.disarmed && hitsOn(sim, sniper) > 0, 'it attacks again afterwards');
});

test('taunt: enemies are forced to attack the caster', () => {
  const sim = createSim(1);
  const axe = addTestHero(sim, 'Axe', 1, 500, 500);
  const index = teach(axe, 'axe_berserkers_call');
  const creep = addDummy(sim, 640, 500, { damageMin: 10, damageMax: 10 });
  runFor(sim, 1.5);
  assert(hitsOn(sim, axe) === 0, 'the dummy does not attack on its own');
  orderCast(axe, index, null);
  runUntil(sim, 2, () => creep.flags.taunted, 'the taunt');
  assert(findMod(axe, 'axe_berserkers_call:armor'), 'Axe gets his armor');
  runFor(sim, abilityValue(axe.abilities[index], 'duration') + 0.5);
  assert(hitsOn(sim, axe) > 0, 'the taunted creep attacked Axe');
  assert(!creep.flags.taunted, 'the taunt wore off');
});

test('damage over time ticks once per second', () => {
  const sim = createSim(1);
  const axe = addTestHero(sim, 'Axe', 1, 500, 500);
  const index = teach(axe, 'axe_battle_hunger');
  const creep = addDummy(sim, 800, 500);
  orderCast(axe, index, creep);
  runUntil(sim, 3, () => findMod(creep, 'axe_battle_hunger:hunger'), 'Battle Hunger');
  runFor(sim, 3.5);
  assertNear(5000 - creep.hp, 3 * abilityValue(axe.abilities[index], 'damage_per_second'), 0.001, 'three ticks of pure damage');
});

test('a zone ticks on whoever is inside and then expires', () => {
  const sim = createSim(1);
  const sniper = addTestHero(sim, 'Sniper', 1, 300, 500);
  const index = teach(sniper, 'sniper_shrapnel');
  const ability = sniper.abilities[index];
  const inside = addDummy(sim, 900, 500);
  const outside = addDummy(sim, 900, 500 + abilityValue(ability, 'radius') + 100);
  orderCast(sniper, index, { x: 900, y: 500 });
  runUntil(sim, 5, () => sim.zones.length === 1, 'the zone');
  assert(sim.zones[0].radius === abilityValue(ability, 'radius') && sim.zones[0].color, 'the zone can be drawn');
  runFor(sim, 2.5);
  assertNear(5000 - inside.hp, 2 * abilityValue(ability, 'shrapnel_damage'), 0.001, 'two ticks');
  assert(inside.stats.moveSpeed === 0 && findMod(inside, 'sniper_shrapnel:slow'), 'slowed inside');
  assert(outside.hp === 5000, 'nothing outside the area');
  runFor(sim, abilityValue(ability, 'duration'));
  assert(sim.zones.length === 0, 'the zone expired');
  const hp = inside.hp;
  runFor(sim, 2);
  assert(inside.hp === hp, 'no damage after it expires');
});

test('a chain never hits the same unit twice', () => {
  const sim = createSim(1);
  const zeus = addTestHero(sim, 'Zeus', 1, 400, 500);
  const index = teach(zeus, 'zuus_arc_lightning');
  const ability = zeus.abilities[index];
  assert(abilityValue(ability, 'jump_count') >= 2, 'the chain could come back if it were allowed to');
  const near = [addDummy(sim, 800, 500), addDummy(sim, 900, 500)];
  const far = addDummy(sim, 900, 500 + abilityValue(ability, 'radius') + 200);
  orderCast(zeus, index, near[0]);
  runFor(sim, 4);
  for (const creep of near) assert(hitsOn(sim, creep) === 1, `hit ${hitsOn(sim, creep)} times`);
  assert(hitsOn(sim, far) === 0, 'out of jump range');
  assert(sim.events.some((event) => event.type === 'fx' && event.kind === 'line'), 'the bolt can be drawn');
});

test('charges are spent per cast and come back with time', () => {
  const sim = createSim(1);
  const sniper = addTestHero(sim, 'Sniper', 1, 300, 500);
  fillMana(sniper);
  const index = teach(sniper, 'sniper_shrapnel');
  const ability = sniper.abilities[index];
  const count = abilityValue(ability, 'abilitycharges');
  assert(ability.charges === count && count > 1, `starts with ${count} charges`);
  for (let i = 1; i <= count; i++) {
    assert(orderCast(sniper, index, { x: 600, y: 500 }) === null, `cast ${i}`);
    runUntil(sim, 2, () => ability.charges === count - i, `charge ${i} to be spent`);
  }
  assert(orderCast(sniper, index, { x: 600, y: 500 }) === 'charges', 'no charges left');
  runFor(sim, abilityValue(ability, 'abilitychargerestoretime') + 0.5);
  assert(ability.charges >= 1, 'one charge came back');
  runFor(sim, abilityValue(ability, 'abilitychargerestoretime') * count);
  assert(ability.charges === count, 'never more than the maximum');
});

test('a toggled attack modifier spends mana only while it is on', () => {
  const sim = createSim(1);
  const viper = addTestHero(sim, 'Viper', 1, 500, 500);
  const index = teach(viper, 'viper_poison_attack');
  const creep = addDummy(sim, 800, 500);
  orderAttack(viper, creep);
  runFor(sim, 5);
  assert(viper.mana < viper.stats.maxMana - 20, 'each attack cost mana');
  assert(findMod(creep, 'viper_poison_attack:poison'), 'the creep is poisoned');
  toggleAutocast(viper, index);
  runFor(sim, abilityValue(viper.abilities[index], 'duration') + 2);
  const mana = viper.mana;
  runFor(sim, 5);
  assert(viper.mana >= mana, 'no mana spent while off');
  assert(!findMod(creep, 'viper_poison_attack:poison'), 'no more poison');
});

test('passives change stats as soon as they are learned', () => {
  const sim = createSim(1);
  const pa = addTestHero(sim, 'Phantom Assassin', 1, 300, 500);
  const immaterial = pa.abilities[teach(pa, 'phantom_assassin_immaterial')];
  assertNear(pa.stats.evasion, abilityValue(immaterial, 'evasion') / 100, 1e-9, 'evasion');

  const sniper = addTestHero(sim, 'Sniper', 1, 500, 500);
  const range = sniper.stats.attackRange;
  assert(levelUpAbility(sniper, sniper.abilities.findIndex((ability) => ability.key === 'sniper_take_aim')), 'learned Take Aim');
  const aim = sniper.abilities.find((ability) => ability.key === 'sniper_take_aim');
  assertNear(sniper.stats.attackRange, range + abilityValue(aim, 'passive_attack_range_bonus'), 1e-9, 'attack range');

  const maiden = addTestHero(sim, 'Crystal Maiden', 1, 700, 500);
  const regen = maiden.stats.manaRegen;
  teach(maiden, 'crystal_maiden_brilliance_aura', 4);
  assert(maiden.stats.manaRegen > regen, 'mana regeneration');

  const zeus = addTestHero(sim, 'Zeus', 1, 900, 500);
  const speed = zeus.stats.attackSpeed;
  const hands = teach(zeus, 'zuus_lightning_hands');
  assertNear(zeus.stats.attackSpeed, speed + abilityValue(zeus.abilities[hands], 'attack_speed_bonus'), 1e-9, 'attack speed while on');
  toggleAutocast(zeus, hands);
  assertNear(zeus.stats.attackSpeed, speed, 1e-9, 'attack speed while off');
});

test('a channel ends as soon as the caster gets another order', () => {
  const sim = createSim(1);
  const maiden = addTestHero(sim, 'Crystal Maiden', 6, 500, 500);
  fillMana(maiden);
  const index = teach(maiden, 'crystal_maiden_freezing_field');
  const creep = addDummy(sim, 700, 500);
  orderCast(maiden, index, null);
  runUntil(sim, 2, () => maiden.channel, 'the channel');
  assert(sim.zones.length === 1, 'the field is up');
  assert(heroEffects(maiden).some((effect) => effect.text === 'Canalizando'), 'shown as channeling');
  runFor(sim, 3);
  assert(maiden.channel && creep.hp < 5000, 'still channeling and hurting');
  orderMove(maiden, 100, 500);
  assert(maiden.channel === null, 'the order cut the channel');
  runFor(sim, 0.1);
  assert(sim.zones.length === 0, 'the field is gone');
  const hp = creep.hp;
  runFor(sim, 3);
  assert(creep.hp === hp, 'no more damage');
});

test('a stun also cuts a channel', () => {
  const sim = createSim(1);
  const maiden = addTestHero(sim, 'Crystal Maiden', 6, 500, 500);
  fillMana(maiden);
  orderCast(maiden, teach(maiden, 'crystal_maiden_freezing_field'), null);
  runUntil(sim, 2, () => maiden.channel, 'the channel');
  addMod(sim, maiden, { id: 'test:stun', sourceId: 0, duration: 1, flags: ['stunned'] });
  runFor(sim, 0.1);
  assert(maiden.channel === null && sim.zones.length === 0, 'the stun ended the field');
});

test('evasion makes attacks miss and a critical hit is announced', () => {
  const sim = createSim(1);
  const pa = addTestHero(sim, 'Phantom Assassin', 6, 500, 500);
  teach(pa, 'phantom_assassin_coup_de_grace');
  const creep = addDummy(sim, 560, 500);
  sim.rng = () => 0; // every roll succeeds
  orderAttack(pa, creep);
  runFor(sim, 2);
  const crit = sim.events.find((event) => event.type === 'crit');
  assert(crit && crit.amount > pa.stats.damageMax, 'a crit with more than normal damage');

  const dodger = addDummy(sim, 440, 500);
  addMod(sim, dodger, { id: 'test:evasion', sourceId: 0, duration: 60, stats: { evasion: 1 } });
  sim.events.length = 0;
  orderAttack(pa, dodger);
  runFor(sim, 3);
  assert(sim.events.some((event) => event.type === 'miss'), 'the attack missed');
  assert(dodger.hp === 5000, 'a miss does no damage');
});

test('Multicast repeats the spell and says how many times', () => {
  const sim = createSim(1);
  const ogre = addTestHero(sim, 'Ogre Magi', 18, 500, 500);
  const index = teach(ogre, 'ogre_magi_fireblast');
  teach(ogre, 'ogre_magi_multicast', 3);
  const creep = addDummy(sim, 800, 500, { maxHp: 50000 });
  sim.rng = () => 0;
  const mana = ogre.mana;
  orderCast(ogre, index, creep);
  runFor(sim, 4);
  assert(hitsOn(sim, creep) === 4, `hit ${hitsOn(sim, creep)} times`);
  assert(sim.events.some((event) => event.type === 'text' && event.text === 'x4'), 'announced x4');
  assert(mana - ogre.mana <= abilityManaCost(ogre.abilities[index]), 'paid for it only once');
});

test('status labels name what a unit cannot do', () => {
  const sim = createSim(1);
  const creep = addDummy(sim, 500, 500, { moveSpeed: 300 });
  assert(unitStatusLabels(creep).length === 0, 'nothing at first');
  for (const flag of ['stunned', 'rooted', 'silenced', 'disarmed', 'taunted']) {
    addMod(sim, creep, { id: `test:${flag}`, sourceId: 0, duration: 5, flags: [flag] });
  }
  const texts = unitStatusLabels(creep).map((label) => label.text).join(' ');
  assert(texts === 'aturdido provocado inmóvil silenciado desarmado', texts);
});

test('the hero panel lists active effects with their time left', () => {
  const sim = createSim(1);
  const sven = addTestHero(sim, 'Sven', 1, 500, 500);
  teach(sven, 'sven_great_cleave');
  orderCast(sven, teach(sven, 'sven_warcry'), null);
  runUntil(sim, 2, () => findMod(sven, 'sven_warcry:buff'), 'Warcry');
  const effects = heroEffects(sven);
  assert(effects.length === 1 && effects[0].text === 'Warcry' && effects[0].good, 'only the timed buff, not the passive');
  assert(effects[0].time > 0 && effects[0].time <= abilityValue(sven.abilities[2], 'duration'), 'with its time left');
});

test('the ability bar has one slot per ability and stays off the hero panel', () => {
  const canvas = { width: 1280, height: 720 };
  const panel = heroPanelRect(canvas);
  for (const { data } of batchHeroes()) {
    const hero = addTestHero(createSim(1), data.localized_name, 1, 500, 500);
    const slots = abilityBarSlots(canvas, hero);
    assert(slots.length === hero.abilities.length, 'one slot per ability');
    assert(slots.map((slot) => slot.key).join('') === 'qwedfr'.replace(/[df]/g, (key) => (slots.some((slot) => slot.key === key) ? key : '')), 'in hotkey order');
    for (const slot of slots) {
      assert(slot.x > panel.x + panel.width && slot.plus.x > panel.x + panel.width, `${data.localized_name}: a slot covers the hero panel`);
      assert(slot.y + slot.height <= canvas.height && slot.plus.y + slot.plus.height <= slot.y, 'the + sits above its slot');
    }
  }
});

test('every aimed ability of the batch has a cast range', () => {
  for (const { abilities } of batchHeroes()) {
    for (const { key } of abilities) {
      const ability = { key, def: ABILITY_DEFS[key], level: 1 };
      const aimed = ability.def.cast === 'unit' || ability.def.cast === 'point';
      if (aimed) assert(abilityCastRange(ability) > 0, `${key} has no cast range`);
      if (ability.def.aoe) assert(abilityAoe(ability) > 0, `${key} has no area`);
    }
  }
});

// Casts everything a hero has, then lets it fight for a while.
function exerciseHero(name, maxed) {
  const sim = createSim(3);
  const hero = addTestHero(sim, name, 25, 1000, 600);
  fillMana(hero);
  const enemyHero = addTestHero(sim, 'Axe', 25, 1200, 600, CREEP_TEAM);
  enemyHero.acquireRange = HERO_ACQUIRE_RANGE;
  const creeps = [addTestCreep(sim, 1150, 500, { maxHp: 3000 }), addTestCreep(sim, 1100, 700, { maxHp: 3000 }), addDummy(sim, 1300, 650)];
  for (const ability of hero.abilities) teach(hero, ability.key, maxed ? maxAbilityLevel(ability) : 1);

  hero.abilities.forEach((ability, index) => {
    try {
      const target = [enemyHero].concat(creeps).find((unit) => !unit.dead);
      if (ability.def.cast === 'toggle') {
        toggleAutocast(hero, index);
        toggleAutocast(hero, index);
      } else if (ability.def.cast !== 'passive' && target) {
        const problem = orderCast(hero, index, target);
        assert(problem === null, `could not cast: ${problem}`);
        runUntil(sim, 6, () => ability.cooldown > 0 || hero.order.type !== 'cast', 'the cast');
        runFor(sim, 2);
      }
    } catch (error) {
      throw new Error(`${ability.key} at level ${ability.level}: ${error.message}`);
    }
  });
  hero.acquireRange = HERO_ACQUIRE_RANGE;
  try {
    runFor(sim, 30);
  } catch (error) {
    throw new Error(`${name} fighting (${maxed ? 'max level' : 'level 1'}): ${error.message}`);
  }
  for (const unit of sim.units) {
    assert(Number.isFinite(unit.hp) && Number.isFinite(unit.x) && Number.isFinite(unit.y) && Number.isFinite(unit.mana), `${name}: a unit ended with a broken number`);
  }
}

test('all 43 abilities of the batch work at level 1', () => {
  let count = 0;
  for (const { data, abilities } of batchHeroes()) {
    exerciseHero(data.localized_name, false);
    count += abilities.length;
  }
  assert(count === 43, `the batch has ${count} abilities`);
});

test('all 43 abilities of the batch work at their maximum level', () => {
  for (const { data } of batchHeroes()) exerciseHero(data.localized_name, true);
});

// ---- Draft ----

test('the draft: the match waits while 8 different abilities are on offer (16 from 150 abilities on)', () => {
  assert(draftOptionCount(43) === 8 && draftOptionCount(149) === 8 && draftOptionCount(150) === 16, 'decision D2');
  const game = createGame(heroByName('Sven'), 5);
  assert(game.hero.abilities.length === 0, 'the hero starts with no abilities');
  stepGame(game, TEST_STEP);
  assert(game.draft && game.draft.number === 1, 'the first pick opens before round 1');
  const options = game.draft.options;
  assert(options.length === DRAFT_OPTIONS_FEW && new Set(options).size === DRAFT_OPTIONS_FEW, 'different options');
  assert(options.every((key) => ABILITY_DEFS[key] && draftPool().includes(key)), 'all from the batch');
  for (let t = 0; t < 10; t += TEST_STEP) stepGame(game, TEST_STEP);
  assert(game.round === 0 && game.timer === PREP_TIME && game.draft.options === options, 'nothing moves until you choose');

  assert(!pickDraft(game, 'not_an_ability') && game.draft, 'only what is on offer can be picked');
  const first = options.find((key) => !ABILITY_DEFS[key].ult);
  assert(pickDraft(game, first), 'picked');
  assert(game.hero.abilities.length === 1 && game.hero.abilities[0].key === first && game.hero.abilities[0].level === 0, 'it arrives unlearned');
  stepGame(game, TEST_STEP);
  assert(game.draft && game.draft.number === 2, 'the second pick follows right away');
  assert(!game.draft.options.includes(first), 'what you already have is not offered again');
  const offered = game.draft.options;
  assert(skipDraft(game), 'closing the window');
  assert(game.hero.abilities.length === 2 && offered.includes(game.hero.abilities[1].key), 'gives a random one of those offered');
  for (let t = 0; t < PREP_TIME + 1; t += TEST_STEP) stepGame(game, TEST_STEP);
  assert(game.round === 1 && !game.draft, 'then round 1 starts');
  assert(levelUpAbility(game.hero, 0) && abilityHotkeys(game.hero.abilities).every(Boolean), 'drafted abilities can be levelled and have keys');
});

test('the draft: five picks, before rounds 1, 1, 3, 6 and 9', () => {
  const game = createGame(heroByName('Luna'), 5);
  const pickedBefore = [];
  for (let round = 0; round < 15; round++) {
    Object.assign(game, { round, phase: 'prep', timer: PREP_TIME });
    stepGame(game, TEST_STEP);
    while (game.draft) {
      pickedBefore.push(round + 1);
      skipDraft(game);
      stepGame(game, TEST_STEP);
    }
  }
  assert(pickedBefore.join(',') === '1,1,3,6,9', `picked before rounds ${pickedBefore}`);
  assert(new Set(game.hero.abilities.map((ability) => ability.key)).size === 5, 'five different abilities');
});

test('the draft: the same seed offers the same abilities', () => {
  const offer = (seed) => {
    const game = createGame(heroByName('Axe'), seed);
    stepGame(game, TEST_STEP);
    return game.draft.options.join(',');
  };
  assert(offer(11) === offer(11), 'same seed, same offer');
  assert(offer(11) !== offer(12), 'another seed, another offer');
});

test('the draft screen: one card per option, none overlapping', () => {
  const canvas = { width: 1280, height: 720 };
  const game = createGame(heroByName('Sven'), 5);
  stepGame(game, TEST_STEP);
  const cards = draftCards(canvas, game);
  const button = draftSkipButton(canvas);
  assert(cards.length === DRAFT_OPTIONS_FEW, 'one card per option');
  for (const card of cards) {
    assert(card.x >= 0 && card.x + card.width <= canvas.width && card.y + card.height <= button.y, 'cards fit above the button');
    assert(abilityOwnerName(card.key), 'each card can say whose ability it was');
  }
  assert(button.y + button.height <= canvas.height, 'the button fits');
});

// ---- Gold, shop and items ----

function richHero(sim, name, x, y) {
  const hero = addTestHero(sim, name, 10, x, y);
  hero.gold = 100000;
  return hero;
}

test('items: plain stats come straight from the data', () => {
  const sim = createSim(1);
  const sven = richHero(sim, 'Sven', 500, 500);
  const before = Object.assign({}, sven.stats);
  for (const key of ['blades_of_attack', 'chainmail', 'gloves', 'belt_of_strength', 'robe', 'boots']) {
    assert(buyItem(sven, key) === null, `bought ${key}`);
  }
  // Sven's main attribute is strength, so the belt also adds damage.
  assertNear(sven.stats.damageMin, before.damageMin + 9 + 6, 1e-6, 'damage');
  assertNear(sven.stats.armor, before.armor + 4, 1e-6, 'armor');
  assertNear(sven.stats.attackSpeed, before.attackSpeed + 20, 1e-6, 'attack speed');
  assertNear(sven.stats.maxHp, before.maxHp + 6 * HP_PER_STR, 1e-6, 'health from strength');
  assertNear(sven.stats.maxMana, before.maxMana + 6 * MANA_PER_INT, 1e-6, 'mana from intelligence');
  assertNear(sven.stats.moveSpeed, before.moveSpeed + 45, 1e-6, 'move speed');
  sellItem(sven, 0);
  buyItem(sven, 'boots');
  assertNear(sven.stats.moveSpeed, before.moveSpeed + 45, 1e-6, 'a second pair of boots adds nothing');
  assertNear(sven.stats.damageMin, before.damageMin + 6, 1e-6, 'selling took the damage away');
});

test('items: buying keeps health and mana at the same fraction', () => {
  const sim = createSim(1);
  const sven = richHero(sim, 'Sven', 500, 500);
  sven.hp = sven.stats.maxHp / 2;
  buyItem(sven, 'reaver');
  assertNear(sven.hp / sven.stats.maxHp, 0.5, 1e-9, 'still at half health');
});

test('shop: a built item costs only what you are missing', () => {
  const sim = createSim(1);
  const sven = richHero(sim, 'Sven', 500, 500);
  assert(purchasePlan(sven, 'phase_boots').cost === 1450, 'from scratch');
  buyItem(sven, 'boots');
  const plan = purchasePlan(sven, 'phase_boots');
  assert(plan.cost === 950 && plan.used.join() === 'boots', `with boots: ${plan.cost}`);
  const gold = sven.gold;
  assert(buyItem(sven, 'phase_boots') === null, 'bought');
  assert(sven.gold === gold - 950 && sven.items.length === 1 && sven.items[0].key === 'phase_boots', 'the boots were used up');

  buyItem(sven, 'mithril_hammer');
  buyItem(sven, 'belt_of_strength');
  const recipe = itemCost('basher') - itemCost('mithril_hammer') - itemCost('belt_of_strength');
  assert(recipe > 0 && purchasePlan(sven, 'basher').cost === recipe, 'only the recipe is left to pay');

  // Parts of a part count too: Daedalus needs Crystalys, which needs a Claymore and Blades.
  buyItem(sven, 'claymore');
  buyItem(sven, 'blades_of_attack');
  const daedalus = purchasePlan(sven, 'greater_crit');
  assert(daedalus.cost === itemCost('greater_crit') - itemCost('claymore') - itemCost('blades_of_attack'), `Daedalus: ${daedalus.cost}`);
  assert(daedalus.used.length === 2, 'uses both parts');
});

test('shop: no gold or no room stops a purchase, and selling pays half', () => {
  const sim = createSim(1);
  const sven = addTestHero(sim, 'Sven', 10, 500, 500);
  sven.gold = 400;
  assert(buyItem(sven, 'blades_of_attack') === 'gold' && sven.items.length === 0 && sven.gold === 400, 'not enough gold');
  sven.gold = 100000;
  buyItem(sven, 'claymore');
  for (let i = 0; i < 5; i++) assert(buyItem(sven, 'blades_of_attack') === null, 'filling the inventory');
  assert(sven.items.length === INVENTORY_SIZE, 'six items');
  assert(buyItem(sven, 'chainmail') === 'full' && sven.items.length === INVENTORY_SIZE, 'no room for a seventh');
  assert(buyItem(sven, 'lesser_crit') === null && sven.items.length === 5, 'a recipe that frees slots still fits');
  const gold = sven.gold;
  assert(sellItem(sven, 0) && sven.gold === gold + Math.floor(itemCost('blades_of_attack') / 2), 'half price back');
  assert(!sellItem(sven, 9), 'nothing to sell in an empty slot');
});

test('items: lifesteal heals with every hit', () => {
  const sim = createSim(1);
  const sven = richHero(sim, 'Sven', 500, 500);
  buyItem(sven, 'lifesteal');
  sven.baseStats.hpRegen = 0;
  sven.hp = 100;
  const creep = addDummy(sim, 560, 500);
  orderAttack(sven, creep);
  runFor(sim, 3);
  const dealt = 5000 - creep.hp;
  assert(dealt > 0, 'it attacked');
  assertNear(sven.hp, 100 + dealt * 0.18, 0.01, 'healed 18% of the damage');
});

test('items: Crystalys crits and Skull Basher stuns', () => {
  const sim = createSim(1);
  const sven = richHero(sim, 'Sven', 500, 500);
  buyItem(sven, 'lesser_crit');
  buyItem(sven, 'basher');
  const creep = addDummy(sim, 560, 500, { maxHp: 50000 });
  sim.rng = () => 0; // every roll succeeds
  orderAttack(sven, creep);
  runUntil(sim, 3, () => creep.flags.stunned, 'the bash');
  const crit = sim.events.find((event) => event.type === 'crit');
  assert(crit && crit.amount > sven.stats.damageMax, 'a critical hit');
  assert(hitsOn(sim, creep) === 2, 'the hit and the bash damage');
  assert(sven.items[1].cooldown > 0, 'the bash has its own cooldown');
});

test('items: Kaya makes abilities hit harder', () => {
  const sim = createSim(1);
  const zeus = richHero(sim, 'Zeus', 500, 500);
  buyItem(zeus, 'kaya');
  const index = teach(zeus, 'zuus_lightning_bolt');
  const creep = addDummy(sim, 800, 500);
  orderCast(zeus, index, creep);
  runUntil(sim, 3, () => creep.hp < 5000, 'the bolt');
  assertNear(5000 - creep.hp, abilityValue(zeus.abilities[index], 'damage') * 1.1, 0.01, '10% more damage');
});

test('items: actives cost mana, have a cooldown and do their thing', () => {
  const sim = createSim(1);
  const sven = richHero(sim, 'Sven', 500, 500);
  for (const key of ['black_king_bar', 'mask_of_madness', 'phase_boots', 'satanic', 'blades_of_attack']) buyItem(sven, key);
  const bolt = sven.abilities[teach(sven, 'sven_storm_bolt')];
  assert(useItem(sim, sven, 4) === 'passive' && useItem(sim, sven, 5) === 'empty', 'nothing to use there');

  const mana = sven.mana;
  const resist = sven.stats.magicResist;
  assert(useItem(sim, sven, 0) === null, 'Black King Bar');
  assert(sven.mana === mana - 50 && sven.items[0].cooldown === 95, 'paid and on cooldown');
  assert(useItem(sim, sven, 0) === 'cooldown', 'not again yet');
  assert(sven.flags.immune && sven.stats.magicResist === resist + 60, 'immune and resistant');
  assert(addMod(sim, sven, { id: 'test:stun', sourceId: 0, duration: 5, flags: ['stunned'] }) === null && !sven.flags.stunned, 'enemy statuses bounce off');

  const speed = sven.stats.attackSpeed;
  const move = sven.stats.moveSpeed;
  assert(useItem(sim, sven, 1) === null, 'Mask of Madness');
  assert(sven.stats.attackSpeed === speed + 100 && castProblem(sven, bolt) === 'silenced', 'faster but silenced');
  assert(useItem(sim, sven, 2) === null && sven.stats.moveSpeed > move, 'Phase Boots speed up');
  const lifesteal = sven.stats.lifesteal;
  assert(lifesteal === 25 + 22, 'lifesteal from two items adds up');
  assert(useItem(sim, sven, 3) === null && sven.stats.lifesteal === lifesteal + 145, 'Satanic raises lifesteal');
  assert(heroEffects(sven).some((effect) => effect.text === 'Black King Bar'), 'effects are listed by item name');
  runFor(sim, 10);
  assert(!sven.flags.immune && castProblem(sven, bolt) === null && sven.stats.lifesteal === lifesteal, 'everything wears off');
  sven.mana = 0;
  sven.items[1].cooldown = 0;
  assert(useItem(sim, sven, 1) === 'mana', 'no mana, no mask');
});

test('items: Power Treads feed the main attribute', () => {
  const sim = createSim(1);
  const sven = richHero(sim, 'Sven', 500, 500);
  const sniper = richHero(sim, 'Sniper', 700, 500);
  const before = [sven.stats.str, sven.stats.moveSpeed, sniper.stats.agi, sniper.stats.moveSpeed];
  buyItem(sven, 'power_treads');
  buyItem(sniper, 'power_treads');
  assertNear(sven.stats.str, before[0] + 10, 1e-9, 'strength for Sven');
  assertNear(sven.stats.moveSpeed, before[1] + 55, 1e-9, 'melee speed');
  assertNear(sniper.stats.agi, before[2] + 10, 1e-9, 'agility for Sniper');
  assertNear(sniper.stats.moveSpeed, before[3] + 45, 1e-9, 'ranged speed');
});

test('all 25 items of the batch can be bought, used and fought with', () => {
  assert(DB.batch.items.length === 25, `the batch has ${DB.batch.items.length} items`);
  for (const name of ['Sven', 'Sniper']) {
    for (const key of DB.batch.items) {
      try {
        const sim = createSim(2);
        const hero = richHero(sim, name, 500, 500);
        assert(buyItem(hero, key) === null, 'could not buy');
        assert(itemSummary(key).length > 3, 'the shop has nothing to say about it');
        if (hero.items[0].def.active) assert(useItem(sim, hero, 0) === null, 'could not use');
        hero.acquireRange = HERO_ACQUIRE_RANGE;
        addTestCreep(sim, 650, 500, { maxHp: 2000 });
        runFor(sim, 8);
        assert(Number.isFinite(hero.hp) && Number.isFinite(hero.stats.damageMin) && Number.isFinite(hero.stats.moveSpeed), 'a broken number');
      } catch (error) {
        throw new Error(`${key} on ${name}: ${error.message}`);
      }
    }
  }
});

test('gold: creeps and rounds pay, and a faster clear pays more', () => {
  assert(roundGold(3, 10) > roundGold(3, 30) && roundGold(3, 30) > roundGold(3, 60), 'faster is better');
  assert(roundGold(3, 60) === roundGold(3, 500) && roundGold(4, 60) > roundGold(3, 60), 'a floor that grows with the round');
  const game = createGame(heroByName('Sven'), 7);
  assert(game.hero.gold === GOLD.start, 'starting gold');
  for (let t = 0; t < 120 && !(game.round === 1 && game.phase === 'prep'); t += TEST_STEP) stepPlaying(game);
  assert(game.round === 1 && game.phase === 'prep', 'round 1 cleared');
  const wave = waveForRound(1);
  const bounties = wave.reduce((sum, entry) => sum + entry.count * creepBounty(creepType(entry.key), 1), 0);
  assert(game.hero.gold === GOLD.start + bounties + roundGold(1, game.roundTime), `gold ${game.hero.gold}`);
});

test('the shop only opens between rounds', () => {
  const game = createGame(heroByName('Sven'), 7);
  stepGame(game, TEST_STEP);
  assert(game.draft && buyFromShop(game, 'blades_of_attack') === 'closed', 'not while drafting');
  while (game.draft) stepPlaying(game);
  assert(shopOpen(game) && buyFromShop(game, 'blades_of_attack') === null, 'open before the round');
  assert(game.hero.gold === GOLD.start - itemCost('blades_of_attack') && game.hero.items.length === 1, 'paid for it');
  for (let t = 0; t < PREP_TIME + 1 && game.phase === 'prep'; t += TEST_STEP) stepPlaying(game);
  assert(game.phase === 'fight', 'the round started');
  assert(buyFromShop(game, 'chainmail') === 'closed' && !sellFromInventory(game, 0), 'closed during the fight');
  assert(game.hero.items.length === 1, 'nothing changed');
});

test('the shop and the inventory fit on screen without covering the rest', () => {
  const canvas = { width: 1280, height: 720 };
  const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const hero = addTestHero(createSim(1), 'Sniper', 1, 500, 500);
  addAbility(hero, 'sven_warcry');
  const bar = abilityBarSlots(canvas, hero);
  assert(bar.length === 6, 'a full bar of six');
  const slots = inventorySlots(canvas);
  const button = shopButton(canvas);
  const panel = shopPanelRect(canvas);
  const cards = shopCards(canvas);
  assert(slots.length === INVENTORY_SIZE && cards.length === 25, 'six slots and 25 cards');
  for (const slot of slots) {
    assert(slot.x + slot.width <= canvas.width && slot.y + slot.height <= canvas.height, 'inventory on screen');
    assert(!bar.some((other) => overlap(slot, other) || overlap(slot, other.plus)), 'inventory clear of the ability bar');
    assert(!overlap(slot, panel), 'the shop leaves the inventory visible');
  }
  assert(!overlap(button, panel) && !slots.some((slot) => overlap(slot, button)), 'the shop button stays visible');
  assert(!overlap(panel, heroPanelRect(canvas)) && !bar.some((slot) => overlap(panel, slot)), 'the shop leaves the hero panel and the bar visible');
  for (const card of cards) assert(card.x >= panel.x && card.x + card.width <= panel.x + panel.width && card.y + card.height <= panel.y + panel.height, 'cards inside the panel');
});

// ---- Computer rivals and the match of 8 ----

// Steps a match; if the human is drafting, takes a random ability.
function stepMatchPlaying(match) {
  const human = humanPlayer(match);
  if (human && human.game.draft) skipDraft(human.game);
  stepMatch(match, TEST_STEP);
}

function runMatchUntil(match, done, maxSeconds) {
  for (let t = 0; t < maxSeconds && !done(); t += TEST_STEP) stepMatchPlaying(match);
  assert(done(), `still waiting after ${maxSeconds} s`);
}

// A lone arena driven by a computer brain, already fighting.
function aiArena(heroName, seed) {
  const game = createGame(heroByName(heroName), seed);
  game.phase = 'fight';
  return { game, brain: createBrain(game.sim.rng, game.hero.data) };
}

function stepAiArena(arena, seconds) {
  for (let t = 0; t < seconds; t += TEST_STEP) {
    aiStep(arena.game, arena.brain, TEST_STEP);
    stepArena(arena.game, TEST_STEP);
  }
}

const STILL_CREEP = { moveSpeed: 0, damageMin: 0, damageMax: 0 };

test('match: 8 players, you first, each with a different hero and an arena of their own', () => {
  const sven = heroByName('Sven');
  const match = createMatch(sven, 3);
  assert(match.players.length === 8, `players: ${match.players.length}`);
  const human = match.players[0];
  assert(human.human && human.name === 'Vos' && human.game.hero.data === sven && !human.brain, 'you are the first player');
  assert(match.players.slice(1).every((player) => !player.human && player.brain), 'the other 7 are the computer');
  assert(new Set(match.players.map((player) => player.game.hero.data)).size === 8, 'eight different heroes');
  assert(new Set(match.players.map((player) => player.game.sim)).size === 8, 'eight arenas');
  assert(new Set(match.players.map((player) => player.name)).size === 8, 'eight names');
  assert(match.players.every((player) => player.game.hero.gold === GOLD.start), 'everyone starts with the same gold');
  assert(match.players.slice(1).every((player) => AI_STYLES.includes(player.brain.style) && AI_MONEY.includes(player.brain.money)), 'each rival has a personality');
});

test('every ability of the batch tells the computer what it is good for', () => {
  for (const key of draftPool()) {
    const info = AI_ABILITY_INFO[key];
    assert(info && info.tags.length, `${key} has no tags`);
    assert(info.tags.every((tag) => tag in AI_STYLE_WEIGHTS.mixed), `${key} has an unknown tag`);
  }
  for (const style of AI_STYLES) {
    for (const key of AI_SHOPPING[style]) assert(DB.batch.items.includes(key), `${style} wants ${key}, not in the batch`);
  }
});

test('match: the computer drafts, levels up and shops on its own, keeping its reserve', () => {
  const match = createMatch(null, 4);
  runMatchUntil(match, () => match.phase === 'fight', PREP_TIME + 1);
  for (const player of match.players) {
    const hero = player.game.hero;
    assert(hero.abilities.length === 2, `${player.name} has ${hero.abilities.length} abilities`);
    assert(hero.skillPoints === 0 && hero.abilities.some((ability) => ability.level === 1), `${player.name} spent the point`);
    const spent = GOLD.start - hero.gold;
    assert(spent <= GOLD.start * (1 - AI_RESERVE[player.brain.money]), `${player.name} (${player.brain.money}) spent ${spent}`);
    if (player.brain.money === 'spender') assert(hero.items.length > 0, `${player.name} spends its gold`);
  }
});

test('match: one clock for everyone; the next round waits for the last arena', () => {
  const match = createMatch(heroByName('Axe'), 5);
  let sawWaiting = false;
  let sawPrep = false;
  for (let t = 0; t < 400 && match.round < 4; t += TEST_STEP) {
    stepMatchPlaying(match);
    const alive = playersAlive(match);
    if (match.phase === 'fight') {
      assert(alive.every((player) => player.game.round === match.round), 'every arena is on the same round');
      if (alive.some((player) => player.game.phase === 'prep') && alive.some((player) => player.game.phase === 'fight')) sawWaiting = true;
    } else {
      sawPrep = true;
      assert(alive.every((player) => player.game.phase === 'prep'), 'nobody fights between rounds');
      assert(alive.every((player) => player.game.timer === match.timer), 'every arena shows the same clock');
    }
  }
  assert(match.round === 4, `reached round ${match.round}`);
  assert(sawWaiting && sawPrep, 'some arenas finished first and waited');
});

test('match: everything waits while you choose an ability', () => {
  const match = createMatch(heroByName('Luna'), 6);
  stepMatch(match, TEST_STEP);
  const human = humanPlayer(match);
  assert(human.game.draft, 'your first pick is open');
  const timer = match.timer;
  const rivalTime = match.players[1].game.sim.time;
  for (let t = 0; t < 5; t += TEST_STEP) stepMatch(match, TEST_STEP);
  assert(match.timer === timer && match.players[1].game.sim.time === rivalTime, 'the clock and the rivals stand still');
  skipDraft(human.game);
  stepMatch(match, TEST_STEP);
  assert(human.game.draft && human.game.draft.number === 2, 'second pick');
  skipDraft(human.game);
  stepMatch(match, TEST_STEP);
  assert(!human.game.draft && match.timer < timer, 'then the clock runs again');
});

test('match: a wave past the time limit ends anyway, as the slowest clear', () => {
  const match = createMatch(null, 7);
  runMatchUntil(match, () => match.phase === 'fight', PREP_TIME + 1);
  match.roundTime = ROUND_LIMIT - TEST_STEP / 2;
  const goldBefore = match.players.map((player) => player.game.hero.gold);
  stepMatch(match, TEST_STEP);
  assert(match.phase === 'prep' && match.players.every((player) => player.game.phase === 'prep'), 'everyone is between rounds');
  assert(match.players.every((player, i) => player.game.hero.gold > goldBefore[i]), 'the round still pays');
});

test('match: whoever falls takes the last place free and loses the gold; the last one standing wins', () => {
  const match = createMatch(heroByName('Sniper'), 8);
  runMatchUntil(match, () => match.phase === 'fight', PREP_TIME + 1);
  const first = match.players[3];
  Object.assign(first.game.hero, { aegis: 0, dead: true });
  stepMatch(match, TEST_STEP);
  assert(first.game.phase === 'lost' && first.place === 8 && first.outRound === 1, `place ${first.place}`);
  assert(first.game.hero.gold === 0, 'the gold is gone, as in the mod');
  assert(playerState(match, first) === 'out' && playerStanding(match)[7] === first, 'last in the table');
  for (const player of match.players.slice(1)) Object.assign(player.game.hero, { aegis: 0, dead: true });
  stepMatch(match, TEST_STEP);
  assert(match.over && match.players[0].place === 1, 'you win when everyone else fell');
  assert(match.players.slice(1).filter((player) => player !== first).every((player) => player.place === 7), 'falling together shares the place');
});

test('computer: an area ability waits for a group; a single target is enough for a nuke', () => {
  const arena = aiArena('Crystal Maiden', 1);
  const hero = arena.game.hero;
  addAbility(hero, 'crystal_maiden_crystal_nova');
  teach(hero, 'crystal_maiden_crystal_nova', 1);
  const nova = hero.abilities[0];
  // Two creeps far apart: the nova would only catch one of them.
  addTestCreep(arena.game.sim, hero.x - 450, hero.y, STILL_CREEP);
  addTestCreep(arena.game.sim, hero.x + 450, hero.y, STILL_CREEP);
  stepAiArena(arena, 1);
  assert(nova.cooldown === 0, 'no nova on lone creeps');
  addTestCreep(arena.game.sim, hero.x + 500, hero.y + 40, STILL_CREEP);
  stepAiArena(arena, 1.5);
  assert(nova.cooldown > 0, 'nova once two are together');

  const zeus = aiArena('Zeus', 2);
  addAbility(zeus.game.hero, 'zuus_lightning_bolt');
  teach(zeus.game.hero, 'zuus_lightning_bolt', 1);
  addTestCreep(zeus.game.sim, zeus.game.hero.x + 400, zeus.game.hero.y, STILL_CREEP);
  stepAiArena(zeus, 1.5);
  assert(zeus.game.hero.abilities[0].cooldown > 0, 'the bolt goes on the only creep');
});

test('computer: walks to the wave and clears round 1 by itself', () => {
  const game = createGame(heroByName('Phantom Assassin'), 9);
  const brain = createBrain(game.sim.rng, game.hero.data);
  for (let t = 0; t < 120 && game.round < 2; t += TEST_STEP) {
    if (game.phase === 'prep' && !game.draft && draftsDue(game) > 0) openDraft(game);
    aiStep(game, brain, TEST_STEP);
    stepGame(game, TEST_STEP);
  }
  assert(game.round === 2 && game.phase !== 'lost', `round ${game.round}, ${game.phase}`);
  assert(game.hero.abilities.length === 2, 'it drafted');
});

test('computer: shops along its list, builds items from their parts and keeps its reserve', () => {
  const { game, brain } = aiArena('Sven', 3);
  game.phase = 'prep';
  Object.assign(brain, { style: 'fighter', money: 'spender' });
  game.hero.gold = 3000;
  aiShop(game, brain);
  const owned = () => game.hero.items.map((item) => item.key).sort().join(',');
  assert(owned() === 'broadsword,power_treads', `bought ${owned()}`);
  assert(game.hero.gold === 600, `gold left ${game.hero.gold}`);
  game.hero.gold += 300;
  aiShop(game, brain);
  assert(owned() === 'mask_of_madness,power_treads', `then ${owned()}: the broadsword went into the mask`);

  const saver = aiArena('Sven', 3);
  Object.assign(saver.brain, { style: 'fighter', money: 'saver' });
  saver.game.phase = 'prep';
  saver.game.hero.gold = 3000;
  aiShop(saver.game, saver.brain);
  assert(saver.game.hero.gold >= 1500, `the saver keeps half: ${saver.game.hero.gold}`);

  game.phase = 'fight';
  game.hero.gold = 10000;
  assert(aiShop(game, brain).length === 0, 'nothing is bought during a round');
});

test('computer: buffs and items come out when they help', () => {
  const arena = aiArena('Ogre Magi', 4);
  const hero = arena.game.hero;
  addAbility(hero, 'ogre_magi_bloodlust');
  teach(hero, 'ogre_magi_bloodlust', 1);
  hero.gold = 10000;
  buyItem(hero, 'satanic');
  // A creep far away keeps the round going without being close enough for a buff.
  addTestCreep(arena.game.sim, hero.x - 1700, hero.y, STILL_CREEP);
  stepAiArena(arena, 0.5);
  assert(hero.abilities[0].cooldown === 0, 'no buff with nobody around');
  addTestCreep(arena.game.sim, hero.x + 300, hero.y, STILL_CREEP);
  hero.hp = hero.stats.maxHp * 0.3;
  stepAiArena(arena, 1);
  assert(hero.abilities[0].cooldown > 0, 'bloodlust before the fight');
  assert(hero.items[0].cooldown > 0, 'Satanic when low on health');
});

test('match: the same seed plays the same match', () => {
  const play = () => {
    const match = createMatch(null, 21);
    runMatchUntil(match, () => match.round >= 3 && match.phase === 'prep', 300);
    return match.players.map((player) => {
      const hero = player.game.hero;
      return `${hero.gold}:${hero.abilities.map((a) => a.key + a.level).join('/')}:${hero.items.map((i) => i.key)}`;
    }).join('|');
  };
  assert(play() === play(), 'two runs differ');
});

test('the players table and the rival panel fit on screen without covering the rest', () => {
  const canvas = { width: 1280, height: 720 };
  const match = createMatch(heroByName('Zeus'), 10);
  const rows = playerTableRows(canvas, match);
  assert(rows.length === 8 && rows[0].player.place === null, 'one row per player');
  const last = rows[rows.length - 1];
  const panel = heroPanelRect(canvas);
  // The hero panel's active effects stack up to 8 rows of 22 px above it.
  assert(last.y + last.height < panel.y - 10 - 8 * 22, 'the table ends above the hero panel and its effects');
  const spy = spyPanelRect(canvas);
  assert(spy.x >= last.x + last.width && spy.x + spy.width < canvas.width / 2 + 200, 'the rival panel sits next to the table');
  assert(spy.y + spy.height < panel.y - 10 - 8 * 22, 'and above the hero panel');
  assert(spy.y > 104, 'it does not cover the round title, the aiming hint or the messages');
  assert(spy.x + spy.width < canvas.width - 300, 'nor the controls reminder');
});

test('the round title follows the shared clock and says who is still fighting', () => {
  const match = createMatch(heroByName('Axe'), 11);
  const game = humanPlayer(match).game;
  assert(roundTitle(game) === 'Ronda 1 en 15', roundTitle(game));
  runMatchUntil(match, () => match.phase === 'fight', PREP_TIME + 1);
  assert(roundTitle(game).startsWith('Ronda 1 · quedan '), roundTitle(game));
  for (const unit of game.sim.units) if (unit.kind === 'creep') unit.dead = true;
  stepMatch(match, TEST_STEP);
  if (match.phase === 'fight') assert(/^Ronda 1 · listo, falta/.test(roundTitle(game)), roundTitle(game));
  assert(endingText(game) === null, 'still playing');
  const other = createMatch(heroByName('Axe'), 12);
  const fallen = humanPlayer(other).game;
  runMatchUntil(other, () => other.phase === 'fight', PREP_TIME + 1);
  Object.assign(fallen.hero, { aegis: 0, dead: true });
  runMatchUntil(other, () => fallen.phase === 'lost', 1);
  assert(endingText(fallen).title === 'Caíste' && endingText(fallen).line.includes('puesto 8 de 8'), endingText(fallen).line);
});

// ---- Duels and bets ----

function runUntilDuel(match, state) {
  runMatchUntil(match, () => match.duel && match.duel.state === state, 400);
  return match.duel;
}

test('duels: none in round 1; from round 2 one per round, never the same player two rounds in a row', () => {
  const match = createMatch(null, 31);
  let seen = null;
  const pairs = [];
  assert(match.timer === PREP_TIME && !match.duel, 'round 1 has a plain break');
  for (let t = 0; t < 900 && pairs.length < 6; t += TEST_STEP) {
    stepMatchPlaying(match);
    if (match.duel && match.duel !== seen) {
      seen = match.duel;
      assert(match.phase === 'prep' && match.timer > PREP_TIME, 'a duel round has a longer break');
      assert(match.duel.round === match.round + 1 && match.duel.round >= DUEL_FIRST_ROUND, `duel for round ${match.duel.round}`);
      assert(match.duel.a !== match.duel.b, 'two different players');
      assert(match.duel.a.game.phase !== 'lost' && match.duel.b.game.phase !== 'lost', 'both alive');
      pairs.push([match.duel.a, match.duel.b]);
    }
  }
  assert(pairs.length === 6, `duels seen: ${pairs.length}`);
  for (let i = 1; i < pairs.length; i++) {
    assert(!pairs[i].some((player) => pairs[i - 1].includes(player)), `round ${i + 2}: someone fought twice in a row`);
  }
});

test('duels: the duelists skip their wave, fight each other in a shared arena, then go home', () => {
  const match = createMatch(null, 32);
  const duel = runUntilDuel(match, 'betting');
  const { a, b } = duel;
  const homes = [a, b].map((player) => ({ sim: player.game.sim, id: player.game.hero.id, team: player.game.hero.team, level: player.game.hero.level }));
  runUntilDuel(match, 'fighting');
  assert(a.game.phase === 'duel' && b.game.phase === 'duel', 'both are in the duel');
  assert(a.game.sim === duel.sim && b.game.sim === duel.sim, 'they share the duel arena');
  assert(duel.sim.units.length === 2 && duel.sim.units.every((unit) => unit.kind === 'hero'), 'only the two heroes');
  assert(a.game.hero.team !== b.game.hero.team && a.game.hero.id !== b.game.hero.id, 'enemies with different ids');
  assert(a.game.hero.hp === a.game.hero.stats.maxHp && b.game.hero.mana === b.game.hero.stats.maxMana, 'full health and mana');
  assert(homes.every((home) => !home.sim.units.some((unit) => unit.kind === 'creep')), 'no wave at home');
  assert(a.game.round === match.round, 'their round counts too');
  assert(duel.oddsA > 0 && duel.oddsA < 1, 'the odds when it started are kept for the bench');
  assert(playerState(match, a) === 'duel', 'the table says they are in a duel');
  const goldBefore = [a, b].map((player) => player.game.hero.gold);
  runUntilDuel(match, 'done');
  const result = duel.result;
  assert(result && [a, b].includes(result.winner) && result.loser !== result.winner, 'one wins');
  [a, b].forEach((player, i) => {
    const hero = player.game.hero;
    assert(player.game.sim === homes[i].sim && homes[i].sim.units.includes(hero), 'back home');
    assert(hero.id === homes[i].id && hero.team === homes[i].team && !hero.dead, 'with its own id and team, alive');
    assert(hero.level === homes[i].level + 1 && hero.hp === hero.stats.maxHp, 'levelled up and healed like after a wave');
    assert(player.game.phase !== 'lost', 'losing a duel does not knock you out');
  });
  const winnerIndex = result.winner === a ? 0 : 1;
  const roundPay = Math.round(ROUND_PRIZE.ladder[ROUND_PRIZE.duelPlace] * (1 + ROUND_PRIZE.growth * (duel.round - 1)));
  const free = result.payouts.find((entry) => entry.free && entry.player === result.winner).pays;
  assert(result.winner.game.hero.gold === goldBefore[winnerIndex] + roundPay + result.prize + free, 'the winner cashes the round, the prize and the free bet');
  assert(result.prize === duelPrize(duel.round) && result.winner.duelsWon === 1, 'prize and record');
  assert(result.loser.game.hero.gold === goldBefore[1 - winnerIndex] + roundPay, 'the loser only cashes the round');
});

test('duels: after 60 seconds the higher share of health wins (D7)', () => {
  const match = createMatch(null, 33);
  const duel = runUntilDuel(match, 'fighting');
  duel.a.game.hero.hp = duel.a.game.hero.stats.maxHp * 0.3;
  duel.b.game.hero.hp = duel.b.game.hero.stats.maxHp * 0.9;
  duel.time = DUEL_TIME_LIMIT - TEST_STEP / 2;
  stepMatch(match, TEST_STEP);
  assert(duel.state === 'done' && duel.result.winner === duel.b, 'the healthier one wins');
});

test('bets: up to half your gold, at least 50, once per duel, only for those watching, only before the round', () => {
  const match = createMatch(heroByName('Sven'), 34);
  const duel = runUntilDuel(match, 'betting');
  const bystanders = playersAlive(match).filter((player) => !isDuelist(duel, player));
  const human = humanPlayer(match);
  const bettor = bystanders.find((player) => !duel.bets.some((bet) => bet.player === player)) || human;
  duel.bets = duel.bets.filter((bet) => bet.player !== bettor);
  bettor.game.hero.gold = 1000;
  assert(placeBet(match, duel.a, 'b', 100) === 'duelist', 'duelists do not bet');
  assert(placeBet(match, bettor, 'a', 49) === 'min', 'minimum');
  assert(placeBet(match, bettor, 'a', 501) === 'max', 'at most half');
  assert(placeBet(match, bettor, 'a', 500) === null && bettor.game.hero.gold === 500, 'the gold leaves');
  assert(placeBet(match, bettor, 'b', 50) === 'already', 'once');
  assert(betTotals(duel).a >= 500, 'the side shows it');
  match.phase = 'fight';
  const other = bystanders.find((player) => player !== bettor);
  duel.bets = duel.bets.filter((bet) => bet.player !== other);
  other.game.hero.gold = 1000;
  assert(placeBet(match, other, 'a', 100) === 'closed', 'closed once the round starts');
});

test('bets: the pot pays the winners in proportion, at least double, never more than 5 times', () => {
  const p = (name) => ({ name, game: { hero: { gold: 0 } } });
  const [a, b, x, y, z] = ['a', 'b', 'x', 'y', 'z'].map(p);
  const pays = (bets, winner, round) => {
    const result = settleBets({ round, a, b, bets }, winner);
    return Object.fromEntries(result.map((entry) => [entry.player.name + (entry.free ? '*' : ''), entry.pays]));
  };
  // 500 bet, free bets of 50 each, extra max(30% of 500, 50 x 4) = 200: a pot of 800.
  let r = pays([{ player: x, side: 'a', amount: 100 }, { player: y, side: 'b', amount: 300 }, { player: z, side: 'a', amount: 100 }], 'a', 4);
  assert(r.x === 320 && r.z === 320 && r['a*'] === 160 && r.y === 0 && r['b*'] === 0, JSON.stringify(r));
  // Almost everything on the favourite: no minimum double.
  r = pays([{ player: x, side: 'a', amount: 1000 }, { player: y, side: 'b', amount: 50 }], 'a', 4);
  assert(r.x > 1000 && r.x < 2000, `favourite pays ${r.x}`);
  // A small bet on the surprise is capped at 5 times.
  r = pays([{ player: x, side: 'a', amount: 50 }, { player: y, side: 'b', amount: 2000 }], 'a', 4);
  assert(r.x === 250, `surprise pays ${r.x}`);
  // A balanced duel pays at least double.
  r = pays([{ player: x, side: 'a', amount: 1000 }, { player: y, side: 'b', amount: 1000 }], 'a', 2);
  assert(r.x >= 2000, `balanced pays ${r.x}`);
});

test('computer bettors: only those watching, once, between 50 and half their gold', () => {
  const match = createMatch(null, 35);
  const duel = runUntilDuel(match, 'betting');
  const gold = new Map(match.players.map((player) => [player, player.game.hero.gold]));
  for (const player of match.players) {
    const before = player.game.hero.gold;
    const bet = duel.bets.find((entry) => entry.player === player);
    if (bet) gold.set(player, before + bet.amount);
  }
  runMatchUntil(match, () => match.phase === 'fight', 30);
  assert(duel.bets.length > 0, 'somebody bets');
  assert(new Set(duel.bets.map((bet) => bet.player)).size === duel.bets.length, 'once each');
  for (const bet of duel.bets) {
    assert(!isDuelist(duel, bet.player), 'not the duelists');
    assert(bet.amount >= BET.min && bet.amount <= gold.get(bet.player) / 2 + 1, `${bet.player.name} bet ${bet.amount} of ${gold.get(bet.player)}`);
  }
});

test('duels on screen: you fight your own duel, and the betting panel fits without covering the rest', () => {
  const canvas = { width: 1280, height: 720 };
  const match = createMatch(heroByName('Axe'), 36);
  const duel = runUntilDuel(match, 'betting');
  const human = humanPlayer(match);
  if (!isDuelist(duel, human)) {
    assert(duelPanelMode(match) === 'bet', 'a bystander gets the betting panel');
    duel.a = human;
  }
  assert(duelPanelMode(match) === 'yourDuel' && playerState(match, human) === 'nextDuel', 'you are told it is your duel');
  runUntilDuel(match, 'fighting');
  assert(human.game.sim === duel.sim && human.game.phase === 'duel', 'your screen is the duel arena');
  assert(roundTitle(human.game).startsWith('Duelo contra '), roundTitle(human.game));
  assert(duelPanelMode(match) === null, 'no panel while you fight');

  const panel = betPanelRect(canvas);
  assert(panel.x >= 0 && panel.x + panel.width <= canvas.width && panel.y > 22 + 5 * 16, 'below the controls reminder');
  const table = playerTableRows(canvas, match);
  const spy = spyPanelRect(canvas);
  assert(panel.x > spy.x + spy.width && panel.x > table[0].x + table[0].width, 'clear of the table and the rival panel');
  const inventoryTop = Math.min(...inventorySlots(canvas).map((slot) => slot.y));
  assert(panel.y + panel.height < Math.min(inventoryTop, shopButton(canvas).y), 'above the inventory');
  const controls = betControls(canvas);
  for (const rect of controls.chips.concat(controls.sides)) {
    assert(rect.x >= panel.x && rect.x + rect.width <= panel.x + panel.width && rect.y + rect.height <= panel.y + panel.height, 'buttons inside the panel');
  }
});

// ---- Aegis, curse marks and the end of the match ----

function killHero(game) {
  applyDamage(game.sim, null, game.hero, 1e9, 'pure');
  stepArena(game, TEST_STEP);
}

test('Aegis: dying to the wave spends one and you come back with an advantage; with none left you are out', () => {
  const game = createGame(heroByName('Sven'), 41);
  game.phase = 'fight';
  addTestCreep(game.sim, 100, 100, STILL_CREEP);
  assert(game.hero.aegis === AEGIS_START && AEGIS_START === 2, 'two Aegis to start (D3)');
  killHero(game);
  const hero = game.hero;
  assert(game.phase === 'fight' && !hero.dead && hero.aegis === 1, 'back in the fight with one less');
  assert(hero.hp === hero.stats.maxHp && hero.mana === hero.stats.maxMana, 'full health and mana');
  assert(hero.stats.damageTakenPct === AEGIS_ADVANTAGE.damageTakenPct && hero.stats.damageDealtPct === AEGIS_ADVANTAGE.damageDealtPct, 'the advantage');
  const hp = hero.hp;
  applyDamage(game.sim, null, hero, 100, 'pure');
  assertNear(hp - hero.hp, 100 * (1 + AEGIS_ADVANTAGE.damageTakenPct / 100), 0.01, 'takes less damage');
  for (let t = 0; t < AEGIS_ADVANTAGE.duration + 0.1; t += TEST_STEP) stepArena(game, TEST_STEP);
  assert(!findMod(hero, 'aegis') && hero.stats.damageTakenPct === 0, 'the advantage wears off');
  killHero(game);
  assert(hero.aegis === 0 && game.phase === 'fight', 'the second one');
  killHero(game);
  assert(game.phase === 'lost', 'then you are out');
});

test('curse marks (D8): 7% more damage taken, 7% less dealt and less gold, at most 3, and they stay', () => {
  const sim = createSim(42);
  const hero = addTestHero(sim, 'Axe', 5, 500, 500);
  const creep = addTestCreep(sim, 600, 500, STILL_CREEP);
  hero.aegis = 0;
  hero.curses = 0;
  assert(punishLoser(hero) === 'curse' && punishLoser(hero) === 'curse' && hero.curses === 2, 'a mark when no Aegis is left');
  assert(hero.stats.damageTakenPct === 14 && hero.stats.damageDealtPct === -14, 'stats');
  const hp = hero.hp;
  applyDamage(sim, creep, hero, 100, 'pure');
  assertNear(hp - hero.hp, 114, 0.01, 'takes more');
  const creepHp = creep.hp;
  applyDamage(sim, hero, creep, 50, 'pure');
  assertNear(creepHp - creep.hp, 43, 0.01, 'deals less');
  assertNear(goldFactor(hero), 0.86, 1e-9, 'earns less');
  punishLoser(hero);
  assert(punishLoser(hero) === 'out' && hero.curses === CURSE.max, 'at most 3; one more loss knocks you out');
  refreshPassives(hero);
  moveHero(hero, createSim(43), 99, CREEP_TEAM, 0, 0);
  assert(hero.stats.damageTakenPct === 21, 'the marks survive a trip to the duel arena');
  hero.aegis = 1;
  assert(punishLoser(hero) === 'aegis' && hero.aegis === 0, 'an Aegis goes first');
});

test('final stretch: losing a duel costs nothing with more than 3 alive; with 3 it costs an Aegis', () => {
  const crowd = createMatch(null, 44);
  const duel = runUntilDuel(crowd, 'fighting');
  finishDuel(crowd, 'a');
  assert(duel.result.penalty === null && duel.b.game.hero.aegis === AEGIS_START, 'no penalty with 8 alive');

  const few = createMatch(null, 45);
  const late = runUntilDuel(few, 'fighting');
  const others = few.players.filter((player) => !isDuelist(late, player));
  for (const player of others.slice(0, 5)) player.game.phase = 'lost';
  finishDuel(few, 'b');
  assert(late.result.penalty === 'aegis' && late.a.game.hero.aegis === AEGIS_START - 1, 'the loser pays an Aegis');
  assert(late.b.game.hero.aegis === AEGIS_START, 'the winner does not');
});

test('the end: falling together shares the place; the win goes to the last one standing', () => {
  const match = createMatch(heroByName('Luna'), 46);
  runMatchUntil(match, () => match.phase === 'fight', PREP_TIME + 1);
  for (const player of match.players) Object.assign(player.game.hero, { aegis: 0, dead: true });
  stepMatch(match, TEST_STEP);
  assert(match.over && match.players.every((player) => player.place === 1), 'all fell at once: all first');
  assert(endingText(humanPlayer(match).game).title === 'Caíste', 'still, you fell');
});

test('the closing screen: everyone in order, and your gold adds up by where it came from', () => {
  const match = createMatch(heroByName('Zeus'), 47);
  const human = humanPlayer(match);
  runMatchUntil(match, () => match.round >= 4 && match.phase === 'prep', 600);
  const income = human.game.income;
  const total = income.creeps + income.rounds + income.duels + income.bets;
  assert(human.game.hero.gold === GOLD.start + total, `gold ${human.game.hero.gold} vs ${GOLD.start} + ${total}`);
  assert(income.creeps > 0 && income.rounds > 0, 'creeps and rounds paid');
  const lines = podiumLines(match);
  assert(lines.length === 8 && lines.every((line) => line.text.includes(line.player.name)), 'one line per player');
  assert(incomeText(human.game).startsWith('creeps '), incomeText(human.game));
  const canvas = { width: 1280, height: 720 };
  assert(213 + lines.length * 30 + 20 < canvas.height - 60, 'the podium fits above the last line');
});

// ---- Waves (decision D5) ----

test('waves: the same for everyone each round, 1 to 3 kinds, heavy every 5 rounds, each kind from its round on', () => {
  for (let round = 1; round <= 90; round++) {
    const wave = waveForRound(round);
    assert(JSON.stringify(wave) === JSON.stringify(waveForRound(round)), `round ${round} changes`);
    if (isRoshanRound(round)) {
      assert(wave.length === 1 && wave[0].key === 'roshan' && wave[0].count === 1, `round ${round}: Roshan alone`);
      continue;
    }
    assert(wave.every((entry) => !creepType(entry.key).boss), `round ${round}: a boss in a normal wave`);
    assert(wave.length >= 1 && wave.length <= 3, `round ${round}: ${wave.length} kinds`);
    const total = wave.reduce((sum, entry) => sum + entry.count, 0);
    assert(total >= 4 && total <= WAVE.maxCount, `round ${round}: ${total} creeps`);
    for (const entry of wave) assert(creepType(entry.key).from <= round, `round ${round}: ${entry.key} too early`);
    const heavy = wave.some((entry) => creepType(entry.key).heavy);
    assert(heavy === (round % WAVE.heavyEvery === 0), `round ${round}: heavy ${heavy}`);
  }
  assert(waveText([{ key: 'melee', count: 6 }, { key: 'ranged', count: 1 }]) === '6 Kóbolds y 1 Arpía', 'the announcement');
  for (const key of Object.keys(DB.waves.types)) assert(creepType(key).name && creepType(key).plural, key + ' needs a name and a plural');
});

test('waves: creeps grow fast until round 10, slower to 20, and without a ceiling after; magic resistance from 60', () => {
  const step = (round) => creepGrowth(round + 1) - creepGrowth(round);
  assert(creepGrowth(1) === 1, 'round 1 is the base');
  assert(step(5) > step(15), 'slower after round 10');
  assert(creepGrowth(80) > creepGrowth(60) * 2, 'no ceiling');
  const type = creepType('melee');
  assert(creepStats(type, 59).magicResist === 0 && creepStats(type, 60).magicResist === CREEP_GROWTH.magicResist, 'resists magic from 60');
  assert(creepStats(creepType('spider'), 20).magicResist === 50, 'the spider always resists');
  assert(creepBounty(type, 1) === type.bounty && creepBounty(type, 30) > type.bounty, 'bounties grow');
});

test('waves: centaurs stun on hit sometimes, and the exploding bug hurts whoever is close when it dies', () => {
  const game = createGame(heroByName('Axe'), 61);
  game.round = 12;
  const hero = game.hero;
  const centaur = addCreep(game, 'centaur', hero.x + 80, hero.y);
  let stunned = false;
  for (let t = 0; t < 30 && !stunned; t += TEST_STEP) {
    stepSim(game.sim, TEST_STEP);
    hero.hp = hero.stats.maxHp;
    stunned = Boolean(hero.flags.stunned);
  }
  assert(stunned, 'the centaur stunned');
  centaur.dead = true;
  const bug = addCreep(game, 'baneling', hero.x + 100, hero.y);
  const far = addCreep(game, 'melee', hero.x + 900, hero.y);
  far.team = HERO_TEAM;
  const hp = hero.hp;
  applyDamage(game.sim, hero, bug, 1e9, 'pure');
  const expected = creepType('baneling').explode.damage * creepGrowth(12) * (1 - hero.stats.magicResist / 100);
  assertNear(hp - hero.hp, expected, 0.01, 'explosion damage');
});

test('waves: after 50 seconds the creeps enrage: faster, harder, and no more stuns or slows', () => {
  const game = createGame(heroByName('Sven'), 62);
  game.phase = 'fight';
  game.round = 1;
  const creep = addCreep(game, 'melee', 200, 200);
  creep.stats.moveSpeed = 0;
  const speed = creep.stats.moveSpeed;
  game.roundTime = ENRAGE.after - TEST_STEP / 2;
  stepArena(game, TEST_STEP);
  assert(findMod(creep, 'enrage') && creep.flags.immune, 'enraged');
  assert(creep.stats.attackSpeed === 100 + ENRAGE.attackSpeed, 'attacks faster');
  const c = abilityContext(game.sim, game.hero, newAbility('sven_storm_bolt'), creep, null);
  stun(c, creep, 2);
  assert(!creep.flags.stunned, 'cannot be stunned');
});

test('round prize: by finishing place, the duelists as in the middle, a wave ended by time as the last', () => {
  const match = createMatch(null, 63);
  runMatchUntil(match, () => match.phase === 'fight', PREP_TIME + 1);
  const pay = (place) => Math.round(ROUND_PRIZE.ladder[place] * (1 + ROUND_PRIZE.growth * (match.round - 1)));
  const [a, b, c] = match.players.map((player) => player.game);
  assert(roundPrize(match, a) === pay(0) && roundPrize(match, b) === pay(1), 'first and second');
  c.forcedEnd = true;
  assert(roundPrize(match, c) === pay(ROUND_PRIZE.ladder.length - 1), 'too slow: last');
  c.forcedEnd = false;
  c.phase = 'duel';
  assert(roundPrize(match, c) === pay(ROUND_PRIZE.duelPlace), 'duelist');
  assert(pay(0) === 500 && pay(7) === 50, 'round 1 goes from 500 to 50');
});

test('final two (user decision): losing a duel with no Aegis and every mark knocks you out', () => {
  const match = createMatch(null, 64);
  const duel = runUntilDuel(match, 'fighting');
  for (const player of match.players) {
    if (!isDuelist(duel, player)) player.game.phase = 'lost';
  }
  Object.assign(duel.b.game.hero, { aegis: 0, curses: CURSE.max });
  finishDuel(match, 'a');
  assert(duel.result.penalty === 'out' && duel.b.game.phase === 'lost', 'out');
  stepMatch(match, TEST_STEP);
  assert(match.over && duel.a.place === 1 && duel.b.place > 1, 'the winner of the last duel wins the match');
});

// ---- The bench ----

test('the bench plays a match alone and counts heroes, abilities, gold and duels', () => {
  const tally = createBenchTally();
  const played = playBenchMatch(51, 4);
  tallyBenchMatch(tally, played);
  assert(tally.matches === 1 && tally.unfinished + tally.endRounds.length === 1, 'one match');
  const heroGames = [...tally.heroes.values()].reduce((sum, entry) => sum + entry.seen, 0);
  const heroWins = [...tally.heroes.values()].reduce((sum, entry) => sum + entry.won, 0);
  assert(heroGames === 8 && heroWins === 1, `${heroGames} heroes, ${heroWins} winners`);
  assert(tally.duels === 2 && tally.favouriteWins <= 2, `duels ${tally.duels}`);
  assert(tally.income.rounds > 0 && tally.income.creeps > 0, 'gold counted');
  const lines = benchReport(tally, 4);
  assert(lines[0] === '1 partidas, hasta la ronda 4.' && lines.some((line) => line.startsWith('Sin alarmas')), lines[0]);
  assert(lines.some((line) => line.startsWith('Eliminados')), 'where players fall');
});

test('bans: each rival bans a different ability, you ban one more or pass, and the hero bans wait for 40 heroes', () => {
  const setup = createSetup(31);
  assert(setup.step === 'ban' && setup.aiBans.length === 7, `rival bans: ${setup.aiBans.length}`);
  assert(new Set(setup.aiBans).size === 7, 'no ability banned twice');
  assert(setup.aiBans.every((key) => draftPool().includes(key)), 'bans come from the batch');
  assert(AI_BAN_TARGETS.every((key) => setup.aiBans.includes(key)) || setup.aiBans.every((key) => AI_BAN_TARGETS.includes(key)),
    'rivals go for the strongest first');
  assert(!setupBan(setup, setup.aiBans[0]), 'one already banned cannot be chosen');
  const mine = draftPool().find((key) => !setup.aiBans.includes(key));
  assert(setupBan(setup, mine) && setup.step === 'hero', 'your ban moves on to the hero');
  assert(!setupBan(setup, mine), 'only one ban');
  assert(setupBans(setup).length === 8 && setupBans(setup).includes(mine), 'eight bans in all');
  const passed = createSetup(32);
  assert(setupBan(passed, null) && setupBans(passed).length === 7, 'you can pass');
  assert(!heroBansActive(), 'decision D10: no hero bans with 10 heroes');
  // A match of 8 computer players bans 8.
  assert(createMatch(null, 33).bannedAbilities.length === 8, 'eight bans without a human');
});

test('bans: nobody is offered a banned ability, not even in many drafts', () => {
  const setup = createSetup(34);
  setupBan(setup, draftPool().find((key) => !setup.aiBans.includes(key)));
  const match = matchFromSetup(setup, setup.offer[0]);
  const banned = new Set(match.bannedAbilities);
  assert(banned.size === 8, `banned: ${banned.size}`);
  for (const player of match.players) {
    for (let i = 0; i < 5; i++) {
      openDraft(player.game);
      assert(player.game.draft.options.length === DRAFT_OPTIONS_FEW, 'still a full offer');
      assert(player.game.draft.options.every((key) => !banned.has(key)), `${player.name} was offered a banned one`);
      skipDraft(player.game);
    }
    assert(player.game.hero.abilities.every((ability) => !banned.has(ability.key)), 'no banned ability in a kit');
  }
});

test('hero offer: 4 heroes, one reroll that keeps the first and brings 3 new ones, and only those can be chosen', () => {
  const setup = createSetup(35);
  assert(setup.offer.length === HERO_OFFER && new Set(setup.offer).size === HERO_OFFER, 'four different heroes');
  assert(!canReroll(setup) && !rerollHeroes(setup), 'no reroll before banning');
  assert(matchFromSetup(setup, setup.offer[0]) === null, 'no match before banning');
  setupBan(setup, null);
  const first = setup.offer.slice();
  assert(rerollHeroes(setup), 'reroll');
  assert(setup.offer.length === HERO_OFFER && setup.offer[0] === first[0], 'the first stays');
  assert(setup.offer.slice(1).every((data) => !first.includes(data)), 'three new ones');
  assert(new Set(first.concat(setup.offer)).size === 7, 'seven heroes seen in all');
  assert(!rerollHeroes(setup) && setup.rerolled, 'only once');
  const outside = batchHeroes().map((hero) => hero.data).find((data) => !setup.offer.includes(data));
  assert(matchFromSetup(setup, outside) === null, 'a hero outside the offer cannot be chosen');
  const match = matchFromSetup(setup, setup.offer[2]);
  assert(match && humanPlayer(match).game.hero.data === setup.offer[2], 'you play the hero you chose');
  assert(new Set(match.players.map((player) => player.game.hero.data)).size === 8, 'the rivals take other heroes');
});

// ---- Roshan (decision D9) ----

test('Roshan: alone every 10 rounds, stronger each time, announced, and no duel that round', () => {
  for (const round of [10, 20, 30, 60]) assert(isRoshanRound(round), `round ${round}`);
  for (const round of [1, 5, 9, 15, 25]) assert(!isRoshanRound(round), `round ${round}`);
  const type = creepType('roshan');
  assert(creepStats(type, 20).maxHp > creepStats(type, 10).maxHp, 'stronger each time');
  assert(creepStats(type, 20).maxHp > creepStats(creepType('golem'), 20).maxHp * creepStats(type, 10).maxHp / creepStats(creepType('golem'), 10).maxHp, 'it grows faster than the creeps');
  assert(waveText(waveForRound(10)) === 'Roshan', waveText(waveForRound(10)));
  const match = createMatch(null, 41);
  match.round = 9;
  assert(!duelRoundFor(match), 'round 10 has no duel');
  match.round = 10;
  assert(duelRoundFor(match), 'round 11 has one again');
  // Played: the break before round 10 announces no duel.
  const other = createMatch(null, 42);
  other.round = 9;
  startBreak(other);
  assert(!other.duel || other.duel.state !== 'betting', 'nobody announced for the duel');
  assert(other.timer === PREP_TIME, 'a normal break');
});

test('Roshan: resists magic, grows angrier every 10 seconds, and killing it gives an Aegis to who has fewer than 2', () => {
  const game = createGame(heroByName('Sven'), 43);
  game.round = 9;
  startRound(game);
  const roshan = game.sim.units.find((unit) => unit.kind === 'creep' && !unit.dead);
  assert(roshan.creepKind === 'roshan' && creepsAlive(game) === 1, 'Roshan alone');
  assert(roshan.stats.magicResist === creepType('roshan').magicResist && roshan.stats.magicResist > 0, `magic resist ${roshan.stats.magicResist}`);
  // Keep it still and harmless to watch it grow.
  roshan.baseStats.moveSpeed = 0;
  game.hero.x = 100;
  game.hero.y = ARENA.height - 60;
  const damage = roshan.stats.damageMin;
  const attackSpeed = roshan.stats.attackSpeed;
  for (let t = 0; t < 21; t += TEST_STEP) stepSim(game.sim, TEST_STEP);
  const rage = creepType('roshan').rage;
  assertNear(roshan.stats.damageMin, damage * (1 + 2 * rage.damagePct / 100), 0.01, 'two rages of damage');
  assertNear(roshan.stats.attackSpeed, attackSpeed + 2 * rage.attackSpeed, 0.01, 'two rages of attack speed');
  game.hero.aegis = 1;
  const gold = game.hero.gold;
  applyDamage(game.sim, game.hero, roshan, 1e9, 'pure');
  stepArena(game, TEST_STEP);
  assert(game.hero.aegis === 2, `aegis ${game.hero.aegis}`);
  assert(game.hero.gold > gold, 'its bounty and the round pay');
  assert(game.phase === 'prep', 'the round is over');
  // With the 2 of the start, no Aegis (decision D9: then it will be a book).
  const full = createGame(heroByName('Sven'), 44);
  full.round = 9;
  startRound(full);
  applyDamage(full.sim, full.hero, full.sim.units.find((unit) => unit.creepKind === 'roshan'), 1e9, 'pure');
  stepArena(full, TEST_STEP);
  assert(full.hero.aegis === AEGIS_START, `aegis ${full.hero.aegis}`);
});

async function runTests() {
  const summary = document.getElementById('summary');
  const list = document.getElementById('results');
  try {
    await loadDB();
  } catch (error) {
    summary.textContent = `❌ No se pudieron cargar los datos (${error.message})`;
    return;
  }
  let passed = 0;
  for (const { name, fn } of tests) {
    const row = document.createElement('li');
    try {
      fn();
      passed++;
      row.textContent = `✅ ${name}`;
    } catch (error) {
      row.textContent = `❌ ${name}: ${error.message}`;
      row.className = 'fail';
    }
    list.append(row);
  }
  summary.textContent = `${passed === tests.length ? '✅' : '❌'} ${passed}/${tests.length} pruebas`;
  document.title = summary.textContent;
}

// Kept so tools/run-tests.js can wait for the run to finish.
const testRun = runTests();
