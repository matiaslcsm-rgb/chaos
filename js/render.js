'use strict';

// Draws the game with plain shapes. Reads the game state, never changes it.

const ATTR_COLORS = { str: '#c0392b', agi: '#27ae60', int: '#2980b9', all: '#8e44ad' };
const ATTR_LABELS = { str: 'Fuerza', agi: 'Agilidad', int: 'Inteligencia', all: 'Universal' };
const CREEP_COLOR = '#a84a3a';
const FLOATER_TIME = 0.8;
const MARKER_TIME = 0.5;
const FX_TIME = 0.45;
const MESSAGE_TIME = 1.8;
const ZONE_FADE_TIME = 0.5;
const CARD = { width: 220, height: 220, gap: 20, columns: 5, top: 150 };
const BAR = { size: 72, gap: 6, bottom: 16, plusHeight: 20, plusGap: 4 };
const HOTKEY_ORDER = BASIC_HOTKEYS.concat(ULT_HOTKEY);
const FONT = 'system-ui, sans-serif';

// What a unit cannot do right now, in the order it is shown over its head.
const STATUS_LABELS = [
  { flag: 'stunned', text: 'aturdido', color: '#f2e08a' },
  { flag: 'taunted', text: 'provocado', color: '#f28c38' },
  { flag: 'rooted', text: 'inmóvil', color: '#8fd3f4' },
  { flag: 'silenced', text: 'silenciado', color: '#c792ea' },
  { flag: 'disarmed', text: 'desarmado', color: '#d8dce6' },
];
const SLOW_LABEL = { text: 'lento', color: '#6aa8f0' };

const SLOT_STATE_TEXT = {
  unlearned: 'Sin aprender',
  passive: 'Pasiva: siempre activa',
  on: 'Prendida: se usa sola en cada ataque',
  off: 'Apagada',
  silenced: 'No podés lanzarla ahora',
  charges: 'Sin cargas',
  cooldown: 'Recargando',
  mana: 'No alcanza el maná',
  ready: 'Lista',
};
const SLOT_BORDERS = { ready: '#8a93a6', on: '#4cc35a', mana: '#4a8fe0', passive: '#5a6274' };
const CAST_LABELS = {
  passive: 'Pasiva',
  none: 'Sin objetivo',
  unit: 'A un enemigo',
  ally: 'Sobre vos',
  point: 'A un punto',
  toggle: 'Modificador de ataque',
};

function worldScale(canvas) {
  return canvas.width / ARENA.width;
}

function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function inRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const longer = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(longer).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = longer;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ---- Layout shared with the click handling ----

// Hero cards of the selection screen, in canvas pixels.
function selectCards(canvas, heroes) {
  const rowWidth = CARD.columns * CARD.width + (CARD.columns - 1) * CARD.gap;
  const left = (canvas.width - rowWidth) / 2;
  return heroes.map((hero, index) => ({
    hero,
    x: left + (index % CARD.columns) * (CARD.width + CARD.gap),
    y: CARD.top + Math.floor(index / CARD.columns) * (CARD.height + CARD.gap),
    width: CARD.width,
    height: CARD.height,
  }));
}

function heroPanelRect(canvas) {
  return { x: 16, y: canvas.height - 112, width: 380, height: 96 };
}

// One slot per ability, laid out in hotkey order (Q W E D F R), each with its "+" button above.
function abilityBarSlots(canvas, hero) {
  const keys = abilityHotkeys(hero.abilities);
  const rank = (index) => (keys[index] ? HOTKEY_ORDER.indexOf(keys[index]) : HOTKEY_ORDER.length);
  const order = hero.abilities.map((ability, index) => index).sort((a, b) => rank(a) - rank(b));
  const width = order.length * BAR.size + (order.length - 1) * BAR.gap;
  const left = (canvas.width - width) / 2;
  const y = canvas.height - BAR.bottom - BAR.size;
  return order.map((index, position) => {
    const x = left + position * (BAR.size + BAR.gap);
    return {
      index,
      ability: hero.abilities[index],
      key: keys[index],
      x,
      y,
      width: BAR.size,
      height: BAR.size,
      plus: { x, y: y - BAR.plusGap - BAR.plusHeight, width: BAR.size, height: BAR.plusHeight },
    };
  });
}

// ---- What to say about a unit ----

