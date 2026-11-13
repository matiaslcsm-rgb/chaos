'use strict';

// What each ability of the batch does, written with the parts from abilities.js.
// cast: passive | none (no target) | unit (an enemy) | ally (yourself for now) | point | toggle (attack modifier).
// aoe (optional): the value that holds the radius, drawn while aiming.
// c.v('key') reads the ability's number for its current level from the Dota data.

const FX = { fire: '#f28c38', ice: '#8fd3f4', bolt: '#f2e08a', poison: '#8bc34a', arcane: '#c792ea', steel: '#d8dce6' };

function slowStats(move, attack) {
  return { stats: { moveSpeedPct: neg(move), attackSpeed: neg(attack || 0) } };
}

// Viper's corrosion and pool are shared by several of his abilities.
function corrode(c, target, duration) {
  status(c, target, 'corrode', duration, {
    stats: { attackSpeed: neg(c.v('bonus_attack_speed')) },
    tick: dot(c, c.v('damage')),
  });
}

function netherPool(c, point) {
  const timeInside = new Map();
  const tick = 0.5;
  addZone(c.sim, {
    x: point.x,
    y: point.y,
    radius: c.v('radius'),
    duration: c.v('duration'),
    interval: tick,
    color: FX.poison,
    run: () => {
      for (const enemy of enemiesOf(c, point, c.v('radius'))) {
        const time = Math.min(c.v('max_duration'), (timeInside.get(enemy.id) || 0) + tick);
        timeInside.set(enemy.id, time);
        const perSecond = c.v('min_damage') + (c.v('max_damage') - c.v('min_damage')) * time / c.v('max_duration');
        spellDamage(c, enemy, perSecond * tick);
        status(c, enemy, 'slow', tick + 0.1, { stats: { attackSpeed: neg(c.v('attack_slow')) } });
      }
    },
  });
}

