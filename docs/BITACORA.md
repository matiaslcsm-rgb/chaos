# Bitácora

Lo que hace cada sesión de trabajo, con fecha. Lo más nuevo va al final.

## 2026-11-11 (miércoles) · tarea diaria

**Qué quedó hecho** (todo en la rama `final-version`, subido a GitHub):
- **Los 7 rivales de la IA.** Ahora la partida es de 8: vos y 7 rivales, cada uno con su arena, que se juega de
  verdad aunque no se vea. Eligen habilidades, suben de nivel, compran y pelean solos, cada uno con su personalidad.
  Las rondas van juntas para los 8. Arriba a la izquierda hay una tabla con todos; con un clic ves qué tiene cada uno.
- **Duelos y apuestas.** Desde la ronda 2 hay un duelo por ronda entre dos jugadores. Si te toca, lo jugás vos. Si
  no, apostás en el panel de arriba a la derecha (50, un cuarto o la mitad de tu oro) y después ves cuánto cobraste.
- **Final de partida.** Cada uno arranca con 2 Aegis (vidas). Al final, con 3 o menos jugadores, perder un duelo
  cuesta un Aegis o una marca de maldición. Al caer o al ganar, una pantalla muestra el orden de los 8 y de dónde
  salió tu oro.
- **Banco de partidas** (a medias): `banco.html` y `node tools/bench.js` juegan partidas solas y miden el balance.
- Se aplicó la decisión D2: ahora el draft ofrece 8 habilidades por elección.
- Pruebas: de 57 a 84, todas bien en la consola y en el navegador ("✅ 84/84 pruebas").

**Qué no pude verificar o quedó pendiente:**
- Probé el juego en el navegador, pero con el panel oculto la animación casi no avanzaba: hice correr la partida
  desde la página y miré capturas. No lo jugué a velocidad normal con el mouse de punta a punta.
- Con los creeps de relleno de hoy las partidas no terminan solas: en 6 partidas de prueba hasta la ronda 30 no cayó
  casi nadie. Por eso el banco no está tildado: falta armar las oleadas de D5 y calibrarlas con el banco.
- No se pudo releer el historial del mod de 2021 en adelante: Steam sigue respondiendo "demasiadas consultas".
- La publicación (jugar desde un enlace) queda para hacerla con vos: esta tarea no publica nada.

**Decisiones que necesitás tomar** (están en `docs/PLAN.md`, "Decisiones abiertas"):
- **Nueva:** cuánta ventaja da revivir con Aegis. El mod no lo dice. Hoy: la mitad de daño recibido y 50% más de daño
  hecho durante 5 segundos (recomendada, ajustable con el banco).
- Siguen abiertas las de antes (nombre, imágenes, estilo, tecla para subir de nivel, definitivas en el draft, etc.).

**Uso:** al empezar, 1% del límite de 5 horas (41% del semanal); al terminar, 25% (44% del semanal).

**Por qué frené:** hoy es miércoles y el tope es 30%. Lo que sigue, armar las oleadas de D5 y calibrarlas con el
banco, es un trabajo grande que no entraba sin dejarlo a medias.

## 2026-11-11 (miércoles, más tarde) · sesión con el usuario

**Qué quedó hecho:**
- **Oleadas de verdad (D5).** 9 tipos de creep con nombres propios: Kóbold, Arpía, Lobo, Centauro, Troll, Bicho
  explosivo, Araña, y los pesados Gólem y Ogro. Cada ronda tiene su oleada fija, igual para los 8, con una oleada
  pesada cada 5 rondas. En la pausa se anuncia la próxima debajo del título.
- A los 50 segundos los creeps se enfurecen, como en el mod.
- El premio de ronda ahora depende del puesto: el que termina primero cobra más.
- **Las partidas terminan solas.** Calibré el crecimiento de los creeps con el banco: en 12 partidas de prueba
  terminaron entre las rondas 49 y 72, con promedio 60 (la meta era 55-65).
- **Decisiones tuyas anotadas:** la ventaja al revivir con Aegis queda como estaba (mitad de daño recibido y 50%
  más de daño hecho, 5 segundos), y en la recta final, perder un duelo sin Aegis y con las 3 marcas te deja afuera.
- Banco de partidas tildado. Pruebas: 90, todas bien.

**Qué no pude verificar:** no jugué una partida entera con el mouse; la probé haciéndola avanzar desde la página y
mirando capturas.

**Banco de 24 partidas (con las oleadas nuevas):**
- Las 24 terminaron solas, en la ronda 60,5 en promedio.
- El oro sale de: rondas 50%, duelos 23%, creeps 19% y apuestas 7,5%.
- El favorito ganó el 71% de los 1.429 duelos (la meta era menos de 75%).
- **Hallazgo importante:** los héroes de inteligencia (Crystal Maiden, Zeus, Skywrath Mage) y Ogre Magi no ganaron
  ninguna partida, y Luna, Sven y Phantom Assassin ganan entre el 30% y el 37% (lo esperado es 12,5%). Las
  habilidades que más ganan son las que mejoran el ataque (Lightning Hands, Coup de Grace, Headshot, Poison Attack).
  Ninguna llegó todavía a la alarma "gana sola", pero el estilo "mago" de la IA está claramente en desventaja: es lo
  primero a mirar en el balance.

## 2026-11-17 (lunes) · sesión con el usuario

**Qué quedó hecho** (en la rama `final-version`, subido a GitHub):
- **Tus 4 decisiones de la etapa 4**, todas las recomendadas, anotadas en `docs/PLAN.md`.
- **Libros.** En la tienda: Reentrenamiento (2.900, elegís qué habilidad cambiar), Página rota (1.200, una al azar)
  y Libro Parangón (13.000, una sexta habilidad). La nueva entra con el nivel de la vieja. Libros gratis para los
  tres últimos al terminar las rondas 10, 20, 30 y 40, y Roshan da un libro a quien ya tiene 2 Aegis.
- **Ítems neutrales.** Después de las rondas 10, 20, 30, 40 y 50 elegís uno entre 3 del nivel que toca. Van en su
  propio casillero (tecla G). Hay 20 de los 49 de Dota.
- **Aghanim.** Cetro (4.200) y fragmento (1.400) en la tienda, con 8 mejoras de habilidades del lote, entre ellas
  Unrefined Fireblast para el que tenga Fireblast.
- La IA usa todo esto: elige neutrales, usa libros y compra el fragmento, el cetro y el Parangón.
- La tienda pasó a 6 columnas para que entren los libros y el Aghanim.
- Pruebas: de 97 a 115, todas bien.

**Qué no pude verificar:** no jugué una partida entera con el mouse; probé las pantallas nuevas en el navegador
haciendo avanzar la partida desde la página y mirando capturas.

**Banco de 6 partidas al final:** todas terminaron solas, en la ronda 55,5 en promedio. Ganó por primera vez un
héroe de inteligencia (Crystal Maiden). A vigilar: muchas eliminaciones en el Roshan de la ronda 50 (16 de 42).

**Quedó pendiente:** las mejoras de Aghanim cuyos números no están en los datos (lista en el PLAN), y pasar la rama
`final-version` a `main`.

**Uso:** al empezar, 2% del límite de 5 horas; al terminar, 38%.