function unitStatusLabels(unit) {
  const labels = STATUS_LABELS.filter((status) => unit.flags[status.flag]);
  if (unit.baseStats.moveSpeed > 0 && unit.stats.moveSpeed < unit.baseStats.moveSpeed) labels.push(SLOW_LABEL);
  return labels;
}

// Timed effects on the hero: its own buffs, what enemies put on it, and a channel in progress.
function heroEffects(hero) {
  const effects = [];
  if (hero.channel) effects.push({ text: 'Canalizando', time: hero.channel.duration - hero.channel.age, good: true });
  for (const mod of hero.mods) {
    if (mod.passive) continue;
    const key = mod.id.split(':')[0];
    const name = DB.abilities[key] ? DB.abilities[key].dname : key;
    effects.push({
      text: mod.stacks > 1 ? `${name} x${mod.stacks}` : name,
      time: mod.duration,
      good: mod.sourceId === hero.id,
    });
  }
  return effects;
}

function slotState(hero, ability) {
  if (ability.level === 0) return 'unlearned';
  if (ability.def.cast === 'passive') return 'passive';
  if (ability.def.cast === 'toggle') return ability.autocast ? 'on' : 'off';
  return castProblem(hero, ability) || 'ready';
}

// ---- Hero selection ----

function drawSelect(ctx, canvas, heroes, mouse) {
  ctx.fillStyle = '#151922';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8b04a';
  ctx.font = `bold 44px ${FONT}`;
  ctx.fillText('Elegí tu héroe', canvas.width / 2, 90);

  for (const card of selectCards(canvas, heroes)) {
    const { data, abilities } = card.hero;
    ctx.fillStyle = inRect(mouse, card) ? '#262c3a' : '#1b2030';
    ctx.fillRect(card.x, card.y, card.width, card.height);
    ctx.fillStyle = ATTR_COLORS[data.primary_attr];
    ctx.fillRect(card.x, card.y, card.width, 6);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8ecf4';
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(data.localized_name, card.x + 14, card.y + 38);
    ctx.fillStyle = '#8a93a6';
    ctx.font = `13px ${FONT}`;
    ctx.fillText(`${ATTR_LABELS[data.primary_attr]} · ${data.attack_type === 'Melee' ? 'cuerpo a cuerpo' : 'a distancia'}`, card.x + 14, card.y + 60);
    ctx.fillStyle = '#b8c0d0';
    ctx.font = `14px ${FONT}`;
    abilities.forEach((ability, row) => {
      ctx.fillText(ability.dname, card.x + 14, card.y + 92 + row * 22);
    });
  }
}

// ---- The arena ----

function drawBar(ctx, x, y, width, height, fraction, color) {
  ctx.fillStyle = '#0d0f14';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width * Math.max(0, Math.min(1, fraction)), height);
}

function drawCircle(ctx, x, y, radius, stroke, fill, dash) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, radius), 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.setLineDash(dash || []);
    ctx.strokeStyle = stroke;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawArena(ctx, canvas, scale) {
  ctx.fillStyle = '#1d2a22';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#24332a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= ARENA.width; x += 125) {
    ctx.moveTo(x * scale, 0);
    ctx.lineTo(x * scale, ARENA.height * scale);
  }
  for (let y = 0; y <= ARENA.height; y += 125) {
    ctx.moveTo(0, y * scale);
    ctx.lineTo(ARENA.width * scale, y * scale);
  }
  ctx.stroke();
}

// Areas on the ground (pools, fields). They fade out as they end.
function drawZones(ctx, sim, scale) {
  ctx.lineWidth = 2;
  for (const zone of sim.zones) {
    if (!zone.color) continue;
    const fade = Math.max(0, Math.min(1, (zone.duration - zone.age) / ZONE_FADE_TIME));
    drawCircle(ctx, zone.x * scale, zone.y * scale, zone.radius * scale, rgba(zone.color, 0.7 * fade), rgba(zone.color, 0.16 * fade));
  }
}

