'use strict';

// One player's arena: rounds, waves of creeps, levelling. Runs on top of the simulation, no DOM.

const PREP_TIME = 5;
const HERO_TEAM = 0;
const CREEP_TEAM = 1;
// The mod's draft: 5 abilities, two before round 1 and one more before rounds 3, 6 and 9.
const DRAFT_ROUNDS = [1, 1, 3, 6, 9];
const DRAFT_OPTIONS = 16;

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
  return { sim, hero, round: 0, phase: 'prep', timer: PREP_TIME, picks: 0, draft: null };
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

// Offers a random handful of the abilities the hero does not have yet.
function openDraft(game) {
  const owned = new Set(game.hero.abilities.map((ability) => ability.key));
  const pool = draftPool().filter((key) => !owned.has(key));
  const options = [];
  while (options.length < DRAFT_OPTIONS && pool.length) {
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
  game.phase = 'fight';
  spawnWave(game);
}

// The mod gives one level per round; the hero comes back at full health for the next one.
function endRound(game) {
  setHeroLevel(game.hero, game.hero.level + 1);
  game.hero.hp = game.hero.stats.maxHp;
  game.hero.mana = game.hero.stats.maxMana;
  game.phase = 'prep';
  game.timer = PREP_TIME;
}

function stepGame(game, dt) {
  if (game.phase === 'lost') return;
  // The match waits while the player is choosing an ability.
  if (game.phase === 'prep' && !game.draft && draftsDue(game) > 0) openDraft(game);
  if (game.draft) return;
  stepSim(game.sim, dt);
  if (game.phase === 'prep') {
    game.timer -= dt;
    if (game.timer <= 0) startRound(game);
  } else if (game.hero.dead) {
    game.phase = 'lost';
  } else if (creepsAlive(game) === 0) {
    endRound(game);
  }
}
