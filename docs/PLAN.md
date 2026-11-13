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

- **2026-11-11 (decisión del usuario):** en las 12 decisiones de `DISENO.md` (D1 a D12) van las recomendadas:
  - D1: partida fiel, sin límite de rondas, con botón de velocidad ×2.
  - D2: 8 opciones por elección mientras haya menos de 150 habilidades; 16 después.
  - D3: 2 Aegis por jugador.
  - D4 **(cambio a propósito respecto del mod):** 1 segundo de inmunidad después de cada aturdimiento, daño por
    porcentaje de vida a la mitad contra héroes e invocaciones más débiles en duelos, además de los baneos.
  - D5: números provisorios de oro, oleadas y tiempos, ajustados con el banco.
  - D6 **(cambio a propósito):** premio fijo al ganador del duelo, además de la apuesta gratis del mod.
  - D7: el duelo dura 60 segundos como mucho; si nadie murió, gana el que tiene más porcentaje de vida.
  - D8 **(cambio a propósito):** marcas de 7% con tope de 3, en vez de 10% sin tope.
  - D9: Roshan cada 10 rondas.
  - D10: baneos de habilidad desde ahora; de héroe cuando haya 40 héroes o más.
  - D11: los ítems para mandar creeps a los rivales quedan afuera de la 1.0.
  - D12: dos jugadores pueden tener la misma habilidad.

- **2026-11-11 (decisión del usuario):** en la recta final, perder un duelo sin Aegis y con las 3 marcas de
  maldición te deja afuera. Sin esto, los dos últimos pelearían duelos para siempre (no enfrentan creeps).
- **2026-11-11 (decisión del usuario):** al revivir con Aegis, durante 5 segundos recibís la mitad de daño y hacés
  50% más. El mod no publica el número; se puede ajustar con el banco.

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

- **Draft: definitivas** (decisión): las fuentes no dicen si el mod limita cuántas definitivas se pueden tener.
  (a) **sin límite: las 16 opciones mezclan comunes y definitivas (así está hoy)**; (b) como mucho una definitiva;
  (c) cuatro comunes y una definitiva, con una elección reservada para la definitiva.
- **Draft: cantidad de opciones** y **habilidades repetidas entre jugadores**: pasaron a `DISENO.md` (D2 y D12).

- **Oro por ronda y por creep**: se investigó y el mod no publica la fórmula; pasó a `DISENO.md` (D5).
- **Precios de los ítems** (decisión): la investigación no encontró una lista; los ítems comunes parecen costar lo
  mismo que en Dota y los propios del mod llegan a 12.000-15.000. (a) **precios de Dota para los comunes (así está
  hoy) y los del mod para los propios**; (b) multiplicar todo por un factor.
- **Vender ítems** (decisión): (a) **a mitad de precio, como en Dota (así está hoy)**; (b) sin venta.

- **Comprar Aegis en la tienda**: el mod lo vende pero no se encontró el precio; entra con los demás números de D5
  cuando esté el banco. Por ahora no se puede comprar.

- **Roshan: Aegis o libro** (decisión, 2026-11-12): D9 dice que Roshan "deja caer un Aegis o un libro", sin decir
  cuándo cada uno. Probé darle un Aegis a todos los que lo matan y el banco salió mal: llegaban a la ronda 50 con 5
  o 6 Aegis guardados y el Roshan de la ronda 60 los barría a todos juntos (todas las partidas terminaban justo en
  la 60). Hoy funciona (a) **un Aegis si tenés menos de 2; si tenés 2 o más, un libro (cuando haya libros; por
  ahora nada) (recomendada)**. Otras: (b) siempre un libro, nunca Aegis; (c) al azar, mitad Aegis y mitad libro.
- **Libros: el nivel de la habilidad nueva** (decisión): no se encontró qué hace el mod cuando cambiás una
  habilidad que ya tenía puntos. (a) **la nueva entra con el mismo nivel que tenía la vieja (recomendada: el
  libro no te castiga por haber subido la habilidad)**; (b) la nueva entra en 0 y te devuelven los puntos para
  repartir; (c) la nueva entra en 0 y los puntos se pierden.