function drawUnit(ctx, unit, scale) {
  const x = unit.x * scale;
  const y = unit.y * scale;
  const radius = unit.radius * scale;
  const isHero = unit.kind === 'hero';

  ctx.fillStyle = isHero ? ATTR_COLORS[unit.data.primary_attr] : CREEP_COLOR;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isHero ? '#f4f6fa' : '#3a1a14';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Facing tick.
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(unit.facing) * radius * 0.5, y + Math.sin(unit.facing) * radius * 0.5);
  ctx.lineTo(x + Math.cos(unit.facing) * radius * 1.35, y + Math.sin(unit.facing) * radius * 1.35);
  ctx.stroke();

  const barWidth = isHero ? 56 : 34;
  const barTop = y - radius - (isHero ? 16 : 10);
  drawBar(ctx, x - barWidth / 2, barTop, barWidth, isHero ? 6 : 4, unit.hp / unit.stats.maxHp, isHero ? '#4cc35a' : '#d9534f');
  if (isHero) drawBar(ctx, x - barWidth / 2, y - radius - 9, barWidth, 3, unit.mana / unit.stats.maxMana, '#4a8fe0');

  const labels = unitStatusLabels(unit);
  if (labels.length) {
    // A ring in the colour of the worst status, and the words above the health bar.
    drawCircle(ctx, x, y, radius + 4, labels[0].color, null, [4, 3]);
    ctx.textAlign = 'center';
    ctx.font = `bold 11px ${FONT}`;
    labels.forEach((label, row) => {
      ctx.fillStyle = label.color;
      ctx.fillText(label.text, x, barTop - 4 - row * 12);
    });
  }
}

// Range ring and area preview: while aiming, or while the mouse rests on a slot of the bar.
function drawAim(ctx, canvas, game, view, scale) {
  const hero = game.hero;
  const hovered = abilityBarSlots(canvas, hero).find((slot) => inRect(view.mouse, slot));
  const ability = view.targeting ? hero.abilities[view.targeting.index] : hovered && hovered.ability;
  if (!ability) return;
  const cast = ability.def.cast;
  const aimed = cast === 'unit' || cast === 'point';
  const range = abilityCastRange(ability);
  const aoe = abilityAoe(ability);
  const heroX = hero.x * scale;
  const heroY = hero.y * scale;
  ctx.lineWidth = 1.5;

  if (aimed && range > 0) drawCircle(ctx, heroX, heroY, range * scale, 'rgba(255, 255, 255, 0.45)', null, [8, 6]);
  if (!aimed && aoe > 0) drawCircle(ctx, heroX, heroY, aoe * scale, 'rgba(232, 176, 74, 0.8)', 'rgba(232, 176, 74, 0.08)');
  if (!view.targeting) return;

  const enemy = cast === 'unit' ? view.hoverEnemy : null;
  const x = enemy ? enemy.x * scale : view.mouse.x;
  const y = enemy ? enemy.y * scale : view.mouse.y;
  if (cast === 'point' || enemy) {
    if (aoe > 0) drawCircle(ctx, x, y, aoe * scale, 'rgba(232, 176, 74, 0.9)', 'rgba(232, 176, 74, 0.12)');
    if (enemy) drawCircle(ctx, x, y, enemy.radius * scale + 6, '#e8b04a');
  }
  // Crosshair.
  ctx.strokeStyle = enemy || cast === 'point' ? '#e8b04a' : 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.moveTo(view.mouse.x - 10, view.mouse.y);
  ctx.lineTo(view.mouse.x + 10, view.mouse.y);
  ctx.moveTo(view.mouse.x, view.mouse.y - 10);
  ctx.lineTo(view.mouse.x, view.mouse.y + 10);
  ctx.stroke();
}

// Short-lived hints of what an ability just did: an expanding ring or a bolt.
function drawEffects(ctx, view, scale) {
  for (const fx of view.effects) {
    const t = fx.age / FX_TIME;
    ctx.lineWidth = 3;
    if (fx.kind === 'ring') {
      drawCircle(ctx, fx.x * scale, fx.y * scale, fx.radius * scale * (0.4 + 0.6 * t), rgba(fx.color, 1 - t), rgba(fx.color, 0.18 * (1 - t)));
    } else if (fx.kind === 'line') {
      ctx.strokeStyle = rgba(fx.color, 1 - t);
      ctx.beginPath();
      ctx.moveTo(fx.x1 * scale, fx.y1 * scale);
      ctx.lineTo(fx.x2 * scale, fx.y2 * scale);
      ctx.stroke();
    }
  }
}

