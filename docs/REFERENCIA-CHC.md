# Custom Hero Chaos, el mod original de Dota 2

Primera investigación: 2026-10-18. Segunda, con las reglas en detalle: 2026-11-11. Junta lo que dicen el historial de
cambios del propio mod (lo más confiable: lo escribe el creador), una nota oficial de Dota 2 China, guías de la
comunidad y un análisis largo de un jugador (fuentes al final). Ojo: el mod se cambió cientos de veces desde 2020 y
casi ninguna fuente da todos los números. Cada regla dice de dónde sale; lo que no se encontró está listado aparte y
**no se inventa**: pasa a `DISENO.md` como "(decisión)".

## Qué es

*Custom Hero Chaos* (CHC) es un juego hecho por la comunidad adentro de Dota 2 (en la sección Arcade), del creador
NoobHumiliator (estudio EoM). Salió el 16 de febrero de 2020 y se inspira en un mapa clásico de Warcraft 3. Fue uno de
los más jugados del Arcade: un análisis de 2023 habla de unos 7.000 jugadores conectados en los picos. Tiene un
hermano, *Custom Hero Clash*, que copia la idea y corrige algunas cosas (más abajo).

La idea en una línea: **8 jugadores, cada uno en su arena, peleando oleadas de creeps cada vez más fuertes; en cada
ronda dos se enfrentan en un duelo y los demás apuestan oro a quién gana. Gana el último que queda.**

## Cómo se juega el original (resumen)

- **Antes de empezar:** cada uno **banea** un héroe y una habilidad (los suscriptores, más) y elige su héroe entre 4
  ofrecidos, con un "volver a sortear". El héroe es casi solo una base de atributos: lo que importa son las habilidades.
- **Habilidades:** se arman mezclando de cualquier héroe. Se eligen **5 en total**: 2 en la ronda 1 y una más en las
  rondas 3, 6 y 9. Si cerrás la ventana, te toca una al azar. El Aghanim (cetro y fragmento) mejora cualquier
  habilidad, sea del héroe que sea.
- **Rondas:** en cada ronda peleás tu oleada de creeps; cuanto más rápido la limpiás, más oro. El héroe **sube un nivel
  por ronda**. Entre rondas hay unos 15 segundos para comprar.
- **Duelos:** en cada ronda dos jugadores se enfrentan mientras los demás siguen con sus creeps.
- **Apuestas:** los demás apuestan **hasta la mitad de su oro**. Varias guías coinciden en que **apostar es la forma
  principal de hacer oro**, y que para apostar bien hay que **mirar las habilidades y los ítems de los dos duelistas**.
- **Vidas:** cada jugador tiene escudos de revivir (Aegis). Morir contra los creeps gasta uno; sin escudos, quedás afuera.
- **Jefes:** Roshan aparece una o más veces por partida.
- **Ayudas para el que va abajo:** en las rondas 10, 20, 30 y 40 los últimos reciben libros para cambiar habilidades.
- **Cómo termina:** gana el último que queda. Normalmente hay que llegar a la ronda **55-65**: partidas de una hora.
- **Modos:** 8 solos, de a dos (12 jugadores) y 5 contra 5. También hay uno contra la máquina, de 500 oleadas.

## Las reglas en detalle

"Historial" es el historial de cambios del mod, con la fecha de la entrada. "Nota oficial" es la de dota2.com.cn de
abril de 2020. "Análisis" es el del jugador de 2023. "Guía 2021" y "Guía 2023" son las de Steam.

### Antes de empezar

| Regla | Qué dice la fuente |
|---|---|
| Héroes ofrecidos | Te dan un héroe y otros 3 para elegir (Guía 2023, Nota oficial). |
| Volver a sortear | Una vez. Aparecen 3 héroes nuevos y el de la izquierda queda; en total ves 7 (Análisis). |
| Baneos | 1 héroe y 1 habilidad por jugador; en una partida típica se usan 5-6 baneos de habilidad y 3-4 de héroe (Análisis). Los suscriptores banean 3 habilidades y 2 héroes (Guía 2025). |
| Baneos y libros | Una habilidad baneada tampoco sale en los libros (Historial, 15 may 2020). |