- **Libros gratis para los que van últimos** (decisión): las fuentes no coinciden. (a) **como la nota oficial y el
  historial: al terminar las rondas 10, 20, 30 y 40, los dos últimos en oro reciben un libro y una página rota, y
  el antepenúltimo una página (recomendada: es lo que escribió el creador)**; (b) como el análisis de 2023, en 4
  escalones (el último, dos páginas y un libro; ...).
- **Ítems neutrales: en qué rondas cae cada nivel** (decisión): para *Chaos* no se encontró. (a) **como *Clash*, que
  los entrega al terminar las rondas 10, 20, 30 y 40, y el quinto nivel en la 50 (recomendada)**; (b) que los suelten los creeps al
  azar, con más chance de nivel alto en rondas altas.
- **Aghanim** (decisión, 2026-11-12): el mod dice que el cetro y el fragmento "funcionan con cualquier habilidad",
  pero en Dota cada héroe tiene una sola mejora de cetro y una de fragmento, y la mitad de esas mejoras son una
  habilidad nueva (por ejemplo, el cetro de Ogre Magi da "Unrefined Fireblast"). En el lote 1, 6 habilidades
  tienen mejora de cetro y 5 de fragmento; las otras 32 no tienen ninguna. Además, en Dota el cetro se arma con
  4 ítems que no están en el lote. (a) **mejorar solo las habilidades que en Dota tienen mejora propia, y cuando
  la mejora es una habilidad nueva, dársela al que tenga la habilidad "madre" (Fireblast → Unrefined Fireblast)
  (recomendada: es lo que se puede hacer sin inventar)**; (b) inventar una mejora para cada habilidad (más trabajo
  y menos fiel); (c) dejar el Aghanim para después de los lotes de contenido. Para el precio: el cetro a 4.200 y
  el fragmento a 1.400, como en Dota, comprados de una sola vez.

## Etapa 0 · Proyecto
- [x] Carpeta, git y página base (2026-11-10).
- [x] Repositorio en GitHub: `matiaslcsm-rgb/chaos` (2026-11-10).
- [ ] Publicación (que se pueda jugar desde un enlace). La tarea diaria no publica nada: queda para hacerlo con
      el usuario.
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
- [ ] Releer el historial del mod de 2021 en adelante (Steam cortó las consultas a mitad de camino; el 2026-11-11
      y el 2026-11-12 seguía respondiendo "demasiadas consultas"). Ahí se podrían encontrar las reglas que faltan
      para los libros y los ítems neutrales.
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
      Simplificaciones a revisar: Lunar Orbit es un área alrededor de Luna, Great Cleave es un cono de 120°,
      Bloodlust solo se lanza sobre uno mismo, Battle Hunger no se corta cuando el enemigo mata a alguien.
      Resueltas el 2026-11-12, con sus pruebas: la lentitud de Viper Strike baja de a poco hasta desaparecer, y
      Battle Hunger solo ralentiza mientras el enemigo le da la espalda a Axe, como en Dota.
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
- [x] 7 rivales de la IA jugando sus arenas (`js/ai.js`, `js/match.js`) (2026-11-11):
      - Partida de 8: vos y 7 rivales con nombre, color y un héroe distinto cada uno. Cada uno tiene su arena, que se
        simula de verdad aunque no se dibuje.
      - Un solo reloj para todos: la ronda siguiente arranca cuando terminaron las 8 arenas y pasaron los 15
        segundos. Si terminás antes, el título dice cuántos faltan. Mientras elegís una habilidad, se frena todo.
      - Cada rival tiene una personalidad (golpeador, mago o mixto; gastador, ahorrador o equilibrado). Elige
        habilidades según su estilo y lo que le falta, sube primero la definitiva, compra siguiendo una lista según
        su estilo (armando los ítems por partes) y guarda oro para apostar según su personalidad.
      - En la pelea va hacia la oleada, usa las de área cuando agarran a 2 o más (3 o más las definitivas), las de
        un objetivo sobre el más cercano, los refuerzos cuando hay enemigos cerca, y los ítems (Satanic con poca
        vida, BKB rodeado, Mask of Madness atacando, Phase Boots para llegar).
      - Tabla de jugadores arriba a la izquierda, ordenada por valor (oro + ítems), con nivel y si está peleando,
        listo o afuera. Clic en uno para ver sus habilidades e ítems.
      - El que cae queda afuera con el último puesto libre y su oro pasa a 0, como en el mod. Al caer ves tu
        puesto; si quedás último en pie, "¡Ganaste!".
      - Se aplicó la decisión D2: 8 opciones por elección (16 cuando haya 150 habilidades o más).
      - 14 pruebas nuevas (71 en total). Las 8 arenas juntas son livianas: 0,08 milésimas de segundo por paso.
      Simplificaciones a revisar: los rivales de rango no retroceden cuando los alcanzan; una oleada que no termina
      en 120 segundos se da por terminada (el límite real del mod, con creeps enfurecidos, es parte de D5); todavía
      no hay Aegis, así que morir contra los creeps es quedar afuera (entra en "Final de partida").
