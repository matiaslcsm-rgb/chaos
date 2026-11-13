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
const BAN = { columns: 6, width: 196, height: 52, gap: 7, top: 96 };
const DRAFT = { columns: 4, width: 296, height: 126, gap: 12, top: 88 };
const BAR = { size: 72, gap: 6, bottom: 16, plusHeight: 20, plusGap: 4 };
const INVENTORY = { size: 54, gap: 4, columns: 3, margin: 16 };
const SHOP = { columns: 5, width: 196, height: 96, gap: 8, left: 60, top: 84 };
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
const ITEM_STAT_TEXT = {
  bonus_damage: '+{v} de daño',
  bonus_armor: '+{v} de armadura',
  bonus_attack_speed: '+{v} vel. de ataque',
  bonus_strength: '+{v} Fuerza',
  bonus_agility: '+{v} Agilidad',
  bonus_intellect: '+{v} Inteligencia',
  bonus_movement_speed: '+{v} de movimiento',
  lifesteal_percent: '{v}% de robo de vida',
  spell_amp: '+{v}% daño de habilidades',
  mana_regen_multiplier: '+{v}% regeneración de maná',
};
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

// Hero cards of the selection screen (the offer of hero data), in canvas pixels.
function selectCards(canvas, heroes) {
  const columns = Math.min(CARD.columns, heroes.length);
  const rowWidth = columns * CARD.width + (columns - 1) * CARD.gap;
  const left = (canvas.width - rowWidth) / 2;
  return heroes.map((data, index) => ({
    data,
    x: left + (index % columns) * (CARD.width + CARD.gap),
    y: CARD.top + Math.floor(index / columns) * (CARD.height + CARD.gap),
    width: CARD.width,
    height: CARD.height,
  }));
}

function rerollButton(canvas) {
  return { x: canvas.width / 2 - 170, y: CARD.top + CARD.height + 40, width: 340, height: 38 };
}

// The ability cells of the ban screen, in the batch order (grouped by the hero they come from).
function banCells(canvas) {
  const rowWidth = BAN.columns * BAN.width + (BAN.columns - 1) * BAN.gap;
  const left = (canvas.width - rowWidth) / 2;
  return draftPool().map((key, index) => ({
    key,
    x: left + (index % BAN.columns) * (BAN.width + BAN.gap),
    y: BAN.top + Math.floor(index / BAN.columns) * (BAN.height + BAN.gap),
    width: BAN.width,
    height: BAN.height,
  }));
}

