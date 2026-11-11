# Plan del proyecto

La meta: una versión jugable y fiel de *Custom Hero Chaos*, en 2D y para navegador. Las etapas van en orden; cada una
cierra con algo que se puede comprobar.

## Decisiones tomadas
- **2026-11-10:** proyecto nuevo y limpio, en 2D. No se parte del motor de MATCH.
- **2026-11-10:** se copia la información del juego (números y mecánicas) y se crean héroes, habilidades e ítems
  similares a los del mod.
- **2026-11-10:** se evaluó hacerlo como juego del Arcade de Dota 2 para jugar desde Latam (ver `SERVIDORES.md`) y
  se sigue con el 2D para navegador.

- **2026-11-11:** el diseño completo de la versión 1.0 está en `DISENO.md`. El draft no lleva reloj: el mod da
  tiempo sin límite para elegir (historial del mod, 6 mar 2020).

## Decisiones abiertas
Las del juego completo (largo de la partida, opciones del draft, vidas, freno a las combinaciones rotas, números de
oro, premio del duelo, duelo que no termina, castigo por perder, Roshan, baneos, ítems para mandar creeps y
habilidades repetidas) están en `DISENO.md`, sección 11, como D1 a D12, esperando respuesta del usuario. Mientras
tanto vale la opción recomendada de cada una. Acá quedan las de antes:

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

- **Draft: definitivas** (decisión): las fuentes no dicen si el mod limita cuántas definitivas se pueden tener.
  (a) **sin límite: las 16 opciones mezclan comunes y definitivas (así está hoy)**; (b) como mucho una definitiva;
  (c) cuatro comunes y una definitiva, con una elección reservada para la definitiva.
- **Draft: cantidad de opciones** y **habilidades repetidas entre jugadores**: pasaron a `DISENO.md` (D2 y D12).

- **Oro por ronda y por creep**: se investigó y el mod no publica la fórmula; pasó a `DISENO.md` (D5).
- **Precios de los ítems** (decisión): la investigación no encontró una lista; los ítems comunes parecen costar lo
  mismo que en Dota y los propios del mod llegan a 12.000-15.000. (a) **precios de Dota para los comunes (así está
  hoy) y los del mod para los propios**; (b) multiplicar todo por un factor.
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
- [x] Completar las reglas del mod que faltan en `REFERENCIA-CHC.md` (2026-11-11): duelos en cada ronda, apuestas
      con pozo, 2 Aegis, maldición, libros y sus precios, Roshan, ítems neutrales, tiempos. No aparecieron la
      fórmula del oro ni la composición de las oleadas: quedaron listadas en "Lo que no se encontró".
- [ ] Releer el historial del mod de 2021 en adelante (Steam cortó las consultas a mitad de camino).
- [x] Lista de lo que el mod cambia respecto de Dota: en `REFERENCIA-CHC.md`, "Libros" e "Ítems" (2026-11-11).
- [x] Diseño completo de la versión 1.0 en `DISENO.md`, con los problemas del mod y cómo evitarlos (2026-11-11).
      Falta la respuesta del usuario a las decisiones D1-D12.

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
- [x] Oro, tienda e inventario de 6 (`js/items.js`, `js/game.js`, `js/render.js`, `js/main.js`) (2026-11-10):
      - Oro: 600 de arranque, oro por cada creep y un premio al terminar la ronda, mayor si la limpiás rápido. Los
        números son provisorios (ver "Decisiones abiertas").
      - Tienda: abre solo entre rondas, que ahora duran 15 segundos como en el mod (tecla T o el botón). Muestra los
        25 ítems del lote con lo que da cada uno, en castellano. Si ya tenés partes de un ítem, se usan y pagás
        solo lo que falta.
      - Inventario de 6 abajo a la derecha, teclas Z X C V B N o clic para usar los que se activan; clic derecho
        entre rondas vende a mitad de precio.
      - Los 25 ítems funcionan: atributos, daño, armadura, velocidad, robo de vida, crítico (Crystalys, Daedalus),
        aturdir (Skull Basher), daño de habilidades (Kaya) y los cuatro que se activan (Phase Boots, Black King
        Bar, Mask of Madness, Satanic).
      - 13 pruebas nuevas (57 en total).
      Simplificaciones a revisar: BKB dura siempre 9 s, Power Treads da siempre el atributo principal, Moon Shard
      no se puede consumir, un solo crítico por golpe, la resistencia mágica se suma en vez de multiplicarse.
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
