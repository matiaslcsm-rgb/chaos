'use strict';

// Neutral items: one slot of their own, cannot be sold, a new one replaces the old. After rounds 10, 20, 30 and 40
// every player still in gets to choose one of the next tier, and the fifth tier after round 50 (as in Clash; user's
// decision 2026-11-17). Numbers come from data/dota/items.json; what each one does is in NEUTRAL_DEFS. No DOM here.

const NEUTRAL_ROUNDS = { 10: 1, 20: 2, 30: 3, 40: 4, 50: 5 };
const NEUTRAL_OPTIONS = 3;
const NEUTRAL_HOTKEY = 'g';

// Hits that splash or zap land on these, besides the target.
function othersNear(c, point, radius, skip) {
  return enemiesOf(c, point, radius).filter((unit) => unit !== skip);
}

// An item effect that waits for its cooldown: true (and the cooldown starts) if it is ready.
function itemReady(c) {
  if (c.item.cooldown > 0) return false;
  c.item.cooldown = DB.items[c.item.key].cd || 0;
  return true;
}

// 4 of each tier of Dota's 49, those that can be built from the parts we have (docs/PLAN.md lists the rest).
// text: what the slot and the offer say about it.
const NEUTRAL_DEFS = {
  // ---- Tier 1 ----
  chipped_vest: {
    text: 'Cuando te pegan, devolvés 30 de daño a los héroes y 15 a los creeps.',
    onAttacked(c, attacker) {
      applyDamage(c.sim, c.caster, attacker, c.v(attacker.kind === 'hero' ? 'damage_return_hero' : 'damage_return_creep'), 'physical');
    },
  },
  possessed_mask: {
    text: 'Cada golpe tuyo te cura 5 de vida.',
    onAttackLanded(c) {
      c.caster.hp = Math.min(c.caster.stats.maxHp, c.caster.hp + c.v('lifesteal'));
    },
  },
  occult_bracelet: {
    text: 'Cada golpe que recibís te da +0,4 de regeneración de maná por 5 s, hasta 5 veces.',
    onAttacked(c) {
      status(c, c.caster, 'rites', c.v('stack_duration'), { maxStacks: c.v('stack_limit'), stats: { manaRegen: c.v('mana_regen') } });
    },
  },
  weighted_dice: {
    text: '+6 al daño máximo.',
    stats: (c) => ({ damageMax: c.v('bonus_max_damage') }),
  },
  // ---- Tier 2 ----
  essence_ring: {
    text: 'Activa: +240 de vida máxima y actual por 10 s.',
    active(c) {
      status(c, c.caster, 'essence', c.v('health_gain_duration'), { stats: { maxHp: c.v('health_gain') } });
      c.caster.hp = Math.min(c.caster.stats.maxHp, c.caster.hp + c.v('health_gain'));
    },
  },
  defiant_shell: {
    text: 'Cuando te pegan, contraatacás con el 80% de tu golpe (cada 5 s).',
    onAttacked(c, attacker) {
      if (attacker.dead || !inAttackRange(c.caster, attacker) || !itemReady(c)) return;
      applyDamage(c.sim, c.caster, attacker, attackDamageOf(c.caster) * c.v('counter_damage') / 100, 'physical');
      fxLine(c, c.caster, attacker, '#b8c0d0');
    },
  },
  mana_draught: {
    text: 'Activa: recuperás 70 de maná más el 3% de tu máximo en 6 s.',
    active(c) {
      const total = c.v('mana_restore') + c.caster.stats.maxMana * c.v('mana_restore_pct') / 100;
      status(c, c.caster, 'draught', c.v('heal_duration'), { stats: { manaRegen: total / c.v('heal_duration') } });
    },
  },
  pogo_stick: {
    text: 'Activa: saltás 300 hacia adelante.',
    active(c) {
      const hero = c.caster;
      const dist = c.v('leap_distance');
      const x = Math.max(0, Math.min(ARENA.width, hero.x + Math.cos(hero.facing) * dist));
      const y = Math.max(0, Math.min(ARENA.height, hero.y + Math.sin(hero.facing) * dist));
      knockUnit(hero, x, y, dist / c.v('leap_speed'));
    },
  },
  // ---- Tier 3 ----
  cloak_of_flames: {
    text: 'Quemás a los enemigos a 375 o menos: 40 de daño mágico por segundo.',
    // Burns in ticks, so the numbers on screen stay readable.
    onStep(c, dt) {
      c.item.burnTimer = (c.item.burnTimer || 0) + dt;
      if (c.item.burnTimer < CLOAK_TICK) return;
      c.item.burnTimer -= CLOAK_TICK;
      for (const enemy of enemiesOf(c, c.caster, c.v('radius'))) applyDamage(c.sim, c.caster, enemy, c.v('damage') * CLOAK_TICK, 'magical');
    },
  },
  stormcrafter: {
    text: 'Cada 6 s, un rayo a 2 enemigos a 700 o menos: 70 de daño mágico y los frena un instante.',
    onStep(c) {
      if (c.item.cooldown > 0) return;
      const targets = enemiesOf(c, c.caster, c.v('range'))
        .sort((a, b) => distance(a, c.caster) - distance(b, c.caster)).slice(0, c.v('max_targets'));
      if (!targets.length || !itemReady(c)) return;
      for (const target of targets) {
        fxLine(c, c.caster, target, '#6aa8f0');
        applyDamage(c.sim, c.caster, target, c.v('damage'), 'magical');
        status(c, target, 'zap', c.v('slow_duration'), slowStats(c.v('slow')));
      }
    },
  },
  gunpowder_gauntlets: {
    text: 'Cada 10 s, tu golpe hace 120 de daño mágico extra y salpica la mitad alrededor.',
    onAttackStart(c, target, attack) {
      if (itemReady(c)) attack.gunpowder = true;
    },
    onAttackLanded(c, target, attack, dealt) {
      if (!attack.gunpowder) return;
      const extra = c.v('bonus_damage');
      applyDamage(c.sim, c.caster, target, extra, 'magical');
      fxRing(c, target, c.v('splash_radius'), '#f28c38');
      for (const other of othersNear(c, target, c.v('splash_radius'), target)) {
        applyDamage(c.sim, c.caster, other, (dealt + extra) * c.v('splash_pct') / 100, 'magical');
      }
    },
  },
  serrated_shiv: {
    text: '20% de probabilidad de que tu golpe saque además el 8% de la vida actual.',
    onAttackLanded(c, target) {
      if (target.dead || c.item.cooldown > 0 || c.sim.rng() * 100 >= c.v('proc_chance')) return;
      itemReady(c);
      applyDamage(c.sim, c.caster, target, target.hp * c.v('hp_dmg') / 100, 'physical');
    },
  },
  // ---- Tier 4 ----
  giant_maul: {
    text: 'Cada 15 s, un golpe crítico de 150% que frena al enemigo 3 s.',
    onAttackStart(c, target, attack) {
      if (!itemReady(c)) return;
      attack.damage *= c.v('crit_multiplier') / 100;
      attack.crit = true;
      attack.maul = true;
    },
    onAttackLanded(c, target, attack) {
      if (attack.maul) status(c, target, 'crushed', c.v('debuff_duration'), slowStats(c.v('movespeed_slow'), c.v('attack_slow')));
    },
  },
  idol_of_screeauk: {
    text: 'Activa: 35% de evasión por 6,5 s.',
    active(c) {
      status(c, c.caster, 'flight', c.v('duration'), { stats: { evasion: c.v('evasion') / 100 } });
    },
  },
  flayers_bota: {
    text: 'Activa: +15% de daño y +30 de velocidad de ataque por 6 s.',
    active(c) {
      status(c, c.caster, 'bloodthirst', c.v('duration'), { stats: { damagePct: c.v('base_damage'), attackSpeed: c.v('attack_speed') } });
    },
  },
  rattlecage: {
    text: 'Cada 220 de daño recibido, dispara a 2 enemigos cerca: 90 de daño y los frena un instante.',
    onDamaged(c, source, dealt) {
      c.item.stored = (c.item.stored || 0) + dealt;
      if (c.item.stored < c.v('damage_threshold')) return;
      c.item.stored = 0;
      const targets = enemiesOf(c, c.caster, c.v('radius')).slice(0, c.v('target_count'));
      for (const target of targets) {
        fxLine(c, c.caster, target, '#b8c0d0');
        applyDamage(c.sim, c.caster, target, c.v('projectile_damage'), 'physical');
        status(c, target, 'rattled', c.v('slow_duration'), slowStats(c.v('slow')));
      }
    },
  },
  // ---- Tier 5 ----
  desolator_2: {
    text: 'Tus golpes le sacan 13 de armadura al enemigo por 7 s.',
    onAttackLanded(c, target) {
      status(c, target, 'corruption', c.v('corruption_duration'), { stats: { armor: c.v('corruption_armor') } });
    },
  },
  divine_regalia: {
    text: '+20% de todo el daño que hacés. Si morís, se apaga para siempre.',
    stats: (c) => (c.item.broken ? {} : { damageDealtPct: c.v('outgoing_damage') }),
    onDeath(c) {
      c.item.broken = true;
      refreshPassives(c.caster);
    },
  },
  fallen_sky: {
    text: 'Activa: caés como meteoro sobre el enemigo más cercano (hasta 1.200): 150 de daño, aturde 1,6 s y quema.',
    active(c) {
      const target = nearestEnemy(c.sim, c.caster, FALLEN_SKY_RANGE);
      if (!target) return;
      const point = { x: target.x, y: target.y };
      knockUnit(c.caster, point.x, point.y, c.v('land_time'), () => {
        fxRing(c, point, c.v('impact_radius'), '#f28c38');
        for (const enemy of enemiesOf(c, point, c.v('impact_radius'))) {
          applyDamage(c.sim, c.caster, enemy, c.v('impact_damage_units'), 'magical');
          stun(c, enemy, c.v('stun_duration'));
          status(c, enemy, 'burn', c.v('burn_duration'), { tick: dot(c, c.v('burn_dps_units')) });
        }
      });
    },
  },
  minotaur_horn: {
    text: 'Activa: 60% de resistencia mágica por 2 s.',
    active(c) {
      status(c, c.caster, 'avatar', c.v('duration'), { stats: { magicResist: c.v('magic_resist') } });
    },
  },
};
// The meteor's reach; Dota lets you aim it anywhere close, here it looks for the nearest enemy.
const FALLEN_SKY_RANGE = 1200;
const CLOAK_TICK = 0.5;

