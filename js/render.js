'use strict';

// Draws the game with plain shapes. Reads the game state, never changes it.

const ATTR_COLORS = { str: '#c0392b', agi: '#27ae60', int: '#2980b9', all: '#8e44ad' };
const ATTR_LABELS = { str: 'Fuerza', agi: 'Agilidad', int: 'Inteligencia', all: 'Universal' };
const CREEP_COLOR = '#a84a3a';
const FLOATER_TIME = 0.8;
const MARKER_TIME = 0.5;
const CARD = { width: 220, height: 220, gap: 20, columns: 5, top: 150 };

function worldScale(canvas) {
  return canvas.width / ARENA.width;
}

// Hero cards of the selection screen, in canvas pixels. Shared with the click handling.
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

function drawSelect(ctx, canvas, heroes, mouse) {
  ctx.fillStyle = '#151922';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8b04a';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('Elegí tu héroe', canvas.width / 2, 90);

  for (const card of selectCards(canvas, heroes)) {
    const { data, abilities } = card.hero;
    const hover = mouse.x >= card.x && mouse.x <= card.x + card.width && mouse.y >= card.y && mouse.y <= card.y + card.height;
    ctx.fillStyle = hover ? '#262c3a' : '#1b2030';
    ctx.fillRect(card.x, card.y, card.width, card.height);
    ctx.fillStyle = ATTR_COLORS[data.primary_attr];
    ctx.fillRect(card.x, card.y, card.width, 6);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8ecf4';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(data.localized_name, card.x + 14, card.y + 38);
    ctx.fillStyle = '#8a93a6';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`${ATTR_LABELS[data.primary_attr]} · ${data.attack_type === 'Melee' ? 'cuerpo a cuerpo' : 'a distancia'}`, card.x + 14, card.y + 60);
    ctx.fillStyle = '#b8c0d0';
    ctx.font = '14px system-ui, sans-serif';
    abilities.forEach((ability, row) => {
      ctx.fillText(ability.dname, card.x + 14, card.y + 92 + row * 22);
    });
  }
}

function drawBar(ctx, x, y, width, height, fraction, color) {
  ctx.fillStyle = '#0d0f14';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width * Math.max(0, Math.min(1, fraction)), height);
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
  drawBar(ctx, x - barWidth / 2, y - radius - (isHero ? 16 : 10), barWidth, isHero ? 6 : 4, unit.hp / unit.stats.maxHp, isHero ? '#4cc35a' : '#d9534f');
  if (isHero) drawBar(ctx, x - barWidth / 2, y - radius - 9, barWidth, 3, unit.mana / unit.stats.maxMana, '#4a8fe0');
}

function drawHud(ctx, canvas, game) {
  const hero = game.hero;
  const stats = hero.stats;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8ecf4';
  ctx.font = 'bold 26px system-ui, sans-serif';
  const title = game.phase === 'prep'
    ? `Ronda ${game.round + 1} en ${Math.ceil(game.timer)}`
    : `Ronda ${game.round} · quedan ${creepsAlive(game)}`;
  ctx.fillText(title, canvas.width / 2, 36);

  const panel = { x: 16, y: canvas.height - 112, width: 380, height: 96 };
  ctx.fillStyle = 'rgba(13, 15, 20, 0.85)';
  ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8ecf4';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`${hero.name} · nivel ${hero.level}`, panel.x + 12, panel.y + 24);
  drawBar(ctx, panel.x + 12, panel.y + 34, panel.width - 24, 16, hero.hp / stats.maxHp, '#4cc35a');
  drawBar(ctx, panel.x + 12, panel.y + 54, panel.width - 24, 10, hero.mana / stats.maxMana, '#4a8fe0');
  ctx.fillStyle = '#e8ecf4';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.ceil(hero.hp)} / ${Math.round(stats.maxHp)}`, panel.x + panel.width / 2, panel.y + 47);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#b8c0d0';
  ctx.font = '13px system-ui, sans-serif';
  const damage = `${Math.round(stats.damageMin)}-${Math.round(stats.damageMax)}`;
  ctx.fillText(
    `Daño ${damage} · Armadura ${stats.armor.toFixed(1)} · Vel. ataque ${Math.round(stats.attackSpeed)} · Mov. ${stats.moveSpeed}`,
    panel.x + 12, panel.y + 84,
  );

  ctx.textAlign = 'right';
  ctx.fillStyle = '#8a93a6';
  ctx.fillText('Clic derecho: mover o atacar · A + clic: avanzar atacando · S: frenar', canvas.width - 16, canvas.height - 28);
}

function drawGame(ctx, canvas, game, view) {
  const scale = worldScale(canvas);
  drawArena(ctx, canvas, scale);

  if (view.marker) {
    const t = view.marker.age / MARKER_TIME;
    ctx.strokeStyle = view.marker.attack ? `rgba(230, 90, 70, ${1 - t})` : `rgba(120, 220, 130, ${1 - t})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(view.marker.x * scale, view.marker.y * scale, 14 * (1 - t) + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const unit of game.sim.units) {
    if (!unit.dead) drawUnit(ctx, unit, scale);
  }

  ctx.fillStyle = '#f2e08a';
  for (const projectile of game.sim.projectiles) {
    ctx.beginPath();
    ctx.arc(projectile.x * scale, projectile.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.font = 'bold 15px system-ui, sans-serif';
  for (const floater of view.floaters) {
    const t = floater.age / FLOATER_TIME;
    ctx.fillStyle = floater.onHero ? `rgba(240, 110, 100, ${1 - t})` : `rgba(255, 255, 255, ${1 - t})`;
    ctx.fillText(floater.text, floater.x * scale, floater.y * scale - 24 - t * 26);
  }

  drawHud(ctx, canvas, game);

  if (view.attackMoveArmed) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e65a46';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('Atacar: elegí dónde', canvas.width / 2, 62);
  }

  if (game.phase === 'lost') {
    ctx.fillStyle = 'rgba(13, 15, 20, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e65a46';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('Caíste', canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillStyle = '#d8dce6';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText(`Llegaste a la ronda ${game.round} con ${game.hero.name}. Clic para volver a elegir.`, canvas.width / 2, canvas.height / 2 + 40);
  }
}
