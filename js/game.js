'use strict';

// One player's arena: rounds, waves of creeps, levelling. Runs on top of the simulation, no DOM.

// The mod leaves about 15 seconds between rounds to shop.
const PREP_TIME = 15;
const HERO_TEAM = 0;
const CREEP_TEAM = 1;
// The mod's draft: 5 abilities, two before round 1 and one more before rounds 3, 6 and 9.
const DRAFT_ROUNDS = [1, 1, 3, 6, 9];
// Decision D2 (docs/PLAN.md): 8 options while there are fewer than 150 abilities, 16 after, as the mod did over time.
const DRAFT_OPTIONS_FEW = 8;
const DRAFT_OPTIONS_MANY = 16;
const DRAFT_MANY_FROM = 150;
// Placeholder income until the mod's real numbers are researched (docs/PLAN.md, open decisions).
// What is known: clearing the wave faster pays more. Starting gold is Dota's.
const GOLD = {
  start: 600,
  perCreep: { melee: 30, ranged: 40 },
  round: 150,
  roundGrowth: 25,
  // Clearing instantly doubles the round's gold; taking this many seconds or more adds nothing.
  parTime: 45,
};

// Placeholder creeps until the mod's real waves are researched (docs/PLAN.md, stage 1).
const CREEP_TYPES = {
  melee: {
    name: 'Creep',
    radius: 22,
    maxHp: 120,
    damageMin: 5,
    damageMax: 7,
    armor: 2,
    attackRange: 100,
    projectileSpeed: 0,
    moveSpeed: 325,
    baseAttackTime: 1,
    attackPoint: 0.467,
  },
  ranged: {
    name: 'Creep a distancia',
    radius: 20,
    maxHp: 80,
    damageMin: 7,
    damageMax: 9,
    armor: 0,
    attackRange: 500,
    projectileSpeed: 900,
    moveSpeed: 325,
    baseAttackTime: 1,
    attackPoint: 0.5,
  },
};
const CREEP_GROWTH_PER_ROUND = 0.1;

function creepStats(type, round) {
  const growth = 1 + CREEP_GROWTH_PER_ROUND * (round - 1);
  return Object.assign({
    maxHp: Math.round(type.maxHp * growth),
    hpRegen: 0,
    maxMana: 0,
    manaRegen: 0,
    armor: type.armor,
    magicResist: 0,
    damageMin: type.damageMin * growth,
    damageMax: type.damageMax * growth,
    attackSpeed: 100,
    attackRange: type.attackRange,
    projectileSpeed: type.projectileSpeed,
    moveSpeed: type.moveSpeed,
    baseAttackTime: type.baseAttackTime,
    baseAttackPoint: type.attackPoint,
  }, attackTiming(type.baseAttackTime, type.attackPoint, 100));
}

function waveForRound(round) {
  return { melee: 2 + round, ranged: Math.floor(round / 2) };
}

// The hero is only a base of attributes: its abilities come from the draft.
function createGame(heroData, seed) {
  const sim = createSim(seed);
  const hero = addHero(sim, heroData, 1, HERO_TEAM, ARENA.width / 2, ARENA.height * 0.6);
  hero.gold = GOLD.start;
  return { sim, hero, round: 0, phase: 'prep', timer: PREP_TIME, roundTime: 0, picks: 0, draft: null };
}

// ---- Gold and the shop ----

function roundGold(round, seconds) {
  const base = GOLD.round + GOLD.roundGrowth * round;
  return Math.round(base * (1 + Math.max(0, 1 - seconds / GOLD.parTime)));
}

// Gold still walking around: what the creeps alive are worth.
function bountyAlive(game) {
  return game.sim.units.reduce((sum, unit) => sum + (unit.kind === 'creep' && !unit.dead ? GOLD.perCreep[unit.creepKind] || 0 : 0), 0);
}

// The shop opens between rounds, like in the mod.
function shopOpen(game) {
  return game.phase === 'prep' && !game.draft;
}

function buyFromShop(game, key) {
  return shopOpen(game) ? buyItem(game.hero, key) : 'closed';
}

function sellFromInventory(game, slot) {
  return shopOpen(game) && sellItem(game.hero, slot);
}