- [x] Duelos y apuestas (`js/duel.js`) (2026-11-11), con las decisiones D6 y D7:
      - Desde la ronda 2 hay un duelo por ronda entre dos jugadores vivos sorteados; nadie pelea dos rondas
        seguidas mientras queden más de 3. La pausa antes de una ronda con duelo dura 18 segundos.
      - Los dos duelistas no pelean su oleada: se mudan a una arena aparte, con vida y maná llenos, y pelean entre
        ellos. Si nadie muere en 60 segundos, gana el que tiene más porcentaje de vida. Después vuelven a su arena,
        suben de nivel y cobran la ronda como si hubieran terminado a mitad de tabla. Perder no te deja afuera.
      - Si el duelo es tuyo, lo jugás en pantalla ("Duelo contra ... · 58 s").
      - Apuestas: durante la pausa, el panel de arriba a la derecha muestra a los dos (nivel, valor, duelos
        ganados y cuánto se apostó a cada uno). Elegís 50, un cuarto o la mitad de tu oro y a quién. Mínimo 50,
        máximo la mitad de tu oro, una vez por duelo. Mientras pelean ves sus barras de vida y después el
        resultado: cuánto cobraste o perdiste.
      - El pozo: todo lo apostado, una apuesta gratis de cada duelista a sí mismo (5% de lo apostado, mínimo 50) y
        un extra del juego (30% de lo apostado, o 50 por número de ronda si es más). Se reparte entre los que
        acertaron según lo que puso cada uno; paga al menos el doble salvo que más del 75% estuviera de ese lado,
        y nunca más de 5 veces lo apostado. El ganador del duelo cobra además un premio fijo: 100 + 50 por ronda.
      - Los rivales apuestan una vez por duelo, casi siempre al favorito (miran valor, nivel y duelos ganados) y a
        veces a la sorpresa; el ahorrador arriesga mucho y el gastador casi nada.
      - 7 pruebas nuevas (78 en total).
      Simplificaciones a revisar: si no peleás, no ves el duelo de los demás en una ventana chica (solo las barras
      de vida en el panel); el aviso "Apostaste ..." sale en rojo como los errores; los números del pozo y del
      premio son provisorios hasta el banco (D5).