const ABILITY_DEFS = {
  // ---- Sven ----
  sven_storm_bolt: {
    cast: 'unit',
    aoe: 'bolt_aoe',
    projectile: 'bolt_speed',
    hit(c) {
      fxRing(c, c.target, c.v('bolt_aoe'), FX.steel);
      for (const enemy of enemiesOf(c, c.target, c.v('bolt_aoe'))) {
        spellDamage(c, enemy, c.dmg());
        stun(c, enemy, c.v('bolt_stun_duration'));
      }
    },
  },
  sven_great_cleave: {
    cast: 'passive',
    onAttackLanded(c, target, attack) {
      const reach = c.v('cleave_distance') + c.caster.radius;
      for (const enemy of enemiesOf(c, c.caster, reach)) {
        if (enemy !== target && isFacing(c.caster, enemy, Math.PI / 3)) {
          spellDamage(c, enemy, attack.damage * c.v('great_cleave_damage') / 100, 'pure');
        }
      }
    },
  },
  sven_warcry: {
    cast: 'none',
    aoe: 'radius',
    hit(c) {
      fxRing(c, c.caster, c.v('radius'), FX.steel);
      status(c, c.caster, 'buff', c.v('duration'), { stats: { armor: c.v('bonus_armor'), moveSpeedPct: c.v('movespeed') } });
    },
  },
  sven_gods_strength: {
    cast: 'none',
    ult: true,
    hit(c) {
      status(c, c.caster, 'buff', c.v('abilityduration'), { stats: { damagePct: c.v('gods_strength_damage') } });
    },
  },

  // ---- Ogre Magi ----
  ogre_magi_fireblast: {
    cast: 'unit',
    hit(c) {
      fxRing(c, c.target, 60, FX.fire);
      spellDamage(c, c.target, c.v('fireblast_damage'));
      stun(c, c.target, c.v('stun_duration'));
    },
  },
  ogre_magi_ignite: {
    cast: 'unit',
    projectile: 'projectile_speed',
    hit(c) {
      // The main target and one more random enemy near it.
      const others = enemiesOf(c, c.target, 700).filter((enemy) => enemy !== c.target);
      const extra = others[Math.floor(c.sim.rng() * others.length)];
      for (const enemy of extra ? [c.target, extra] : [c.target]) {
        status(c, enemy, 'burn', c.v('duration'), {
          stats: { moveSpeedPct: neg(c.v('slow_movement_speed_pct')) },
          tick: dot(c, c.v('burn_damage')),
        });
      }
    },
  },
  ogre_magi_bloodlust: {
    cast: 'ally',
    hit(c) {
      const target = c.target || c.caster;
      const attackSpeed = target === c.caster ? c.v('self_bonus') : c.v('bonus_attack_speed');
      status(c, target, 'buff', c.v('duration'), { stats: { attackSpeed, moveSpeedPct: c.v('bonus_movement_speed') } });
    },
  },
  ogre_magi_multicast: {
    cast: 'passive',
    ult: true,
    onCast(c, castAbility, release) {
      const roll = c.sim.rng() * 100;
      const four = c.v('multicast_4_times');
      const three = four + c.v('multicast_3_times');
      const two = three + c.v('multicast_2_times');
      const times = roll < four ? 4 : roll < three ? 3 : roll < two ? 2 : 1;
      for (let i = 1; i < times; i++) after(c.sim, MULTICAST_DELAY * i, release);
      if (times > 1) pushEvent(c.sim, { type: 'text', x: c.caster.x, y: c.caster.y, text: `x${times}` });
    },
  },

  // ---- Axe ----
  axe_berserkers_call: {
    cast: 'none',
    aoe: 'radius',
    hit(c) {
      fxRing(c, c.caster, c.v('radius'), FX.fire);
      for (const enemy of enemiesOf(c, c.caster, c.v('radius'))) {
        status(c, enemy, 'taunt', c.v('duration'), { flags: ['taunted'] });
      }
      status(c, c.caster, 'armor', c.v('duration'), { stats: { armor: c.v('bonus_armor') } });
    },
  },
  axe_battle_hunger: {
    cast: 'unit',
    hit(c) {
      status(c, c.target, 'hunger', c.v('duration'), {
        stats: { moveSpeedPct: neg(c.v('slow')) },
        tick: dot(c, c.v('damage_per_second'), 'pure'),
      });
    },
  },
  axe_counter_helix: {
    cast: 'passive',
    aoe: 'radius',
    onAttacked(c) {
      c.ability.counter = (c.ability.counter || 0) + 1;
      if (c.ability.counter < c.v('trigger_attacks')) return;
      c.ability.counter = 0;
      fxRing(c, c.caster, c.v('radius'), FX.steel);
      for (const enemy of enemiesOf(c, c.caster, c.v('radius'))) spellDamage(c, enemy, c.v('damage'), 'pure');
    },
  },
  axe_culling_blade: {
    cast: 'unit',
    ult: true,
    hit(c) {
      spellDamage(c, c.target, c.v('damage'), 'pure');
      if (c.target.dead) {
        status(c, c.caster, 'rush', c.v('speed_duration'), { stats: { moveSpeedPct: c.v('speed_bonus'), armor: c.v('armor_bonus') } });
      }
    },
  },

  // ---- Sniper ----
  sniper_shrapnel: {
    cast: 'point',
    aoe: 'radius',
    charges: { count: 'abilitycharges', restore: 'abilitychargerestoretime' },
    hit(c) {
      const point = c.point;
      after(c.sim, c.v('damage_delay'), () => addZone(c.sim, {
        x: point.x,
        y: point.y,
        radius: c.v('radius'),
        duration: c.v('duration'),
        interval: 1,
        color: FX.fire,
        run: () => {
          for (const enemy of enemiesOf(c, point, c.v('radius'))) {
            spellDamage(c, enemy, c.v('shrapnel_damage'));
            status(c, enemy, 'slow', c.v('slow_duration'), slowStats(c.v('slow_movement_speed')));
          }
        },
      }));
    },
  },
  sniper_headshot: {
    cast: 'passive',
    onAttackStart(c, target, attack) {
      const chance = findMod(c.caster, 'sniper_take_aim:aim') ? 100 : c.v('proc_chance');
      if (c.sim.rng() * 100 >= chance) return;
      attack.damage += c.v('damage');
      attack.headshot = true;
    },
    onAttackLanded(c, target, attack) {
      if (!attack.headshot || target.dead) return;
      status(c, target, 'slow', c.v('slow_duration'), slowStats(100, 100));
      knockAway(target, c.caster, c.v('knockback_distance'), 0.1);
    },
  },
  sniper_take_aim: {
    cast: 'none',
    stats: (c) => ({ attackRange: c.v('passive_attack_range_bonus') }),
    hit(c) {
      status(c, c.caster, 'aim', c.v('duration'), {
        stats: { attackRange: c.v('active_attack_range_bonus'), moveSpeedPct: neg(c.v('slow')) },
      });
    },
  },
  sniper_concussive_grenade: {
    cast: 'point',
    aoe: 'radius',
    maxLevel: 1,
    hit(c) {
      const point = c.point;
      after(c.sim, 0.3, () => {
        fxRing(c, point, c.v('radius'), FX.fire);
        for (const enemy of enemiesOf(c, point, c.v('radius'))) {
          spellDamage(c, enemy, c.v('damage'));
          knockAway(enemy, point, c.v('knockback_distance'), c.v('knockback_duration'));
          status(c, enemy, 'daze', c.v('debuff_duration'), { flags: ['disarmed'], stats: { moveSpeedPct: neg(c.v('slow')) } });
        }
        if (!c.caster.dead && distance(c.caster, point) <= c.v('radius')) {
          knockAway(c.caster, point, c.v('knockback_distance'), c.v('knockback_duration'));
        }
      });
    },
  },
  sniper_assassinate: {
    cast: 'unit',
    ult: true,
    projectile: 'projectile_speed',
    hit(c) {
      spellDamage(c, c.target, c.v('damage'));
      landAttack(c.sim, c.caster, c.target, { damage: attackDamageOf(c.caster) });
    },
  },

  // ---- Viper ----
  viper_poison_attack: {
    cast: 'toggle',
    onAttackStart(c, target, attack) {
      const cost = abilityManaCost(c.ability);
      if (!c.ability.autocast || c.caster.mana < cost) return;
      c.caster.mana -= cost;
      attack.poison = true;
    },
    onAttackLanded(c, target, attack) {
      if (!attack.poison || target.dead) return;
      status(c, target, 'poison', c.v('duration'), {
        maxStacks: c.v('max_stacks'),
        stats: { moveSpeedPct: neg(c.v('movement_speed')), magicResist: neg(c.v('magic_resistance')) },
        tick: dot(c, (mod) => c.v('damage') * mod.stacks),
      });
    },
  },
  viper_nethertoxin: {
    cast: 'point',
    aoe: 'radius',
    projectile: 'projectile_speed',
    hit(c) {
      netherPool(c, c.point);
    },
  },
  viper_corrosive_skin: {
    cast: 'passive',
    stats: (c) => ({ magicResist: c.v('bonus_magic_resistance') }),
    onDamaged(c, source) {
      if (distance(c.caster, source) <= c.v('max_range')) corrode(c, source, c.v('duration'));
    },
  },
  viper_nose_dive: {
    cast: 'point',
    aoe: 'corrosive_radius',
    maxLevel: 1,
    hit(c) {
      const time = Math.max(0.1, distance(c.caster, c.point) / c.v('dive_speed'));
      knockUnit(c.caster, c.point.x, c.point.y, time, () => {
        const skin = borrowAbility(c, 'viper_corrosive_skin');
        for (const enemy of enemiesOf(c, c.caster, c.v('corrosive_radius'))) corrode(skin, enemy, c.v('effect_duration'));
        netherPool(borrowAbility(c, 'viper_nethertoxin'), { x: c.caster.x, y: c.caster.y });
      });
    },
  },
  viper_viper_strike: {
    cast: 'unit',
    ult: true,
    projectile: 'projectile_speed',
    // The slow fades as the poison wears off, as in Dota: full at the start, nothing at the end.
    hit(c) {
      const total = c.v('duration');
      const full = slowStats(c.v('bonus_movement_speed'), c.v('bonus_attack_speed')).stats;
      const damage = dot(c, c.v('damage'), undefined, 0.5);
      status(c, c.target, 'strike', total, {
        stats: Object.assign({}, full),
        tick: {
          interval: damage.interval,
          run(mod, unit) {
            damage.run(mod, unit);
            const left = Math.max(0, mod.duration / total);
            mod.stats = { moveSpeedPct: full.moveSpeedPct * left, attackSpeed: full.attackSpeed * left };
            recomputeStats(unit);
          },
        },
      });
    },
  },

  // ---- Luna ----
  luna_lucent_beam: {
    cast: 'unit',
    hit(c) {
      fxLine(c, { x: c.target.x, y: c.target.y - 400 }, c.target, FX.ice);
      spellDamage(c, c.target, c.v('beam_damage'));
      stun(c, c.target, c.v('stun_duration'));
    },
  },
  luna_lunar_orbit: {
    cast: 'none',
    hit(c) {
      const radius = c.v('rotating_glaives_movement_radius') + 60;
      const tick = 0.5;
      addZone(c.sim, {
        x: c.caster.x,
        y: c.caster.y,
        followId: c.caster.id,
        radius,
        duration: c.v('rotating_glaives_duration'),
        interval: tick,
        color: FX.ice,
        run: (zone) => {
          const damage = attackDamageOf(c.caster) * c.v('rotating_glaives_collision_damage') / 100;
          for (const enemy of enemiesOf(c, zone, radius)) applyDamage(c.sim, c.caster, enemy, damage, 'physical');
        },
      });
    },
  },
  luna_moon_glaive: {
    cast: 'passive',
    onAttackLanded(c, target, attack) {
      let damage = attack.damage;
      chain(c, target, c.v('bounces') + 1, c.v('range'), 0.15, FX.ice, (enemy, n) => {
        if (n === 0) return;
        damage *= 1 - c.v('damage_reduction_percent') / 100;
        applyDamage(c.sim, c.caster, enemy, damage, 'physical');
      });
    },
  },
  luna_eclipse: {
    cast: 'none',
    aoe: 'radius',
    ult: true,
    hit(c) {
      const beam = borrowAbility(c, 'luna_lucent_beam');
      const hits = new Map();
      for (let i = 0; i < c.v('beams'); i++) {
        after(c.sim, i * c.v('beam_interval'), () => {
          if (c.caster.dead) return;
          const pool = enemiesOf(c, c.caster, c.v('radius')).filter((enemy) => (hits.get(enemy.id) || 0) < c.v('hit_count'));
          if (!pool.length) return;
          const enemy = pool[Math.floor(c.sim.rng() * pool.length)];
          hits.set(enemy.id, (hits.get(enemy.id) || 0) + 1);
          fxLine(c, { x: enemy.x, y: enemy.y - 400 }, enemy, FX.ice);
          spellDamage(beam, enemy, beam.v('beam_damage'));
        });
      }
    },
  },

  // ---- Phantom Assassin ----
  phantom_assassin_stifling_dagger: {
    cast: 'unit',
    projectile: 'dagger_speed',
    hit(c) {
      status(c, c.target, 'slow', c.v('duration'), slowStats(c.v('move_slow')));
      const damage = c.v('base_damage') + attackDamageOf(c.caster) * c.v('attack_factor_tooltip') / 100;
      const attack = { damage, dagger: true };
      // The dagger counts as an attack: it can crit and applies attack effects.
      runHooks(c.sim, c.caster, 'onAttackStart', c.target, attack);
      landAttack(c.sim, c.caster, c.target, attack);
    },
  },
  phantom_assassin_phantom_strike: {
    cast: 'unit',
    charges: { count: 'max_charges', restore: 'charge_restore_time' },
    hit(c) {
      teleportNextTo(c.caster, c.target);
      status(c, c.caster, 'frenzy', c.v('duration'), { stats: { attackSpeed: c.v('bonus_attack_speed') } });
      c.caster.order = { type: 'attack', targetId: c.target.id };
    },
  },
  phantom_assassin_immaterial: {
    cast: 'passive',
    stats: (c) => ({ evasion: c.v('evasion') / 100 }),
  },
  phantom_assassin_coup_de_grace: {
    cast: 'passive',
    ult: true,
    onAttackStart(c, target, attack) {
      const chance = attack.dagger ? c.v('dagger_crit_chance') : c.v('crit_chance');
      if (c.sim.rng() * 100 >= chance) return;
      attack.damage *= c.v('crit_bonus') / 100;
      attack.crit = true;
    },
  },

  // ---- Crystal Maiden ----
  crystal_maiden_crystal_nova: {
    cast: 'point',
    aoe: 'radius',
    hit(c) {
      fxRing(c, c.point, c.v('radius'), FX.ice);
      for (const enemy of enemiesOf(c, c.point, c.v('radius'))) {
        spellDamage(c, enemy, c.v('nova_damage'));
        status(c, enemy, 'slow', c.v('duration'), slowStats(c.v('movespeed_slow'), c.v('attackspeed_slow')));
      }
    },
  },
  crystal_maiden_frostbite: {
    cast: 'unit',
    hit(c) {
      const perSecond = c.v('damage_per_second') * (c.target.kind === 'creep' ? c.v('creep_multiplier') : 1);
      status(c, c.target, 'frozen', c.v('duration'), {
        flags: ['rooted', 'disarmed'],
        tick: dot(c, perSecond, 'magical', c.v('tick_interval')),
      });
    },
  },
  crystal_maiden_brilliance_aura: {
    cast: 'passive',
    stats: (c) => ({ manaRegen: c.v('proximity_mana_regen_tooltip'), manaRegenPct: c.v('mana_regen_amp') }),
  },
  crystal_maiden_freezing_field: {
    cast: 'none',
    aoe: 'radius',
    ult: true,
    hit(c) {
      // Channeled: the zone ends as soon as she gets a new order or is stunned.
      c.caster.channel = addZone(c.sim, {
        x: c.caster.x,
        y: c.caster.y,
        followId: c.caster.id,
        channelOf: c.caster.id,
        radius: c.v('radius'),
        duration: c.v('abilitychanneltime'),
        interval: c.v('explosion_interval'),
        color: FX.ice,
        run: (zone) => {
          const angle = c.sim.rng() * Math.PI * 2;
          const reach = c.v('explosion_min_dist') + c.sim.rng() * (c.v('explosion_max_dist') - c.v('explosion_min_dist'));
          const point = { x: zone.x + Math.cos(angle) * reach, y: zone.y + Math.sin(angle) * reach };
          fxRing(c, point, c.v('explosion_radius'), FX.ice);
          for (const enemy of enemiesOf(c, point, c.v('explosion_radius'))) {
            spellDamage(c, enemy, c.v('damage'));
            status(c, enemy, 'slow', c.v('slow_duration'), slowStats(c.v('movespeed_slow'), c.v('attack_slow')));
          }
        },
      });
    },
  },

  // ---- Zeus ----
  zuus_arc_lightning: {
    cast: 'unit',
    hit(c) {
      chain(c, c.target, c.v('jump_count') + 1, c.v('radius'), c.v('jump_delay'), FX.bolt, (enemy) => {
        spellDamage(c, enemy, c.v('arc_damage'));
      });
    },
  },
  zuus_lightning_bolt: {
    cast: 'unit',
    hit(c) {
      fxLine(c, { x: c.target.x, y: c.target.y - 400 }, c.target, FX.bolt);
      spellDamage(c, c.target, c.v('damage'));
      stun(c, c.target, c.v('ministun_duration'));
    },
  },
  zuus_heavenly_jump: {
    cast: 'none',
    aoe: 'range',
    hit(c) {
      const enemy = nearestEnemy(c.sim, c.caster, c.v('range'));
      if (enemy) {
        fxLine(c, c.caster, enemy, FX.bolt);
        spellDamage(c, enemy, c.v('damage'));
        status(c, enemy, 'slow', c.v('duration'), slowStats(c.v('move_slow'), c.v('aspd_slow')));
      }
      const hop = c.v('hop_distance');
      knockUnit(c.caster, c.caster.x + Math.cos(c.caster.facing) * hop, c.caster.y + Math.sin(c.caster.facing) * hop, c.v('hop_duration'));
    },
  },
  zuus_lightning_hands: {
    cast: 'toggle',
    maxLevel: 1,
    stats: (c) => (c.ability.autocast ? { attackSpeed: c.v('attack_speed_bonus') } : {}),
    onAttackLanded(c, target) {
      if (!c.ability.autocast) return;
      const arc = borrowAbility(c, 'zuus_arc_lightning');
      const damage = arc.v('arc_damage') * c.v('arc_lightning_damage_pct') / 100;
      chain(arc, target, arc.v('jump_count') + 1, arc.v('radius'), arc.v('jump_delay'), FX.bolt, (enemy) => {
        spellDamage(arc, enemy, damage);
      });
    },
  },
  zuus_thundergods_wrath: {
    cast: 'none',
    ult: true,
    hit(c) {
      // Enemy heroes only, wherever they are.
      for (const enemy of enemiesOf(c, c.caster, Infinity)) {
        if (enemy.kind !== 'hero') continue;
        fxLine(c, { x: enemy.x, y: enemy.y - 400 }, enemy, FX.bolt);
        spellDamage(c, enemy, c.v('damage'));
      }
    },
  },

  // ---- Skywrath Mage ----
  skywrath_mage_arcane_bolt: {
    cast: 'unit',
    projectile: 'bolt_speed',
    hit(c) {
      spellDamage(c, c.target, c.v('bolt_damage') + c.v('int_multiplier') * (c.caster.baseStats.int || 0));
    },
  },
  skywrath_mage_concussive_shot: {
    cast: 'none',
    aoe: 'launch_radius',
    hit(c) {
      // Flies to the closest enemy, heroes first.
      const pool = enemiesOf(c, c.caster, c.v('launch_radius')).sort((a, b) => distance(c.caster, a) - distance(c.caster, b));
      const target = pool.find((enemy) => enemy.kind === 'hero') || pool[0];
      if (!target) return;
      c.sim.projectiles.push({
        x: c.caster.x,
        y: c.caster.y,
        targetId: target.id,
        speed: c.v('speed'),
        onHit: (hitTarget) => {
          fxRing(c, hitTarget, c.v('slow_radius'), FX.arcane);
          for (const enemy of enemiesOf(c, hitTarget, c.v('slow_radius'))) {
            spellDamage(c, enemy, c.v('damage'));
            status(c, enemy, 'slow', c.v('slow_duration'), slowStats(c.v('movement_speed_pct')));
          }
        },
      });
    },
  },
  skywrath_mage_ancient_seal: {
    cast: 'unit',
    hit(c) {
      status(c, c.target, 'seal', c.v('seal_duration'), { flags: ['silenced'], stats: { magicResist: neg(c.v('resist_debuff')) } });
    },
  },
  skywrath_mage_mystic_flare: {
    cast: 'point',
    aoe: 'radius',
    ult: true,
    hit(c) {
      const point = c.point;
      const perTick = c.v('damage') * c.v('damage_interval') / c.v('duration');
      addZone(c.sim, {
        x: point.x,
        y: point.y,
        radius: c.v('radius'),
        duration: c.v('duration'),
        interval: c.v('damage_interval'),
        color: FX.arcane,
        run: () => {
          // Split evenly among heroes in the area; with no heroes there, among whoever is.
          const inside = enemiesOf(c, point, c.v('radius'));
          const heroes = inside.filter((enemy) => enemy.kind === 'hero');
          const pool = heroes.length ? heroes : inside;
          for (const enemy of pool) spellDamage(c, enemy, perTick / pool.length);
        },
      });
    },
  },
};
