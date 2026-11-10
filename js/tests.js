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
  for (let t = 0; t < 120 && game.round < 2; t += TEST_STEP) stepGame(game, TEST_STEP);
  assert(game.round === 2, `reached round ${game.round}, phase ${game.phase}`);
  assert(game.hero.level === 2, `hero level ${game.hero.level}`);
});

test('the match ends when the hero dies', () => {
  const game = createGame(heroByName('Crystal Maiden'), 7);
  game.hero.baseStats = Object.assign({}, game.hero.baseStats, { maxHp: 1, hpRegen: 0 });
  game.hero.hp = 1;
  for (let t = 0; t < 60 && game.phase !== 'lost'; t += TEST_STEP) stepGame(game, TEST_STEP);
  assert(game.phase === 'lost', `phase ${game.phase}`);
});

test('the same seed plays the same match', () => {
  const play = () => {
    const game = createGame(heroByName('Viper'), 42);
    for (let t = 0; t < 30; t += TEST_STEP) stepGame(game, TEST_STEP);
    return `${game.round} ${game.hero.hp} ${game.hero.x} ${game.sim.units.length}`;
  };
  assert(play() === play(), 'two runs with one seed differ');
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

runTests();
