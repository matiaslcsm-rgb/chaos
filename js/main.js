'use strict';

const GAME_VERSION = '0.0.1 · Etapa 0: proyecto';
document.getElementById('game-version').textContent = `Versión ${GAME_VERSION}`;

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');

// Placeholder screen until the first playable stage exists.
function drawTitle() {
  ctx.fillStyle = '#151922';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8b04a';
  ctx.font = 'bold 96px system-ui, sans-serif';
  ctx.fillText('CHAOS', canvas.width / 2, canvas.height / 2);
  ctx.fillStyle = '#8a93a6';
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText('Proyecto en construcción', canvas.width / 2, canvas.height / 2 + 56);
}

drawTitle();
