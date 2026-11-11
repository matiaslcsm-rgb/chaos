# Diseño de Chaos 1.0

Escrito el 2026-11-11. Describe el juego completo antes de programarlo. La base es `REFERENCIA-CHC.md`: lo que ahí
tiene fuente se hace igual que en el mod; lo que el mod no deja claro o lo que conviene cambiar está marcado
**(decisión)** y juntado al final, con opciones y una recomendada. Hasta que el usuario responda, vale la recomendada.

## 1. Una partida de punta a punta

1. **Inicio.** Tocás "Jugar". Se arman 8 jugadores: vos y 7 rivales de la IA, cada uno con nombre y color.
2. **Baneos.** Cada jugador saca del juego un héroe y una habilidad (ver D10).
3. **Héroe.** Te dan un héroe y otros 3 para elegir. Podés volver a sortear una vez: aparecen 3 nuevos y el primero
   queda. El héroe pone los atributos; las habilidades vienen del draft.
4. **Primeras dos habilidades.** Elegís 2 de una lista al azar. Los rivales eligen las suyas.
5. **Rondas.** Cada ronda tiene tres momentos:
   - **Preparación (15 s; 18 s si hay duelo):** tienda abierta, se anuncia qué creeps vienen y, si hay duelo, quiénes
     pelean. Los que no pelean apuestan.
   - **Pelea:** cada jugador pelea su oleada en su arena. Los dos duelistas pelean entre ellos en la arena de duelos
     en vez de pelear creeps.
   - **Cierre:** oro de la ronda, se pagan las apuestas, todos suben un nivel y vuelven con la vida llena.
6. **Más habilidades** antes de las rondas 3, 6 y 9, hasta tener 5.
7. **Cada 10 rondas:** Roshan (ver D9), ítems neutrales y libros gratis para los que van últimos.
8. **Eliminación.** Si los creeps te matan, gastás un Aegis y revivís en el lugar con una ventaja corta. Sin Aegis,
   quedás afuera: tu oro pasa a 0 y seguís mirando.
9. **Recta final.** Cuando quedan 3 jugadores, perder un duelo también cuesta un Aegis (o una maldición si no tenés).
10. **Final.** Gana el último en pie. Pantalla con el podio, en qué ronda cayó cada uno y de dónde salió tu oro.

Una partida fiel dura 55-65 rondas, cerca de una hora (ver D1).

## 2. Las pantallas

| Pantalla | Qué muestra | Qué hacés |
|---|---|---|
| **Inicio** | Título, "Jugar", "Cómo se juega", acceso a las pruebas y a los datos. | Empezar. |
| **Baneos** | Las grillas de héroes y de habilidades; lo que banean los rivales aparece tachado. | Elegís un héroe y una habilidad para sacar. |
| **Elegir héroe** | 4 tarjetas con atributos, tipo de ataque y alcance. Botón "Volver a sortear" (una vez). | Elegís uno. |
| **Draft** | Las opciones con nombre, descripción, tipo y números. Botón "Esconder" para mirar la arena y volver. | Elegís una. Si cerrás, te toca una al azar. |
| **Arena** (la principal) | Tu arena, la barra de habilidades, el inventario, oro, ronda, reloj, tus Aegis y el aviso de la próxima oleada. A la izquierda, la **tabla de jugadores**. | Jugar. |
| **Tabla de jugadores** | Los 8 ordenados por valor total (oro + ítems): nombre, héroe, Aegis, marcas, si está peleando o eliminado. Clic en uno: ves sus habilidades e ítems. | Espiar a los rivales. |
| **Tienda** | Los ítems por categoría, los libros y el Aegis. Lo que ya está hoy. | Comprar y vender entre rondas. |
| **Apuesta** | Los dos duelistas lado a lado: héroe, nivel, habilidades, ítems, valor total, duelos ganados. El pozo y cuánto puso cada lado, en vivo. Un control para elegir cuánto apostar (hasta la mitad de tu oro). | Apostás a uno o pasás. |
| **Duelo** | La arena de duelos con los dos héroes, sus barras y un reloj. Si peleás vos, lo jugás. Si no, lo ves en una ventana chica mientras limpiás tu oleada y en grande cuando terminás (como la cámara automática del mod). | Pelear o mirar. |
| **Resultado del duelo** | Quién ganó, cuánto cobró, quién acertó y cuánto ganó o perdió cada apostador. | Nada: dura 3 segundos. |
| **Eliminado** | "Quedaste afuera en la ronda N, puesto N". Podés seguir mirando o volver al inicio. | Mirar o salir. |
| **Final** | Podio, ronda en que cayó cada uno, y tu resumen: oro por creeps, por rondas, por duelos y por apuestas. | Jugar de nuevo. |
| **Banco** (`banco.html`) | Corre N partidas solas y muestra las tablas de balance. No es parte del juego. | Medir. |

