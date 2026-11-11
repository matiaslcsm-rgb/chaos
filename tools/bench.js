'use strict';

// The bench: computer players play whole matches alone, without drawing, and the balance is measured.
//   node tools/bench.js [matches] [max rounds] [first seed]
// See docs/DISENO.md, section 8. Until the waves of decision D5 exist, matches rarely end by themselves,
// so a match that reaches the round limit is ranked by the players' table (value).

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const SCRIPTS = ['data', 'stats', 'sim', 'abilities', 'abilityDefs', 'items', 'game', 'ai', 'match', 'duel'];
const context = vm.createContext({
  console,
  fetch: async (file) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) }),
});
for (const name of SCRIPTS) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', `${name}.js`), 'utf8'), context, { filename: `js/${name}.js` });
}

const MATCHES = Number(process.argv[2] || 20);
const MAX_ROUNDS = Number(process.argv[3] || 30);
const FIRST_SEED = Number(process.argv[4] || 1);
const STEP = 1 / 60;
const INCOME_NAMES = { creeps: 'creeps', rounds: 'rondas', duels: 'duelos', bets: 'apuestas' };
// Alarm: an ability whose owners win too often (docs/DISENO.md): with 8 players, 12.5% is expected.
const ALARM = { single: 0.22, pair: 0.3, minSeen: 50 };

function playMatch(seed) {
  const match = context.createMatch(null, seed);
  const duels = [];
  let seen = null;
  while (!match.over && match.round < MAX_ROUNDS) {
    context.stepMatch(match, STEP);
    const duel = match.lastDuel;
    if (duel && duel !== seen) {
      seen = duel;
      duels.push(duel);
    }
  }
  return { match, duels, ended: match.over };
}

function winnerOf(match) {
  return match.over ? match.players.find((player) => player.place === 1) : context.playerStanding(match)[0];
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function main() {
  const started = Date.now();
  const abilities = new Map();
  const pairs = new Map();
  const heroes = new Map();
  const income = { creeps: 0, rounds: 0, duels: 0, bets: 0 };
  const endRounds = [];
  let unfinished = 0;
  let duelCount = 0;
  let favouriteWins = 0;
  const count = (map, key, won) => {
    const entry = map.get(key) || { seen: 0, won: 0 };
    entry.seen++;
    if (won) entry.won++;
    map.set(key, entry);
  };

  for (let i = 0; i < MATCHES; i++) {
    const { match, duels, ended } = playMatch(FIRST_SEED + i);
    if (ended) endRounds.push(match.round);
    else unfinished++;
    const winner = winnerOf(match);
    for (const player of match.players) {
      const won = player === winner;
      const keys = player.game.hero.abilities.map((ability) => ability.key).sort();
      for (const key of keys) count(abilities, key, won);
      for (let a = 0; a < keys.length; a++) {
        for (let b = a + 1; b < keys.length; b++) count(pairs, `${keys[a]} + ${keys[b]}`, won);
      }
      count(heroes, player.game.hero.name, won);
      for (const source of Object.keys(income)) income[source] += player.game.income[source];
    }
    for (const duel of duels) {
      // The favourite, as the computer bettors saw it when the duel started.
      const favourite = duel.oddsA >= 0.5 ? duel.a : duel.b;
      duelCount++;
      if (duel.result.winner === favourite) favouriteWins++;
    }
    process.stdout.write(`partida ${i + 1}/${MATCHES}: ${ended ? `terminó en la ronda ${match.round}` : `cortada en la ronda ${match.round}`}, ganó ${winner.game.hero.name}\n`);
  }

  const rows = (map, minSeen) => [...map.entries()]
    .filter(([, entry]) => entry.seen >= minSeen)
    .map(([key, entry]) => ({ key, seen: entry.seen, rate: entry.won / entry.seen }))
    .sort((a, b) => b.rate - a.rate);

  console.log(`\n${MATCHES} partidas, hasta la ronda ${MAX_ROUNDS}, en ${((Date.now() - started) / 1000).toFixed(0)} s`);
  console.log(`Terminaron solas: ${endRounds.length}${endRounds.length ? ` (ronda promedio ${(endRounds.reduce((a, b) => a + b, 0) / endRounds.length).toFixed(1)})` : ''}; cortadas: ${unfinished}`);
  const totalIncome = Object.values(income).reduce((a, b) => a + b, 0) || 1;
  console.log(`De dónde sale el oro: ${Object.entries(income).map(([key, value]) => `${INCOME_NAMES[key]} ${percent(value / totalIncome)}`).join(' · ')}`);
  console.log(`Duelos: ${duelCount}, el favorito ganó ${percent(duelCount ? favouriteWins / duelCount : 0)} (meta: menos de 75%)`);

  console.log('\nHéroes (veces que ganó / veces que jugó; se espera 12,5%):');
  for (const row of rows(heroes, 1)) console.log(`  ${row.key.padEnd(20)} ${percent(row.rate).padStart(6)}  (${row.seen})`);
  console.log('\nHabilidades que más ganan:');
  for (const row of rows(abilities, 1).slice(0, 10)) console.log(`  ${row.key.padEnd(36)} ${percent(row.rate).padStart(6)}  (${row.seen})`);

  const alarms = rows(abilities, ALARM.minSeen).filter((row) => row.rate > ALARM.single)
    .concat(rows(pairs, ALARM.minSeen).filter((row) => row.rate > ALARM.pair));
  console.log(alarms.length
    ? `\nALARMA "gana sola":\n${alarms.map((row) => `  ${row.key}: ${percent(row.rate)} en ${row.seen}`).join('\n')}`
    : `\nSin alarmas (habilidad > ${percent(ALARM.single)} o par > ${percent(ALARM.pair)}, con ${ALARM.minSeen} apariciones o más).`);
}

vm.runInContext('loadDB()', context).then(main);
