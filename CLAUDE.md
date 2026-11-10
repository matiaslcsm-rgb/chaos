# Chaos

Versión propia, en 2D y para navegador, del mod *Custom Hero Chaos* de Dota 2: 8 jugadores (vos + 7 de la IA), cada
uno en su arena contra oleadas de creeps, armando su kit con habilidades de cualquier héroe; cada tanto dos se enfrentan
en un duelo y los demás apuestan. Gana el último que queda.

## Antes de tocar nada
- Leé `docs/PLAN.md`: las etapas, qué está hecho y las decisiones abiertas.
- Las reglas del mod original están en `docs/REFERENCIA-CHC.md`.

## Reglas de la casa
- **Fiel al mod.** Ante la duda, se hace como en Custom Hero Chaos. Lo que se cambie a propósito se anota en
  `docs/PLAN.md` como decisión del usuario.
- **Proyecto limpio y aparte.** No se copia código de `mattbox/match` ni de `mattbox/custom-hero-chaos`. Si algo de ahí
  sirve, se reescribe acá, chico y sin arrastrar lo que no hace falta.
- **2D**, JavaScript puro con `<script>` clásicos (el orden está en `index.html`), sin build.
- **Los datos mandan.** Héroes, habilidades e ítems viven en `data/` como datos; el motor los lee. Las habilidades se
  arman con piezas reutilizables y solo las raras llevan código propio.
- Código, comentarios y commits en inglés. Interfaz y documentos en español rioplatense. El usuario no es programador.
- Toda mecánica nueva lleva su prueba. El balance se mide con partidas simuladas, no a ojo.
- Lo que decide el usuario se marca "(decisión)" con 2-3 opciones y una recomendada.
