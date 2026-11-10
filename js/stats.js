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

// What a hero gets from its attribute points. Shared by the base stats and by item bonuses.
function attributeStats(primaryAttr, str, agi, int) {
  return {
    maxHp: str * HP_PER_STR,
    hpRegen: str * HP_REGEN_PER_STR,
    maxMana: int * MANA_PER_INT,
    manaRegen: int * MANA_REGEN_PER_INT,
    magicResist: int * MAGIC_RESIST_PER_INT,
    armor: agi * ARMOR_PER_AGI,
    attackSpeed: agi * ATTACK_SPEED_PER_AGI,
    damage: primaryAttr === 'all' ? (str + agi + int) * UNIVERSAL_DAMAGE_PER_ATTR : { str, agi, int }[primaryAttr],
  };
}

function heroStats(hero, level) {
  const ups = level - 1;
  const str = hero.base_str + hero.str_gain * ups;
  const agi = hero.base_agi + hero.agi_gain * ups;
  const int = hero.base_int + hero.int_gain * ups;
  const fromAttrs = attributeStats(hero.primary_attr, str, agi, int);
  // In the data, base_attack_time is the base attack speed (100) and attack_rate is the BAT in seconds.
  const attackSpeed = hero.base_attack_time + fromAttrs.attackSpeed;

  return Object.assign({
    str,
    agi,
    int,
    maxHp: hero.base_health + fromAttrs.maxHp,
    hpRegen: hero.base_health_regen + fromAttrs.hpRegen,
    maxMana: hero.base_mana + fromAttrs.maxMana,
    manaRegen: hero.base_mana_regen + fromAttrs.manaRegen,
    armor: hero.base_armor + fromAttrs.armor,
    magicResist: hero.base_mr + fromAttrs.magicResist,
    damageMin: hero.base_attack_min + fromAttrs.damage,
    damageMax: hero.base_attack_max + fromAttrs.damage,
    attackSpeed,
    attackRange: hero.attack_range,
    projectileSpeed: hero.attack_type === 'Ranged' ? hero.projectile_speed : 0,
    moveSpeed: hero.move_speed,
    baseAttackTime: hero.attack_rate,
    baseAttackPoint: hero.attack_point,
  }, attackTiming(hero.attack_rate, hero.attack_point, attackSpeed));
}