### Habilidades

| Regla | Qué dice la fuente |
|---|---|
| Cuántas | 5: dos al empezar y una más en las rondas 3, 6 y 9 (Historial, 27 feb 2020; guías). Una sexta con un libro. |
| Opciones por elección | **No coinciden:** 8 (Nota oficial 2020 y Guía 2021) o 16 (Análisis 2023). Probablemente subió con los años. |
| Tiempo para elegir | Sin límite (Historial, 6 mar 2020). Hay un botón para esconder la ventana y seguir jugando (30 oct 2020). |
| Cerrar la ventana | Te da una al azar que no estaba en la lista (Guía 2023). |
| Habilidades del propio héroe | Salen un poco más seguido (+7%) (Historial, 30 nov 2020). |
| Aghanim | El cetro y el fragmento funcionan con cualquier habilidad, juegues con quien juegues (guías). |
| Habilidades incompatibles | Algunos pares no se pueden tener juntos (varias entradas del Historial). |
| Habilidades repetidas entre jugadores | **No se encontró** si dos jugadores pueden tener la misma. |

### Rondas y creeps

| Regla | Qué dice la fuente |
|---|---|
| Nivel | Uno por ronda: en la ronda 60 sos nivel 60 (Análisis). |
| Pausa entre rondas | Unos 15 segundos (Análisis). 3 segundos más en las rondas con duelo (Historial, 9 abr 2020) y un poco más después de la ronda 40 (20 nov 2020). |
| Límite de tiempo | Cada ronda tiene un tiempo. Al vencer, los creeps se enfurecen: se mueven más rápido, no se los puede ralentizar, sus golpes no fallan y lastiman aunque seas invulnerable (Historial, 21 y 28 feb y 20 may 2020). Una guía china habla de limpiar en unos 50 segundos. **El tiempo exacto no se encontró.** |
| Crecimiento | Crecen rápido antes de la ronda 10 y más lento después de la 20 (Historial, 28 feb 2020). Desde la ronda 60 tienen resistencia mágica y una habilidad que rompe armadura; el daño de sus hechizos sube con las rondas (21 feb y 14 mar 2020). |
| Qué tan duros | Hasta la ronda 20-25 son fáciles; en rondas altas se vieron creeps de 791.000 de vida. Cerca de la ronda 50 hace falta sí o sí una habilidad defensiva (Análisis). |
| Tipos | Creeps neutrales de Dota (arpías con rayo, gólems, etc.) y algunos propios: Baneling, Toxin Spider (apaga las pasivas), Timber Spider (Historial, mar-abr 2020). La ronda que viene se anuncia arriba a la izquierda (FAQ rusa). |
| Composición de cada oleada | **No se encontró** una tabla ronda por ronda. |
| Ronda máxima | Sin límite (Historial, 16 feb 2020). |

### Oro

| Regla | Qué dice la fuente |
|---|---|
| Oro inicial | 600 (Análisis). |
| Oro por ronda | Hay un premio al terminar la ronda y el que limpia más rápido cobra más (Nota oficial; Historial, 25 may 2020). Un ejemplo: el más rápido unos 500, el más lento unos 50, el autor 250 (Análisis). **La fórmula no se encontró.** |
| Oro por creep | Los creeps dan oro al morir (Historial, 23 jun 2020). **Cuánto, no se encontró.** |
| Al quedar eliminado | Tu oro pasa a 0 (Historial, 18 feb 2020). |
| Economía típica | Tener solo 10.000 en la ronda 20 es ir mal; en la 35 sobra el oro (guía china). |

### Duelos