- [x] Final de partida: eliminados y ganador (2026-11-11), con las decisiones D3 y D8:
      - Cada jugador arranca con 2 Aegis (se ven en la tabla, columna "vidas", y junto al nombre de tu héroe). Si
        los creeps te matan, gastás uno y revivís en el lugar con vida y maná llenos y 5 segundos de ventaja; la
        oleada sigue. Sin Aegis, quedás afuera.
      - Recta final: cuando quedan 3 jugadores o menos, perder un duelo cuesta un Aegis y, si no te queda, una
        marca de maldición: 7% más de daño recibido, 7% menos de daño hecho y 7% menos de oro cada una, hasta 3.
      - Los que caen en el mismo momento comparten el puesto; si caen todos los que quedaban, comparten el primero.
      - Pantalla final: "Caíste" o "¡Ganaste!", la lista de los 8 en orden (en qué ronda cayó cada uno o si sigue
        en juego) y de dónde salió tu oro: creeps, rondas, duelos y apuestas (las apuestas, ganado menos apostado).
      - 5 pruebas nuevas (83 en total).
      Simplificaciones a revisar: si quedás afuera, la pantalla final no te deja seguir mirando la partida; el
      Aegis todavía no se compra (ver "Decisiones abiertas").
- [x] Banco de partidas: la IA juega sola partidas completas y mide el balance (2026-11-11):
      - `node tools/bench.js 24 150` (24 partidas, cortando en la ronda 150 si alguna no termina) y la página
        `banco.html` hacen lo mismo (`js/bench.js`). Informan en qué ronda terminó cada partida, de dónde sale el
        oro, cada cuánto gana el favorito del duelo, cuánto gana cada héroe y cada habilidad, y la alarma "gana
        sola".
- [x] Oleadas y números de D5, calibrados con el banco (`data/waves.json`, `js/game.js`) (2026-11-11):
      - 9 tipos de creep con nombres propios, inspirados en los neutrales de Dota: Kóbold, Arpía (a distancia),
        Lobo (rápido), Centauro (aturde al pegar), Troll (a distancia, pega fuerte), Bicho explosivo (explota al
        morir), Araña (resiste la magia) y dos pesados, Gólem y Ogro. Cada tipo aparece desde una ronda.
      - Cada ronda tiene su oleada fija, la misma para los 8 (como en el mod): 1 a 3 tipos, de 5 a 12 creeps, y
        cada 5 rondas una oleada pesada. En la pausa, debajo del título, se anuncia la próxima.
      - Crecen en tres tramos: rápido hasta la ronda 10, más lento hasta la 20 y después sin techo. Desde la 60
        resisten la magia.
      - A los 50 segundos de ronda los creeps se enfurecen: más rápidos, pegan más fuerte y no se los puede aturdir
        ni frenar, como en el mod.
      - Premio de ronda por puesto: el primero en terminar cobra 500 y el último 50 en la ronda 1, y crece con las
        rondas. Los duelistas cobran como el cuarto; una oleada cortada por tiempo, como el último.
      - Calibración: en 12 partidas de prueba la partida terminó entre las rondas 49 y 72, con un promedio de 60
        (la meta era 55-65). Después, un banco de 24 partidas: todas terminaron solas, en la ronda 60,5 en
        promedio; el favorito ganó el 71% de los duelos. El oro a la ronda 20 da unos 15.800 por jugador (las guías hablan de 10.000-15.000).
      - 6 pruebas nuevas (90 en total).
      Simplificaciones a revisar: la Araña resiste la magia en vez de "apagar pasivas" como en el mod; todos los
      creeps se dibujan iguales salvo el tamaño; muchas eliminaciones caen justo en las oleadas pesadas (rondas 10,
      30, 40, 45...), lo que puede estar bien o ser un salto demasiado grande.
      Para revisar en el balance: en ese banco los héroes de inteligencia y Ogre Magi no ganaron ninguna partida, y
      Luna, Sven y Phantom Assassin ganaron entre 30% y 37% (se espera 12,5%). Las habilidades de ataque ganan más.

**Lista cuando:** jugás una partida de punta a punta con el primer lote.

