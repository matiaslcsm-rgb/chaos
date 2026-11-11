'use strict';

// A match of 8: the human and 7 computer players, each in their own arena, on one shared round clock.
// Every arena is simulated for real all the time, drawn or not. No DOM here.

const MATCH_PLAYERS = 8;
// Safety net: a wave that nobody finishes in this long ends anyway, so one stuck arena cannot hold the
// other seven forever. The mod's real limit (creeps that enrage) is part of decision D5 in docs/DISENO.md.
const ROUND_LIMIT = 120;
const AI_NAMES = ['Lucía', 'Tomás', 'Valen', 'Martina', 'Joaco', 'Sofi', 'Nico', 'Cami', 'Bauti', 'Juli'];
// Decision D5, provisional: the round's prize by finishing place, like the example of the analysis (round 1:
// the fastest about 500, the slowest about 50), growing with the round.
const ROUND_PRIZE = { ladder: [500, 400, 320, 250, 190, 140, 90, 50], growth: 0.08, duelPlace: 3 };
const PLAYER_COLORS = ['#4cc35a', '#e65a46', '#4a8fe0', '#e8b04a', '#c792ea', '#5fd0c8', '#f28cb8', '#a0a8b8'];

function shuffled(rng, list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// humanHero: the hero data the human chose, or null for a match of 8 computer players (tests, the bench).
function createMatch(humanHero, seed) {
  const rng = makeRng(seed);
  const pool = shuffled(rng, batchHeroes().map((hero) => hero.data).filter((data) => data !== humanHero));
  const names = shuffled(rng, AI_NAMES);
  const players = [];
  for (let i = 0; i < MATCH_PLAYERS; i++) {
    const human = i === 0 && Boolean(humanHero);
    const heroData = human ? humanHero : pool[i % pool.length];
    const game = createGame(heroData, Math.floor(rng() * 1e9));
    players.push({
      index: i,
      name: human ? 'Vos' : names[i % names.length],
      color: PLAYER_COLORS[i],
      human,
      game,
      brain: human ? null : createBrain(game.sim.rng, heroData),
      place: null,
      outRound: null,
    });
  }
  const match = { players, rng, round: 0, phase: 'prep', timer: PREP_TIME, roundTime: 0, over: false, duel: null, lastDuelists: [] };
  for (const player of players) {
    player.game.match = match;
    player.game.payRound = (game) => roundPrize(match, game);
  }
  return match;
}

function humanPlayer(match) {
  return match.players.find((player) => player.human) || null;
}

function playersAlive(match) {
  return match.players.filter((player) => player.game.phase !== 'lost');
}

// What a player is worth: gold plus what their items cost. The players' table is sorted by it.
function playerValue(player) {
  const hero = player.game.hero;
  return hero.gold + hero.items.reduce((sum, item) => sum + itemCost(item.key), 0);
}

function playerStanding(match) {
  return match.players.slice().sort((a, b) => {
    if ((a.place === null) !== (b.place === null)) return a.place === null ? -1 : 1;
    if (a.place !== null) return a.place - b.place;
    return playerValue(b) - playerValue(a);
  });
}

// Where a player stands in the round: 'fight' | 'duel' | 'done' (finished, waiting for the rest) |
// 'prep' | 'nextDuel' (fights the duel of the coming round) | 'out'.
function playerState(match, player) {
  if (player.game.phase === 'lost') return 'out';
  if (player.game.phase === 'duel') return 'duel';
  if (match.phase === 'fight') return player.game.phase === 'fight' ? 'fight' : 'done';
  return match.duel && match.duel.state === 'betting' && isDuelist(match.duel, player) ? 'nextDuel' : 'prep';
}

function stillPlaying(game) {
  return game.phase === 'fight' || game.phase === 'duel';
}

// Whoever falls gets the worst place still free; players who fall in the same step share the round.
function markEliminated(match) {
  const fallen = match.players.filter((player) => player.game.phase === 'lost' && player.place === null);
  if (!fallen.length) return;
  const placeLeft = match.players.filter((player) => player.place === null).length;
  for (const player of fallen) {
    player.place = placeLeft;
    player.outRound = match.round;
    // The mod empties the gold of whoever is knocked out.
    player.game.hero.gold = 0;
  }
  const alive = playersAlive(match);
  if (alive.length <= 1) {
    match.over = true;
    if (alive.length === 1) alive[0].place = 1;
    // The last ones fell in the very same moment: they share the win.
    else for (const player of fallen) player.place = 1;
  }
}

// What the round pays: by finishing place among the arenas; duelists as in the middle; a wave ended by the
// time limit as the last place.
function roundPrize(match, game) {
  let place;
  if (game.phase === 'duel') place = ROUND_PRIZE.duelPlace;
  else if (game.forcedEnd) place = ROUND_PRIZE.ladder.length - 1;
  else place = match.finished++;
  const ladder = ROUND_PRIZE.ladder;
  return Math.round(ladder[Math.min(place, ladder.length - 1)] * (1 + ROUND_PRIZE.growth * (match.round - 1)));
}

function startMatchRound(match) {
  match.round++;
  match.finished = 0;
  match.roundTime = 0;
  match.phase = 'fight';
  const duel = match.duel && match.duel.state === 'betting' ? match.duel : null;
  if (duel) startDuel(match);
  for (const player of playersAlive(match)) {
    if (!isDuelist(duel, player)) startRound(player.game);
  }
}

// The break between rounds; the duel of the coming round is announced and the break is longer.
function startBreak(match) {
  match.phase = 'prep';
  match.timer = PREP_TIME;
  if (duelRoundFor(match) && announceDuel(match)) match.timer = DUEL_PREP_TIME;
}

// A wave that ran past the limit: its creeps leave and the round counts as cleared (slowest of all).
function forceEndRound(game) {
  for (const unit of game.sim.units) {
    if (unit.kind === 'creep') unit.dead = true;
  }
  game.forcedEnd = true;
  endRound(game);
  game.forcedEnd = false;
}

function stepMatch(match, dt) {
  if (match.over) return;
  const human = humanPlayer(match);
  // The human's draft opens between rounds and the whole match waits for it, as in a solo game.
  if (human && match.phase === 'prep' && human.game.phase !== 'lost' && !human.game.draft && draftsDue(human.game) > 0) {
    openDraft(human.game);
  }
  if (human && human.game.draft) return;

  for (const player of playersAlive(match)) {
    const game = player.game;
    // The two duelists are moved by the duel, in their shared arena.
    if (game.phase === 'duel') continue;
    // Computer players choose at the same moment as the human: when the round is over for everyone.
    if (!player.human && match.phase === 'prep' && !game.draft && draftsDue(game) > 0) openDraft(game);
    if (player.brain) aiStep(game, player.brain, dt);
    if (player.brain && match.duel && match.duel.state === 'betting' && match.phase === 'prep') aiBet(match, player);
    stepArena(game, dt);
    // Nobody draws the rivals' arenas, so what happened there for the screen is dropped.
    if (!player.human) game.sim.events.length = 0;
  }
  markEliminated(match);
  if (match.over) return;

  if (match.phase === 'prep') {
    match.timer -= dt;
    if (match.timer <= 0) startMatchRound(match);
  } else {
    stepRoundEnd(match, dt);
  }
  // Every arena shows the match's clock.
  for (const player of match.players) player.game.timer = match.timer;
}

// During a round: the time limit, and back to the shop once every arena is done.
function stepRoundEnd(match, dt) {
  stepDuel(match, dt);
  match.roundTime += dt;
  if (match.roundTime >= ROUND_LIMIT) {
    for (const player of playersAlive(match)) {
      if (player.game.phase === 'fight') forceEndRound(player.game);
    }
  }
  if (!playersAlive(match).some((player) => stillPlaying(player.game))) startBreak(match);
}