function drawFloaters(ctx, view, scale) {
  ctx.textAlign = 'center';
  for (const floater of view.floaters) {
    const t = floater.age / FLOATER_TIME;
    const alpha = 1 - t;
    let color = `rgba(255, 255, 255, ${alpha})`;
    let size = 15;
    if (floater.kind === 'crit') {
      color = `rgba(240, 70, 60, ${alpha})`;
      size = 22;
    } else if (floater.kind === 'miss') {
      color = `rgba(170, 178, 194, ${alpha})`;
      size = 13;
    } else if (floater.kind === 'text') {
      color = `rgba(232, 176, 74, ${alpha})`;
      size = 22;
    } else if (floater.onHero) {
      color = `rgba(240, 110, 100, ${alpha})`;
    }
    ctx.font = `bold ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(floater.text, floater.x * scale, floater.y * scale - 24 - t * 26);
  }
}

// ---- HUD ----

function drawSlot(ctx, hero, slot, view) {
  const { ability, x, y, width, height } = slot;
  const info = DB.abilities[ability.key];
  const state = slotState(hero, ability);
  const learned = ability.level > 0;
  const aiming = view.targeting && view.targeting.index === slot.index;

  ctx.fillStyle = state === 'on' ? '#1c3324' : '#1b2030';
  ctx.fillRect(x, y, width, height);

  ctx.globalAlpha = learned ? 1 : 0.4;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d8dce6';
  ctx.font = `11px ${FONT}`;
  const lines = wrapText(ctx, info.dname, width - 8).slice(0, 3);
  lines.forEach((line, row) => {
    ctx.fillText(line, x + width / 2, y + height / 2 + 4 + (row - (lines.length - 1) / 2) * 12);
  });

  // Level pips, bottom left.
  const max = maxAbilityLevel(ability);
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = i < ability.level ? '#e8b04a' : '#3a4154';
    ctx.fillRect(x + 5 + i * 8, y + height - 10, 6, 5);
  }
  // Mana cost, bottom right.
  const cost = abilityManaCost(ability);
  if (cost > 0) {
    ctx.textAlign = 'right';
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillStyle = state === 'mana' ? '#e65a46' : '#6aa8f0';
    ctx.fillText(String(cost), x + width - 5, y + height - 5);
  }
  // Top right: charges, or what kind of ability it is.
  ctx.textAlign = 'right';
  ctx.font = `10px ${FONT}`;
  if (ability.def.charges && learned) {
    ctx.fillStyle = ability.charges > 0 ? '#e8ecf4' : '#e65a46';
    ctx.fillText(`×${ability.charges}`, x + width - 5, y + 14);
  } else if (ability.def.cast === 'passive') {
    ctx.fillStyle = '#8a93a6';
    ctx.fillText('pasiva', x + width - 5, y + 14);
  } else if (ability.def.cast === 'toggle') {
    ctx.fillStyle = ability.autocast ? '#4cc35a' : '#8a93a6';
    ctx.fillText(ability.autocast ? 'prendida' : 'apagada', x + width - 5, y + 14);
  }
  ctx.globalAlpha = 1;

  // Cooldown (or the wait for the next charge): a curtain that drains, with the seconds on top.
  const total = abilityCooldown(ability);
  const waitingCharge = ability.def.charges && learned && ability.charges <= 0;
  const wait = waitingCharge ? Math.max(ability.cooldown, ability.chargeTimer) : ability.cooldown;
  if (learned && wait > 0) {
    const fraction = waitingCharge ? 1 : Math.min(1, wait / total);
    ctx.fillStyle = 'rgba(8, 10, 14, 0.72)';
    ctx.fillRect(x, y + height * (1 - fraction), width, height * fraction);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4f6fa';
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText(wait >= 10 ? String(Math.ceil(wait)) : wait.toFixed(1), x + width / 2, y + height / 2 + 8);
  } else if (state === 'mana') {
    ctx.fillStyle = 'rgba(40, 80, 160, 0.35)';
    ctx.fillRect(x, y, width, height);
  } else if (state === 'silenced') {
    ctx.fillStyle = 'rgba(120, 60, 150, 0.35)';
    ctx.fillRect(x, y, width, height);
  }

  ctx.lineWidth = aiming ? 3 : 2;
  ctx.strokeStyle = aiming ? '#f4f6fa' : SLOT_BORDERS[state] || '#333a4c';
  ctx.strokeRect(x, y, width, height);

  // Hotkey, top left, always readable.
  if (slot.key) {
    ctx.textAlign = 'left';
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = '#e8b04a';
    ctx.fillText(slot.key.toUpperCase(), x + 5, y + 15);
  }

  if (canLevelAbility(hero, ability)) {
    const plus = slot.plus;
    ctx.fillStyle = inRect(view.mouse, plus) ? '#f2c466' : '#e8b04a';
    ctx.fillRect(plus.x, plus.y, plus.width, plus.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#151922';
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText('+', plus.x + plus.width / 2, plus.y + plus.height - 4);
  }
}

function drawTooltip(ctx, canvas, hero, slot) {
  const ability = slot.ability;
  const info = DB.abilities[ability.key];
  const width = 360;
  const x = Math.min(canvas.width - width - 8, Math.max(8, slot.x + slot.width / 2 - width / 2));

  const facts = [CAST_LABELS[ability.def.cast], `Nivel ${ability.level}/${maxAbilityLevel(ability)}`];
  if (abilityManaCost(ability) > 0) facts.push(`Maná ${abilityManaCost(ability)}`);
  if (abilityCooldown(ability) > 0) facts.push(`Recarga ${abilityCooldown(ability)} s`);
  if (abilityCastRange(ability) > 0) facts.push(`Alcance ${abilityCastRange(ability)}`);

  let stateText = SLOT_STATE_TEXT[slotState(hero, ability)];
  const problem = levelProblem(hero, ability);
  if (problem === null) stateText += ` · Podés subirla: clic en + o Shift + ${slot.key ? slot.key.toUpperCase() : 'tecla'}`;
  else if (problem === 'heroLevel') stateText += ` · Sube de nivel cuando tu héroe llegue al ${heroLevelForNextLevel(ability)}`;

  ctx.font = `12px ${FONT}`;
  const factLines = wrapText(ctx, facts.join(' · '), width - 24);
  const stateLines = wrapText(ctx, stateText, width - 24);
  const descLines = wrapText(ctx, info.desc || '', width - 24).slice(0, 5);
  const height = 38 + (factLines.length + stateLines.length + descLines.length) * 16 + 8;
  const y = slot.plus.y - 8 - height;

  ctx.fillStyle = 'rgba(13, 15, 20, 0.94)';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = '#333a4c';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8ecf4';
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillText(info.dname, x + 12, y + 24);
  ctx.font = `12px ${FONT}`;
  let row = y + 44;
  const print = (lines, color) => {
    ctx.fillStyle = color;
    for (const line of lines) {
      ctx.fillText(line, x + 12, row);
      row += 16;
    }
  };
  print(factLines, '#6aa8f0');
  print(stateLines, '#e8b04a');
  print(descLines, '#b8c0d0');
}

function drawAbilityBar(ctx, canvas, game, view) {
  const hero = game.hero;
  const slots = abilityBarSlots(canvas, hero);
  for (const slot of slots) drawSlot(ctx, hero, slot, view);
  const hovered = slots.find((slot) => inRect(view.mouse, slot));
  if (hovered && !view.targeting) drawTooltip(ctx, canvas, hero, hovered);
}

function drawHeroPanel(ctx, canvas, game) {
  const hero = game.hero;
  const stats = hero.stats;
  const panel = heroPanelRect(canvas);
  ctx.fillStyle = 'rgba(13, 15, 20, 0.85)';
  ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8ecf4';
  ctx.font = `bold 18px ${FONT}`;
  const title = `${hero.name} · nivel ${hero.level}`;
  ctx.fillText(title, panel.x + 12, panel.y + 24);
  if (hero.skillPoints > 0) {
    const titleWidth = ctx.measureText(title).width;
    ctx.fillStyle = '#e8b04a';
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillText(hero.skillPoints === 1 ? '1 punto para repartir' : `${hero.skillPoints} puntos para repartir`, panel.x + 22 + titleWidth, panel.y + 24);
  }
  drawBar(ctx, panel.x + 12, panel.y + 34, panel.width - 24, 16, hero.hp / stats.maxHp, '#4cc35a');
  drawBar(ctx, panel.x + 12, panel.y + 54, panel.width - 24, 12, hero.mana / stats.maxMana, '#4a8fe0');
  ctx.fillStyle = '#e8ecf4';
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.ceil(hero.hp)} / ${Math.round(stats.maxHp)}`, panel.x + panel.width / 2, panel.y + 47);
  ctx.font = `10px ${FONT}`;
  ctx.fillText(`${Math.floor(hero.mana)} / ${Math.round(stats.maxMana)}`, panel.x + panel.width / 2, panel.y + 64);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#b8c0d0';
  ctx.font = `13px ${FONT}`;
  const damage = `${Math.round(stats.damageMin)}-${Math.round(stats.damageMax)}`;
  ctx.fillText(
    `Daño ${damage} · Armadura ${stats.armor.toFixed(1)} · Vel. ataque ${Math.round(stats.attackSpeed)} · Mov. ${Math.round(stats.moveSpeed)}`,
    panel.x + 12, panel.y + 86,
  );

  // Active effects stack upwards from the panel, each with the seconds it has left.
  ctx.font = `bold 13px ${FONT}`;
  heroEffects(hero).slice(0, 8).forEach((effect, row) => {
    const text = `${effect.text} · ${effect.time.toFixed(1)} s`;
    const y = panel.y - 10 - row * 22;
    ctx.fillStyle = 'rgba(13, 15, 20, 0.8)';
    ctx.fillRect(panel.x, y - 15, ctx.measureText(text).width + 16, 20);
    ctx.fillStyle = effect.good ? '#7edb8a' : '#f08a7c';
    ctx.fillText(text, panel.x + 8, y);
  });
}