## 3. Rondas, creeps y oro

Lo que tiene fuente:
- 600 de oro inicial, un nivel por ronda, 15 s de preparación (18 con duelo), tienda solo entre rondas.
- Limpiar más rápido paga más. Cada creep da oro al morir.
- Cada ronda tiene un tiempo límite; al vencer, los creeps se enfurecen (más rápidos, no se los ralentiza, no fallan).
- Los creeps crecen rápido hasta la ronda 10, más lento desde la 20, y desde la 60 ganan resistencia mágica.
- La próxima oleada se anuncia antes.

Lo que el mod no deja claro y se arma así (**D5**, provisorio, se ajusta con el banco):
- **Premio de ronda por puesto:** el que limpia primero cobra más y el último menos, en escalera (ronda 1: de 500 a
  50, como el ejemplo del análisis), y la escalera entera crece con las rondas.
- **Oro por creep:** chico, para que el grueso venga del premio y de las apuestas, como cuentan las guías.
- **Tiempo límite:** 50 segundos.
- **Oleadas:** una tabla en `data/waves.json` con 10 tipos de creep inspirados en los neutrales de Dota (cuerpo a
  cuerpo, de rango, uno que aturde, uno que lanza rayos, uno que explota, uno que apaga pasivas...). Cada ronda
  combina 1-3 tipos y cada 5 rondas hay una oleada "pesada" de pocos creeps grandes.
- **Crecimiento:** una curva con tres tramos (rápido, medio, lento pero sin techo), calibrada con el banco para que
  la partida promedio termine entre las rondas 55 y 65.

## 4. Duelos

Fiel al mod:
- **Desde la ronda 2 hay un duelo por ronda** entre dos jugadores vivos. Todos tienen la misma probabilidad y nadie
  pelea dos rondas seguidas (salvo que queden 3 o menos). En la ronda de Roshan no hay duelo.
- Los duelistas **no pelean creeps esa ronda**: pelean entre ellos en la arena de duelos.
- Entran con la vida y el maná llenos. Las invocaciones se mueren antes de entrar y esas habilidades quedan listas.
  Las demás recargas **no** se reinician.
- El perdedor no muere "de verdad": vuelve a su arena para la ronda siguiente. No pierde Aegis, salvo en la recta
  final (3 jugadores o menos).
- Los duelistas cobran el premio de ronda como si hubieran limpiado en un puesto del medio (el mod no lo aclara).

A definir:
- **Cómo se decide si nadie muere (D7):** recomendado, 60 segundos; al vencer gana el que tiene más porcentaje de vida.
- **Premio del duelo (D6):** en el mod es una apuesta gratis a uno mismo; se propone sumarle un premio fijo.

**Cómo se muestra.** El duelo se simula de verdad con el mismo motor que todo lo demás, golpe por golpe; nunca se
decide con una tirada de dados. Si es tuyo, lo jugás a pantalla completa. Si no, corre al mismo tiempo que tu oleada:
lo ves en una ventana chica arriba a la derecha y, cuando terminás tus creeps, pasa a pantalla completa. Si termina
antes que vos, queda el cartel con el resultado.

## 5. Apuestas

Fiel al mod:
- Apuestan los que no pelean y siguen vivos, durante la preparación (18 s).
- Hasta **la mitad de tu oro** actual, a uno solo de los dos. Se puede pasar.
- Ves habilidades, ítems, nivel y valor total de los dos, y cuánto oro va a cada lado.
- Es un **pozo**: todo lo apostado, más un extra que pone el juego, se reparte entre los que acertaron en proporción
  a lo que puso cada uno. Si errás, perdés lo apostado.
