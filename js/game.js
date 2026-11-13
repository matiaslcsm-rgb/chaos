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
// Decision D5: the mod does not publish its gold numbers, so these are provisional and tuned with the bench.
// What is known: 600 to start (Dota's), clearing faster pays more, every creep pays when it dies.
const GOLD = {
  start: 600,
  // A game on its own (no match): clearing instantly doubles the round's gold; this many seconds or more adds nothing.
  round: 150,
  roundGrowth: 25,
  parTime: 45,
  // Each creep's bounty grows this much per round.
  bountyGrowth: 0.04,
};

// Decision D5, provisional. The mod's creeps grow fast until round 10 and slower after 20 (history, 28 Feb 2020);
// here: three stretches, the last one without a ceiling. From round 60 they also resist magic (history, 21 Feb 2020).
const CREEP_GROWTH = { early: 0.2, middle: 0.15, lateRate: 1.05, magicResistFrom: 60, magicResist: 30 };
// Waves: a few kinds of creep per round, more creeps as rounds go by, and a heavy wave every 5 rounds.
const WAVE = { baseCount: 5, perRounds: 6, maxCount: 12, heavyEvery: 5, seed: 1009 };
// After this long, the creeps of a wave enrage: faster, harder hitting, and nothing can slow or stop them (mod).
const ENRAGE = { after: 50, moveSpeedPct: 50, attackSpeed: 100, damagePct: 50 };

// Decision D9: Roshan every 10 rounds (10, 20, 30...), alone instead of the wave, stronger each time. It grows
// angrier the longer the fight goes, resists magic (fighters kill it more easily than mages, as in the mod) and
// drops an Aegis. Its numbers are provisional (D5), tuned with the bench.
const ROSHAN_EVERY = 10;

function isRoshanRound(round) {
  return round > 0 && round % ROSHAN_EVERY === 0;
}

function creepType(key) {
  return DB.waves.types[key];
}

// How much stronger the creeps are in a round than in round 1.
function creepGrowth(round) {
  if (round <= 10) return 1 + CREEP_GROWTH.early * (round - 1);
  const at10 = 1 + CREEP_GROWTH.early * 9;
  if (round <= 20) return at10 + CREEP_GROWTH.middle * (round - 10);
  return (at10 + CREEP_GROWTH.middle * 10) * Math.pow(CREEP_GROWTH.lateRate, round - 20);
}

function creepBounty(type, round) {
  return Math.round(type.bounty * (1 + GOLD.bountyGrowth * (round - 1)));
}
// Decision D3: 2 Aegis per player, as in the mod. Dying to the wave spends one and you come back on the spot
// with a short advantage. The mod does not say how big; the size is the user's decision (docs/PLAN.md).
const AEGIS_START = 2;
const AEGIS_ADVANTAGE = { duration: 5, damageTakenPct: -50, damageDealtPct: 50 };
// Decision D8: curse marks of 7% (more damage taken, less damage dealt, less gold), at most 3.
const CURSE = { pct: 7, max: 3 };

function curseStats() {
  return { damageTakenPct: CURSE.pct, damageDealtPct: -CURSE.pct };
}

function goldFactor(hero) {
  return 1 - CURSE.pct * (hero.curses || 0) / 100;
}

// Gold that comes in, with a note of where it came from for the closing screen.
function earn(game, amount, source) {
  game.hero.gold += amount;
  game.income[source] += amount;
}

