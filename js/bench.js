'use strict';

// The bench: computer players play whole matches alone, without drawing, and the balance is measured
// (docs/DISENO.md, section 8). Used by banco.html and by tools/bench.js. No DOM here.
// Until the waves of decision D5 exist, matches rarely end by themselves, so a match that reaches the
// round limit is ranked by the players' table (value).

const BENCH_STEP = 1 / 60;
// Alarm: an ability whose owners win too often. With 8 players, 12.5% is expected.
const BENCH_ALARM = { single: 0.22, pair: 0.3, minSeen: 50 };
const BENCH_INCOME_NAMES = { creeps: 'creeps', rounds: 'rondas', duels: 'duelos', bets: 'apuestas' };

function playBenchMatch(seed, maxRounds) {
  const match = createMatch(null, seed);
  const duels = [];
  let seen = null;
  while (!match.over && match.round < maxRounds) {
    stepMatch(match, BENCH_STEP);
    if (match.lastDuel && match.lastDuel !== seen) {
      seen = match.lastDuel;
      duels.push(seen);
    }
  }
  const winner = match.over ? match.players.find((player) => player.place === 1) : playerStanding(match)[0];
  return { match, duels, winner };
}

function createBenchTally() {
  return {
    matches: 0, abilities: new Map(), pairs: new Map(), heroes: new Map(),
    income: { creeps: 0, rounds: 0, duels: 0, bets: 0 }, endRounds: [], unfinished: 0, duels: 0, favouriteWins: 0,
    outRounds: new Map(),
  };
}

function benchCount(map, key, won) {
  const entry = map.get(key) || { seen: 0, won: 0 };
  entry.seen++;
  if (won) entry.won++;
  map.set(key, entry);
}

// Adds one played match to the tally.
function tallyBenchMatch(tally, played) {
  const { match, duels, winner } = played;
  tally.matches++;
  if (match.over) tally.endRounds.push(match.round);
  else tally.unfinished++;
  for (const player of match.players) {
    const won = player === winner;
    const keys = player.game.hero.abilities.map((ability) => ability.key).sort();
    for (const key of keys) benchCount(tally.abilities, key, won);
    for (let a = 0; a < keys.length; a++) {
      for (let b = a + 1; b < keys.length; b++) benchCount(tally.pairs, `${keys[a]} + ${keys[b]}`, won);
    }
    benchCount(tally.heroes, player.game.hero.name, won);
    if (player.outRound !== null && player.place > 1) tally.outRounds.set(player.outRound, (tally.outRounds.get(player.outRound) || 0) + 1);
    for (const source of Object.keys(tally.income)) tally.income[source] += player.game.income[source];
  }
  for (const duel of duels) {
    // The favourite as the computer bettors saw it when the duel started.
    const favourite = duel.oddsA >= 0.5 ? duel.a : duel.b;
    tally.duels++;
    if (duel.result.winner === favourite) tally.favouriteWins++;
  }
}

function benchRows(map, minSeen) {
  return [...map.entries()]
    .filter(([, entry]) => entry.seen >= minSeen)
    .map(([key, entry]) => ({ key, seen: entry.seen, rate: entry.won / entry.seen }))
    .sort((a, b) => b.rate - a.rate || b.seen - a.seen);
}

function benchPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

// The report as lines of text, in Spanish, for the console and the page.
function benchReport(tally, maxRounds) {
  const lines = [];
  const ended = tally.endRounds.length;
  const average = ended ? (tally.endRounds.reduce((a, b) => a + b, 0) / ended).toFixed(1) : null;
  lines.push(`${tally.matches} partidas, hasta la ronda ${maxRounds}.`);
  lines.push(`Terminaron solas: ${ended}${average ? ` (ronda promedio ${average})` : ''}; cortadas en la ronda ${maxRounds}: ${tally.unfinished}.`);
  const total = Object.values(tally.income).reduce((a, b) => a + b, 0) || 1;
  lines.push(`De dónde sale el oro: ${Object.entries(tally.income).map(([key, value]) => `${BENCH_INCOME_NAMES[key]} ${benchPercent(value / total)}`).join(' · ')}.`);
  lines.push(benchEliminations(tally));
  lines.push(`Duelos: ${tally.duels}; el favorito ganó ${benchPercent(tally.duels ? tally.favouriteWins / tally.duels : 0)} (meta: menos de 75%).`);
  lines.push('');
  lines.push('Héroes: veces que ganó sobre veces que jugó (se espera 12,5%).');
  for (const row of benchRows(tally.heroes, 1)) lines.push(`  ${row.key.padEnd(20)} ${benchPercent(row.rate).padStart(6)}  (${row.seen})`);
  lines.push('');
  lines.push('Las 10 habilidades que más ganan:');
  for (const row of benchRows(tally.abilities, 1).slice(0, 10)) {
    lines.push(`  ${DB.abilities[row.key].dname.padEnd(24)} ${benchPercent(row.rate).padStart(6)}  (${row.seen})`);
  }
  const alarms = benchAlarms(tally);
  lines.push('');
  if (alarms.length) {
    lines.push('ALARMA "gana sola":');
    for (const row of alarms) lines.push(`  ${row.key}: ${benchPercent(row.rate)} en ${row.seen}`);
  } else {
    lines.push(`Sin alarmas (habilidad > ${benchPercent(BENCH_ALARM.single)} o par > ${benchPercent(BENCH_ALARM.pair)}, con ${BENCH_ALARM.minSeen} apariciones o más).`);
  }
  return lines;
}

// Where players fall: Roshan's rounds, the heavy waves, and the three rounds with the most eliminations.
function benchEliminations(tally) {
  const rows = [...tally.outRounds.entries()];
  const total = rows.reduce((sum, [, count]) => sum + count, 0);
  if (!total) return 'Eliminados: ninguno.';
  const share = (test) => benchPercent(rows.filter(([round]) => test(round)).reduce((sum, [, count]) => sum + count, 0) / total);
  const top = rows.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([round, count]) => `${round} (${count})`).join(', ');
  return `Eliminados: ${total}; ${share(isRoshanRound)} en rondas de Roshan, ${share((round) => !isRoshanRound(round) && round % WAVE.heavyEvery === 0)} en oleadas pesadas. Las rondas con más: ${top}.`;
}

function benchAlarms(tally) {
  return benchRows(tally.abilities, BENCH_ALARM.minSeen).filter((row) => row.rate > BENCH_ALARM.single)
    .concat(benchRows(tally.pairs, BENCH_ALARM.minSeen).filter((row) => row.rate > BENCH_ALARM.pair));
}