function drawHud(ctx, canvas, game, view) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8ecf4';
  ctx.font = `bold 26px ${FONT}`;
  const title = game.phase === 'prep'
    ? `Ronda ${game.round + 1} en ${Math.ceil(game.timer)}`
    : `Ronda ${game.round} · quedan ${creepsAlive(game)}`;
  ctx.fillText(title, canvas.width / 2, 36);

  drawHeroPanel(ctx, canvas, game);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#8a93a6';
  ctx.font = `13px ${FONT}`;
  const help = [
    'Clic derecho: mover o atacar',
    'A + clic: avanzar atacando · S: frenar',
    'Q W E D F R: habilidades · Esc: cancelar',
    'Shift + tecla o clic en +: subir de nivel',
  ];
  help.forEach((line, row) => {
    ctx.fillText(line, canvas.width - 16, canvas.height - 28 - (help.length - 1 - row) * 18);
  });

  drawAbilityBar(ctx, canvas, game, view);

  let hint = null;
  if (view.targeting) {
    const ability = game.hero.abilities[view.targeting.index];
    const what = ability.def.cast === 'unit' ? 'elegí un enemigo' : 'elegí dónde';
    hint = `${DB.abilities[ability.key].dname}: ${what} (clic derecho o Esc para cancelar)`;
  } else if (view.attackMoveArmed) {
    hint = 'Atacar: elegí dónde';
  }
  if (hint) {
    ctx.textAlign = 'center';
    ctx.fillStyle = view.targeting ? '#e8b04a' : '#e65a46';
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText(hint, canvas.width / 2, 62);
  }

  if (view.message) {
    const alpha = Math.min(1, (MESSAGE_TIME - view.message.age) / 0.4);
    ctx.textAlign = 'center';
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillStyle = `rgba(13, 15, 20, ${0.75 * alpha})`;
    const width = ctx.measureText(view.message.text).width + 28;
    ctx.fillRect(canvas.width / 2 - width / 2, canvas.height - 178, width, 30);
    ctx.fillStyle = `rgba(240, 110, 100, ${alpha})`;
    ctx.fillText(view.message.text, canvas.width / 2, canvas.height - 157);
  }
}