// ---- Draft ----

// Every ability of the batch can be drafted, whoever the hero is.
function draftPool() {
  return DB.batch.heroes.flatMap((entry) => entry.abilities);
}

// How many picks the player still owes before the next round can start.
function draftsDue(game) {
  return DRAFT_ROUNDS.filter((round) => round <= game.round + 1).length - game.picks;
}

function draftOptionCount(poolSize) {
  return poolSize < DRAFT_MANY_FROM ? DRAFT_OPTIONS_FEW : DRAFT_OPTIONS_MANY;
}

// Offers a random handful of the abilities the hero does not have yet.
function openDraft(game) {
  const owned = new Set(game.hero.abilities.map((ability) => ability.key));
  const all = draftPool();
  const pool = all.filter((key) => !owned.has(key));
  const count = draftOptionCount(all.length);
  const options = [];
  while (options.length < count && pool.length) {
    options.push(pool.splice(Math.floor(game.sim.rng() * pool.length), 1)[0]);
  }
  game.draft = { options, number: game.picks + 1 };
}

function pickDraft(game, key) {
  if (!game.draft || !game.draft.options.includes(key)) return false;
  addAbility(game.hero, key);
  game.picks++;
  game.draft = null;
  return true;
}

// Closing the window without choosing gives a random one, like in the mod.
function skipDraft(game) {
  const options = game.draft.options;
  return pickDraft(game, options[Math.floor(game.sim.rng() * options.length)]);
}

function creepsAlive(game) {
  return game.sim.units.filter((unit) => unit.kind === 'creep' && !unit.dead).length;
}

function spawnWave(game) {
  const wave = waveForRound(game.round);
  const total = wave.melee + wave.ranged;
  let index = 0;
  for (const kind of ['melee', 'ranged']) {
    for (let i = 0; i < wave[kind]; i++) {
      const type = CREEP_TYPES[kind];
      addUnit(game.sim, {
        kind: 'creep',
        creepKind: kind,
        name: type.name,
        team: CREEP_TEAM,
        radius: type.radius,
        // Spread along the top edge; ranged ones start a bit behind.
        x: ARENA.width * (index + 1) / (total + 1),
        y: kind === 'melee' ? 90 : 40,
        facing: Math.PI / 2,
        stats: creepStats(type, game.round),
      });
      index++;
    }
  }
}

function startRound(game) {
  game.round++;
  game.roundTime = 0;
  game.phase = 'fight';
  spawnWave(game);
}

// The mod gives one level per round; the hero comes back at full health for the next one.
function endRound(game) {
  const gold = roundGold(game.round, game.roundTime);
  game.hero.gold += gold;
  pushEvent(game.sim, { type: 'text', x: game.hero.x, y: game.hero.y, text: `+${gold} de oro` });
  setHeroLevel(game.hero, game.hero.level + 1);
  game.hero.hp = game.hero.stats.maxHp;
  game.hero.mana = game.hero.stats.maxMana;
  game.phase = 'prep';
  game.timer = PREP_TIME;
}

// One arena on its own, with its own clock between rounds (a solo game, and the tests).
function stepGame(game, dt) {
  if (game.phase === 'lost') return;
  // The match waits while the player is choosing an ability.
  if (game.phase === 'prep' && !game.draft && draftsDue(game) > 0) openDraft(game);
  if (game.draft) return;
  stepArena(game, dt);
  if (game.phase === 'prep') {
    game.timer -= dt;
    if (game.timer <= 0) startRound(game);
  }
}

// Moves one arena forward: the fight, the gold of the creeps that die, and the end of the wave.
// Whoever owns the clock (stepGame or the match) decides when the next round starts.
function stepArena(game, dt) {
  if (game.phase === 'lost') return;
  const bounty = bountyAlive(game);
  stepSim(game.sim, dt);
  game.hero.gold += bounty - bountyAlive(game);
  if (game.phase !== 'fight') return;
  game.roundTime += dt;
  if (game.hero.dead) {
    game.phase = 'lost';
  } else if (creepsAlive(game) === 0) {
    endRound(game);
  }
}
