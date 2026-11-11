'use strict';

// The computer players. They play by the same rules as the human: same gold, same prices, same draft
// options, and they only look at what a player could see. They just decide instantly (docs/DISENO.md, section 7).

const AI_THINK_INTERVAL = 0.2;
const AI_STYLES = ['fighter', 'mage', 'mixed'];
const AI_MONEY = ['spender', 'saver', 'balanced'];
// Share of the gold each money personality keeps for betting instead of shopping.
const AI_RESERVE = { spender: 0, balanced: 0.25, saver: 0.5 };

// What each ability is good for, so the computer can judge a draft option and when to cast it.
// area: hits several (creeps) · stun: control (duels) · nuke: single-target damage · attack: makes attacks
// better · buff: casts on itself · defense: keeps it alive · magic: helps other spells.
// reach (optional): how close the enemies must be for a no-target ability without an area to be worth casting.
const AI_ABILITY_INFO = {
  sven_storm_bolt: { tags: ['stun', 'area', 'nuke'] },
  sven_great_cleave: { tags: ['attack', 'area'] },
  sven_warcry: { tags: ['buff', 'defense'] },
  sven_gods_strength: { tags: ['attack', 'buff'] },
  ogre_magi_fireblast: { tags: ['stun', 'nuke'] },
  ogre_magi_ignite: { tags: ['nuke'] },
  ogre_magi_bloodlust: { tags: ['attack', 'buff'] },
  ogre_magi_multicast: { tags: ['magic'] },
  axe_berserkers_call: { tags: ['stun', 'area', 'defense'] },
  axe_battle_hunger: { tags: ['nuke'] },
  axe_counter_helix: { tags: ['area', 'defense'] },
  axe_culling_blade: { tags: ['nuke'] },
  sniper_shrapnel: { tags: ['area'] },
  sniper_headshot: { tags: ['attack'] },
  sniper_take_aim: { tags: ['attack', 'buff'] },
  sniper_concussive_grenade: { tags: ['area', 'defense'] },
  sniper_assassinate: { tags: ['nuke'] },
  viper_poison_attack: { tags: ['attack'] },
  viper_nethertoxin: { tags: ['area'] },
  viper_corrosive_skin: { tags: ['defense'] },
  viper_nose_dive: { tags: ['area'] },
  viper_viper_strike: { tags: ['nuke'] },
  luna_lucent_beam: { tags: ['stun', 'nuke'] },
  luna_lunar_orbit: { tags: ['area'], reach: 330 },
  luna_moon_glaive: { tags: ['attack', 'area'] },
  luna_eclipse: { tags: ['area', 'nuke'] },
  phantom_assassin_stifling_dagger: { tags: ['nuke'] },
  phantom_assassin_phantom_strike: { tags: ['attack'] },
  phantom_assassin_immaterial: { tags: ['defense'] },
  phantom_assassin_coup_de_grace: { tags: ['attack'] },
  crystal_maiden_crystal_nova: { tags: ['area'] },
  crystal_maiden_frostbite: { tags: ['stun', 'nuke'] },
  crystal_maiden_brilliance_aura: { tags: ['magic'] },
  crystal_maiden_freezing_field: { tags: ['area'] },
  zuus_arc_lightning: { tags: ['area', 'nuke'] },
  zuus_lightning_bolt: { tags: ['stun', 'nuke'] },
  zuus_heavenly_jump: { tags: ['area'] },
  zuus_lightning_hands: { tags: ['attack'] },
  zuus_thundergods_wrath: { tags: ['area', 'nuke'], reach: Infinity },
  skywrath_mage_arcane_bolt: { tags: ['nuke'] },
  skywrath_mage_concussive_shot: { tags: ['nuke'] },
  skywrath_mage_ancient_seal: { tags: ['stun'] },
  skywrath_mage_mystic_flare: { tags: ['area', 'nuke'] },
};

// How much each style likes each kind of ability.
const AI_STYLE_WEIGHTS = {
  fighter: { attack: 3, defense: 1.5, area: 1.5, stun: 1, nuke: 0.5, buff: 1, magic: 0 },
  mage: { attack: 0, defense: 1, area: 2, stun: 1.5, nuke: 2.5, buff: 0.5, magic: 2 },
  mixed: { attack: 1.5, defense: 1.2, area: 1.8, stun: 1.2, nuke: 1.5, buff: 1, magic: 1 },
};

// Shopping lists: the finished items each style works towards, in order. Components are bought on the way.
const AI_SHOPPING = {
  fighter: ['power_treads', 'mask_of_madness', 'lesser_crit', 'basher', 'black_king_bar', 'satanic', 'greater_crit'],
  mage: ['phase_boots', 'kaya', 'black_king_bar', 'basher', 'satanic', 'reaver'],
  mixed: ['phase_boots', 'kaya', 'lesser_crit', 'black_king_bar', 'satanic', 'greater_crit'],
};
// Items that come from upgrading another one of the list: owning them also counts as owning the base.
const AI_UPGRADES = { greater_crit: 'lesser_crit', satanic: 'reaver' };

