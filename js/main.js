'use strict';

// Boot, input and the frame loop. The only file that knows about real time and the mouse.

const GAME_VERSION = '0.7.0 · Etapa 3: Aegis y final de partida';
document.getElementById('game-version').textContent = `Versión ${GAME_VERSION}`;

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');

const SIM_STEP = 1 / 60;
const MAX_FRAME_TIME = 0.1;
const CLICK_SLACK = 10;

const CAST_MESSAGES = {
  unlearned: 'Todavía no la aprendiste',
  stunned: 'Estás aturdido',
  silenced: 'Estás silenciado',
  charges: 'No le quedan cargas',
  cooldown: 'Todavía se está recargando',
  mana: 'No alcanza el maná',
};
const BET_MESSAGES = {
  min: `La apuesta mínima es ${BET.min}`,
  max: 'Podés apostar hasta la mitad de tu oro',
  already: 'Ya apostaste en este duelo',
  closed: 'Las apuestas cierran cuando empieza la ronda',
};
const SHOP_MESSAGES = {
  gold: 'No te alcanza el oro',
  full: 'El inventario está lleno',
  closed: 'La tienda abre entre rondas',
};

let heroes = [];
// The match of 8, and the human's own arena inside it (what is drawn and controlled).
let match = null;
let game = null;
const view = {
  floaters: [],
  effects: [],
  marker: null,
  message: null,
  attackMoveArmed: false,
  targeting: null,
  shop: false,
  hoverEnemy: null,
  spy: null,
  betAmount: 'quarter',
  mouse: { x: 0, y: 0 },
};

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

function say(text) {
  view.message = { text, age: 0 };
}

function startGame(heroData) {
  match = createMatch(heroData, Date.now());
  game = humanPlayer(match).game;
  Object.assign(view, { floaters: [], effects: [], marker: null, message: null, attackMoveArmed: false, targeting: null, shop: false, hoverEnemy: null, spy: null });
}

function onSelectClick(point) {
  const card = selectCards(canvas, heroes).find((c) => inRect(point, c));
  if (card) startGame(card.hero.data);
}

function onDraftClick(point) {
  const card = draftCards(canvas, game).find((c) => inRect(point, c));
  if (card) pickDraft(game, card.key);
  else if (inRect(point, draftSkipButton(canvas))) skipDraft(game);
}

// ---- Abilities ----

function sayCastProblem(problem) {
  say(CAST_MESSAGES[problem === 'silenced' && game.hero.flags.stunned ? 'stunned' : problem]);
}

// A hotkey or a click on the bar: cast right away, start aiming, or flip a toggle.
function useAbility(index) {
  const hero = game.hero;
  const ability = hero.abilities[index];
  const cast = ability.def.cast;
  view.attackMoveArmed = false;
  view.targeting = null;
  if (ability.level === 0) {
    sayCastProblem('unlearned');
    return;
  }
  if (cast === 'passive') return;
  if (cast === 'toggle') {
    toggleAutocast(hero, index);
    return;
  }
  const problem = castProblem(hero, ability);
  if (problem) {
    sayCastProblem(problem);
    return;
  }
  if (cast === 'unit' || cast === 'point') view.targeting = { index };
  else orderCast(hero, index, null);
}

// Left click while aiming. A unit-target ability keeps aiming until the click lands on an enemy.
function confirmTarget(world) {
  const hero = game.hero;
  const index = view.targeting.index;
  let target = world;
  if (hero.abilities[index].def.cast === 'unit') {
    target = enemyAt(world);
    if (!target) {
      say('Elegí un enemigo');
      return;
    }
  }
  view.targeting = null;
  const problem = orderCast(hero, index, target);
  if (problem) sayCastProblem(problem);
}

function tryLevelUp(index) {
  const hero = game.hero;
  const ability = hero.abilities[index];
  const problem = levelProblem(hero, ability);
  if (problem === 'max') say('Ya está al máximo');
  else if (problem === 'points') say('No tenés puntos para repartir');
  else if (problem === 'heroLevel') say(`Sube cuando tu héroe llegue al nivel ${heroLevelForNextLevel(ability)}`);
  else levelUpAbility(hero, index);
}

