'use strict';

// Browser for the raw Dota data in data/dota/. Read-only: the game does not load this file.
// Everything from the JSON goes through textContent, never innerHTML.

const DATA_FILES = ['heroes', 'abilities', 'hero_abilities', 'items'];
const ATTR_NAMES = { str: 'Fuerza', agi: 'Agilidad', int: 'Inteligencia', all: 'Universal' };
const ATTR_ORDER = ['str', 'agi', 'int', 'all'];

const data = {};
let tab = 'heroes';
let selected = null;

const listEl = document.getElementById('list');
const detailEl = document.getElementById('detail');
const searchEl = document.getElementById('search');
const countEl = document.getElementById('count');

function el(tag, props, children) {
  const node = document.createElement(tag);
  Object.assign(node, props || {});
  for (const child of [].concat(children || [])) {
    node.append(child);
  }
  return node;
}

// Values come as a string or as one string per level.
function levels(value) {
  return Array.isArray(value) ? value.join(' / ') : String(value);
}

function statRow(label, value) {
  return el('div', null, [el('span', { textContent: label }), el('span', { textContent: String(value) })]);
}

function heroList() {
  return Object.values(data.heroes).sort((a, b) => a.localized_name.localeCompare(b.localized_name));
}

function itemList() {
  return Object.entries(data.items)
    .filter(([key, item]) => item.cost > 0 && item.dname && !key.startsWith('recipe_'))
    .map(([key, item]) => Object.assign({ key }, item))
    .sort((a, b) => a.cost - b.cost);
}

function heroAbilities(hero) {
  const entry = data.hero_abilities[hero.name] || { abilities: [] };
  return entry.abilities
    .map((key) => Object.assign({ key }, data.abilities[key]))
    .filter((ability) => ability.dname && ability.key !== 'generic_hidden');
}

function abilityCard(ability) {
  const behavior = [].concat(ability.behavior || []);
  const title = el('h4', { textContent: ability.dname });
  if (ability.is_innate) title.append(el('span', { className: 'tag', textContent: 'Innata' }));
  if (behavior.includes('Hidden')) title.append(el('span', { className: 'tag', textContent: 'Oculta' }));

  const rows = [];
  const addRow = (label, value, generated) => {
    const row = el('tr', { className: generated ? 'generated' : '' }, [
      el('td', { textContent: label }),
      el('td', { textContent: value }),
    ]);
    rows.push(row);
  };
  if (behavior.length) addRow('TIPO:', behavior.filter((b) => b !== 'Hidden').join(', '));
  if (ability.dmg_type) addRow('DAÑO:', ability.dmg_type);
  if (ability.bkbpierce) addRow('ATRAVIESA BKB:', ability.bkbpierce);
  if (ability.cd) addRow('ENFRIAMIENTO:', levels(ability.cd));
  if (ability.mc) addRow('MANÁ:', levels(ability.mc));
  for (const attrib of ability.attrib || []) {
    addRow(attrib.header || attrib.key, levels(attrib.value), attrib.generated);
  }

  return el('div', { className: 'card' }, [
    title,
    el('p', { className: 'muted', textContent: ability.key }),
    el('p', { textContent: ability.desc || '' }),
    el('table', null, rows),
  ]);
}

function showHero(hero) {
  const abilities = heroAbilities(hero);
  const title = el('h2', { textContent: hero.localized_name });
  title.append(el('span', { className: `tag ${hero.primary_attr}`, textContent: ATTR_NAMES[hero.primary_attr] }));
  detailEl.replaceChildren(
    title,
    el('p', { className: 'muted', textContent: `${hero.attack_type} · ${hero.roles.join(', ')}` }),
    el('div', { className: 'stats' }, [
      statRow('Fuerza', `${hero.base_str} +${hero.str_gain}`),
      statRow('Agilidad', `${hero.base_agi} +${hero.agi_gain}`),
      statRow('Inteligencia', `${hero.base_int} +${hero.int_gain}`),
      statRow('Vida base', hero.base_health),
      statRow('Maná base', hero.base_mana),
      statRow('Daño base', `${hero.base_attack_min}-${hero.base_attack_max}`),
      statRow('Armadura base', hero.base_armor),
      statRow('Resistencia mágica', `${hero.base_mr}%`),
      statRow('Alcance', hero.attack_range),
      statRow('Tiempo de ataque', hero.attack_rate),
      statRow('Velocidad', hero.move_speed),
      statRow('Proyectil', hero.projectile_speed || 'cuerpo a cuerpo'),
    ]),
    el('h3', { textContent: `Habilidades (${abilities.length})` }),
    ...abilities.map(abilityCard),
  );
}

