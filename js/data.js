'use strict';

// Loads the Dota reference data and the current batch. No game rules here.

const DB = { heroes: {}, abilities: {}, heroAbilities: {}, items: {}, batch: null };

async function loadJson(file) {
  const response = await fetch(file);
  if (!response.ok) throw new Error(`${file}: ${response.status}`);
  return response.json();
}

async function loadDB() {
  const [heroes, abilities, heroAbilities, items, batch] = await Promise.all([
    loadJson('data/dota/heroes.json'),
    loadJson('data/dota/abilities.json'),
    loadJson('data/dota/hero_abilities.json'),
    loadJson('data/dota/items.json'),
    loadJson('data/batch1.json'),
  ]);
  // heroes.json is keyed by numeric id; the rest of the data uses the npc_dota_hero_* name.
  for (const hero of Object.values(heroes)) DB.heroes[hero.name] = hero;
  DB.abilities = abilities;
  DB.heroAbilities = heroAbilities;
  DB.items = items;
  DB.batch = batch;
}

// The heroes of the current batch, with their draftable abilities resolved.
function batchHeroes() {
  return DB.batch.heroes.map((entry) => ({
    data: DB.heroes[entry.key],
    abilities: entry.abilities.map((key) => Object.assign({ key }, DB.abilities[key])),
  }));
}

function heroByName(localizedName) {
  return Object.values(DB.heroes).find((hero) => hero.localized_name === localizedName);
}
