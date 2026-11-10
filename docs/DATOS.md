# Los datos de Dota

Están en `data/dota/`, tal cual se bajaron el 2026-11-10 de [dotaconstants](https://github.com/odota/dotaconstants)
(proyecto abierto de OpenDota, licencia MIT, versión `5c0242d`). No se editan a mano: son la copia de referencia. Lo
que el juego use se arma aparte a partir de estos.

Para consultarlos: `py -m http.server 8768` en la carpeta del proyecto y abrir `http://localhost:8768/datos.html`.

## Qué hay
| Archivo | Qué trae | Cantidad |
|---|---|---|
| `heroes.json` | Atributos base y crecimiento, vida, maná, armadura, daño, alcance, velocidad | 127 héroes (36 de Fuerza, 35 de Agilidad, 34 de Inteligencia, 22 Universales) |
| `hero_abilities.json` | Qué habilidades, talentos y facetas tiene cada héroe | 127 héroes |
| `abilities.json` | Nombre, descripción, tipo, daño, enfriamiento, maná y valores por nivel | 788 habilidades de héroes (184 pasivas, 163 ocultas, 126 innatas) |
| `items.json` | Costo, componentes, atributos, efecto activo o pasivo | 208 ítems de tienda, 85 recetas, 49 neutrales |
| `aghs_desc.json` | Qué le hace el Cetro y el Fragmento de Aghanim a cada héroe | 127 héroes |
| `neutral_abilities.json` | Solo la lista de habilidades de creeps neutrales, sin números | |

## Qué les falta
- **No dicen cómo funciona cada habilidad, solo sus números.** El archivo sabe que Arc Lightning hace 105/130/155/180
  de daño y salta 5/7/9/11 veces, pero "rebota entre enemigos cercanos" está escrito en inglés para leer, no como
  regla. Esa parte hay que armarla con piezas, habilidad por habilidad: es la Etapa 2.
- **Las "ocultas" son partes de otras habilidades** (la segunda mitad de un hechizo, formas alternativas). Hay que
  revisarlas una por una para saber cuáles cuentan como habilidad elegible.
- **Los creeps no están:** ni los de las oleadas del mod ni los números de los neutrales.
- **Nada de lo propio del mod:** precios cambiados, libros, oro por ronda, oleadas.
- Los textos están en inglés.
