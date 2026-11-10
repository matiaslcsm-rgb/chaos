'use strict';

// Sorts every draftable Dota ability by how hard it is to build from parts.
// It guesses the parts from the ability's description and value names, so the result is a first pass
// to plan batches with, not a spec. Usage: node tools/classify.js  (writes data/classification.json)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const load = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dota', `${name}.json`), 'utf8'));

// Each part: [id, level, pattern]. Level 1 = basic, 2 = needs extra engine work, 3 = needs custom code.
const PARTS = [
  ['damage', 1, /\bdamage\b|\bdmg\b/],
  ['damage_over_time', 1, /damage per second|per second|damage over time|\bdps\b|burn_damage|tick/],
  ['heal', 1, /\bheal|restor(es|ing) health|health_regen|hp_regen/],
  ['stun', 1, /\bstun/],
  ['slow', 1, /\bslow|movement_slow|move_slow/],
  ['root', 1, /\broot|entangle|ensnare/],
  ['silence', 1, /\bsilenc/],
  ['disarm', 1, /\bdisarm/],
  ['armor', 1, /\barmor\b/],
  ['magic_resist', 1, /magic resist|magic_resist|spell resist/],
  ['attack_speed', 1, /attack speed|attack_speed|attackspeed/],
  ['move_speed', 1, /movement speed|move speed|movespeed|move_speed|movement_speed/],
  ['stat_bonus', 1, /bonus_(str|agi|int|all)|\bstrength\b|\bagility\b|\bintelligence\b/],
  ['attack_damage', 1, /bonus damage|bonus_damage|attack damage/],
  ['crit', 1, /critical|\bcrit/],
  ['lifesteal', 1, /lifesteal|life steal/],
  ['evasion', 1, /\bevasion|\bevade|\bmiss\b|miss_chance|\bblind/],
  ['on_hit_chance', 1, /chance to|_chance\b|chance_pct/],
  ['splash', 1, /cleave|splash/],
  ['mana', 1, /mana burn|burns? .* mana|mana drain|restores? mana|mana_restore|mana per hit|mana_per_hit/],
  ['shield', 1, /\bbarrier|\bshield|damage block|absorb/],
  ['area', 1, /\bradius\b|\barea\b|\baoe\b|nearby enem/],
  ['aura', 1, /\baura\b/],
  ['bounce', 2, /bounce|jump_count|\bjumps?\b|leaps? (through|between)|chain/],
  ['knockback', 2, /knock|push(es|ed|ing)? |pull(s|ed|ing)? |drag|hurl|toss|throw/],
  ['blink', 2, /\bblink|teleport|leap|\bdash|charges? (toward|at|to)|rush/],
  ['invisibility', 2, /invisib/],
  ['dispel', 2, /dispel|purge/],
  ['immunity', 2, /immun|invulnerab/],
  ['hex', 2, /\bhex|transforms? (the|an) (enemy|target)|into a (frog|pig|critter|sheep)/],
  ['fear_taunt', 2, /\bfear|taunt|forced? to attack/],
  ['reflect', 2, /reflect|return(s|ed)? .*damage|damage return/],
  ['execute', 2, /instantly kill|kills? .* below|health threshold|kill_threshold/],
  ['stacks', 2, /\bstack/],
  ['summon', 2, /summon|spawns?\b|\bward\b|creates? an?\b|raises?\b|skeleton|spiderling|treant|wolves|familiar/],
  ['illusion', 3, /illusion|\bimage/],
  ['transform', 3, /transforms? into|\bform\b|metamorph|shapeshift|true form|changes? .* attack type/],
  ['spell_steal', 3, /steal(s|ing)? (the |a )?(spell|abilit)|cop(y|ies) (the |a )?(spell|abilit)/],
  ['terrain', 3, /terrain|\bwall\b|impassable|\btrees?\b|\bcliff/],
  ['tether', 3, /tether|\blink(s|ed)?\b|\bleash/],
  ['time', 3, /rewind|back in time|time lapse|freez(e|es|ing) time|chronosphere|stops? time/],
  ['control', 3, /takes? control|dominat|enchant|convert/],
  ['global', 3, /global|anywhere on the map|across the map/],
];

const LEVEL_NAMES = { 1: 'simple', 2: 'media', 3: 'difícil' };

function classify(key, ability) {
  const behavior = [].concat(ability.behavior || []);
  const attribs = (ability.attrib || []).map((a) => `${a.key} ${a.header || ''}`).join(' ');
  const text = `${ability.desc || ''} ${attribs}`.toLowerCase();

  const parts = PARTS.filter(([, , pattern]) => pattern.test(text)).map(([id]) => id);
  let level = Math.max(0, ...PARTS.filter(([id]) => parts.includes(id)).map(([, lvl]) => lvl));

  // How it is cast adds its own work.
  const cast = behavior.includes('Passive') ? 'passive'
    : behavior.includes('Channeled') ? 'channel'
      : behavior.includes('Autocast') || behavior.includes('Attack Modifier') ? 'attack_modifier'
        : behavior.includes('Point Target') ? 'point'
          : behavior.includes('Unit Target') ? 'unit'
            : 'no_target';
  if (cast === 'channel' && level < 2) level = 2;

  return {
    key,
    name: ability.dname,
    cast,
    parts,
    difficulty: level ? LEVEL_NAMES[level] : 'sin clasificar',
  };
}

function main() {
  const heroes = load('heroes');
  const abilities = load('abilities');
  const heroAbilities = load('hero_abilities');

  const result = { heroes: {}, totals: {}, partCounts: {} };
  for (const hero of Object.values(heroes)) {
    const list = [];
    for (const key of heroAbilities[hero.name].abilities) {
      const ability = abilities[key];
      const behavior = [].concat((ability && ability.behavior) || []);
      // Draftable = a real, visible, non-innate hero ability.
      if (!ability || !ability.dname || !behavior.length || behavior.includes('Hidden') || ability.is_innate) continue;
      const entry = classify(key, ability);
      list.push(entry);
      result.totals[entry.difficulty] = (result.totals[entry.difficulty] || 0) + 1;
      for (const part of entry.parts) result.partCounts[part] = (result.partCounts[part] || 0) + 1;
    }
    result.heroes[hero.localized_name] = {
      attr: hero.primary_attr,
      attack: hero.attack_type,
      simple: list.filter((a) => a.difficulty === 'simple').length,
      abilities: list,
    };
  }

  fs.writeFileSync(path.join(ROOT, 'data', 'classification.json'), `${JSON.stringify(result, null, 1)}\n`);

  const total = Object.values(result.totals).reduce((a, b) => a + b, 0);
  console.log(`Draftable abilities: ${total}`, result.totals);
  console.log('Parts:', Object.entries(result.partCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
  console.log('\nHeroes whose whole kit is simple:');
  for (const [name, hero] of Object.entries(result.heroes)) {
    if (hero.abilities.length >= 4 && hero.simple === hero.abilities.length) {
      console.log(`  ${name} (${hero.attr}, ${hero.attack}): ${hero.abilities.map((a) => a.name).join(', ')}`);
    }
  }
  console.log('\nHeroes with exactly one non-simple ability:');
  for (const [name, hero] of Object.entries(result.heroes)) {
    if (hero.abilities.length >= 4 && hero.simple === hero.abilities.length - 1) {
      const odd = hero.abilities.find((a) => a.difficulty !== 'simple');
      console.log(`  ${name} (${hero.attr}, ${hero.attack}): ${odd.name} -> ${odd.difficulty} [${odd.parts.join(' ')}]`);
    }
  }
}

main();
