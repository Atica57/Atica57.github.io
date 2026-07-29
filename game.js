(() => {
  const canvas = document.querySelector('#game-canvas');
  const startButton = document.querySelector('#game-start');
  const pauseButton = document.querySelector('#game-pause');
  const scoreEl = document.querySelector('#game-score');
  const statusEl = document.querySelector('#game-status');
  const overlay = document.querySelector('#game-overlay');
  if (!canvas || !startButton || !pauseButton) return;

  const ctx = canvas.getContext('2d');
  const columns = 32;
  const rows = 20;
  const cell = canvas.width / columns;
  const directions = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
  const enemyCount = 5;
  const tickMs = 150;
  const enemyTickMs = 360;
  let snake;
  let direction;
  let queuedDirection;
  let food;
  let enemies;
  let score = 0;
  let state = 'ready';
  let elapsed = 0;
  let lastFrame = performance.now();
  let lastSnakeTick = 0;
  let lastEnemyTick = 0;

  const samePosition = (a, b) => a && b && a.x === b.x && a.y === b.y;
  const occupied = (position) => snake.some((part) => samePosition(part, position)) || samePosition(food, position) || enemies.some((enemy) => enemy.state === 'active' && samePosition(enemy, position));
  const randomCell = () => ({ x: Math.floor(Math.random() * columns), y: Math.floor(Math.random() * rows) });
  const freeCell = () => { let position; do { position = randomCell(); } while (occupied(position)); return position; };
  const setStatus = (message) => { statusEl.textContent = message; };
  const updateScore = () => { scoreEl.textContent = String(score); };

  function createEnemy() {
    const position = freeCell();
    const options = Object.keys(directions);
    return { ...position, direction: options[Math.floor(Math.random() * options.length)], state:'active', born:elapsed, explodeAt:elapsed + 5000, respawnAt:0 };
  }

  function resetGame() {
    snake = [{x:9,y:10},{x:8,y:10},{x:7,y:10},{x:6,y:10}];
    direction = 'right';
    queuedDirection = 'right';
    score = 0;
    elapsed = 0;
    lastSnakeTick = 0;
    lastEnemyTick = 0;
    food = {x:20,y:10};
    enemies = [];
    for (let index = 0; index < enemyCount; index += 1) enemies.push(createEnemy());
    updateScore();
    draw();
  }

  function setDirection(next) {
    if (!directions[next]) return;
    const current = directions[direction];
    const requested = directions[next];
    if (current.x + requested.x === 0 && current.y + requested.y === 0) return;
    queuedDirection = next;
  }

  function moveSnake() {
    direction = queuedDirection;
    const vector = directions[direction];
    const head = { x:snake[0].x + vector.x, y:snake[0].y + vector.y };
    if (head.x < 0 || head.x >= columns || head.y < 0 || head.y >= rows || snake.some((part) => samePosition(part, head))) {
      state = 'gameover';
      setStatus('게임 오버 · 다시 시작해 보세요.');
      pauseButton.disabled = true;
      overlay.classList.remove('is-hidden');
      overlay.querySelector('strong').textContent = 'GAME OVER';
      return;
    }
    snake.unshift(head);
    if (samePosition(head, food)) {
      score += 10;
      updateScore();
      food = freeCell();
    } else {
      snake.pop();
    }
    const hitEnemy = enemies.some((enemy) => enemy.state === 'active' && samePosition(enemy, head));
    if (hitEnemy) {
      state = 'gameover';
      setStatus('적과 부딪혔습니다 · 다시 시작해 보세요.');
      pauseButton.disabled = true;
      overlay.classList.remove('is-hidden');
      overlay.querySelector('strong').textContent = 'GAME OVER';
    }
  }

  function moveEnemies() {
    enemies.forEach((enemy) => {
      if (enemy.state !== 'active') return;
      if (elapsed >= enemy.explodeAt) {
        enemy.state = 'exploding';
        enemy.respawnAt = elapsed + 2000;
        return;
      }
      if (Math.random() < .3) {
        const options = Object.keys(directions).filter((key) => {
          const current = directions[enemy.direction];
          const next = directions[key];
          return !(current.x + next.x === 0 && current.y + next.y === 0);
        });
        enemy.direction = options[Math.floor(Math.random() * options.length)];
      }
      const vector = directions[enemy.direction];
      const next = {x:enemy.x + vector.x, y:enemy.y + vector.y};
      if (next.x < 0 || next.x >= columns || next.y < 0 || next.y >= rows) {
        enemy.direction = {up:'down',down:'up',left:'right',right:'left'}[enemy.direction];
      } else {
        enemy.x = next.x;
        enemy.y = next.y;
      }
    });
    enemies = enemies.map((enemy) => {
      if (enemy.state === 'exploding' && elapsed >= enemy.respawnAt) return createEnemy();
      return enemy;
    });
  }

  function drawCell(position, color, radius = 5) {
    const x = position.x * cell;
    const y = position.y * cell;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, cell - 4, cell - 4, radius);
    ctx.fill();
  }

  function draw() {
    ctx.fillStyle = '#0b2034';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(141,220,255,.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= columns; x += 1) { ctx.beginPath(); ctx.moveTo(x * cell, 0); ctx.lineTo(x * cell, canvas.height); ctx.stroke(); }
    for (let y = 0; y <= rows; y += 1) { ctx.beginPath(); ctx.moveTo(0, y * cell); ctx.lineTo(canvas.width, y * cell); ctx.stroke(); }
    drawCell(food, '#ffca70', 9);
    enemies.forEach((enemy) => {
      if (enemy.state === 'exploding') {
        const pulse = 1 + Math.sin(elapsed / 90) * .2;
        ctx.fillStyle = '#ff8270';
        ctx.beginPath(); ctx.arc((enemy.x + .5) * cell, (enemy.y + .5) * cell, cell * .42 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffd19b'; ctx.lineWidth = 2; ctx.stroke();
      } else {
        drawCell(enemy, '#ed7788', 8);
        ctx.fillStyle = '#fff3f0'; ctx.beginPath(); ctx.arc((enemy.x + .35) * cell, (enemy.y + .38) * cell, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc((enemy.x + .68) * cell, (enemy.y + .38) * cell, 2, 0, Math.PI * 2); ctx.fill();
      }
    });
    snake.forEach((part, index) => drawCell(part, index === 0 ? '#79e1bd' : '#36bd99', index === 0 ? 8 : 6));
    if (snake[0]) { ctx.fillStyle = '#123449'; ctx.beginPath(); ctx.arc((snake[0].x + .35) * cell, (snake[0].y + .38) * cell, 2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc((snake[0].x + .68) * cell, (snake[0].y + .38) * cell, 2, 0, Math.PI * 2); ctx.fill(); }
  }

  function frame(now) {
    const delta = Math.min(now - lastFrame, 100);
    lastFrame = now;
    if (state === 'running') {
      elapsed += delta;
      if (elapsed - lastSnakeTick >= tickMs) { lastSnakeTick = elapsed; moveSnake(); }
      if (elapsed - lastEnemyTick >= enemyTickMs) { lastEnemyTick = elapsed; moveEnemies(); }
      draw();
    }
    requestAnimationFrame(frame);
  }

  function startGame() {
    resetGame();
    state = 'running';
    startButton.textContent = '재시작';
    pauseButton.disabled = false;
    pauseButton.textContent = '일시정지';
    overlay.classList.add('is-hidden');
    setStatus('플레이 중 · 적 5개가 천천히 움직입니다.');
    canvas.focus();
  }

  startButton.addEventListener('click', startGame);
  pauseButton.addEventListener('click', () => {
    if (state === 'running') { state = 'paused'; pauseButton.textContent = '계속하기'; setStatus('일시정지됨'); overlay.classList.remove('is-hidden'); overlay.querySelector('strong').textContent = 'PAUSED'; }
    else if (state === 'paused') { state = 'running'; pauseButton.textContent = '일시정지'; setStatus('플레이 중 · 시간을 잠시 멈췄습니다.'); overlay.classList.add('is-hidden'); lastFrame = performance.now(); }
  });
  window.addEventListener('keydown', (event) => { const keys = {ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'}; const next = keys[event.key]; if (next) { event.preventDefault(); setDirection(next); } if (event.key === ' ' && (state === 'running' || state === 'paused')) { event.preventDefault(); pauseButton.click(); } });
  document.querySelectorAll('[data-direction]').forEach((button) => { button.addEventListener('click', () => { setDirection(button.dataset.direction); canvas.focus(); }); });
  let touchStart = null;
  canvas.addEventListener('touchstart', (event) => { const touch = event.changedTouches[0]; touchStart = {x:touch.clientX,y:touch.clientY}; }, {passive:true});
  canvas.addEventListener('touchend', (event) => { if (!touchStart) return; const touch = event.changedTouches[0]; const dx = touch.clientX - touchStart.x; const dy = touch.clientY - touchStart.y; if (Math.max(Math.abs(dx),Math.abs(dy)) > 20) setDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); touchStart = null; }, {passive:true});

  resetGame();
  requestAnimationFrame(frame);
})();