| Regla | Qué dice la fuente |
|---|---|
| Cada cuánto | **En cada ronda** el juego elige a dos jugadores para un duelo; la primera ronda no tiene (Nota oficial). "Cada ronda peleás contra creeps o te toca un duelo" (Guía 2023). Con 8 jugadores te toca más o menos 1 de cada 4 rondas, que es lo que cuenta el Análisis; con menos jugadores, más seguido. |
| Quién pelea | Todos tienen la misma probabilidad y no se repite el mismo jugador seguido (Historial, 4 y 8 mar 2020). |
| Ronda de Roshan | No hay duelo (Historial, 2 abr 2020). Una guía china dice que desde la ronda 20 las rondas terminadas en 9 no tienen duelo. |
| Invocaciones | Antes del duelo se mueren todas, y a cambio esas habilidades quedan listas para usar (Historial, 10 jun 2020). |
| Habilidades en recarga | No se reinician: si tu habilidad clave está en recarga, entrás sin ella (Análisis). |
| Premio | El duelista recibe una apuesta gratis a sí mismo (10% al principio, después 6% y al final 5%) y, si gana, cobra esa apuesta más un extra (Historial, 7, 8 y 12 abr 2020). El perdedor no cobra nada. Un favorito puede ganar unos 2.000 y una sorpresa 10.000-20.000 (Análisis). **De qué es ese 5%, no queda claro.** |
| Duración máxima | **No se encontró.** |
| Mirar el duelo | Cuando terminás tu ronda, la cámara va sola al duelo (Historial, 7 abr 2020). |

### Apuestas

| Regla | Qué dice la fuente |
|---|---|
| Quién apuesta | Los que no pelean y siguen vivos. Los eliminados no (Historial, 18 feb y 11 mar 2020). Los rivales de la IA también apuestan (13 ago 2020). |
| Cuánto | Hasta el 50% de tu oro actual, a uno solo (Nota oficial, Análisis). |
| Tiempo | 15 segundos para apostar y comprar desde que se anuncia el duelo (Análisis). |
| Qué se ve | Las habilidades y los ítems de los dos, y el total apostado (Historial, 8 abr 2020). |
| Cómo se paga | Es un pozo: los que aciertan se reparten **todo** lo apostado en proporción a lo que puso cada uno, y el juego agrega un extra al pozo (Nota oficial; Historial, 18 feb 2020). Si perdés, perdés lo apostado. |
| Cuánto rinde | "Como mínimo duplicás"; acertar una sorpresa paga varias veces más. En una partida larga es normal ganar más de 100.000 apostando (Análisis). |
| Truco conocido | Los duelistas compran a último momento para que los demás apuesten mal (Guía 2023). |

### Vidas, maldición y final

| Regla | Qué dice la fuente |
|---|---|
| Vidas | 2 escudos de revivir (Aegis) por jugador (Nota oficial). *Clash* da 3 vidas. |
| Morir contra los creeps | Gasta un escudo; revivís con una ventaja pasajera (recibís menos daño y hacés más). Sin escudos, quedás afuera (Nota oficial). |
| Comprar escudos | El Aegis se vende en la tienda (Historial, 12 abr 2020). **El precio no se encontró.** |
| Castigo por perder duelos | Solo cuando quedan 3 o 2 jugadores: el que pierde un duelo pierde un escudo y, si no tiene, recibe una maldición (Historial, 21 feb 2020). Si la partida empezó con menos de 5 jugadores, no hay castigo (26 feb 2020). |
| La maldición | Baja el daño que hacés y sube el que recibís; también baja los atributos (Historial, 21 feb y 28 mar 2020). Se acumula. Según el Análisis: cada marca es +10% de daño recibido, -10% de daño hecho y -10% de oro, y con 2 o 3 "ya no se puede jugar". |
| Quién gana | El último que queda vivo. |

### Roshan

| Regla | Qué dice la fuente |
|---|---|
| Cuándo | **No coinciden:** una vez, al azar entre las rondas 40 y 50 (FAQ rusa 2020; guía china: 40-45) o más o menos cada 10 rondas (Análisis 2023). *Clash* tiene un jefe cada 10 rondas. |
| Cómo es | Se enfurece con el tiempo; los que pegan con golpes lo matan más fácil que los magos; matarlo rápido da más oro; muchos lo matan devolviéndole el daño con Blade Mail (guías). Es la ronda donde más jugadores quedan afuera (guía china). |
| Aviso | El anuncio de la ronda que viene siempre lo muestra (FAQ rusa). |

