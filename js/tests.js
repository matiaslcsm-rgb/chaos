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
    stats: Object.assign(creepStats(CREEP_TYPES.melee, 1), overrides),
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

test('the draft: the match waits while 16 different abilities are on offer', () => {
  const game = createGame(heroByName('Sven'), 5);
  assert(game.hero.abilities.length === 0, 'the hero starts with no abilities');
  stepGame(game, TEST_STEP);
  assert(game.draft && game.draft.number === 1, 'the first pick opens before round 1');
  const options = game.draft.options;
  assert(options.length === DRAFT_OPTIONS && new Set(options).size === DRAFT_OPTIONS, 'different options');
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
  assert(cards.length === DRAFT_OPTIONS, 'one card per option');
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
  const bounties = wave.melee * GOLD.perCreep.melee + wave.ranged * GOLD.perCreep.ranged;
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