- Cada duelista tiene una **apuesta gratis** a sí mismo que entra al pozo.
- Los rivales de la IA también apuestan.

Números que el mod no deja claros (**D6**):
- Extra del juego: 30% de lo apostado, con un mínimo que crece con la ronda.
- Acertar paga **como mínimo el doble** de lo apostado (lo dice el análisis); si el pozo no alcanza, la diferencia
  la pone el juego.
- La apuesta gratis del duelista vale el 5% del pozo.

## 6. Vidas, maldición y cómo se gana

- **2 Aegis** por jugador al empezar (ver D3). Se pueden comprar más en la tienda (el precio es parte de D5).
- Morir contra los creeps gasta un Aegis: revivís en el lugar con 5 segundos de ventaja (recibís menos daño y hacés
  más) y la oleada sigue. Sin Aegis, quedás eliminado.
- **Recta final (3 jugadores o menos):** perder un duelo cuesta un Aegis; si no te quedan, una **marca de maldición**
  (ver D8). Esto evita que la partida se estire para siempre entre dos que no mueren contra los creeps.
- Si los últimos vivos caen en la misma ronda, gana el que aguantó más segundos.
- Gana el último en pie.

## 7. Cómo juegan los rivales de la IA

**Principio: juegan con las mismas reglas que vos.** Mismo oro, mismos precios, mismas opciones de draft, sin ver
nada que vos no puedas ver. Lo único distinto es que deciden al instante.

Cada rival tiene una **personalidad** sorteada al empezar, que cambia sus preferencias:
- *Estilo:* golpeador (daño de ataque, velocidad, robo de vida), mago (daño de habilidades, maná, recargas) o mixto.
- *Con el oro:* gastador (compra todo lo que puede), apostador (guarda la mitad para apostar) o equilibrado.

Qué decide y cómo:
- **Baneos y héroe:** banea al azar entre las habilidades con mejor historial en el banco; elige el héroe que mejor
  va con su estilo.
- **Draft:** le pone puntaje a cada opción: qué tan bien va con su estilo, si le falta algo (daño en área para los
  creeps, control para los duelos, algo defensivo para las rondas altas) y un poco de azar. Elige la mejor.
- **Tienda:** sigue una lista de compras según su estilo y compra lo más caro que le alcance, guardando la parte que
  su personalidad reserva para apostar. Si murió contra los creeps, prioriza defensa; si le sobra, compra un Aegis.
- **Pelea:** ataca al enemigo más cercano o al más débil; si es de rango, retrocede cuando lo alcanzan. Usa cada
  habilidad según su tipo: las de área cuando agarran a 3 o más, los aturdimientos sobre el más peligroso, las
  defensivas con poca vida, las definitivas en oleadas pesadas, Roshan y duelos. Usa los ítems activos igual.
- **Apuestas:** estima quién gana mirando lo mismo que vos (valor total, nivel, habilidades, duelos ganados) y
  apuesta más cuanto más seguro está; el apostador arriesga más, el gastador casi nada. A veces va por la sorpresa.

Las arenas de los 7 rivales **se simulan de verdad** todo el tiempo (sin dibujarse), así que lo que ves al espiar a
un rival o al mirar un duelo es lo que realmente pasó. La misma IA puede jugar tu lugar: así el banco corre partidas
de 8 sin nadie.

## 8. El banco de partidas

`node tools/bench.js 200` juega 200 partidas completas con 8 jugadores de la IA y sin dibujar nada. `banco.html`
muestra lo mismo en una página. Informa:
- Cuántas veces gana cada habilidad, cada **par** de habilidades, cada héroe y cada ítem, contra lo esperado (con 8
  jugadores, 12,5%).
- En qué ronda termina la partida promedio y en qué ronda cae cada puesto.
- De dónde sale el oro: creeps, premio de ronda, duelos y apuestas.
- Cada cuánto gana el duelo el favorito.

**Alarma de "gana sola":** una habilidad cuyos dueños ganan más del 22% de las partidas, o un par que gana más del
30%, con al menos 50 apariciones. Una tanda de contenido no entra hasta que el banco no muestre ninguna alarma.

