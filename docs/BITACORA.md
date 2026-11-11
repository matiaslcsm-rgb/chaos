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