// Returns true if the click was on the ability bar (a slot or its "+").
function onBarClick(point) {
  for (const slot of abilityBarSlots(canvas, game.hero)) {
    if (inRect(point, slot.plus) && canLevelAbility(game.hero, slot.ability)) {
      tryLevelUp(slot.index);
      return true;
    }
    if (inRect(point, slot)) {
      useAbility(slot.index);
      return true;
    }
  }
  return false;
}

// ---- Items and the shop ----

function toggleShop() {
  if (shopOpen(game)) view.shop = !view.shop;
  else say(SHOP_MESSAGES.closed);
}

function tryUseItem(slot) {
  const problem = useItem(game.sim, game.hero, slot);
  if (problem && CAST_MESSAGES[problem]) say(CAST_MESSAGES[problem]);
}

function trySellItem(slot) {
  const item = game.hero.items[slot];
  if (!item) return;
  if (sellFromInventory(game, slot)) say(`Vendiste ${DB.items[item.key].dname} por ${sellPrice(item.key)} de oro`);
  else say('Los ítems se venden entre rondas');
}

// Returns true if the click was on the shop, its button or the inventory.
function onShopClick(point, button) {
  const shopping = view.shop && shopOpen(game);
  if (shopping && inRect(point, shopPanelRect(canvas))) {
    const card = shopCards(canvas).find((c) => inRect(point, c));
    if (card && button === 0) {
      const problem = buyFromShop(game, card.key);
      if (problem) say(SHOP_MESSAGES[problem]);
    }
    return true;
  }
  if (inRect(point, shopButton(canvas))) {
    if (button === 0) toggleShop();
    return true;
  }
  const slot = inventorySlots(canvas).find((s) => inRect(point, s));
  if (!slot) return false;
  if (button === 0) tryUseItem(slot.slot);
  else if (button === 2) trySellItem(slot.slot);
  return true;
}

// ---- The players' table ----

// A click on a row opens what that player has; a second click (or Esc) closes it.
function onTableClick(point) {
  const row = playerTableRows(canvas, match).find((r) => inRect(point, r));
  if (row) {
    view.spy = view.spy === row.player.index ? null : row.player.index;
    return true;
  }
  if (view.spy !== null && inRect(point, spyPanelRect(canvas))) {
    view.spy = null;
    return true;
  }
  return false;
}

// ---- Bets ----

// Returns true if the click was on the betting panel.
function onBetClick(point) {
  if (duelPanelMode(match) !== 'bet' || !inRect(point, betPanelRect(canvas))) return false;
  const controls = betControls(canvas);
  const chip = controls.chips.find((c) => inRect(point, c));
  if (chip) view.betAmount = chip.key;
  const side = controls.sides.find((c) => inRect(point, c));
  if (side) {
    const human = humanPlayer(match);
    const amount = betChipAmount(human, view.betAmount);
    const problem = placeBet(match, human, side.side, amount);
    if (problem) say(BET_MESSAGES[problem] || 'No se puede apostar ahora');
    else say(`Apostaste ${amount} a ${duelSide(match.duel, side.side).name}`);
  }
  return true;
}

// ---- Input ----

canvas.addEventListener('mousemove', (event) => {
  view.mouse = canvasPoint(event);
});

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