### Libros y ayudas al que va abajo

| Ítem | Qué hace | Precio |
|---|---|---|
| Book of Retraining (libro) | Elegís una habilidad tuya, se va y elegís otra de una lista nueva. | 2.900 (Análisis). En *Clash*, 3.000. |
| Torn Page (página rota) | Te saca una habilidad **al azar** y elegís otra. | 1.200; se vende a 600 (Análisis). |
| Paragon Book | Suma una sexta habilidad. Una sola vez. | 13.000 (Historial, 7 dic 2020). En *Clash*, 6.000. |
| Omniscient Book | Cambiás una habilidad por cualquiera del juego, sin lista. | No se encontró. |
| Book of Summoner | Te saca una al azar y te da una de invocación. | No se encontró. |
| Tomos de atributo | +3 de fuerza, agilidad o inteligencia cada uno. Se compran cuando el inventario ya está lleno. | No se encontró. |

- **Quién recibe libros gratis:** al terminar las rondas 10, 20, 30 y 40, los que van últimos en oro. Los dos últimos
  reciben un libro y una página rota; el antepenúltimo, solo la página (Nota oficial; Historial, 25 feb, 2 y 8 abr y
  2 jun 2020). El Análisis de 2023 lo cuenta en 4 escalones: último, dos páginas y un libro; anteúltimos, una página
  y un libro; siguiente, un libro; y el 3.º o 4.º, una página.
- En versiones recientes también puede caer un libro al perder un Aegis (Guía 2025).
- Si cambiás una habilidad mejorada con Aghanim, perdés la mejora (Análisis).

### Ítems

| Regla | Qué dice la fuente |
|---|---|
| Base | Los ítems de Dota 2, con tienda única que se usa desde cualquier lado (Historial, 6 mar 2020). No hay Travel Boots ni wards. |
| Ítems propios | Una línea de daño contra creeps con 5 niveles; escudos contra creeps; Sky Staff y Star Force (salen de Kaya, daño mágico); Torture Pipe (daño por segundo); los de invocador (salen del Helm of the Dominator); una versión de Battle Fury para héroes de rango; Dark Moon Shard (4 Hyperstone, 8.000 de oro, -30% de tiempo entre ataques, un solo uso) (guías, Historial, Análisis). |
| Precios | Los ítems grandes cuestan 12.000-15.000; el mejor de daño, unos 13.000 (Análisis). **No se encontró la lista de precios**; los ítems comunes parecen costar lo mismo que en Dota. |
| Tope de velocidad de ataque | 700 (antes 999) (Análisis). |
| Mandar creeps a los rivales | Ítems que se consumen y, desde la ronda siguiente, suman un creep extra en la arena de todos los demás; el más caro (Toxin Spider) cuesta 20.000 (Historial, 5 y 16 jun 2020). |
| Ítems neutrales | Los sueltan los creeps; hay 5 niveles; no se pueden vender; en partidas de 8, como mucho 3 por nivel (Historial, 30 nov y 7 dic 2020). **En qué rondas cae cada nivel, no se encontró** para *Chaos*; en *Clash* se entregan al terminar las rondas 10, 20, 30 y 40. |

## Qué lo hacía divertido (según los jugadores)

1. **Nunca sabés qué te va a tocar:** cada partida es otra combinación de habilidades, y hay muchas remontadas.
2. **Dos juegos en uno:** pelear y apostar. Leer un duelo y acertar da tanta satisfacción como ganarlo.
3. **Los duelos son el momento de tensión:** todos miran.
4. **Decisiones de verdad:** qué banear, qué habilidad tomar, cuándo comprar y cuándo guardar para apostar.

## Qué problemas tenía (para no repetirlos)

1. **Combinaciones que ganan solas:** los golpes que aturden con cada ataque, sumados a mucha velocidad de ataque,
   aturdían para siempre; también el daño según la vida máxima (Feast, Infernal Blade, Maledict), las invocaciones en
   los duelos (Death Ward mata antes de poder reaccionar), Rearm y Tempest Double. No había un ítem para resistir
   aturdimientos. El creador pasó años bajándoles el daño de a 20% sin resolverlo.
