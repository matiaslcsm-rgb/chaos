'use strict';

// Runs the tests of tests.html outside the browser:  node tools/run-tests.js
// It loads the same scripts, in the same order, with a stand-in for the page.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const elements = {};
const makeElement = () => ({ textContent: '', className: '', children: [], append(child) { this.children.push(child); } });

const context = vm.createContext({
  console,
  document: {
    title: '',
    getElementById: (id) => elements[id] || (elements[id] = makeElement()),
    createElement: makeElement,
  },
  fetch: async (file) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) }),
});

const page = fs.readFileSync(path.join(root, 'tests.html'), 'utf8');
for (const [, file] of page.matchAll(/<script src="([^"]+)"/g)) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

vm.runInContext('testRun', context).then(() => {
  const rows = elements.results.children;
  for (const row of rows.filter((entry) => entry.className === 'fail')) console.log(row.textContent);
  console.log(elements.summary.textContent);
  process.exit(rows.some((entry) => entry.className === 'fail') || !rows.length ? 1 : 0);
});
