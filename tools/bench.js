'use strict';

// The bench in the console:  node tools/bench.js [matches] [max rounds] [first seed]
// Same as banco.html (the work is in js/bench.js), without opening the browser.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const context = vm.createContext({
  console,
  fetch: async (file) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) }),
});
// The same scripts as banco.html, in its order (its inline script needs the DOM and is left out).
const page = fs.readFileSync(path.join(root, 'banco.html'), 'utf8');
for (const [, file] of page.matchAll(/<script src="([^"]+)"/g)) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

const MATCHES = Number(process.argv[2] || 20);
const MAX_ROUNDS = Number(process.argv[3] || 30);
const FIRST_SEED = Number(process.argv[4] || 1);

vm.runInContext('loadDB()', context).then(() => {
  const started = Date.now();
  const tally = context.createBenchTally();
  for (let i = 0; i < MATCHES; i++) {
    const played = context.playBenchMatch(FIRST_SEED + i, MAX_ROUNDS);
    context.tallyBenchMatch(tally, played);
    const how = played.match.over ? `terminó en la ronda ${played.match.round}` : `cortada en la ronda ${played.match.round}`;
    console.log(`partida ${i + 1}/${MATCHES}: ${how}, ganó ${played.winner.game.hero.name}`);
  }
  console.log(`\n${context.benchReport(tally, MAX_ROUNDS).join('\n')}`);
  console.log(`\nTardó ${((Date.now() - started) / 1000).toFixed(0)} s.`);
});