2. **Un baneo por jugador no alcanzaba:** había 15-20 habilidades "rotas" y la comunidad pedía 2 o 3 baneos.
3. **Convenía no pelear:** apostar daba más oro que ganar duelos, y la gente prefería que el duelo no le tocara.
   *Clash* lo corrigió **dándole más oro a los duelistas**.
4. **El castigo por perder seguido era demasiado:** con 2 o 3 marcas ya no se podía jugar. Un jugador proponía 7-8% en
   vez de 10%.
5. **El favorito casi siempre gana** (80-85% de las veces el que tiene más oro), así que apostar al favorito era fácil.
6. **Apostar 1 de oro a la sorpresa pagaba fortunas** cuando nadie más le apostaba (Historial, 7 abr 2020). El creador
   lo emparchó con la apuesta gratis del duelista.
7. **Duelos arreglados:** un jugador se dejaba ganar y sus amigos apostaban al otro (discusiones de Steam). Contra la
   IA no aplica.
8. **Partidas de una hora que se pierden al principio:** con malas habilidades la partida "es insoportable", y muchos
   reiniciaban hasta que les tocara algo bueno (comentarios del Análisis).
9. **Balance abandonado** durante años, según los jugadores.

## Lo que no se encontró

Queda como "(decisión)" en `DISENO.md`, con números provisorios que se ajustan con el banco de partidas:

- La fórmula del oro por ronda y el oro por creep.
- La composición de cada oleada y la vida y el daño de los creeps ronda por ronda.
- Cuánto dura una ronda antes de que los creeps se enfurezcan.
- La fórmula exacta del premio del duelo y del extra que el juego suma al pozo de apuestas.
- Cuánto puede durar un duelo y qué pasa si nadie muere.
- El precio del Aegis, de los tomos y de varios libros; la lista de precios de los ítems propios.
- En qué rondas cae cada nivel de ítem neutral.
- Si dos jugadores pueden tener la misma habilidad.

Las páginas del historial de 2021 en adelante no se pudieron leer completas (Steam limita las consultas); si se
vuelven a revisar, puede aparecer alguno de estos datos.

## Fuentes

- [Historial de cambios de Custom Hero Chaos (767 entradas desde 2020)](https://steamcommunity.com/sharedfiles/filedetails/changelog/1999002498)
- [Nota oficial de Dota 2 China sobre el mod (abril de 2020)](https://www.dota2.com.cn/article/details/20200427/216191.html)
- [Custom Hero Chaos: The Biggest Game Inside Dota 2 (análisis de un jugador, 2023)](https://billiondollarcompany.substack.com/p/custom-hero-chaos-the-biggest-game)
- [Guía de Custom Hero Chaos en Steam (2023, en ruso)](https://steamcommunity.com/sharedfiles/filedetails/?id=2971173666)
- [Guía de Custom Hero Chaos en Steam (2025, ruso/inglés)](https://steamcommunity.com/sharedfiles/filedetails/?id=3570972414)
- [Cómo ganar en Custom Hero Chaos (guía de Steam, 2021, en ruso)](https://steamcommunity.com/sharedfiles/filedetails/?id=2354614531)
- [Preguntas frecuentes de Custom Hero Chaos (Respawn, 2020, en ruso)](https://respawn.media/gaming/7p3k8-faq-po-custom-hero-chaos-ot-cqru)
- [Experiencias con el mod (17173, 2020, en chino)](http://dota2.17173.com/news/04242020/113833168.shtml)
- [Custom Hero Clash comparado con Chaos (blog de sports.ru)](https://cyber.sports.ru/dota2/blogs/2858357.html)
- [Historial de cambios de Custom Hero Clash](https://steamcommunity.com/sharedfiles/filedetails/changelog/2141071809?p=21)
- [Discusión de la comunidad sobre balance (2023)](https://steamcommunity.com/workshop/filedetails/discussion/1999002498/4039230498605074765)
