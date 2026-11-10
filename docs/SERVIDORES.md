# Por qué el mod anda mal desde Latam, y si un mod propio en Dota 2 lo arregla

Investigación del 2026-11-10. Las fuentes son reportes de jugadores (GitHub de Valve, comentarios del Workshop) y la
página del mod; Valve no publicó nada. Lo más nuevo que encontré es de principios de noviembre de 2026.

## Qué pasó
- **Desde fines de agosto de 2026 los servidores de Valve para los juegos del Arcade no funcionan bien, en todo el
  mundo.** Las salas quedan en "Buscando servidor" o tiran "Fuera de línea por mantenimiento", también las privadas y
  eligiendo la región a mano. Hay muchos reportes abiertos y ninguna respuesta de Valve en lo que pude leer.
- Cuando no hay servidor, Dota avisa que la PC de un jugador va a alojar la partida ("Local Host"). Los mods que
  dependen de un servidor propio (perfil, guardado, compras) no funcionan bien así. Custom Hero Chaos es uno de esos.
- **Los creadores del mod pasaron a un programa aparte, el "VG Custom Launcher", con servidores de ellos.** Según los
  comentarios de octubre, tiene servidores rusos y chinos y ninguno de Sudamérica ni Norteamérica: 200-350 de ping.

Conclusión: el problema no es la región que elegís. Son los servidores de Valve caídos, más un reemplazo que solo
tiene servidores lejos.

## ¿Un mod propio lo arregla?
- **En el Arcade común, no por sí solo:** usaría los mismos servidores de Valve que están fallando. El autor de un mod
  no elige ni pone servidores.
- **Con "Local Host", sí puede:** si el mod no depende de ningún servidor externo, la partida la aloja la PC de uno
  del grupo. Si todos están en Latam, el ping es bajo. Sirve para jugar entre amigos en sala privada, no para buscar
  partida con desconocidos.
- **Riesgos:** en septiembre un jugador reportó que con Local Host se le cerraba el juego al elegir héroe; otro, que
  le funcionó bien con un mod de 12 contra 12. No sé cómo está hoy. Y si la PC del anfitrión se cae, se cae la partida.

## La prueba antes de decidir
Con un amigo: en el Arcade, crear una sala de cualquier juego simple (por ejemplo Overthrow), poner **Ubicación del
servidor: Local Host**, y ver si arranca y con cuánto ping juega el que no es anfitrión. Si anda, un mod propio para
Latam es viable. Si no, no hay forma de jugarlo bien hasta que Valve arregle los servidores.

## Fuentes
- [Juegos del Arcade trabados en "finding server" (19/8/2026)](https://github.com/ValveSoftware/Dota2-Gameplay/issues/34531)
- [Custom Games rotos: "Finding Server" u "Offline for Maintenance" (24/8/2026)](https://github.com/ValveSoftware/Dota2-Gameplay/issues/34743)
- [Custom Hero Chaos no encuentra servidor en Europa ni América (31/8/2026)](https://github.com/ValveSoftware/Dota2-Gameplay/issues/35111)
- [Servidores dedicados caídos, se fuerza Local Host (9/9/2026)](https://github.com/ValveSoftware/Dota2-Gameplay/issues/35302)
- [Comentarios del mod en el Workshop](https://steamcommunity.com/sharedfiles/filedetails/comments/1999002498)
- [Historial de cambios del mod](https://steamcommunity.com/sharedfiles/filedetails/changelog/1999002498)
- [Página del VG Custom Launcher](https://home.vgbattle.com/en/)
