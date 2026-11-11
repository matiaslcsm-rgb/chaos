'use strict';

// Duels and bets (docs/DISENO.md, sections 4 and 5). From round 2 on, two living players fight each other
// instead of their wave; the rest bet on them during the break before the round. No DOM here.

// The mod gives 3 more seconds of break in rounds with a duel.
const DUEL_PREP_TIME = PREP_TIME + 3;
const DUEL_FIRST_ROUND = 2;
// Decision D7: 60 seconds at most; if nobody died, the higher share of health wins.
const DUEL_TIME_LIMIT = 60;
// Duelists start this far apart, close enough to see each other.
const DUEL_GAP = 600;
// Decision D6, numbers provisional until the bench (D5):
const BET = {
  maxShare: 0.5, // you can bet up to half of your gold (mod)
  min: 50, // so that a 1-gold bet on the surprise cannot pay a fortune
  extraShare: 0.3, // the game adds 30% of what was bet to the pot...
  extraPerRound: 50, // ...or at least this much per round number
  freeShare: 0.05, // each duelist's free bet on themselves, as a share of what was bet
  minPayout: 2, // a right guess pays at least double...
  lopsided: 0.75, // ...unless more than this share of the pot was on the winner
  maxPayout: 5, // and never more than 5 times the stake
};
const DUEL_PRIZE = { base: 100, perRound: 50 };

function duelRoundFor(match) {
  return match.round + 1 >= DUEL_FIRST_ROUND;
}

// Two living players, all equally likely; nobody fights two rounds in a row unless 3 or fewer are left.
function pickDuelists(match) {
  const alive = playersAlive(match);
  if (alive.length < 2) return null;
  const last = match.lastDuelists || [];
  let pool = alive.length > 3 ? alive.filter((player) => !last.includes(player.index)) : alive;
  if (pool.length < 2) pool = alive;
  const order = shuffled(match.rng, pool);
  return [order[0], order[1]];
}

// Announced when the break before the round starts, so everyone can bet.
function announceDuel(match) {
  const pair = pickDuelists(match);
  if (!pair) return null;
  match.duel = { round: match.round + 1, a: pair[0], b: pair[1], bets: [], state: 'betting', time: 0, sim: null, result: null };
  return match.duel;
}

function isDuelist(duel, player) {
  return Boolean(duel) && (duel.a === player || duel.b === player);
}

function maxBet(player) {
  return Math.floor(player.game.hero.gold * BET.maxShare);
}

// Why this bet cannot be placed, or null if it can (and then it is placed and the gold leaves).
function betProblem(match, player, side, amount) {
  const duel = match.duel;
  if (!duel || duel.state !== 'betting' || match.phase !== 'prep') return 'closed';
  if (player.game.phase === 'lost') return 'out';
  if (isDuelist(duel, player)) return 'duelist';
  if (duel.bets.some((bet) => bet.player === player)) return 'already';
  if (side !== 'a' && side !== 'b') return 'side';
  if (amount < BET.min) return 'min';
  if (amount > maxBet(player)) return 'max';
  return null;
}

function placeBet(match, player, side, amount) {
  const problem = betProblem(match, player, side, Math.floor(amount));
  if (problem) return problem;
  player.game.hero.gold -= Math.floor(amount);
  match.duel.bets.push({ player, side, amount: Math.floor(amount) });
  return null;
}

// Gold on each side, for the screen.
function betTotals(duel) {
  const totals = { a: 0, b: 0 };
  for (const bet of duel.bets) totals[bet.side] += bet.amount;
  return totals;
}

// ---- Moving the two heroes into the duel arena and back ----

// Units of different arenas can share an id, so a hero gets a fresh one while it visits the duel arena,
// and keeps its own effects pointing at it. Whatever was still running on it (buffs, debuffs) ends.
function moveHero(hero, toSim, newId, team, x, y) {
  hero.mods = hero.mods.filter((mod) => mod.passive);
  for (const mod of hero.mods) {
    if (mod.sourceId === hero.id) mod.sourceId = newId;
  }
  Object.assign(hero, {
    id: newId, team, x, y, dead: false,
    order: { type: 'idle' }, windup: null, windupTargetId: null, castTime: null, channel: null, knock: null,
  });
  recomputeStats(hero);
  hero.hp = hero.stats.maxHp;
  hero.mana = hero.stats.maxMana;
  toSim.units.push(hero);
}