function banPassButton(canvas) {
  return { x: canvas.width / 2 - 130, y: canvas.height - 82, width: 260, height: 34 };
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

// The six inventory slots, bottom right, in hotkey order (Z X C / V B N).
function inventorySlots(canvas) {
  const rows = INVENTORY_SIZE / INVENTORY.columns;
  const step = INVENTORY.size + INVENTORY.gap;
  const left = canvas.width - INVENTORY.margin - INVENTORY.columns * step + INVENTORY.gap;
  const top = canvas.height - INVENTORY.margin - rows * step + INVENTORY.gap;
  return ITEM_HOTKEYS.map((key, slot) => ({
    slot,
    key,
    x: left + (slot % INVENTORY.columns) * step,
    y: top + Math.floor(slot / INVENTORY.columns) * step,
    width: INVENTORY.size,
    height: INVENTORY.size,
  }));
}

function shopButton(canvas) {
  const first = inventorySlots(canvas)[0];
  return { x: first.x, y: first.y - 34, width: canvas.width - INVENTORY.margin - first.x, height: 28 };
}

function shopCards(canvas) {
  return DB.batch.items.map((key, index) => ({
    key,
    x: SHOP.left + (index % SHOP.columns) * (SHOP.width + SHOP.gap),
    y: SHOP.top + Math.floor(index / SHOP.columns) * (SHOP.height + SHOP.gap),
    width: SHOP.width,
    height: SHOP.height,
  }));
}

function shopPanelRect(canvas) {
  const cards = shopCards(canvas);
  const last = cards[cards.length - 1];
  const top = SHOP.top - 36;
  return {
    x: SHOP.left - 12,
    y: top,
    width: SHOP.columns * (SHOP.width + SHOP.gap) - SHOP.gap + 24,
    height: last.y + last.height + 12 - top,
  };
}

// What an item gives, in words: its plain stats, then what is special about it.
function itemSummary(key) {
  const stats = (DB.items[key].attrib || [])
    .filter((attrib) => ITEM_STAT_TEXT[attrib.key])
    .map((attrib) => ITEM_STAT_TEXT[attrib.key].replace('{v}', parseFloat(attrib.value)));
  const special = ITEM_DEFS[key] && ITEM_DEFS[key].text;
  if (!special) return stats.join(' · ') + '.';
  return stats.length ? stats.join(' · ') + '. ' + special : special;
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
    const source = DB.abilities[key] || DB.items[key];
    const name = source ? source.dname : key;
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

// ---- Before the match: bans and hero ----

function drawButton(ctx, rect, text, hover, enabled) {
  ctx.fillStyle = !enabled ? '#1b2030' : hover ? '#3a4154' : '#262c3a';
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = enabled ? '#d8dce6' : '#5a6274';
  ctx.font = `15px ${FONT}`;
  ctx.fillText(text, rect.x + rect.width / 2, rect.y + rect.height / 2 + 5);
}

function abilityNames(keys) {
  return keys.map((key) => DB.abilities[key].dname).join(', ');
}

function drawBan(ctx, canvas, setup, mouse) {
  ctx.fillStyle = '#151922';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8b04a';
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText('Baneá una habilidad', canvas.width / 2, 48);
  ctx.fillStyle = '#8a93a6';
  ctx.font = `14px ${FONT}`;
  ctx.fillText('Nadie va a poder elegirla en esta partida. Las tachadas ya las banearon los rivales.', canvas.width / 2, 76);

  let hovered = null;
  for (const cell of banCells(canvas)) {
    const taken = setup.aiBans.includes(cell.key);
    const hover = !taken && inRect(mouse, cell);
    if (inRect(mouse, cell)) hovered = cell.key;
    const def = ABILITY_DEFS[cell.key];
    ctx.fillStyle = taken ? '#141720' : hover ? '#3a2a2a' : '#1b2030';
    ctx.fillRect(cell.x, cell.y, cell.width, cell.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = hover ? '#e65a46' : def.ult ? '#6b5a2e' : '#333a4c';
    ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);
    ctx.textAlign = 'left';
    ctx.fillStyle = taken ? '#5a6274' : '#e8ecf4';
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillText(DB.abilities[cell.key].dname, cell.x + 8, cell.y + 20, cell.width - 16);
    ctx.fillStyle = taken ? '#4a5060' : '#8a93a6';
    ctx.font = `11px ${FONT}`;
    ctx.fillText(`${def.ult ? 'Definitiva · ' : ''}de ${abilityOwnerName(cell.key)}`, cell.x + 8, cell.y + 38, cell.width - 16);
    if (taken) {
      ctx.strokeStyle = '#e65a46';
      ctx.beginPath();
      ctx.moveTo(cell.x + 6, cell.y + cell.height / 2);
      ctx.lineTo(cell.x + cell.width - 6, cell.y + cell.height / 2);
      ctx.stroke();
    }
  }

  const button = banPassButton(canvas);
  drawButton(ctx, button, 'No banear nada', inRect(mouse, button), true);
  ctx.textAlign = 'center';
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = '#b8c0d0';
  // What the ability under the mouse does (the descriptions come in English from the Dota data).
  const text = hovered ? `${DB.abilities[hovered].dname}: ${DB.abilities[hovered].desc || ''}` : '';
  wrapText(ctx, text, canvas.width - 120).slice(0, 2).forEach((line, row) => {
    ctx.fillText(line, canvas.width / 2, canvas.height - 30 + row * 15);
  });
}

function drawSelect(ctx, canvas, setup, mouse) {
  ctx.fillStyle = '#151922';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8b04a';
  ctx.font = `bold 44px ${FONT}`;
  ctx.fillText('Elegí tu héroe', canvas.width / 2, 90);

  for (const card of selectCards(canvas, setup.offer)) {
    const { data } = card;
    const stats = heroStats(data, 1);
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
    // The hero is only a base of attributes; the abilities come from the draft.
    const lines = [
      `Fuerza ${data.base_str} (+${data.str_gain} por nivel)`,
      `Agilidad ${data.base_agi} (+${data.agi_gain})`,
      `Inteligencia ${data.base_int} (+${data.int_gain})`,
      `Vida ${Math.round(stats.maxHp)} · Maná ${Math.round(stats.maxMana)}`,
      `Daño ${Math.round(stats.damageMin)}-${Math.round(stats.damageMax)} · Alcance ${stats.attackRange}`,
      `Armadura ${stats.armor.toFixed(1)} · Movimiento ${stats.moveSpeed}`,
    ];
    lines.forEach((line, row) => {
      ctx.fillText(line, card.x + 14, card.y + 90 + row * 21);
    });
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8a93a6';
  ctx.font = `15px ${FONT}`;
  ctx.fillText('El héroe pone los atributos. Las habilidades las vas eligiendo durante la partida, de cualquier héroe.', canvas.width / 2, 660);

  const reroll = rerollButton(canvas);
  const label = setup.rerolled ? 'Ya volviste a sortear' : 'Volver a sortear (una vez; el primero queda)';
  drawButton(ctx, reroll, label, inRect(mouse, reroll), canReroll(setup));
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b8c0d0';
  ctx.font = `14px ${FONT}`;
  const bans = setupBans(setup);
  const bansText = bans.length ? `Habilidades baneadas: ${abilityNames(bans)}.` : 'No hay habilidades baneadas.';
  wrapText(ctx, bansText, canvas.width - 160).forEach((line, row) => {
    ctx.fillText(line, canvas.width / 2, reroll.y + 80 + row * 20);
  });
  ctx.fillStyle = '#8a93a6';
  ctx.fillText(setup.humanBan ? `Tu baneo: ${DB.abilities[setup.humanBan].dname}.` : 'No baneaste nada.', canvas.width / 2, reroll.y + 140);
}

// ---- Draft ----

function draftCards(canvas, game) {
  const rowWidth = DRAFT.columns * DRAFT.width + (DRAFT.columns - 1) * DRAFT.gap;
  const left = (canvas.width - rowWidth) / 2;
  return game.draft.options.map((key, index) => ({
    key,
    x: left + (index % DRAFT.columns) * (DRAFT.width + DRAFT.gap),
    y: DRAFT.top + Math.floor(index / DRAFT.columns) * (DRAFT.height + DRAFT.gap),
    width: DRAFT.width,
    height: DRAFT.height,
  }));
}

function draftSkipButton(canvas) {
  return { x: canvas.width / 2 - 170, y: canvas.height - 62, width: 340, height: 36 };
}

function abilityOwnerName(key) {
  const entry = DB.batch.heroes.find((hero) => hero.abilities.includes(key));
  return entry ? DB.heroes[entry.key].localized_name : '';
}

function perLevel(value) {
  return [].concat(value).join('/');
}

function drawDraft(ctx, canvas, game, mouse) {
  ctx.fillStyle = 'rgba(13, 15, 20, 0.88)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8b04a';
  ctx.font = `bold 30px ${FONT}`;
  ctx.fillText(`Elegí una habilidad (${game.draft.number} de ${DRAFT_ROUNDS.length})`, canvas.width / 2, 44);
  ctx.fillStyle = '#8a93a6';
  ctx.font = `14px ${FONT}`;
  const owned = game.hero.abilities.map((ability) => DB.abilities[ability.key].dname).join(', ');
  ctx.fillText(owned ? `Ya tenés: ${owned}` : 'Todavía no tenés ninguna. La partida espera mientras elegís.', canvas.width / 2, 70);

  for (const card of draftCards(canvas, game)) {
    const info = DB.abilities[card.key];
    const def = ABILITY_DEFS[card.key];
    const hover = inRect(mouse, card);
    ctx.fillStyle = hover ? '#2a3142' : '#1b2030';
    ctx.fillRect(card.x, card.y, card.width, card.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = hover ? '#e8b04a' : def.ult ? '#6b5a2e' : '#333a4c';
    ctx.strokeRect(card.x, card.y, card.width, card.height);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8ecf4';
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText(info.dname, card.x + 10, card.y + 22);
    if (def.ult) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#e8b04a';
      ctx.font = `bold 11px ${FONT}`;
      ctx.fillText('DEFINITIVA', card.x + card.width - 10, card.y + 21);
      ctx.textAlign = 'left';
    }
    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = '#8a93a6';
    ctx.fillText(`${CAST_LABELS[def.cast]} · de ${abilityOwnerName(card.key)}`, card.x + 10, card.y + 40);
    const costs = [];
    if (info.mc !== undefined && parseFloat(perLevel(info.mc)) > 0) costs.push(`Maná ${perLevel(info.mc)}`);
    if (info.cd !== undefined && parseFloat(perLevel(info.cd)) > 0) costs.push(`Recarga ${perLevel(info.cd)} s`);
    ctx.fillStyle = '#6aa8f0';
    ctx.fillText(costs.join(' · ') || 'Sin costo', card.x + 10, card.y + 57);
    ctx.fillStyle = '#b8c0d0';
    ctx.font = `11px ${FONT}`;
    wrapText(ctx, info.desc || '', card.width - 20).slice(0, 4).forEach((line, row) => {
      ctx.fillText(line, card.x + 10, card.y + 75 + row * 14);
    });
  }

  const button = draftSkipButton(canvas);
  ctx.fillStyle = inRect(mouse, button) ? '#3a4154' : '#262c3a';
  ctx.fillRect(button.x, button.y, button.width, button.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d8dce6';
  ctx.font = `15px ${FONT}`;
  ctx.fillText('Cerrar: que me toque una al azar', canvas.width / 2, button.y + 24);
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
  drawBar(ctx, x - barWidth / 2, barTop, barWidth, isHero ? 6 : 4, unit.hp / unit.stats.maxHp, isHero && unit.team === HERO_TEAM ? '#4cc35a' : '#d9534f');
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

// Gold, the shop button and the six slots. Returns the slot under the mouse, if it holds an item.
function drawInventory(ctx, canvas, game, view) {
  const hero = game.hero;
  const open = shopOpen(game);
  const button = shopButton(canvas);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#e8b04a';
  ctx.font = `bold 17px ${FONT}`;
  ctx.fillText(`Oro: ${Math.floor(hero.gold)}`, button.x + button.width, button.y - 10);
  ctx.fillStyle = !open ? '#1b2030' : view.shop || inRect(view.mouse, button) ? '#e8b04a' : '#8a6a2c';
  ctx.fillRect(button.x, button.y, button.width, button.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = open ? '#151922' : '#5a6274';
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText(open ? (view.shop ? 'Cerrar tienda (T)' : 'Tienda (T)') : 'Tienda cerrada', button.x + button.width / 2, button.y + 19);

  let hovered = null;
  for (const slot of inventorySlots(canvas)) {
    const item = hero.items[slot.slot];
    const { x, y, width, height } = slot;
    ctx.fillStyle = item ? '#1b2030' : 'rgba(13, 15, 20, 0.7)';
    ctx.fillRect(x, y, width, height);
    if (item) {
      if (inRect(view.mouse, slot)) hovered = slot;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#d8dce6';
      ctx.font = `10px ${FONT}`;
      const lines = wrapText(ctx, DB.items[item.key].dname, width - 6).slice(0, 3);
      lines.forEach((line, row) => {
        ctx.fillText(line, x + width / 2, y + height / 2 + 8 + (row - (lines.length - 1) / 2) * 11);
      });
      if (item.cooldown > 0) {
        ctx.fillStyle = 'rgba(8, 10, 14, 0.72)';
        ctx.fillRect(x, y, width, height);
        ctx.fillStyle = '#f4f6fa';
        ctx.font = `bold 18px ${FONT}`;
        ctx.fillText(item.cooldown >= 10 ? String(Math.ceil(item.cooldown)) : item.cooldown.toFixed(1), x + width / 2, y + height / 2 + 7);
      }
    }
    const active = item && item.def.active;
    ctx.lineWidth = 2;
    ctx.strokeStyle = active ? (itemProblem(hero, item) ? '#5a6274' : '#e8b04a') : '#333a4c';
    ctx.strokeRect(x, y, width, height);
    ctx.textAlign = 'left';
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillStyle = active ? '#e8b04a' : '#5a6274';
    ctx.fillText(slot.key.toUpperCase(), x + 4, y + 12);
  }
  return hovered;
}

function drawItemTooltip(ctx, canvas, game, slot) {
  const item = game.hero.items[slot.slot];
  const info = DB.items[item.key];
  const width = 320;
  ctx.font = `12px ${FONT}`;
  const lines = wrapText(ctx, itemSummary(item.key), width - 24);
  const facts = [];
  if (item.def.active) {
    facts.push(`Se usa con ${slot.key.toUpperCase()} o con clic`);
    if (info.mc) facts.push(`Maná ${info.mc}`);
    if (info.cd) facts.push(`Recarga ${info.cd} s`);
  }
  facts.push(shopOpen(game) ? `Clic derecho: vender por ${sellPrice(item.key)}` : 'Se vende entre rondas');
  const factLines = wrapText(ctx, facts.join(' · '), width - 24);
  const height = 38 + (lines.length + factLines.length) * 16 + 6;
  const x = canvas.width - INVENTORY.margin - width;
  const y = shopButton(canvas).y - 34 - height;
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
  for (const [group, color] of [[lines, '#b8c0d0'], [factLines, '#e8b04a']]) {
    ctx.fillStyle = color;
    for (const line of group) {
      ctx.fillText(line, x + 12, row);
      row += 16;
    }
  }
}

function drawShop(ctx, canvas, game, view) {
  const hero = game.hero;
  const panel = shopPanelRect(canvas);
  ctx.fillStyle = 'rgba(13, 15, 20, 0.95)';
  ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
  ctx.strokeStyle = '#8a6a2c';
  ctx.lineWidth = 2;
  ctx.strokeRect(panel.x, panel.y, panel.width, panel.height);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8b04a';
  ctx.font = `bold 18px ${FONT}`;
  ctx.fillText('Tienda', panel.x + 12, panel.y + 25);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8a93a6';
  ctx.font = `13px ${FONT}`;
  ctx.fillText('Clic para comprar. Las partes que ya tenés se usan y pagás lo que falta.', panel.x + panel.width - 12, panel.y + 24);

  for (const card of shopCards(canvas)) {
    const info = DB.items[card.key];
    const plan = purchasePlan(hero, card.key);
    const problem = buyProblem(hero, card.key);
    const hover = inRect(view.mouse, card);
    ctx.fillStyle = hover ? '#2a3142' : '#1b2030';
    ctx.fillRect(card.x, card.y, card.width, card.height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = hover && !problem ? '#e8b04a' : '#333a4c';
    ctx.strokeRect(card.x, card.y, card.width, card.height);
    ctx.textAlign = 'left';
    ctx.fillStyle = problem ? '#8a93a6' : '#e8ecf4';
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillText(info.dname, card.x + 8, card.y + 18);
    ctx.textAlign = 'right';
    ctx.fillStyle = problem === 'gold' ? '#e65a46' : '#e8b04a';
    ctx.fillText(String(plan.cost), card.x + card.width - 8, card.y + 18);
    ctx.textAlign = 'left';
    ctx.font = `11px ${FONT}`;
    let text = itemSummary(card.key);
    const parts = info.components || [];
    if (plan.used.length) text += ` Usa tu ${plan.used.map((part) => DB.items[part].dname).join(' y tu ')}.`;
    else if (parts.length) text += ` Se arma con ${parts.map((part) => DB.items[part].dname).join(' + ')}.`;
    ctx.fillStyle = '#b8c0d0';
    wrapText(ctx, text, card.width - 16).slice(0, 5).forEach((line, row) => {
      ctx.fillText(line, card.x + 8, card.y + 34 + row * 13);
    });
  }
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
  const title = `${hero.name} · nivel ${hero.level} · ${aegisText(hero)}`;
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
  ctx.fillText(roundTitle(game), canvas.width / 2, 36);

  drawHeroPanel(ctx, canvas, game);
  if (game.match) {
    drawPlayerTable(ctx, canvas, game.match, view);
    if (view.spy !== null) drawSpyPanel(ctx, canvas, game.match, view);
    if (!game.draft) drawDuelPanel(ctx, canvas, game.match, view);
  }

  const shopping = view.shop && shopOpen(game);
  // Controls reminder, top right, out of the way of the inventory (the shop covers that corner).
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8a93a6';
  ctx.font = `12px ${FONT}`;
  const help = [
    'Clic derecho: mover o atacar',
    'A + clic: avanzar atacando · S: frenar',
    'Q W E D F R: habilidades · Esc: cancelar',
    'Shift + tecla o clic en +: subir de nivel',
    'Z X C V B N: ítems · T: tienda (entre rondas)',
  ];
  if (!shopping) {
    help.forEach((line, row) => {
      ctx.fillText(line, canvas.width - 16, 22 + row * 16);
    });
  }

  const hoveredItem = drawInventory(ctx, canvas, game, view);
  drawAbilityBar(ctx, canvas, game, view);
  if (shopping) drawShop(ctx, canvas, game, view);
  if (hoveredItem) drawItemTooltip(ctx, canvas, game, hoveredItem);

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
  } else if (nextWaveText(game)) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b8c0d0';
    ctx.font = `15px ${FONT}`;
    ctx.fillText(nextWaveText(game), canvas.width / 2, 62);
  }

  if (view.message) {
    const alpha = Math.min(1, (MESSAGE_TIME - view.message.age) / 0.4);
    ctx.textAlign = 'center';
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillStyle = `rgba(13, 15, 20, ${(shopping ? 1 : 0.75) * alpha})`;
    const width = ctx.measureText(view.message.text).width + 28;
    // Over the shop's title strip while shopping, so it does not cover the cards.
    const top = shopping ? shopPanelRect(canvas).y + 3 : 74;
    ctx.fillRect(canvas.width / 2 - width / 2, top, width, 30);
    ctx.fillStyle = `rgba(240, 110, 100, ${alpha})`;
    ctx.fillText(view.message.text, canvas.width / 2, top + 21);
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
  if (game.draft) drawDraft(ctx, canvas, game, view.mouse);

  const ending = endingText(game);
  if (ending) {
    ctx.fillStyle = 'rgba(13, 15, 20, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = ending.color;
    ctx.font = `bold 56px ${FONT}`;
    ctx.fillText(ending.title, canvas.width / 2, 120);
    ctx.fillStyle = '#d8dce6';
    ctx.font = `20px ${FONT}`;
    ctx.fillText(ending.line, canvas.width / 2, 160);
    if (game.match) drawPodium(ctx, canvas, game);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8a93a6';
    ctx.font = `16px ${FONT}`;
    ctx.fillText('Clic para volver a elegir.', canvas.width / 2, canvas.height - 40);
  }
}

// ---- The players' table (top left) ----

const TABLE = { x: 16, y: 16, width: 380, header: 22, row: 24 };
const PLAYER_STATE_TEXT = {
  fight: { text: 'peleando', color: '#e8b04a' },
  done: { text: 'listo', color: '#7edb8a' },
  prep: { text: '', color: '#8a93a6' },
  out: { text: 'afuera', color: '#e65a46' },
  duel: { text: 'en duelo', color: '#c792ea' },
  nextDuel: { text: 'a duelo', color: '#c792ea' },
};

// One clickable row per player, in the table's order (best first).
function playerTableRows(canvas, match) {
  return playerStanding(match).map((player, i) => ({
    player,
    x: TABLE.x,
    y: TABLE.y + TABLE.header + i * TABLE.row,
    width: TABLE.width,
    height: TABLE.row,
  }));
}

// Next to the table, below the round title, the aiming hint and the messages (they end at y = 104).
function spyPanelRect(canvas) {
  return { x: TABLE.x + TABLE.width + 8, y: 112, width: 280, height: 250 };
}

function drawPlayerTable(ctx, canvas, match, view) {
  const rows = playerTableRows(canvas, match);
  ctx.fillStyle = 'rgba(13, 15, 20, 0.8)';
  ctx.fillRect(TABLE.x, TABLE.y, TABLE.width, TABLE.header + rows.length * TABLE.row + 4);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8a93a6';
  ctx.font = `11px ${FONT}`;
  ctx.fillText('Jugador · héroe', TABLE.x + 24, TABLE.y + 15);
  ctx.textAlign = 'right';
  ctx.fillText('nivel', TABLE.x + 210, TABLE.y + 15);
  ctx.fillText('valor', TABLE.x + 262, TABLE.y + 15);
  ctx.fillText('vidas', TABLE.x + 316, TABLE.y + 15);
  for (const row of rows) {
    const player = row.player;
    const hero = player.game.hero;
    const state = playerState(match, player);
    const out = state === 'out';
    if (view.spy === player.index || inRect(view.mouse, row)) {
      ctx.fillStyle = 'rgba(232, 236, 244, 0.08)';
      ctx.fillRect(row.x, row.y, row.width, row.height);
    }
    ctx.fillStyle = player.color;
    ctx.globalAlpha = out ? 0.4 : 1;
    ctx.fillRect(row.x + 8, row.y + 7, 10, 10);
    ctx.textAlign = 'left';
    ctx.fillStyle = player.human ? '#e8ecf4' : '#c8cede';
    ctx.font = `${player.human ? 'bold ' : ''}13px ${FONT}`;
    ctx.fillText(player.name, row.x + 24, row.y + 17);
    ctx.fillStyle = '#8a93a6';
    ctx.font = `12px ${FONT}`;
    ctx.fillText(hero.name, row.x + 84, row.y + 17);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#c8cede';
    ctx.fillText(out ? `${player.place}º` : String(hero.level), row.x + 210, row.y + 17);
    ctx.fillStyle = '#e8c45a';
    ctx.fillText(out ? '—' : String(playerValue(player)), row.x + 262, row.y + 17);
    ctx.fillStyle = hero.curses ? '#f08a7c' : '#c8cede';
    ctx.fillText(out ? '' : livesText(hero), row.x + 316, row.y + 17);
    const label = PLAYER_STATE_TEXT[state];
    ctx.fillStyle = label.color;
    ctx.font = `11px ${FONT}`;
    ctx.fillText(label.text, row.x + row.width - 8, row.y + 17);
    ctx.globalAlpha = 1;
  }
}

// What a rival has: their abilities with level, and their items. Opens with a click on the table.
function drawSpyPanel(ctx, canvas, match, view) {
  const player = match.players[view.spy];
  if (!player) return;
  const hero = player.game.hero;
  const panel = spyPanelRect(canvas);
  ctx.fillStyle = 'rgba(13, 15, 20, 0.92)';
  ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
  ctx.strokeStyle = player.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(panel.x + 1, panel.y + 1, panel.width - 2, panel.height - 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8ecf4';
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillText(`${player.name} · ${hero.name} · nivel ${hero.level}`, panel.x + 12, panel.y + 22);
  ctx.fillStyle = '#8a93a6';
  ctx.font = `12px ${FONT}`;
  const out = playerState(match, player) === 'out';
  ctx.fillText(out ? `Afuera en la ronda ${player.outRound}, puesto ${player.place}` : `Oro ${hero.gold} · valor ${playerValue(player)} · ${aegisText(hero)}`, panel.x + 12, panel.y + 40);
  let y = panel.y + 62;
  ctx.fillStyle = '#b8c0d0';
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillText('Habilidades', panel.x + 12, y);
  ctx.font = `12px ${FONT}`;
  for (const ability of hero.abilities) {
    y += 17;
    ctx.fillStyle = ability.level > 0 ? '#d8dce6' : '#6a7284';
    ctx.fillText(`${DB.abilities[ability.key].dname}${ability.def.ult ? ' (definitiva)' : ''} · ${ability.level}`, panel.x + 18, y);
  }
  if (!hero.abilities.length) {
    y += 17;
    ctx.fillStyle = '#6a7284';
    ctx.fillText('Todavía ninguna', panel.x + 18, y);
  }
  y += 26;
  ctx.fillStyle = '#b8c0d0';
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillText('Ítems', panel.x + 12, y);
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = '#d8dce6';
  const items = hero.items.map((item) => DB.items[item.key].dname).join(', ') || 'Ninguno';
  for (const line of wrapText(ctx, items, panel.width - 30).slice(0, 4)) {
    y += 17;
    ctx.fillText(line, panel.x + 18, y);
  }
  ctx.fillStyle = '#6a7284';
  ctx.font = `11px ${FONT}`;
  ctx.fillText('Clic de nuevo o Esc para cerrar', panel.x + 12, panel.y + panel.height - 10);
}

// The round title: the shared clock, your wave, or the wait for the others.
function roundTitle(game) {
  const match = game.match;
  if (!match) {
    return game.phase === 'prep' ? `Ronda ${game.round + 1} en ${Math.ceil(game.timer)}` : `Ronda ${game.round} · quedan ${creepsAlive(game)}`;
  }
  if (match.phase === 'prep') return `Ronda ${match.round + 1} en ${Math.ceil(match.timer)}`;
  if (game.phase === 'duel') {
    const duel = match.duel;
    const rival = duel.a.game === game ? duel.b : duel.a;
    return `Duelo contra ${rival.name} · ${Math.max(0, Math.ceil(DUEL_TIME_LIMIT - duel.time))} s`;
  }
  if (game.phase === 'fight') return `Ronda ${match.round} · quedan ${creepsAlive(game)}`;
  const busy = match.players.filter((player) => playerState(match, player) === 'fight').length;
  return `Ronda ${match.round} · listo, ${busy === 1 ? 'falta 1 jugador' : `faltan ${busy} jugadores`}`;
}

// The closing screen: you fell (and in which place), or you are the last one standing. Null while playing.
function endingText(game) {
  const match = game.match;
  const player = match ? humanPlayer(match) : null;
  if (game.phase === 'lost') {
    const place = player && player.place ? `, puesto ${player.place} de ${match.players.length}` : '';
    return { title: 'Caíste', color: '#e65a46', line: `Llegaste a la ronda ${game.round} con ${game.hero.name}${place}.` };
  }
  if (match && match.over) {
    return { title: '¡Ganaste!', color: '#7edb8a', line: `Quedaste último en pie en la ronda ${match.round} con ${game.hero.name}.` };
  }
  return null;
}

// ---- Duels and bets (top right) ----

const BET_PANEL = { width: 420, height: 176, top: 112, margin: 16 };
const BET_CHIPS = [
  { key: 'min', label: `${BET.min}` },
  { key: 'quarter', label: '¼ de tu oro' },
  { key: 'half', label: '½ de tu oro' },
];

function betPanelRect(canvas) {
  return { x: canvas.width - BET_PANEL.margin - BET_PANEL.width, y: BET_PANEL.top, width: BET_PANEL.width, height: BET_PANEL.height };
}

function betChipAmount(player, key) {
  if (key === 'min') return BET.min;
  return key === 'half' ? maxBet(player) : Math.floor(player.game.hero.gold / 4);
}

// The clickable parts of the betting panel: the three amounts and the two sides.
function betControls(canvas) {
  const panel = betPanelRect(canvas);
  const chipWidth = (panel.width - 24 - 2 * 8) / 3;
  const sideWidth = (panel.width - 24 - 8) / 2;
  return {
    chips: BET_CHIPS.map((chip, i) => ({ key: chip.key, label: chip.label, x: panel.x + 12 + i * (chipWidth + 8), y: panel.y + 112, width: chipWidth, height: 22 })),
    sides: ['a', 'b'].map((side, i) => ({ side, x: panel.x + 12 + i * (sideWidth + 8), y: panel.y + 142, width: sideWidth, height: 26 })),
  };
}

// What the duel panel shows to the human right now, or null for nothing.
function duelPanelMode(match) {
  const human = humanPlayer(match);
  if (!human || human.game.phase === 'lost') return null;
  const duel = match.duel;
  if (match.phase === 'prep' && duel && duel.state === 'betting') {
    if (isDuelist(duel, human)) return 'yourDuel';
    return duel.bets.some((bet) => bet.player === human) ? 'betPlaced' : 'bet';
  }
  if (match.phase === 'fight' && duel && duel.state === 'fighting' && !isDuelist(duel, human)) return 'watching';
  if (match.phase === 'fight' && match.lastDuel && match.lastDuel === duel && duel.state === 'done') return 'result';
  return null;
}

function duelSide(duel, side) {
  return side === 'a' ? duel.a : duel.b;
}

function drawDuelist(ctx, duel, side, x, y, total) {
  const player = duelSide(duel, side);
  const hero = player.game.hero;
  ctx.textAlign = 'left';
  ctx.fillStyle = player.color;
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillText(`${player.name} · ${hero.name}`, x, y);
  ctx.fillStyle = '#b8c0d0';
  ctx.font = `12px ${FONT}`;
  ctx.fillText(`Nivel ${hero.level} · valor ${playerValue(player)}`, x, y + 18);
  ctx.fillText(`Duelos ganados: ${player.duelsWon || 0}`, x, y + 34);
  ctx.fillStyle = '#e8c45a';
  ctx.fillText(`Apostado: ${total}`, x, y + 50);
}

function drawButton(ctx, rect, label, active, hover) {
  ctx.fillStyle = active ? '#3a4a6a' : hover ? '#2a3348' : '#1c2230';
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = active ? '#8fb4f0' : '#4a5468';
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
  ctx.fillStyle = '#e8ecf4';
  ctx.textAlign = 'center';
  ctx.font = `12px ${FONT}`;
  ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 + 4);
}

// The lines under the two duelists, for every mode but betting (which shows the buttons).
function duelPanelLines(match, mode, duel) {
  const human = humanPlayer(match);
  const bet = duel.bets.find((entry) => entry.player === human);
  if (mode === 'betPlaced') return [`Apostaste ${bet.amount} a ${duelSide(duel, bet.side).name}.`, 'Se cobra cuando termina el duelo.'];
  if (mode === 'yourDuel') {
    const rival = duel.a === human ? duel.b : duel.a;
    return [`Peleás contra ${rival.name} en vez de la oleada. Si ganás, cobrás ${duelPrize(duel.round)}`, 'más tu apuesta gratis. Los demás apuestan.'];
  }
  if (mode === 'watching') return [bet ? `Apostaste ${bet.amount} a ${duelSide(duel, bet.side).name}.` : 'No apostaste en este duelo.', ''];
  const mine = duel.result.payouts.find((entry) => entry.player === human);
  if (!mine) return ['No apostaste en este duelo.', ''];
  if (mine.free) return [mine.pays ? `Ganaste el duelo: ${duel.result.prize} de premio y ${mine.pays} de tu apuesta gratis.` : 'Perdiste el duelo.', ''];
  return [mine.pays ? `Acertaste: cobraste ${mine.pays} por tus ${mine.amount}.` : `Erraste: perdiste tus ${mine.amount}.`, ''];
}

function drawDuelPanel(ctx, canvas, match, view) {
  const mode = duelPanelMode(match);
  if (!mode) return;
  const human = humanPlayer(match);
  const duel = mode === 'result' ? match.lastDuel : match.duel;
  const panel = betPanelRect(canvas);
  const totals = betTotals(duel);
  const x = panel.x + 12;
  ctx.fillStyle = 'rgba(13, 15, 20, 0.9)';
  ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
  ctx.strokeStyle = '#c792ea';
  ctx.lineWidth = 2;
  ctx.strokeRect(panel.x + 1, panel.y + 1, panel.width - 2, panel.height - 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8ecf4';
  ctx.font = `bold 15px ${FONT}`;
  const title = {
    bet: `Duelo de la ronda ${duel.round}: ¿quién gana?`,
    betPlaced: `Duelo de la ronda ${duel.round}`,
    yourDuel: `Duelo de la ronda ${duel.round}: te toca pelear`,
    watching: `Duelo en curso · ${Math.max(0, Math.ceil(DUEL_TIME_LIMIT - duel.time))} s`,
    result: `Duelo de la ronda ${duel.round}: ganó ${duel.result ? duel.result.winner.name : ''}`,
  }[mode];
  ctx.fillText(title, x, panel.y + 22);
  drawDuelist(ctx, duel, 'a', x, panel.y + 46, totals.a);
  drawDuelist(ctx, duel, 'b', x + panel.width / 2, panel.y + 46, totals.b);

  if (mode === 'bet') {
    const controls = betControls(canvas);
    for (const chip of controls.chips) {
      drawButton(ctx, chip, `${chip.label} (${betChipAmount(human, chip.key)})`, view.betAmount === chip.key, inRect(view.mouse, chip));
    }
    for (const side of controls.sides) {
      drawButton(ctx, side, `Apostar a ${duelSide(duel, side.side).name}`, false, inRect(view.mouse, side));
    }
    return;
  }
  if (mode === 'watching') {
    const width = panel.width / 2 - 24;
    drawBar(ctx, x, panel.y + 112, width, 10, healthShare(duel.a.game.hero), '#4cc35a');
    drawBar(ctx, x + panel.width / 2, panel.y + 112, width, 10, healthShare(duel.b.game.hero), '#4cc35a');
  }
  const lines = duelPanelLines(match, mode, duel);
  ctx.textAlign = 'left';
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = '#e8ecf4';
  ctx.fillText(lines[0], x, panel.y + 146);
  ctx.fillStyle = '#b8c0d0';
  ctx.fillText(lines[1], x, panel.y + 164);
}

// ---- Lives and the closing screen ----

// "2 Aegis", plus the curse marks if there are any.
function aegisText(hero) {
  const marks = hero.curses ? ` · ${hero.curses} ${hero.curses === 1 ? 'marca' : 'marcas'}` : '';
  return `${hero.aegis} Aegis${marks}`;
}

// Short form for the table: Aegis left, and the marks with an x.
function livesText(hero) {
  return hero.curses ? `${hero.aegis} ·${hero.curses}✖` : String(hero.aegis);
}

const INCOME_LABELS = { creeps: 'creeps', rounds: 'rondas', duels: 'duelos', bets: 'apuestas' };

// One line per player for the closing screen.
function podiumLines(match) {
  return playerStanding(match).map((player) => {
    const hero = player.game.hero;
    let fate = 'sigue en juego';
    if (player.place === 1) fate = 'ganó';
    else if (player.place) fate = `cayó en la ronda ${player.outRound}`;
    const place = player.place ? `${player.place}º` : '·';
    return { player, text: `${place}  ${player.name} · ${hero.name} · ${fate}` };
  });
}

function incomeText(game) {
  return Object.keys(INCOME_LABELS).map((key) => `${INCOME_LABELS[key]} ${game.income[key]}`).join(' · ');
}

function drawPodium(ctx, canvas, game) {
  const lines = podiumLines(game.match);
  ctx.textAlign = 'left';
  const x = canvas.width / 2 - 200;
  lines.forEach((line, i) => {
    ctx.fillStyle = line.player.color;
    ctx.fillRect(x, 202 + i * 30, 12, 12);
    ctx.fillStyle = line.player.human ? '#e8ecf4' : '#b8c0d0';
    ctx.font = `${line.player.human ? 'bold ' : ''}17px ${FONT}`;
    ctx.fillText(line.text, x + 22, 213 + i * 30);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8c45a';
  ctx.font = `16px ${FONT}`;
  ctx.fillText(`De dónde salió tu oro: ${incomeText(game)}`, canvas.width / 2, 213 + lines.length * 30 + 20);
}

// Between rounds, what is coming (the mod announces the next wave). Null during a round, or if your next round
// is a duel.
function nextWaveText(game) {
  const match = game.match;
  const prep = match ? match.phase === 'prep' : game.phase === 'prep';
  if (!prep || game.phase === 'lost') return null;
  if (match && match.duel && match.duel.state === 'betting' && isDuelist(match.duel, humanPlayer(match))) return null;
  const round = (match ? match.round : game.round) + 1;
  const heavy = round % WAVE.heavyEvery === 0 ? ' pesada' : '';
  return `Próxima oleada${heavy}: ${waveText(waveForRound(round))}`;
}
