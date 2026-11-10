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

- **Tecla para subir de nivel una habilidad** (decisión): el plan decía Ctrl + tecla como en Dota, pero en el
  navegador Ctrl + W cierra la pestaña y no se puede evitar. Hoy funciona (a) **Shift + tecla y clic en el "+"
  (recomendada: no choca con nada)**; Ctrl + tecla también anda en Q, E, D, F y R, pero no en W. Otras opciones:
  (b) Alt + tecla; (c) solo el "+".
- **Clic derecho mientras apuntás** (decisión): (a) **solo cancela (así está hoy)**; (b) cancela y además mueve al
  héroe, como en Dota.

- **Draft: tiempo para elegir** (decisión): las fuentes no dicen cuánto tiempo da el mod. (a) **la partida espera
  hasta que elijas (así está hoy; recomendada mientras se juega solo)**; (b) un reloj de 20-30 segundos y al
  terminar te toca una al azar (va a hacer falta cuando jueguen los 7 rivales al mismo tiempo).
- **Draft: definitivas** (decisión): las fuentes no dicen si el mod limita cuántas definitivas se pueden tener.
  (a) **sin límite: las 16 opciones mezclan comunes y definitivas (así está hoy)**; (b) como mucho una definitiva;
  (c) cuatro comunes y una definitiva, con una elección reservada para la definitiva.
- **Draft: cantidad de opciones** (decisión): (a) **16, como dice un análisis del mod (así está hoy)**; (b) menos
  (8-10) mientras el lote tenga solo 43 habilidades, para que no se repitan tanto entre elecciones.
- **Draft: habilidades repetidas entre jugadores** (decisión, para cuando estén los rivales): (a) **cada habilidad
  la puede tener un solo jugador (recomendada si el mod lo hace así; hay que confirmarlo)**; (b) se pueden repetir.

- **Oro por ronda y por creep** (decisión): las fuentes solo dicen que limpiar más rápido da más oro, no cuánto.
  Hoy hay números provisorios (600 de arranque, 30-40 por creep, 150 + 25 por ronda, hasta el doble si limpiás
  rápido). (a) **investigar los valores del mod y reemplazarlos (recomendada)**; (b) dejar los provisorios y
  ajustarlos con el banco de partidas.
- **Precios de los ítems** (decisión): el mod los tiene más caros que Dota, pero no sabemos cuánto. (a) **precios
  de Dota por ahora (así está hoy)**; (b) multiplicarlos por un factor cuando se investigue.
- **Vender ítems** (decisión): (a) **a mitad de precio, como en Dota (así está hoy)**; (b) sin venta.

## Etapa 0 · Proyecto
- [x] Carpeta, git y página base (2026-11-10).
- [x] Repositorio en GitHub: `matiaslcsm-rgb/chaos` (2026-11-10).
- [ ] Publicación (que se pueda jugar desde un enlace).
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
- [x] Motor de combate, segunda parte: las habilidades del lote armadas con piezas, maná, enfriamientos y estados
      (`js/abilities.js`, `js/abilityDefs.js`) y la interfaz para usarlas (2026-11-10):
      - Barra de habilidades abajo al centro: tecla, nombre, nivel, recarga, maná, cargas y estado de cada una; al
        pasar el mouse muestra el detalle, el alcance y el área. Las descripciones salen en inglés porque vienen de
        los datos de Dota.
      - Teclas Q W E D F para las comunes y R para la definitiva (o clic en el casillero). Las que piden objetivo
        entran en modo apuntar: clic izquierdo confirma, clic derecho o Esc cancela.
      - Subir de nivel: clic en el "+" o Shift + tecla (ver "Decisiones abiertas").
      - Se dibujan las zonas, los rayos y explosiones, los fallos y críticos, los estados sobre cada unidad
        (aturdido, provocado, inmóvil, silenciado, desarmado, lento) y los efectos activos del héroe con su tiempo.
      - 28 pruebas nuevas, una por pieza, más una que lanza las 43 habilidades a nivel 1 y al máximo.
        `node tools/run-tests.js` corre las mismas pruebas sin abrir el navegador.
      Simplificaciones a revisar: Battle Hunger siempre ralentiza, Viper Strike no decae, Lunar Orbit es un área
      alrededor de Luna, Great Cleave es un cono de 120°, Bloodlust solo se lanza sobre uno mismo.
- [x] Una arena con oleadas de creeps y el héroe controlado al estilo Dota: elegís entre los 10 héroes, clic derecho
      para mover o atacar, A + clic para avanzar atacando, S para frenar; un nivel por ronda (`js/game.js`,
      `js/render.js`, `js/main.js`). Los creeps son provisorios hasta investigar las oleadas del mod (2026-11-10).
- [x] Draft de 5 habilidades: dos antes de la ronda 1 y una más antes de las rondas 3, 6 y 9. Cada vez se ofrecen 16
      al azar de las 43 del lote (nunca una que ya tenés); la partida espera mientras elegís y, si cerrás la
      ventana, te toca una al azar. El héroe ya no trae habilidades propias: pone solo los atributos, como en el
      mod (`js/game.js`, `js/render.js`) (2026-11-10). Quedan reglas por confirmar en "Decisiones abiertas".
- [ ] Oro, tienda e inventario de 6. **A medias (2026-11-10):** programado pero SIN pruebas propias y SIN probar
      en el navegador (la sesión se cortó ahí). Hecho: oro inicial, oro por creep y por ronda (más si limpiás
      rápido), tienda entre rondas (tecla T, 15 segundos), inventario de 6 con teclas Z X C V B N, recetas que usan
      las partes que ya tenés, venta a mitad de precio con clic derecho, y los 25 ítems del lote
      (`js/items.js`, `js/game.js`, `js/render.js`, `js/main.js`). **Falta:** pruebas en `js/tests.js` (comprar,
      armar recetas, vender, inventario lleno, robo de vida, crítico, aturdir del Basher, BKB, oro por ronda),
      jugar una ronda comprando en el navegador y revisar que la tienda no tape nada.
      Simplificaciones: BKB dura siempre 9 s, Power Treads da siempre el atributo principal, Moon Shard no se
      consume, un solo crítico por golpe.
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