function neutralTier(key) {
  return DB.items[key].tier;
}

function neutralsOfTier(tier) {
  return Object.keys(NEUTRAL_DEFS).filter((key) => neutralTier(key) === tier);
}

function newNeutral(key) {
  return { key, def: NEUTRAL_DEFS[key], cooldown: 0, neutral: true };
}

// After rounds 10..50 every player still in gets an offer of the next tier.
function offerNeutrals(game, round) {
  const tier = NEUTRAL_ROUNDS[round];
  if (!tier || game.phase === 'lost') return false;
  const pool = neutralsOfTier(tier);
  const options = [];
  while (options.length < NEUTRAL_OPTIONS && pool.length) {
    options.push(pool.splice(Math.floor(game.sim.rng() * pool.length), 1)[0]);
  }
  game.neutralOffer = { tier, options };
  return true;
}

// The new one replaces the old one, which is gone.
function pickNeutral(game, key) {
  const offer = game.neutralOffer;
  if (!offer || !offer.options.includes(key)) return false;
  const hero = game.hero;
  if (hero.neutral) hero.mods = hero.mods.filter((mod) => !(mod.sourceId === hero.id && mod.id.startsWith(`${hero.neutral.key}:`)));
  hero.neutral = newNeutral(key);
  game.neutralOffer = null;
  refreshInventory(hero);
  return true;
}

function skipNeutral(game) {
  const options = game.neutralOffer.options;
  return pickNeutral(game, options[Math.floor(game.sim.rng() * options.length)]);
}