function drawGame(ctx, canvas, game, view) {
  const scale = worldScale(canvas);
  drawArena(ctx, canvas, scale);
  drawZones(ctx, game.sim, scale);

  if (view.marker) {
    const t = view.marker.age / MARKER_TIME;
    ctx.strokeStyle = view.marker.attack ? `rgba(230, 90, 70, ${1 - t})` : `rgba(120, 220, 130, ${1 - t})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(view.marker.x * scale, view.marker.y * scale, 14 * (1 - t) + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (game.phase !== 'lost') drawAim(ctx, canvas, game, view, scale);

  for (const unit of game.sim.units) {
    if (!unit.dead) drawUnit(ctx, unit, scale);
  }

  ctx.fillStyle = '#f2e08a';
  for (const projectile of game.sim.projectiles) {
    ctx.beginPath();
    ctx.arc(projectile.x * scale, projectile.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEffects(ctx, view, scale);
  drawFloaters(ctx, view, scale);
  drawHud(ctx, canvas, game, view);

  if (game.phase === 'lost') {
    ctx.fillStyle = 'rgba(13, 15, 20, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e65a46';
    ctx.font = `bold 64px ${FONT}`;
    ctx.fillText('Caíste', canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillStyle = '#d8dce6';
    ctx.font = `22px ${FONT}`;
    ctx.fillText(`Llegaste a la ronda ${game.round} con ${game.hero.name}. Clic para volver a elegir.`, canvas.width / 2, canvas.height / 2 + 40);
  }
}