function showItem(item) {
  const cards = (item.abilities || []).map((ability) => el('div', { className: 'card' }, [
    el('h4', { textContent: ability.title }, el('span', { className: 'tag', textContent: ability.type })),
    el('p', { textContent: ability.description }),
  ]));
  const stats = [statRow('Costo', item.cost)];
  if (item.cd) stats.push(statRow('Enfriamiento', levels(item.cd)));
  if (item.mc) stats.push(statRow('Maná', levels(item.mc)));
  for (const attrib of item.attrib || []) {
    const text = attrib.display ? attrib.display.replace('{value}', levels(attrib.value)) : levels(attrib.value);
    stats.push(statRow(attrib.display ? '' : attrib.key, text));
  }
  const components = (item.components || []).map((key) => {
    const part = data.items[key];
    return part ? `${part.dname} (${part.cost})` : key;
  });
  const recipe = data.items[`recipe_${item.key}`];
  if (components.length && recipe && recipe.cost > 0) components.push(`Receta (${recipe.cost})`);

  detailEl.replaceChildren(
    el('h2', { textContent: item.dname }),
    el('p', { className: 'muted', textContent: item.key }),
    el('div', { className: 'stats' }, stats),
    el('h3', { textContent: components.length ? 'Se arma con' : 'Ítem básico' }),
    el('p', { textContent: components.join(' + ') }),
    ...cards,
    el('p', { className: 'muted', textContent: item.notes || '' }),
  );
}

function renderList() {
  const query = searchEl.value.trim().toLowerCase();
  const rows = [];
  let count = 0;

  const addRow = (entry, label, extra, show) => {
    const row = el('li', { className: entry === selected ? 'active' : '' }, [
      el('span', { textContent: label }),
      el('span', { className: 'muted', textContent: extra }),
    ]);
    row.addEventListener('click', () => {
      selected = entry;
      show(entry);
      renderList();
    });
    rows.push(row);
    count++;
  };

  if (tab === 'heroes') {
    // A hero also matches when one of its abilities does.
    const matches = (hero) => !query
      || hero.localized_name.toLowerCase().includes(query)
      || heroAbilities(hero).some((ability) => ability.dname.toLowerCase().includes(query));
    for (const attr of ATTR_ORDER) {
      const group = heroList().filter((hero) => hero.primary_attr === attr && matches(hero));
      if (!group.length) continue;
      rows.push(el('li', { className: 'group', textContent: `${ATTR_NAMES[attr]} (${group.length})` }));
      for (const hero of group) addRow(hero, hero.localized_name, hero.attack_type === 'Melee' ? '' : 'rango', showHero);
    }
  } else {
    for (const item of itemList()) {
      if (query && !item.dname.toLowerCase().includes(query)) continue;
      addRow(item, item.dname, item.cost, showItem);
    }
  }

  listEl.replaceChildren(...rows);
  countEl.textContent = `${count} ${tab === 'heroes' ? 'héroes' : 'ítems'}`;
}

function setTab(next) {
  tab = next;
  selected = null;
  searchEl.value = '';
  for (const button of document.querySelectorAll('#tabs button')) {
    button.classList.toggle('active', button.dataset.tab === tab);
  }
  detailEl.replaceChildren(el('p', { className: 'muted', textContent: 'Elegí uno de la lista.' }));
  renderList();
}

async function loadData() {
  try {
    await Promise.all(DATA_FILES.map(async (name) => {
      const response = await fetch(`data/dota/${name}.json`);
      if (!response.ok) throw new Error(`${name}.json: ${response.status}`);
      data[name] = await response.json();
    }));
  } catch (error) {
    detailEl.replaceChildren(el('p', {
      textContent: `No se pudieron cargar los datos (${error.message}). Abrí la página desde el servidor local, no con doble clic.`,
    }));
    return;
  }
  setTab('heroes');
}

for (const button of document.querySelectorAll('#tabs button')) {
  button.addEventListener('click', () => setTab(button.dataset.tab));
}
searchEl.addEventListener('input', renderList);

loadData();