function creepStats(type, round) {
  // A boss grows like the creeps and, on top, a bit more each time it comes back.
  const growth = creepGrowth(round) * (type.bossGrowth ? 1 + type.bossGrowth * (Math.floor(round / ROSHAN_EVERY) - 1) : 1);
  const lateResist = round >= CREEP_GROWTH.magicResistFrom ? CREEP_GROWTH.magicResist : 0;
  return Object.assign({
    maxHp: Math.round(type.maxHp * growth),
    hpRegen: 0,
    maxMana: 0,
    manaRegen: 0,
    armor: type.armor,
    magicResist: Math.min(90, (type.magicResist || 0) + lateResist),
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

// The wave of a round: [{ key, count }]. Fixed for each round number, so every arena gets the same one
// (in the mod the waves are the same for everyone and announced in advance).
function waveForRound(round) {
  if (isRoshanRound(round)) return [{ key: 'roshan', count: 1 }];
  const rng = makeRng(WAVE.seed + round);
  const open = (heavy) => Object.keys(DB.waves.types)
    .filter((key) => !creepType(key).boss && Boolean(creepType(key).heavy) === heavy && creepType(key).from <= round);
  const light = open(false);
  if (round % WAVE.heavyEvery === 0 && open(true).length) {
    // A heavy wave: a few big ones and a couple of small ones.
    const heavy = open(true);
    return [
      { key: heavy[Math.floor(rng() * heavy.length)], count: Math.min(4, 2 + Math.floor(round / 20)) },
      { key: light[Math.floor(rng() * light.length)], count: 2 },
    ];
  }
  const kinds = Math.min(light.length, round < 3 ? 1 : round < 10 ? 2 : 3);
  const picked = [];
  while (picked.length < kinds) {
    const key = light[Math.floor(rng() * light.length)];
    if (!picked.includes(key)) picked.push(key);
  }
  const total = Math.min(WAVE.maxCount, WAVE.baseCount + Math.floor(round / WAVE.perRounds));
  return picked.map((key, i) => ({ key, count: Math.floor(total / kinds) + (i < total % kinds ? 1 : 0) }));
}

// "6 Kóbolds y 1 Arpía", for the announcement of the next wave; a boss goes by its name alone.
function waveText(wave) {
  if (wave.length === 1 && creepType(wave[0].key).boss) return creepType(wave[0].key).name;
  const parts = wave.map((entry) => `${entry.count} ${entry.count === 1 ? creepType(entry.key).name : creepType(entry.key).plural}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0];
}

// The hero is only a base of attributes: its abilities come from the draft.
function createGame(heroData, seed) {
  const sim = createSim(seed);
  const hero = addHero(sim, heroData, 1, HERO_TEAM, ARENA.width / 2, ARENA.height * 0.6);
  hero.gold = GOLD.start;
  hero.aegis = AEGIS_START;
  hero.curses = 0;
  const income = { creeps: 0, rounds: 0, duels: 0, bets: 0 };
  return { sim, hero, income, round: 0, phase: 'prep', timer: PREP_TIME, roundTime: 0, picks: 0, draft: null };
}

// ---- Gold and the shop ----

function roundGold(round, seconds) {
  const base = GOLD.round + GOLD.roundGrowth * round;
  return Math.round(base * (1 + Math.max(0, 1 - seconds / GOLD.parTime)));
}

// Gold still walking around: what the creeps alive are worth.
function bountyAlive(game) {
  return game.sim.units.reduce((sum, unit) => sum + (unit.kind === 'creep' && !unit.dead ? unit.bounty || 0 : 0), 0);
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

// Abilities banned before the match: nobody can draft them (an arena played alone has no bans).
function bannedAbilities(game) {
  return game.match && game.match.bannedAbilities ? game.match.bannedAbilities : [];
}

// Offers a random handful of the abilities the hero does not have yet, never a banned one.
function openDraft(game) {
  const owned = new Set(game.hero.abilities.map((ability) => ability.key));
  const banned = new Set(bannedAbilities(game));
  const all = draftPool().filter((key) => !banned.has(key));
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

// What some creeps do beyond hitting, written like item effects so the simulation runs them the same way.
const CREEP_TRAITS = {
  bash: (type, round) => ({
    key: 'creep_bash',
    cooldown: 0,
    def: {
      onAttackLanded(c, target) {
        if (c.sim.rng() * 100 < type.bash.chance) stun(c, target, type.bash.duration);
      },
    },
  }),
  explode: (type, round) => ({
    key: 'creep_explode',
    cooldown: 0,
    def: {
      onDeath(c) {
        const damage = type.explode.damage * creepGrowth(round);
        fxRing(c, c.caster, type.explode.radius, '#f28c38');
        for (const enemy of enemiesNear(c.sim, c.caster.team, c.caster, type.explode.radius)) {
          applyDamage(c.sim, c.caster, enemy, damage, 'magical');
        }
      },
    },
  }),
  // Decision D9 says "an Aegis or a book": killing it gives an Aegis to whoever has fewer than they started
  // with. With more, it will be a book once books exist; meanwhile nothing (see docs/PLAN.md).
  aegis: () => ({
    key: 'creep_aegis',
    cooldown: 0,
    def: {
      onDeath(c) {
        const hero = c.sim.units.find((unit) => unit.kind === 'hero' && unit.team === HERO_TEAM);
        if (!hero || (hero.aegis || 0) >= AEGIS_START) return;
        hero.aegis = (hero.aegis || 0) + 1;
        pushEvent(c.sim, { type: 'text', x: c.caster.x, y: c.caster.y, text: `¡${c.caster.name} soltó un Aegis!` });
      },
    },
  }),
};

// Rage: every few seconds of fight, more damage and attack speed, without a ceiling.
function addRage(game, unit, rage) {
  addMod(game.sim, unit, {
    id: 'rage',
    sourceId: unit.id,
    duration: Infinity,
    passive: true,
    level: 0,
    stats: {},
    tick: {
      interval: rage.every,
      run(mod, target) {
        mod.level++;
        mod.stats = { damagePct: rage.damagePct * mod.level, attackSpeed: rage.attackSpeed * mod.level };
        recomputeStats(target);
      },
    },
  });
}

function addCreep(game, key, x, y) {
  const type = creepType(key);
  const unit = addUnit(game.sim, {
    kind: 'creep',
    creepKind: key,
    name: type.name,
    team: CREEP_TEAM,
    radius: type.radius,
    x,
    y,
    facing: Math.PI / 2,
    bounty: creepBounty(type, game.round),
    items: Object.keys(CREEP_TRAITS).filter((trait) => type[trait]).map((trait) => CREEP_TRAITS[trait](type, game.round)),
    stats: creepStats(type, game.round),
  });
  if (type.rage) addRage(game, unit, type.rage);
  return unit;
}

function spawnWave(game) {
  const wave = waveForRound(game.round);
  const total = wave.reduce((sum, entry) => sum + entry.count, 0);
  let index = 0;
  for (const entry of wave) {
    const ranged = creepType(entry.key).projectileSpeed > 0;
    for (let i = 0; i < entry.count; i++) {
      // Spread along the top edge; ranged ones start a bit behind; a boss comes alone, from the middle.
      addCreep(game, entry.key, ARENA.width * (index + 1) / (total + 1), ranged ? 40 : creepType(entry.key).boss ? 110 : 90);
      index++;
    }
  }
}

// A wave that takes too long gets angry.
function enrageCreeps(game) {
  for (const unit of game.sim.units) {
    if (unit.kind !== 'creep' || unit.dead || findMod(unit, 'enrage')) continue;
    addMod(game.sim, unit, {
      id: 'enrage',
      sourceId: unit.id,
      duration: Infinity,
      flags: ['immune'],
      stats: { moveSpeedPct: ENRAGE.moveSpeedPct, attackSpeed: ENRAGE.attackSpeed, damagePct: ENRAGE.damagePct },
    });
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
  const base = game.payRound ? game.payRound(game) : roundGold(game.round, game.roundTime);
  const gold = Math.round(base * goldFactor(game.hero));
  earn(game, gold, 'rounds');
  pushEvent(game.sim, { type: 'text', x: game.hero.x, y: game.hero.y, text: `+${gold} de oro` });
  setHeroLevel(game.hero, game.hero.level + 1);
  game.hero.hp = game.hero.stats.maxHp;
  game.hero.mana = game.hero.stats.maxMana;
  game.phase = 'prep';
  game.timer = PREP_TIME;
}

// Back on the spot, full health and mana, with a few seconds of advantage. The wave goes on.
function reviveWithAegis(game) {
  const hero = game.hero;
  hero.aegis--;
  hero.dead = false;
  hero.hp = hero.stats.maxHp;
  hero.mana = hero.stats.maxMana;
  hero.order = { type: 'idle' };
  addMod(game.sim, hero, {
    id: 'aegis',
    sourceId: hero.id,
    duration: AEGIS_ADVANTAGE.duration,
    stats: { damageTakenPct: AEGIS_ADVANTAGE.damageTakenPct, damageDealtPct: AEGIS_ADVANTAGE.damageDealtPct },
  });
  pushEvent(game.sim, { type: 'text', x: hero.x, y: hero.y, text: `¡Aegis! Te quedan ${hero.aegis}` });
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
  const bountyEarned = Math.round((bounty - bountyAlive(game)) * goldFactor(game.hero));
  if (bountyEarned) earn(game, bountyEarned, 'creeps');
  if (game.phase !== 'fight') return;
  game.roundTime += dt;
  if (game.roundTime >= ENRAGE.after) enrageCreeps(game);
  if (game.hero.dead && game.hero.aegis > 0) {
    reviveWithAegis(game);
  } else if (game.hero.dead) {
    game.phase = 'lost';
  } else if (creepsAlive(game) === 0) {
    endRound(game);
  }
}