canvas.addEventListener('mousedown', (event) => {
  const point = canvasPoint(event);
  view.mouse = point;
  if (!game) {
    if (event.button === 0) onSelectClick(point);
    return;
  }
  if (endingText(game)) {
    game = null;
    match = null;
    return;
  }
  if (game.draft) {
    if (event.button === 0) onDraftClick(point);
    return;
  }
  if (onShopClick(point, event.button)) return;
  if (event.button === 0 && onTableClick(point)) return;
  if (event.button === 0 && onBetClick(point)) return;
  const world = worldPoint(point);
  if (event.button === 2) {
    if (view.targeting) {
      view.targeting = null;
      return;
    }
    // Right click: attack the enemy under the cursor, otherwise walk there.
    const enemy = enemyAt(world);
    if (enemy) orderAttack(game.hero, enemy);
    else orderMove(game.hero, world.x, world.y);
    view.marker = { x: world.x, y: world.y, age: 0, attack: Boolean(enemy) };
    view.attackMoveArmed = false;
  } else if (event.button === 0) {
    if (onBarClick(point)) return;
    if (view.targeting) {
      confirmTarget(world);
    } else if (view.attackMoveArmed) {
      const enemy = enemyAt(world);
      if (enemy) orderAttack(game.hero, enemy);
      else orderAttackMove(game.hero, world.x, world.y);
      view.marker = { x: world.x, y: world.y, age: 0, attack: true };
      view.attackMoveArmed = false;
    }
  }
});

window.addEventListener('keydown', (event) => {
  if (!game || endingText(game) || game.draft) return;
  const key = event.key.toLowerCase();
  const index = abilityHotkeys(game.hero.abilities).indexOf(key);
  const levelling = event.shiftKey || event.ctrlKey;

  if (index !== -1) {
    // Ctrl + key is Dota's way to level up, but the browser keeps some (Ctrl+W closes the tab), so Shift works too.
    event.preventDefault();
    if (event.repeat) return;
    if (levelling) tryLevelUp(index);
    else if (!event.altKey && !event.metaKey) useAbility(index);
    return;
  }
  if (levelling) return;
  if (ITEM_HOTKEYS.includes(key) && !event.repeat) tryUseItem(ITEM_HOTKEYS.indexOf(key));
  if (key === 't' && !event.repeat) toggleShop();
  if (key === 'a') {
    view.attackMoveArmed = true;
    view.targeting = null;
  }
  if (key === 's') {
    orderStop(game.hero);
    view.attackMoveArmed = false;
    view.targeting = null;
  }
  if (key === 'escape') {
    view.shop = false;
    view.spy = null;
    view.attackMoveArmed = false;
    view.targeting = null;
  }
});

// ---- Frame loop ----

// Turns what happened in the simulation into things to draw.
function consumeEvents() {
  for (const event of game.sim.events) {
    if (event.type === 'damage') {
      if (event.amount < 0.5) continue;
      view.floaters.push({
        x: event.x,
        y: event.y,
        text: String(Math.round(event.amount)),
        age: 0,
        kind: 'damage',
        onHero: event.targetId === game.hero.id,
      });
    } else if (event.type === 'crit') {
      // The hit already left its number: turn that one into the big red one.
      const hit = view.floaters.find((floater) => floater.age === 0 && floater.kind === 'damage'
        && floater.x === event.x && floater.y === event.y);
      if (hit) Object.assign(hit, { kind: 'crit', text: `${Math.round(event.amount)}!` });
    } else if (event.type === 'miss') {
      view.floaters.push({ x: event.x, y: event.y, text: 'falló', age: 0, kind: 'miss' });
    } else if (event.type === 'text') {
      view.floaters.push({ x: event.x, y: event.y - 30, text: event.text, age: 0, kind: 'text' });
    } else if (event.type === 'fx') {
      view.effects.push(Object.assign({ age: 0 }, event));
    }
  }
  game.sim.events.length = 0;
}

function ageView(dt) {
  for (const floater of view.floaters) floater.age += dt;
  view.floaters = view.floaters.filter((floater) => floater.age < FLOATER_TIME);
  for (const fx of view.effects) fx.age += dt;
  view.effects = view.effects.filter((fx) => fx.age < FX_TIME);
  if (view.marker) {
    view.marker.age += dt;
    if (view.marker.age >= MARKER_TIME) view.marker = null;
  }
  if (view.message) {
    view.message.age += dt;
    if (view.message.age >= MESSAGE_TIME) view.message = null;
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
      stepMatch(match, SIM_STEP);
      pending -= SIM_STEP;
    }
    ageView(elapsed);
    consumeEvents();
    if (endingText(game) || game.draft) view.targeting = null;
    view.hoverEnemy = enemyAt(worldPoint(view.mouse));
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