## 9. Lo que el mod hacía mal y cómo lo evitamos

| Problema del mod | Cómo lo evitamos |
|---|---|
| **Aturdir para siempre** con golpes que aturden y mucha velocidad de ataque. | Regla general en el motor (D4): después de un aturdimiento, el héroe queda 1 segundo sin poder ser aturdido de nuevo, y los aturdimientos por golpe tienen recarga propia. Además un ítem de resistencia a estados en la tienda. |
| **Daño por porcentaje de vida** que decide todo. | Contra héroes vale la mitad, y contra Roshan tiene un tope. El mod terminó haciendo algo parecido a los golpes. |
| **Invocaciones en duelos.** | Como el mod: se mueren antes de entrar. Y las del duelo hacen menos daño a héroes. En la 1.0 casi no hay invocaciones (ver "Afuera"). |
| **Habilidades rotas que nadie arregla.** | El banco marca la alarma antes de sumar cada tanda; lo que la dispare se ajusta o no entra. Las que multiplican todo (Rearm, Tempest Double, Multicast sobre ciertas cosas) entran últimas y con límites. |
| **Un baneo no alcanza.** | Baneos de la IA apuntados a lo que el banco marca como más fuerte, y D10 para la cantidad. |
| **Conviene no pelear:** apostar da más que ganar duelos. | Premio fijo al ganador del duelo, además de su apuesta gratis (D6). El banco mide que un duelista gane, en promedio, por lo menos lo mismo que un apostador que acierta. |
| **Castigo por perder demasiado duro.** | Marcas de 7% en vez de 10%, con tope de 3, y solo en la recta final (D8). |
| **El favorito gana casi siempre** y apostarle es plata fácil. | El pozo ya lo corrige en parte: si todos van al favorito, paga poco. Se quita el "mínimo el doble" cuando más del 75% del pozo está de un solo lado (D6). El banco vigila que el favorito gane menos del 75%. |
| **Apostar 1 de oro a la sorpresa paga fortunas.** | Apuesta mínima de 50 y el extra del juego se reparte en proporción, con un tope de 5 veces lo apostado. |
| **Partidas de una hora perdidas desde el principio.** | Los libros gratis para los últimos cada 10 rondas (ya lo hace el mod), el banco mide que el que va último en la ronda 10 gane al menos un 5% de las veces, y D1 ofrece una partida corta. |
| **Duelos arreglados entre amigos.** | No aplica contra la IA. |

## 10. Qué queda afuera de la 1.0

- **Jugar con otras personas en línea.** La 1.0 es vos contra 7 de la IA.
- **Los modos de equipos** (de a dos, 5 contra 5) y el modo contra la máquina de 500 oleadas.
- **Rating, temporadas, cosméticos, pases y monedas.**
- **Los ítems para mandarle creeps a los rivales** (ver D11).
- **Los talentos de cada héroe** (el mod los conserva; acá el héroe es solo atributos).
- **Las habilidades de nivel 3 de `PIEZAS.md`:** ilusiones, robar habilidades, tomar control, terreno. Entran
  después de la 1.0, una por una. Las invocaciones entran en la Etapa 5, pocas y medidas.
- **Los ítems propios del mod más raros** (línea de invocador, Torture Pipe). Sí entran la línea de daño contra
  creeps, los escudos, la mejora de Kaya y el Dark Moon Shard, porque el mod se equilibra alrededor de ellos.
- **Reordenar las habilidades en la barra y esconder habilidades.**
- **Guardar la partida** para seguirla otro día (se anota como candidata para después).

## 11. Decisiones abiertas

Cada una con opciones; la **negrita** es la recomendada y es la que se usa si no decís nada.

**D1 · Largo de la partida.**
(a) **Fiel: sin límite de rondas, termina cuando queda uno, cerca de la ronda 55-65 (una hora).** Es lo que pide la
regla "fiel al mod" y lo único que hay que equilibrar.
(b) Corta: los creeps crecen el doble de rápido y termina cerca de la ronda 25-30 (25 minutos).
(c) Las dos como modos: duplica el trabajo de balance.
*Extra recomendado en cualquier caso:* un botón de velocidad ×2 para las rondas fáciles.

