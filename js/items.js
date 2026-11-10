'use strict';

// Items: the inventory, buying and selling, their stats and their effects.
// Costs, recipes and numbers come from data/dota/items.json; what an item does beyond plain stats is in ITEM_DEFS.

const INVENTORY_SIZE = 6;
const SELL_FRACTION = 0.5;
const ITEM_HOTKEYS = ['z', 'x', 'c', 'v', 'b', 'n'];

// Values of the Dota data that are plain stats, and the stat each one gives (see recomputeStats).
const ITEM_STAT_KEYS = {
  bonus_damage: 'damage',
  bonus_armor: 'armor',
  bonus_attack_speed: 'attackSpeed',
  bonus_strength: 'str',
  bonus_agility: 'agi',
  bonus_intellect: 'int',
  bonus_movement_speed: 'boots',
  lifesteal_percent: 'lifesteal',
  spell_amp: 'spellAmp',
  mana_regen_multiplier: 'manaRegenPct',
};

function itemValue(item, key) {
  const attrib = (DB.items[item.key].attrib || []).find((entry) => entry.key === key);
  if (!attrib) throw new Error(`${item.key} has no value "${key}"`);
  return parseFloat(attrib.value);
}

// Same shape as an ability's context, so items use the same parts (status, stun, ...).
function itemContext(sim, unit, item) {
  return { sim, caster: unit, ability: item, item, target: null, point: null, v: (key) => itemValue(item, key) };
}

function isRanged(unit) {
  return unit.baseStats.projectileSpeed > 0;
}

function itemStats(unit, item) {
  const stats = {};
  for (const attrib of DB.items[item.key].attrib || []) {
    const stat = ITEM_STAT_KEYS[attrib.key];
    if (stat) stats[stat] = parseFloat(attrib.value);
  }
  if (item.def.stats) Object.assign(stats, item.def.stats(itemContext(null, unit, item)));
  return stats;
}

// ---- Buying and selling ----

function itemCost(key) {
  return DB.items[key].cost;
}

// What buying an item takes right now: the gold to pay and the owned components it uses up.
// The listed cost of a built item already includes its components and its recipe.
function purchasePlan(unit, key) {
  const left = unit.items.map((item) => item.key);
  const used = [];
  const price = (itemKey) => {
    const parts = DB.items[itemKey].components || [];
    let cost = itemCost(itemKey) - parts.reduce((sum, part) => sum + itemCost(part), 0);
    for (const part of parts) {
      const owned = left.indexOf(part);
      if (owned === -1) {
        cost += price(part);
      } else {
        left.splice(owned, 1);
        used.push(part);
      }
    }
    return cost;
  };
  return { cost: price(key), used };
}

// Why an item cannot be bought ('gold' | 'full'), or null if it can.
function buyProblem(unit, key) {
  const plan = purchasePlan(unit, key);
  if (unit.gold < plan.cost) return 'gold';
  if (unit.items.length - plan.used.length + 1 > INVENTORY_SIZE) return 'full';
  return null;
}

// Keeps health and mana at the same fraction when the maximums change, like in Dota.
function refreshInventory(unit) {
  const hp = unit.hp / unit.stats.maxHp;
  const mana = unit.stats.maxMana > 0 ? unit.mana / unit.stats.maxMana : 0;
  refreshPassives(unit);
  unit.hp = hp * unit.stats.maxHp;
  unit.mana = mana * unit.stats.maxMana;
}

function buyItem(unit, key) {
  const problem = buyProblem(unit, key);
  if (problem) return problem;
  const plan = purchasePlan(unit, key);
  for (const part of plan.used) unit.items.splice(unit.items.findIndex((item) => item.key === part), 1);
  unit.gold -= plan.cost;
  unit.items.push({ key, def: ITEM_DEFS[key] || {}, cooldown: 0 });
  refreshInventory(unit);
  return null;
}

function sellPrice(key) {
  return Math.floor(itemCost(key) * SELL_FRACTION);
}

function sellItem(unit, slot) {
  const item = unit.items[slot];
  if (!item) return false;
  unit.items.splice(slot, 1);
  unit.gold += sellPrice(item.key);
  // Whatever the item had put on its owner goes with it.
  unit.mods = unit.mods.filter((mod) => !(mod.sourceId === unit.id && mod.id.startsWith(`${item.key}:`)));
  refreshInventory(unit);
  return true;
}