## Etapa 4 · Las reglas del mod
- [x] Baneos y volver a sortear el héroe (2026-11-12), con la decisión D10:
      - Antes de la partida, una pantalla con las 43 habilidades: elegís una para banear (o "No banear nada"). Los
        7 rivales banean antes que vos y sus baneos aparecen tachados; nadie banea dos veces la misma.
      - Los rivales banean al azar entre las habilidades que el banco marca como las más fuertes (las de los que
        más ganan); cuando se acaban, cualquiera.
      - Una habilidad baneada no sale en ningún draft de la partida, ni para vos ni para los rivales.
      - Elegir héroe: te ofrecen 4. Podés volver a sortear una vez: el primero queda y vienen 3 nuevos (7 vistos en
        total, como cuenta el análisis del mod). Debajo se ve la lista de habilidades baneadas, y también en cada
        draft.
      - Los baneos de héroe quedan apagados hasta que haya 40 héroes o más (D10).
      - 3 pruebas nuevas (93 en total).
      Simplificaciones a revisar: los rivales no eligen héroe según su estilo (les toca uno al azar entre los que
      quedan); en el mod los baneos probablemente son a la vez y acá los rivales banean primero; la lista de "las
      más fuertes" está fija en `js/ai.js` y hay que actualizarla a mano con cada banco.
- [x] Roshan (2026-11-12), con la decisión D9:
      - En las rondas 10, 20, 30... no hay oleada: aparece Roshan solo. Esa ronda no tiene duelo (historial del
        mod, 2 abr 2020). En la pausa anterior se anuncia: "Próxima ronda: Roshan".
      - Pega fuerte, a veces aturde, resiste la magia (40%: los que pegan con golpes lo matan más fácil, como en
        el mod) y se enfurece cada 10 segundos: +10% de daño y más velocidad de ataque, sin techo. A los 50
        segundos también se enfurece como los creeps.
      - Cada vez que vuelve es más fuerte: crece como los creeps y, además, un 15% más por cada aparición.
      - Matarlo rápido paga más (el premio de ronda va por puesto) y da 400 de oro base. Si tenés menos de 2 Aegis,
        te da uno (ver "Roshan: Aegis o libro" en las decisiones abiertas).
      - Se dibuja violeta, más grande, con su nombre y su nivel de furia.
      - El banco ahora dice cuántos jugadores caen en las rondas de Roshan y en las oleadas pesadas.
      - 2 pruebas nuevas.
      Calibración: con un script aparte medí qué pasa en cada ronda de Roshan. Con los primeros números (más
      fuerte en la ronda 10) caían 7 de 8; con un Aegis para todos los que lo mataban, las partidas terminaban
      todas en la ronda 60. Quedó: unos pocos eliminados en cada Roshan, más en los de las rondas 50 y 60.
      Simplificaciones a revisar: el nombre "Roshan" es el de Dota (entra en la decisión de nombres); el "tope del
      daño por porcentaje de vida contra Roshan" de `DISENO.md` no hace falta todavía porque ninguna habilidad del
      lote hace ese daño.
- [ ] Libros para cambiar o sumar una habilidad. Espera dos decisiones: "Libros: el nivel de la habilidad nueva"
      y "Libros gratis para los que van últimos".
- [ ] Ítems neutrales. Espera la decisión "Ítems neutrales: en qué rondas cae cada nivel".
- [ ] Marcas por perder duelos seguidos y ayudas al que va abajo. Las marcas ya están (D8, en "Final de
      partida"); las ayudas son los libros gratis, que esperan las decisiones de los libros.
- [ ] Aghanim para cualquier habilidad. Espera la decisión "Aghanim".

**Lista cuando:** comparado con `REFERENCIA-CHC.md`, no queda nada "distinto" sin que sea una decisión anotada.

## Etapa 5 · Contenido por tandas
- [ ] Lotes de 10-20 héroes, habilidades e ítems, cada uno medido con el banco antes de sumar el siguiente.

**Lista cuando:** el roster es grande y ninguna combinación gana sola.

## Etapa 6 · Balance y pulido
- [ ] Interfaz, sonido, tutorial, arte definitivo.

**Lista cuando:** versión 1.0.