**D2 · Cuántas opciones en cada elección de habilidad.** Las fuentes dicen 8 (2020-2021) y 16 (2023).
(a) **8 mientras haya menos de 150 habilidades, 16 después.** Con 43 habilidades, 16 opciones es ver casi la mitad
del juego en cada elección.
(b) 16 siempre (como está hoy).
(c) 8 siempre.

**D3 · Vidas.**
(a) **2 Aegis, como el mod.**
(b) 3 vidas, como *Clash*: perdona más y alarga la partida.

**D4 · Freno a las combinaciones que ganan solas.**
(a) **Reglas generales en el motor** (1 segundo de inmunidad después de un aturdimiento, daño por porcentaje a la
mitad contra héroes, invocaciones más débiles en duelos) **más los baneos.** Es un cambio a propósito respecto del mod.
(b) Solo baneos, como el mod, y ajustar habilidad por habilidad cuando el banco marque alarma.
(c) Las reglas generales y además 2 baneos de habilidad por jugador.

**D5 · Números que el mod no publica** (oro por ronda y por creep, oleadas, tiempo límite, precio del Aegis y de los
tomos).
(a) **Los provisorios de la sección 3, ajustados con el banco hasta que la partida promedio termine en la ronda
55-65 y el oro se parezca a lo que cuentan las guías** (unos 10.000-15.000 acumulados en la ronda 20).
(b) Frenar y seguir buscando los números reales (habría que mirar videos de partidas o abrir los archivos del mod).

**D6 · Premio del duelo y pago de las apuestas.**
(a) **Como el mod (pozo repartido, apuesta gratis del 5%, mínimo el doble) más un premio fijo para el ganador del
duelo que crece con la ronda**, para que pelear convenga. Es lo que hizo *Clash*.
(b) Exactamente como el mod, sin premio fijo: fiel, pero repite el problema de "conviene no pelear".
(c) Como (a) y además un premio consuelo chico para el que pierde.

**D7 · Duelo que no termina.** El mod no lo aclara.
(a) **60 segundos; si nadie murió, gana el que tiene más porcentaje de vida.**
(b) Sin límite, pero desde los 45 segundos los dos reciben cada vez más daño hasta que uno cae.
(c) Empate: nadie cobra y se devuelven las apuestas.

**D8 · Castigo por perder duelos en la recta final.**
(a) **Marcas de 7% (más daño recibido, menos daño hecho, menos oro), con tope de 3.** Es lo que pedían los jugadores.
(b) Fiel: 10% por marca, sin tope.
(c) Sin marcas: solo se pierde el Aegis.

**D9 · Roshan.** Las fuentes no coinciden.
(a) **Cada 10 rondas (10, 20, 30...), cada vez más fuerte**, como cuenta la fuente más nueva y como hace *Clash*.
Deja caer un Aegis o un libro, y matarlo rápido da más oro.
(b) Una sola vez, en una ronda al azar entre la 40 y la 50, como en 2020.

**D10 · Baneos.** Con 10 héroes y 43 habilidades, 8 baneos de héroe dejarían 2 héroes.
(a) **Baneos de habilidad desde ahora (1 por jugador); los de héroe se activan cuando haya 40 héroes o más.**
(b) Sin baneos hasta que el contenido sea grande.
(c) Baneos completos ya, pero solo baneás vos (los rivales no).

**D11 · Ítems para mandarle creeps a los rivales.**
(a) **Afuera de la 1.0.** Es lo único que deja atacar a un rival fuera de los duelos, cuesta 20.000 y complica la
IA y el balance.
(b) Adentro, en la Etapa 5.

**D12 · Habilidades repetidas entre jugadores.** No se encontró qué hace el mod.
(a) **Se pueden repetir:** es lo más simple y las apuestas siguen teniendo sentido.
(b) Cada habilidad la tiene un solo jugador: más variedad, pero con 43 habilidades y 40 elecciones no alcanza.

**Siguen abiertas de antes y no frenan nada:** el nombre del proyecto, nombres e imágenes propios o de Dota, el
estilo del 2D, la tecla para subir de nivel, el clic derecho al apuntar y vender a mitad de precio (están en
`PLAN.md`). El **tiempo para elegir habilidad** quedó resuelto: el mod no pone reloj, así que no hay reloj.
