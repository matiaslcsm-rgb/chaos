'use strict';

// Books: swap an ability for another one, or add a sixth. They are not inventory items: the books you own wait in
// their own stash until you use them, between rounds. No DOM here.

// The mod's books and prices (docs/REFERENCIA-CHC.md, "Libros"). Omniscient Book, Book of Summoner and the
// attribute tomes are left out: their price was not found.
const BOOKS = {
  // Choose one of your abilities; it goes and you choose another one from a new list.
  retrain: { name: 'Reentrenamiento', cost: 2900, text: 'Elegís una de tus habilidades y la cambiás por otra de una lista nueva.' },
  // A random ability of yours goes and you choose another one.
  page: { name: 'Página rota', cost: 1200, text: 'Te saca una habilidad al azar y elegís otra de una lista nueva.' },
  // A sixth ability, once per match.
  paragon: { name: 'Libro Parangón', cost: 13000, text: 'Suma una sexta habilidad. Una sola vez por partida.' },
};
const BOOK_KINDS = Object.keys(BOOKS);

// The free books for whoever goes last: after rounds 10, 20, 30 and 40, by value (gold plus items), the last two
// get a book and a torn page and the one before them a page (the mod's official note; user's decision 2026-11-17).
const FREE_BOOK_ROUNDS = [10, 20, 30, 40];
const FREE_BOOKS = [['retrain', 'page'], ['retrain', 'page'], ['page']];

function bookStash(hero) {
  if (!hero.books) hero.books = { retrain: 0, page: 0 };
  return hero.books;
}

function giveBook(hero, kind) {
  bookStash(hero)[kind]++;
}

// Why a book cannot be bought right now ('closed' | 'gold' | 'paragon'), or null if it can.
function bookBuyProblem(game, kind) {
  if (!shopOpen(game)) return 'closed';
  if (kind === 'paragon' && (game.hero.paragon || game.picks < DRAFT_ROUNDS.length)) return 'paragon';
  if (game.hero.gold < BOOKS[kind].cost) return 'gold';
  return null;
}

// The Paragon Book is read on the spot; the others go to the stash.
function buyBook(game, kind) {
  const problem = bookBuyProblem(game, kind);
  if (problem) return problem;
  game.hero.gold -= BOOKS[kind].cost;
  if (kind === 'paragon') {
    game.hero.paragon = true;
    openDraft(game, { book: 'paragon' });
  } else {
    giveBook(game.hero, kind);
  }
  return null;
}

// Why a book from the stash cannot be used now ('closed' | 'none' | 'empty'), or null if it can.
function bookUseProblem(game, kind) {
  if (!shopOpen(game)) return 'closed';
  if (!bookStash(game.hero)[kind]) return 'none';
  if (!game.hero.abilities.length) return 'empty';
  return null;
}

// kind 'retrain' needs the index of the ability to swap; a torn page picks one at random.
function useBook(game, kind, index) {
  const problem = bookUseProblem(game, kind);
  if (problem) return problem;
  const abilities = game.hero.abilities;
  const replace = kind === 'page' ? Math.floor(game.sim.rng() * abilities.length) : index;
  if (!abilities[replace]) return 'empty';
  bookStash(game.hero)[kind]--;
  openDraft(game, { book: kind, replace });
  return null;
}

// The highest level an ability can have at this hero level (Dota's rule, as in levelProblem).
function levelCap(hero, ability) {
  const byHero = ability.def.ult
    ? ULT_HERO_LEVELS.filter((level) => level <= hero.level).length
    : Math.floor((hero.level + 1) / 2);
  return Math.min(maxAbilityLevel(ability), byHero);
}

// The new ability takes the old one's place and its level (user's decision 2026-11-17: the book does not punish
// having levelled it). If the new one cannot go that high yet (an ultimate before hero level 6, say), the points
// that do not fit come back to spend.
function swapAbility(hero, index, key) {
  const old = hero.abilities[index];
  const fresh = newAbility(key);
  fresh.level = Math.min(old.level, levelCap(hero, fresh));
  hero.skillPoints += old.level - fresh.level;
  if (fresh.def.charges && fresh.level > 0) fresh.charges = abilityValue(fresh, fresh.def.charges.count);
  hero.abilities[index] = fresh;
  refreshPassives(hero);
}

// After rounds 10, 20, 30 and 40 the players at the bottom get free books. Returns who got what.
function giveFreeBooks(match) {
  if (!FREE_BOOK_ROUNDS.includes(match.round)) return [];
  const bottom = playersAlive(match).sort((a, b) => playerValue(a) - playerValue(b));
  const given = [];
  FREE_BOOKS.forEach((kinds, i) => {
    const player = bottom[i];
    // Never the leader: with 3 players or fewer, the one on top gets nothing.
    if (!player || i >= bottom.length - 1) return;
    for (const kind of kinds) giveBook(player.game.hero, kind);
    given.push({ player, kinds });
  });
  return given;
}

// "un libro y una página", for the announcements.
function booksText(kinds) {
  const words = kinds.map((kind) => (kind === 'page' ? 'una página rota' : 'un libro'));
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} y ${words[words.length - 1]}` : words[0];
}