function enterDuel(duelSim, game, team, x) {
  const hero = game.hero;
  game.arena = { sim: game.sim, id: hero.id, team: hero.team, x: hero.x, y: hero.y };
  game.sim.units = game.sim.units.filter((unit) => unit !== hero);
  moveHero(hero, duelSim, duelSim.nextId++, team, x, ARENA.height / 2);
  hero.facing = team === HERO_TEAM ? 0 : Math.PI;
  game.sim = duelSim;
  game.round++;
  game.roundTime = 0;
  game.phase = 'duel';
}

function leaveDuel(game) {
  const home = game.arena;
  game.sim.units = game.sim.units.filter((unit) => unit !== game.hero);
  game.sim = home.sim;
  moveHero(game.hero, home.sim, home.id, home.team, home.x, home.y);
  game.arena = null;
}

function startDuel(match) {
  const duel = match.duel;
  duel.state = 'fighting';
  duel.sim = createSim(Math.floor(match.rng() * 1e9));
  enterDuel(duel.sim, duel.a.game, HERO_TEAM, ARENA.width / 2 - DUEL_GAP / 2);
  enterDuel(duel.sim, duel.b.game, CREEP_TEAM, ARENA.width / 2 + DUEL_GAP / 2);
}

function healthShare(hero) {
  return hero.dead ? 0 : hero.hp / hero.stats.maxHp;
}

function stepDuel(match, dt) {
  const duel = match.duel;
  if (!duel || duel.state !== 'fighting') return;
  for (const player of [duel.a, duel.b]) {
    if (player.brain) aiStep(player.game, player.brain, dt);
  }
  stepSim(duel.sim, dt);
  if (!duel.a.human && !duel.b.human) duel.sim.events.length = 0;
  duel.time += dt;
  const heroA = duel.a.game.hero;
  const heroB = duel.b.game.hero;
  if (!heroA.dead && !heroB.dead && duel.time < DUEL_TIME_LIMIT) return;
  const shareA = healthShare(heroA);
  const shareB = healthShare(heroB);
  const winner = shareA === shareB ? (match.rng() < 0.5 ? 'a' : 'b') : shareA > shareB ? 'a' : 'b';
  finishDuel(match, winner);
}

// ---- Paying ----

// The pot: every bet, each duelist's free bet on themselves, and the game's extra. Returns what each
// bettor gets back (0 for a wrong guess).
function settleBets(duel, winnerSide) {
  const staked = duel.bets.reduce((sum, bet) => sum + bet.amount, 0);
  const free = Math.max(BET.min, Math.round(staked * BET.freeShare));
  const entries = duel.bets.concat([
    { player: duel.a, side: 'a', amount: free, free: true },
    { player: duel.b, side: 'b', amount: free, free: true },
  ]);
  const inPot = staked + 2 * free;
  const pot = inPot + Math.max(Math.round(staked * BET.extraShare), BET.extraPerRound * duel.round);
  const winners = entries.filter((entry) => entry.side === winnerSide);
  const winningStake = winners.reduce((sum, entry) => sum + entry.amount, 0);
  const lopsided = winningStake / inPot > BET.lopsided;
  return entries.map((entry) => {
    let pays = 0;
    if (entry.side === winnerSide) {
      pays = pot * entry.amount / winningStake;
      if (!lopsided) pays = Math.max(pays, entry.amount * BET.minPayout);
      pays = Math.round(Math.min(pays, entry.amount * BET.maxPayout));
    }
    return Object.assign({ pays }, entry);
  });
}

function duelPrize(round) {
  return DUEL_PRIZE.base + DUEL_PRIZE.perRound * round;
}

function finishDuel(match, winnerSide) {
  const duel = match.duel;
  const winner = winnerSide === 'a' ? duel.a : duel.b;
  const loser = winnerSide === 'a' ? duel.b : duel.a;
  for (const player of [duel.a, duel.b]) {
    leaveDuel(player.game);
    // Duelists cash the round as if they had cleared in the middle of the pack.
    player.game.roundTime = GOLD.parTime / 2;
    endRound(player.game);
  }
  const payouts = settleBets(duel, winnerSide);
  for (const entry of payouts) entry.player.game.hero.gold += entry.pays;
  const prize = duelPrize(duel.round);
  winner.game.hero.gold += prize;
  winner.duelsWon = (winner.duelsWon || 0) + 1;
  duel.state = 'done';
  duel.result = { winner, loser, prize, time: duel.time, payouts };
  match.lastDuelists = [duel.a.index, duel.b.index];
  // Kept apart: the next duel may be announced in the same step and replace match.duel.
  match.lastDuel = duel;
}
