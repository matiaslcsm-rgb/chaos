# Plan del proyecto

La meta: una versión jugable y fiel de *Custom Hero Chaos*, en 2D y para navegador. Las etapas van en orden; cada una
cierra con algo que se puede comprobar.

## Decisiones tomadas
- **2026-11-10:** proyecto nuevo y limpio, en 2D. No se parte del motor de MATCH.
- **2026-11-10:** se copia la información del juego (números y mecánicas) y se crean héroes, habilidades e ítems
  similares a los del mod.
- **2026-11-10:** se evaluó hacerlo como juego del Arcade de Dota 2 para jugar desde Latam (ver `SERVIDORES.md`) y
  se sigue con el 2D para navegador.

## Decisiones abiertas
- **Nombre del proyecto** (decisión): hoy la carpeta se llama `chaos`.
- **Nombres e imágenes** (decisión): (a) **nombres y dibujos propios parecidos (recomendada si se publica en
  internet)**; (b) los nombres reales de Dota, solo para jugar en tu PC.
- **Estilo del 2D** (decisión): (a) **figuras simples primero y el arte después (recomendada: se llega antes a
  jugar)**; (b) pixel art desde el arranque.
- **Largo de la partida** (decisión): (a) **55-65 rondas como el mod (recomendada: es lo fiel)**; (b) una versión corta
  de 20-25 rondas; (c) las dos como modos.

## Etapa 0 · Proyecto
- [x] Carpeta, git y página base (2026-11-10).
- [ ] Repositorio en GitHub y publicación.
- [x] Página de pruebas: `tests.html`, tiene que decir "✅ N/N pruebas" (2026-11-10).

## Etapa 1 · Copiar la información
Sin programar nada del juego todavía.
- [x] Bajar los datos de Dota a `data/dota/`: héroes (atributos y crecimiento), habilidades (daño, enfriamiento,
      maná, alcance) e ítems (costo y recetas). Qué trae y qué le falta, en `DATOS.md` (2026-11-10).
- [x] Una página para consultar esos datos: `datos.html` (buscar un héroe o una habilidad, ver ítems y recetas)
      (2026-11-10).
- [ ] Completar las reglas del mod que faltan en `REFERENCIA-CHC.md`: oro por ronda, composición de las oleadas,
      tiempos, cada cuánto hay duelo, cuánto pagan las apuestas.
- [ ] Lista de lo que el mod cambia respecto de Dota (ítems más caros, libros, Aghanim para todas las habilidades).

**Lista cuando:** hay una tabla consultable con todo.

## Etapa 2 · Piezas
- [x] Definir las piezas con las que se arman las habilidades: 6 formas de lanzar y 43 efectos en 3 niveles, en
      `PIEZAS.md` (2026-11-10).
- [x] Clasificar todas las habilidades: de 557 elegibles, 199 simples, 247 medias, 99 difíciles y 12 sin clasificar
      (`tools/classify.js`; es una estimación, cada una se revisa a mano al entrar a un lote) (2026-11-10).
- [x] Elegir el primer lote: 10 héroes, 43 habilidades y 25 ítems, en `data/batch1.json` (2026-11-10).

**Lista cuando:** hay una lista de habilidades ordenada por dificultad y el primer lote elegido.

## Etapa 3 · Primera versión jugable
Una partida completa, pero chica.
- [x] Motor de combate, primera parte: stats con las fórmulas de Dota, moverse, atacar (con el tiempo de preparación
      que se cancela al moverse), proyectiles, armadura, regeneración (`js/stats.js`, `js/sim.js`) (2026-11-10).
- [ ] Motor de combate, segunda parte: las habilidades del lote armadas con piezas, maná, enfriamientos y estados.
- [x] Una arena con oleadas de creeps y el héroe controlado al estilo Dota: elegís entre los 10 héroes, clic derecho
      para mover o atacar, A + clic para avanzar atacando, S para frenar; un nivel por ronda (`js/game.js`,
      `js/render.js`, `js/main.js`). Los creeps son provisorios hasta investigar las oleadas del mod (2026-11-10).
- [ ] Draft de 5 habilidades (rondas 1, 1, 3, 6 y 9).
- [ ] Oro, tienda e inventario de 6.
- [ ] 7 rivales de la IA jugando sus arenas.
- [ ] Duelos y apuestas.
- [ ] Final de partida: eliminados y ganador.
- [ ] Banco de partidas: la IA juega sola cientos de partidas y mide el balance.

**Lista cuando:** jugás una partida de punta a punta con el primer lote.

## Etapa 4 · Las reglas del mod
- [ ] Baneos y volver a sortear el héroe.
- [ ] Roshan.
- [ ] Libros para cambiar o sumar una habilidad.
- [ ] Ítems neutrales.
- [ ] Marcas por perder duelos seguidos y ayudas al que va abajo.
- [ ] Aghanim para cualquier habilidad.

**Lista cuando:** comparado con `REFERENCIA-CHC.md`, no queda nada "distinto" sin que sea una decisión anotada.

## Etapa 5 · Contenido por tandas
- [ ] Lotes de 10-20 héroes, habilidades e ítems, cada uno medido con el banco antes de sumar el siguiente.

**Lista cuando:** el roster es grande y ninguna combinación gana sola.

## Etapa 6 · Balance y pulido
- [ ] Interfaz, sonido, tutorial, arte definitivo.

**Lista cuando:** versión 1.0.