function pickFrom(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// A personality drawn at the start. The hero leans the style: intelligence heroes tend to be mages.
function createBrain(rng, heroData) {
  const roll = rng();
  const order = heroData && heroData.primary_attr === 'int' ? ['mage', 'mixed', 'fighter'] : ['fighter', 'mixed', 'mage'];
  const style = roll < 0.6 ? order[0] : roll < 0.9 ? order[1] : order[2];
  return { style, money: pickFrom(rng, AI_MONEY), scores: {}, thinkTimer: 0, shoppedRound: -1 };
}

function abilityTags(key) {
  return (AI_ABILITY_INFO[key] || { tags: [] }).tags;
}

// ---- Draft ----

// How much this computer player wants a draft option: its style, what its kit is missing, and some luck.
function draftScore(brain, hero, key, rng) {
  const weights = AI_STYLE_WEIGHTS[brain.style];
  const tags = abilityTags(key);
  const owned = hero.abilities.flatMap((ability) => abilityTags(ability.key));
  // The best thing it does counts in full; the rest counts less, so doing many things is not everything.
  const values = tags.map((tag) => weights[tag] || 0).sort((a, b) => b - a);
  let score = values.reduce((sum, value, i) => sum + (i === 0 ? value : value * 0.4), 0);
  // Something to clear waves with comes first, then control for the duels, then something to survive.
  if (tags.includes('area') && !owned.includes('area')) score += 3;
  if (tags.includes('stun') && !owned.includes('stun')) score += 1.5;
  if (tags.includes('defense') && !owned.includes('defense') && hero.abilities.length >= 2) score += 1;
  // A second ultimate competes with the first one for points.
  if (ABILITY_DEFS[key].ult && hero.abilities.some((ability) => ability.def.ult)) score -= 3;
  return score + rng() * 1.5;
}

function aiPickDraft(game, brain) {
  const rng = game.sim.rng;
  let best = null;
  let bestScore = -Infinity;
  for (const key of game.draft.options) {
    const score = draftScore(brain, game.hero, key, rng);
    if (score > bestScore) {
      best = key;
      bestScore = score;
    }
  }
  brain.scores[best] = bestScore;
  return pickDraft(game, best);
}

// ---- Levelling ----

// Spends every skill point: the ultimate whenever it can, then the abilities it wanted the most.
function aiSpendPoints(hero, brain) {
  while (hero.skillPoints > 0) {
    let best = -1;
    let bestValue = -Infinity;
    hero.abilities.forEach((ability, index) => {
      if (!canLevelAbility(hero, ability)) return;
      const value = (ability.def.ult ? 100 : 0) + (brain.scores[ability.key] || 0) + (ability.level === 0 ? 5 : 0);
      if (value > bestValue) {
        best = index;
        bestValue = value;
      }
    });
    if (best === -1) return;
    levelUpAbility(hero, best);
  }
}

// ---- Shopping ----

function ownsItem(hero, key) {
  return hero.items.some((item) => item.key === key)
    || Object.keys(AI_UPGRADES).some((upgrade) => AI_UPGRADES[upgrade] === key && ownsItem(hero, upgrade));
}

// The direct parts of an item that the hero does not have yet (an owned part is used up only once).
function missingParts(hero, key) {
  const left = hero.items.map((item) => item.key);
  const missing = [];
  for (const part of DB.items[key].components || []) {
    const owned = left.indexOf(part);
    if (owned === -1) missing.push(part);
    else left.splice(owned, 1);
  }
  return missing;
}

// The purchase that gets closest to `key` with this much gold: the item itself, or its priciest
// missing part that fits (going down the recipe). Null if nothing fits.
function nextPurchase(hero, key, budget) {
  if (buyProblem(hero, key) === null && purchasePlan(hero, key).cost <= budget) return key;
  const parts = missingParts(hero, key).sort((a, b) => itemCost(b) - itemCost(a));
  for (const part of parts) {
    const buy = nextPurchase(hero, part, budget);
    if (buy) return buy;
  }
  return null;
}

// Buys along the shopping list while the gold it is willing to spend allows.
function aiShop(game, brain) {
  const hero = game.hero;
  const budgetStart = hero.gold * (1 - AI_RESERVE[brain.money]);
  let spent = 0;
  const bought = [];
  for (let guard = 0; guard < 20; guard++) {
    const goal = AI_SHOPPING[brain.style].find((key) => !ownsItem(hero, key));
    if (!goal) break;
    const key = nextPurchase(hero, goal, budgetStart - spent);
    if (!key) break;
    const before = hero.gold;
    if (buyFromShop(game, key)) break;
    spent += before - hero.gold;
    bought.push(key);
  }
  return bought;
}

// ---- Fighting ----

function enemiesAround(game, point, radius) {
  return enemiesNear(game.sim, game.hero.team, point, radius);
}

// The enemy whose surroundings hold the most enemies, within reach of a point-target area ability.
function bestCluster(game, reach, radius) {
  let best = null;
  let bestCount = 0;
  for (const enemy of enemiesAround(game, game.hero, reach)) {
    const count = enemiesAround(game, enemy, radius).length;
    if (count > bestCount) {
      best = enemy;
      bestCount = count;
    }
  }
  return { target: best, count: bestCount };
}

// Whether to cast this ability now, and on what. Returns { target } (null for no target) or null to wait.
function castDecision(game, ability) {
  const hero = game.hero;
  const info = AI_ABILITY_INFO[ability.key] || { tags: [] };
  const alive = creepsAlive(game) || enemiesAround(game, hero, Infinity).length;
  // Areas wait for a group: two enemies, or three for an ultimate (fewer if that is all there is).
  const crowd = Math.min(ability.def.ult ? 3 : 2, alive);
  const range = abilityCastRange(ability);
  const cast = ability.def.cast;
  if (cast === 'unit') {
    const target = nearestEnemy(game.sim, hero, range + 200);
    return target ? { target } : null;
  }
  if (cast === 'point') {
    const radius = abilityAoe(ability) || 200;
    const cluster = bestCluster(game, range + 200, radius);
    return cluster.target && cluster.count >= crowd ? { target: { x: cluster.target.x, y: cluster.target.y } } : null;
  }
  if (cast === 'ally' || (cast === 'none' && info.tags.includes('buff'))) {
    return nearestEnemy(game.sim, hero, 600) ? { target: null } : null;
  }
  if (cast === 'none') {
    const reach = abilityAoe(ability) || info.reach || 350;
    return enemiesAround(game, hero, reach).length >= Math.max(1, crowd) ? { target: null } : null;
  }
  return null;
}

function aiUseItems(game) {
  const hero = game.hero;
  const hp = hero.hp / hero.stats.maxHp;
  const near = enemiesAround(game, hero, 500).length;
  const nearest = nearestEnemy(game.sim, hero, Infinity);
  hero.items.forEach((item, slot) => {
    if (itemProblem(hero, item)) return;
    const use = {
      black_king_bar: hp < 0.5 && near >= 3,
      satanic: hp < 0.4 && near >= 1,
      mask_of_madness: hp > 0.5 && nearest && inAttackRange(hero, nearest),
      phase_boots: nearest && distance(hero, nearest) > 500,
    }[item.key];
    if (use) useItem(game.sim, hero, slot);
  });
}

// One decision of the fight: walk to the wave, cast what is worth casting, use items.
function aiFight(game, brain) {
  const hero = game.hero;
  if (hero.dead || hero.order.type === 'cast' || hero.channel) return;
  aiUseItems(game);
  for (let index = 0; index < hero.abilities.length; index++) {
    const ability = hero.abilities[index];
    if (castProblem(hero, ability)) continue;
    const decision = castDecision(game, ability);
    if (decision && !orderCast(hero, index, decision.target)) return;
  }
  // Idle heroes only see enemies close by: walk towards the wave.
  if (hero.order.type === 'idle' && !nearestEnemy(game.sim, hero, hero.acquireRange)) {
    const target = nearestEnemy(game.sim, hero, Infinity);
    if (target) orderAttackMove(hero, target.x, target.y);
  }
}

// ---- Betting ----

// How strong a duelist looks from outside: what a player can see in the table and the betting panel.
function duelStrength(player) {
  return playerValue(player) + player.game.hero.level * 300 + (player.duelsWon || 0) * 200;
}

// Chance that side 'a' wins, as a computer player estimates it.
function duelOdds(duel) {
  const a = duelStrength(duel.a);
  return a / (a + duelStrength(duel.b));
}

// How much of the most it may bet each personality risks: the saver kept its gold for this.
const AI_BET_APPETITE = { saver: 0.8, balanced: 0.4, spender: 0.1 };

// Bets once per duel: usually on the favourite, sometimes on the surprise, more when it is surer.
function aiBet(match, player) {
  const duel = match.duel;
  if (player.brain.betRound === duel.round || isDuelist(duel, player)) return null;
  player.brain.betRound = duel.round;
  const rng = player.game.sim.rng;
  const oddsA = duelOdds(duel);
  // Squaring leans the pick towards the favourite without making it certain.
  const leanA = oddsA * oddsA / (oddsA * oddsA + (1 - oddsA) * (1 - oddsA));
  const side = rng() < leanA ? 'a' : 'b';
  const sure = Math.abs((side === 'a' ? oddsA : 1 - oddsA) * 2 - 1);
  const amount = Math.floor(maxBet(player) * AI_BET_APPETITE[player.brain.money] * (0.3 + 0.7 * sure));
  if (amount < BET.min) return null;
  return placeBet(match, player, side, amount) ? null : { side, amount };
}

// Everything a computer player does, called every simulation step.
function aiStep(game, brain, dt) {
  if (game.phase === 'lost') return;
  if (game.draft) aiPickDraft(game, brain);
  aiSpendPoints(game.hero, brain);
  if (game.phase === 'prep' && brain.shoppedRound !== game.round && shopOpen(game)) {
    brain.shoppedRound = game.round;
    aiShop(game, brain);
  }
  if (game.phase !== 'fight' && game.phase !== 'duel') return;
  brain.thinkTimer -= dt;
  if (brain.thinkTimer > 0) return;
  brain.thinkTimer = AI_THINK_INTERVAL;
  aiFight(game, brain);
}