// ---- Using ----

// Why an item cannot be used right now, or null if it can.
function itemProblem(unit, item) {
  if (!item.def.active) return 'passive';
  if (unit.flags.stunned) return 'stunned';
  if (item.cooldown > 0) return 'cooldown';
  if (unit.mana < (DB.items[item.key].mc || 0)) return 'mana';
  return null;
}

// The batch's active items are all instant and need no target, so they do not interrupt the hero.
function useItem(sim, unit, slot) {
  const item = unit.items[slot];
  if (!item) return 'empty';
  const problem = itemProblem(unit, item);
  if (problem) return problem;
  unit.mana -= DB.items[item.key].mc || 0;
  item.cooldown = DB.items[item.key].cd || 0;
  item.def.active(itemContext(sim, unit, item));
  pushEvent(sim, { type: 'cast', unitId: unit.id, key: item.key });
  return null;
}

// ---- What each item does beyond its stats ----

function critOnAttack(c, target, attack) {
  if (attack.crit || c.sim.rng() * 100 >= c.v('crit_chance')) return;
  attack.damage *= c.v('crit_multiplier') / 100;
  attack.crit = true;
}

// text: what the shop says about the item, besides its plain stats.
const ITEM_DEFS = {
  phase_boots: {
    text: 'Más daño (18 cuerpo a cuerpo, 12 a distancia). Activa: 3 s de más velocidad.',
    stats: (c) => ({ damage: c.v(isRanged(c.caster) ? 'bonus_damage_range' : 'bonus_damage_melee') }),
    active(c) {
      const speed = c.v(isRanged(c.caster) ? 'phase_movement_speed_range' : 'phase_movement_speed');
      status(c, c.caster, 'phase', c.v('phase_duration'), { stats: { moveSpeedPct: speed } });
    },
  },
  power_treads: {
    text: '+10 a tu atributo principal y más movimiento (55, o 45 a distancia).',
    stats: (c) => {
      const primary = c.caster.data.primary_attr;
      return {
        boots: c.v(isRanged(c.caster) ? 'bonus_movement_speed_ranged' : 'bonus_movement_speed_melee'),
        [primary === 'all' ? 'str' : primary]: c.v('bonus_stat'),
      };
    },
  },
  lesser_crit: {
    text: '30% de probabilidad de golpe crítico (160% del daño).',
    onAttackStart: critOnAttack,
  },
  greater_crit: {
    text: '30% de probabilidad de golpe crítico (225% del daño).',
    onAttackStart: critOnAttack,
  },
  black_king_bar: {
    text: 'Activa: 9 s sin que te pongan estados y con 60% menos de daño mágico.',
    active(c) {
      status(c, c.caster, 'immune', c.v('duration'), { flags: ['immune'], stats: { magicResist: c.v('spell_reduce') } });
    },
  },
  basher: {
    text: 'Tus golpes pueden aturdir 1,2 s y hacer 100 de daño extra.',
    onAttackLanded(c, target) {
      if (c.item.cooldown > 0 || target.dead) return;
      if (c.sim.rng() * 100 >= c.v(isRanged(c.caster) ? 'bash_chance_ranged' : 'bash_chance_melee')) return;
      c.item.cooldown = c.v('bash_cooldown');
      stun(c, target, c.v('bash_duration'));
      applyDamage(c.sim, c.caster, target, c.v('bonus_chance_damage'), 'physical');
    },
  },
  satanic: {
    text: 'Activa: 6 s con 145% más de robo de vida.',
    active(c) {
      status(c, c.caster, 'unholy', c.v('unholy_duration'), { stats: { lifesteal: c.v('unholy_lifesteal_percent') } });
    },
  },
  mask_of_madness: {
    text: 'Activa: 6 s de mucha más velocidad, pero silenciado y con 7 menos de armadura.',
    active(c) {
      const speed = c.v(isRanged(c.caster) ? 'berserk_bonus_movement_speed' : 'berserk_bonus_movement_speed_melee');
      status(c, c.caster, 'berserk', c.v('berserk_duration'), {
        flags: ['silenced'],
        stats: { attackSpeed: c.v('berserk_bonus_attack_speed'), moveSpeedPct: speed, armor: neg(c.v('berserk_armor_reduction')) },
      });
    },
  },
};
