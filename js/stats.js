'use strict';

// Dota 2 attribute formulas. Pure functions, no state.

const HP_PER_STR = 22;
const HP_REGEN_PER_STR = 0.1;
const MANA_PER_INT = 12;
const MANA_REGEN_PER_INT = 0.05;
const MAGIC_RESIST_PER_INT = 0.1;
const ARMOR_PER_AGI = 1 / 6;
const ATTACK_SPEED_PER_AGI = 1;
const UNIVERSAL_DAMAGE_PER_ATTR = 0.45;
const MIN_ATTACK_SPEED = 20;
const MAX_ATTACK_SPEED = 700;
const ARMOR_FACTOR = 0.06;

// Fraction of physical damage that gets through a given armor value.
function armorMultiplier(armor) {
  return 1 - (ARMOR_FACTOR * armor) / (1 + ARMOR_FACTOR * Math.abs(armor));
}

// Turns base attack time, attack point and attack speed into seconds.
function attackTiming(baseAttackTime, attackPoint, attackSpeed) {
  const speed = Math.min(MAX_ATTACK_SPEED, Math.max(MIN_ATTACK_SPEED, attackSpeed)) / 100;
  return { attackInterval: baseAttackTime / speed, attackPoint: attackPoint / speed };
}

function heroStats(hero, level) {
  const ups = level - 1;
  const str = hero.base_str + hero.str_gain * ups;
  const agi = hero.base_agi + hero.agi_gain * ups;
  const int = hero.base_int + hero.int_gain * ups;
  const attrDamage = hero.primary_attr === 'all'
    ? (str + agi + int) * UNIVERSAL_DAMAGE_PER_ATTR
    : { str, agi, int }[hero.primary_attr];
  // In the data, base_attack_time is the base attack speed (100) and attack_rate is the BAT in seconds.
  const attackSpeed = hero.base_attack_time + agi * ATTACK_SPEED_PER_AGI;

  return Object.assign({
    str,
    agi,
    int,
    maxHp: hero.base_health + str * HP_PER_STR,
    hpRegen: hero.base_health_regen + str * HP_REGEN_PER_STR,
    maxMana: hero.base_mana + int * MANA_PER_INT,
    manaRegen: hero.base_mana_regen + int * MANA_REGEN_PER_INT,
    armor: hero.base_armor + agi * ARMOR_PER_AGI,
    magicResist: hero.base_mr + int * MAGIC_RESIST_PER_INT,
    damageMin: hero.base_attack_min + attrDamage,
    damageMax: hero.base_attack_max + attrDamage,
    attackSpeed,
    attackRange: hero.attack_range,
    projectileSpeed: hero.attack_type === 'Ranged' ? hero.projectile_speed : 0,
    moveSpeed: hero.move_speed,
  }, attackTiming(hero.attack_rate, hero.attack_point, attackSpeed));
}
