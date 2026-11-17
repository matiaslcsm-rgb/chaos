'use strict';

// Aghanim's Scepter and Shard (user's decision 2026-11-17): they upgrade only the abilities that have an upgrade of
// their own in Dota, whoever owns them. When the upgrade is a new ability (Ogre Magi's scepter: Unrefined Fireblast),
// whoever has the "parent" ability gets it. The scepter is an item (4.200, it takes a slot and gives its stats);
// the shard is used up on buying (1.400). What each upgrade does is in the ability's code (abilityDefs.js), which
// asks hasScepter / hasShard; `scepter` and `shard` there are the texts. No DOM here.

const SCEPTER = 'ultimate_scepter';
const SHARD = 'aghanims_shard';

function hasScepter(unit) {
  return Boolean(unit.items) && unit.items.some((item) => item.key === SCEPTER);
}

function hasShard(unit) {
  return Boolean(unit.shard);
}

// Abilities an upgrade adds: key -> the ability that must be owned and what gives it.
const GRANTED_ABILITIES = {
  ogre_magi_unrefined_fireblast: { parent: 'ogre_magi_fireblast', by: 'scepter' },
};

ABILITY_DEFS.ogre_magi_unrefined_fireblast = {
  cast: 'unit',
  granted: true,
  maxLevel: 1,
  // It costs 35% of the mana Ogre Magi has at the moment.
  manaCost: (unit) => unit.mana * abilityValue({ key: 'ogre_magi_unrefined_fireblast', level: 1 }, 'scepter_mana') / 100,
  hit(c) {
    fxRing(c, c.target, 80, FX.fire);
    spellDamage(c, c.target, c.v('base_damage') + c.v('str_multiplier') * (c.caster.stats.str || 0));
    stun(c, c.target, c.v('stun_duration'));
  },
};

// Adds or removes the abilities upgrades give, at the end of the bar. A given ability is learned while its parent is.
function syncGrantedAbilities(unit) {
  if (!unit.abilities) return;
  for (const [key, grant] of Object.entries(GRANTED_ABILITIES)) {
    const parent = unit.abilities.find((ability) => ability.key === grant.parent);
    const wanted = Boolean(parent) && (grant.by === 'scepter' ? hasScepter(unit) : hasShard(unit));
    const index = unit.abilities.findIndex((ability) => ability.key === key);
    if (wanted && index === -1) unit.abilities.push(newAbility(key));
    if (!wanted && index !== -1) unit.abilities.splice(index, 1);
    const granted = unit.abilities.find((ability) => ability.key === key);
    if (granted) granted.level = parent.level > 0 ? 1 : 0;
  }
}

// The abilities of this hero that the scepter (kind 'scepter') or the shard ('shard') upgrades.
function aghanimUpgrades(hero, kind) {
  return hero.abilities.filter((ability) => ability.def[kind]).map((ability) => ability.key);
}

// Why the shard cannot be bought ('closed' | 'gold' | 'owned'), or null if it can.
function shardBuyProblem(game) {
  if (!shopOpen(game)) return 'closed';
  if (hasShard(game.hero)) return 'owned';
  if (game.hero.gold < itemCost(SHARD)) return 'gold';
  return null;
}

function buyShard(game) {
  const problem = shardBuyProblem(game);
  if (problem) return problem;
  game.hero.gold -= itemCost(SHARD);
  game.hero.shard = true;
  refreshInventory(game.hero);
  return null;
}
