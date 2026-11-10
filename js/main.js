'use strict';

// Boot, input and the frame loop. The only file that knows about real time and the mouse.

const GAME_VERSION = '0.1.0 · Etapa 3: héroe contra oleadas';
document.getElementById('game-version').textContent = `Versión ${GAME_VERSION}`;

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');

const SIM_STEP = 1 / 60;
const MAX_FRAME_TIME = 0.1;
const CLICK_SLACK = 10;

let heroes = [];
let game = null;
const view = { floaters: [], marker: null, attackMoveArmed: false, mouse: { x: 0, y: 0 } };

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height,
  };
}

function worldPoint(point) {
  const scale = worldScale(canvas);
  return { x: point.x / scale, y: point.y / scale };
}

function enemyAt(point) {
  return game.sim.units.find((unit) => !unit.dead && unit.team !== game.hero.team
    && distance(unit, point) <= unit.radius + CLICK_SLACK) || null;
}

function startGame(heroData) {
  game = createGame(heroData, Date.now());
  view.floaters = [];
  view.marker = null;
  view.attackMoveArmed = false;
}

function onSelectClick(point) {
  const card = selectCards(canvas, heroes).find((c) => point.x >= c.x && point.x <= c.x + c.width
    && point.y >= c.y && point.y <= c.y + c.height);
  if (card) startGame(card.hero.data);
}

canvas.addEventListener('mousemove', (event) => {
  view.mouse = canvasPoint(event);
});

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

canvas.addEventListener('mousedown', (event) => {
  const point = canvasPoint(event);
  if (!game) {
    if (event.button === 0) onSelectClick(point);
    return;
  }
  if (game.phase === 'lost') {
    game = null;
    return;
  }
  const world = worldPoint(point);
  if (event.button === 2) {
    // Right click: attack the enemy under the cursor, otherwise walk there.
    const enemy = enemyAt(world);
    if (enemy) orderAttack(game.hero, enemy);
    else orderMove(game.hero, world.x, world.y);
    view.marker = { x: world.x, y: world.y, age: 0, attack: Boolean(enemy) };
    view.attackMoveArmed = false;
  } else if (event.button === 0 && view.attackMoveArmed) {
    const enemy = enemyAt(world);
    if (enemy) orderAttack(game.hero, enemy);
    else orderAttackMove(game.hero, world.x, world.y);
    view.marker = { x: world.x, y: world.y, age: 0, attack: true };
    view.attackMoveArmed = false;
  }
});

window.addEventListener('keydown', (event) => {
  if (!game || game.phase === 'lost') return;
  const key = event.key.toLowerCase();
  if (key === 'a') view.attackMoveArmed = true;
  if (key === 's') {
    orderStop(game.hero);
    view.attackMoveArmed = false;
  }
  if (key === 'escape') view.attackMoveArmed = false;
});

// Turns what happened in the simulation into things to draw.
function consumeEvents() {
  for (const event of game.sim.events) {
    if (event.type === 'damage') {
      view.floaters.push({
        x: event.x,
        y: event.y,
        text: String(Math.round(event.amount)),
        age: 0,
        onHero: event.targetId === game.hero.id,
      });
    }
  }
  game.sim.events.length = 0;
}

function ageView(dt) {
  for (const floater of view.floaters) floater.age += dt;
  view.floaters = view.floaters.filter((floater) => floater.age < FLOATER_TIME);
  if (view.marker) {
    view.marker.age += dt;
    if (view.marker.age >= MARKER_TIME) view.marker = null;
  }
}

let lastTime = null;
let pending = 0;

function frame(now) {
  const elapsed = lastTime === null ? 0 : Math.min(MAX_FRAME_TIME, (now - lastTime) / 1000);
  lastTime = now;

  if (game) {
    pending += elapsed;
    while (pending >= SIM_STEP) {
      stepGame(game, SIM_STEP);
      pending -= SIM_STEP;
    }
    consumeEvents();
    ageView(elapsed);
    drawGame(ctx, canvas, game, view);
  } else {
    drawSelect(ctx, canvas, heroes, view.mouse);
  }
  requestAnimationFrame(frame);
}

async function boot() {
  try {
    await loadDB();
  } catch (error) {
    ctx.fillStyle = '#d8dce6';
    ctx.font = '20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`No se pudieron cargar los datos (${error.message}).`, canvas.width / 2, canvas.height / 2);
    ctx.fillText('Abrí el juego desde el servidor local, no con doble clic.', canvas.width / 2, canvas.height / 2 + 30);
    return;
  }
  heroes = batchHeroes();
  requestAnimationFrame(frame);
}

boot();
