# Piezas de habilidades y primer lote

Los datos de Dota traen los números de cada habilidad pero no cómo funciona (ver `DATOS.md`). La idea es no programar
788 habilidades una por una: se definen **piezas** y cada habilidad es una combinación de piezas con sus números.

Ejemplo: *Storm Hammer* de Sven = se lanza a un enemigo + proyectil + área + daño + aturdimiento.

## Las piezas

**Cómo se lanza**

| Pieza | Qué es |
|---|---|
| Pasiva | Siempre activa |
| Sin objetivo | Se activa y sale desde el héroe |
| A una unidad | Elegís un enemigo o aliado |
| A un punto | Elegís un lugar del piso |
| Canalizada | Hay que quedarse quieto mientras dura |
| Modificador de ataque | Cambia los golpes normales (se prende y se apaga) |

**Qué hace, nivel 1 (básicas)**

Daño · daño por segundo · curación · aturdir · ralentizar · inmovilizar · silenciar · desarmar · armadura ·
resistencia mágica · velocidad de ataque · velocidad de movimiento · atributos · daño de ataque · crítico · robo de
vida · evasión · efecto con probabilidad al golpear · daño en abanico · maná (quemar, drenar, dar) · escudo · área · aura

**Nivel 2 (piden más motor)**

Rebote entre enemigos · empujar y atraer · saltos y teletransporte · invisibilidad · disipar · inmunidad · maleficio
(convertir en bicho) · miedo y provocación · devolver daño · ejecutar bajo cierta vida · acumulaciones · invocaciones

**Nivel 3 (código a medida)**

Ilusiones · transformaciones · robar o copiar habilidades · terreno (paredes, árboles) · lazos entre unidades ·
manipular el tiempo · tomar control de unidades · efectos globales

## Clasificación automática

`node tools/classify.js` lee las descripciones y los nombres de los valores, adivina qué piezas usa cada habilidad y
guarda el resultado en `data/classification.json`.

De las 788 habilidades de héroes, **557 se pueden elegir en el draft** (se sacan las ocultas, que son partes de otras, y
las innatas, que son del héroe):

| Dificultad | Cantidad | |
|---|---|---|
| Simple | 199 | Salen solo con piezas de nivel 1 |
| Media | 247 | Usan alguna pieza de nivel 2 |
| Difícil | 99 | Usan alguna pieza de nivel 3 |
| Sin clasificar | 12 | La descripción no alcanzó |

**Es una estimación para planificar, no un veredicto.** Busca palabras, así que se equivoca para los dos lados: marca
como difícil a *Lightning Hands* de Zeus (que es un modificador de ataque simple) y como media a *Primal Split* de
Brewmaster (que es de las más difíciles del juego). Cada habilidad se revisa a mano cuando entra a un lote.

Las piezas más usadas: daño (437 habilidades), área (331), ralentizar (162), velocidad de movimiento (144), daño por
segundo (116), curación (115), invocaciones (86), aturdir (80), empujar y atraer (80).

## Primer lote (para la Etapa 3)

Guardado en `data/batch1.json`. Elegido a mano: héroes conocidos, de kits sencillos, repartidos entre atributos y
entre cuerpo a cuerpo y rango, que entre todos usen casi todas las piezas de nivel 1 y algunas de nivel 2.

| Héroe | Atributo | Habilidades |
|---|---|---|
| Sven | Fuerza | Storm Hammer, Great Cleave, Warcry, God's Strength |
| Ogre Magi | Fuerza | Fireblast, Ignite, Bloodlust, Multicast |
| Axe | Fuerza | Berserker's Call, Battle Hunger, Counter Helix, Culling Blade |
| Sniper | Agilidad | Shrapnel, Headshot, Take Aim, Concussive Grenade, Assassinate |
| Viper | Agilidad | Poison Attack, Nethertoxin, Corrosive Skin, Nosedive, Viper Strike |
| Luna | Agilidad | Lucent Beam, Lunar Orbit, Moon Glaives, Eclipse |
| Phantom Assassin | Agilidad | Stifling Dagger, Phantom Strike, Immaterial, Coup de Grace |
| Crystal Maiden | Inteligencia | Crystal Nova, Frostbite, Arcane Aura, Freezing Field |
| Zeus | Inteligencia | Arc Lightning, Lightning Bolt, Heavenly Jump, Lightning Hands, Thundergod's Wrath |
| Skywrath Mage | Inteligencia | Arcane Bolt, Concussive Shot, Ancient Seal, Mystic Flare |

10 héroes y 43 habilidades (28 simples, 14 medias y 1 difícil según la clasificación automática).

**25 ítems**, elegidos para que todas las recetas cierren dentro del lote:
- Básicos (15): Boots of Speed, Blades of Attack, Chainmail, Gloves of Haste, Belt of Strength, Robe of the Magi,
  Staff of Wizardry, Broadsword, Claymore, Mithril Hammer, Ogre Axe, Demon Edge, Reaver, Morbid Mask, Hyperstone.
- Compuestos (10): Phase Boots, Power Treads, Crystalys, Daedalus, Black King Bar, Skull Basher, Satanic, Mask of
  Madness, Moon Shard, Kaya.

Los nombres son los de Dota mientras no se decida si van nombres propios (ver "Decisiones abiertas" en `PLAN.md`).
