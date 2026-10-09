(() => {
  'use strict';
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('bestScore');
  const overlay = document.getElementById('gameOverlay');
  const overlayKicker = document.getElementById('overlayKicker');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayText = document.getElementById('overlayText');
  const startButton = document.getElementById('startButton');
  const pauseButton = document.getElementById('pauseButton');
  const soundButton = document.getElementById('soundButton');
  const statusText = document.getElementById('statusText');
  const statusBlock = statusText.parentElement;
  const speedBars = [...document.querySelectorAll('#speedBars i')];
  const grid = 24;
  const cell = canvas.width / grid;
  const initialSnake = [{ x: 11, y: 12 }, { x: 10, y: 12 }, { x: 9, y: 12 }, { x: 8, y: 12 }];
  let snake = initialSnake.map(part => ({ ...part }));
  let food = { x: 17, y: 12 };
  let direction = { x: 1, y: 0 };
  let queuedDirection = { ...direction };
  let score = 0;
  let best = Number(localStorage.getItem('neon-snake-best') || 0);
  let running = false;
  let paused = false;
  let gameOver = false;
  let lastStep = 0;
  let soundOn = true;
  let audioContext;
  let touchStart = null;
  const pad = value => String(value).padStart(3, '0');

  function drawGrid() {
    ctx.fillStyle = '#020806'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(108,255,141,.055)'; ctx.lineWidth = 1;
    for (let i = 0; i <= grid; i += 1) {
      const p = i * cell + .5;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(canvas.width, p); ctx.stroke();
    }
  }
  function draw() {
    drawGrid();
    const pulse = .65 + Math.sin(performance.now() / 180) * .15;
    ctx.save(); ctx.shadowColor = '#ff5e68'; ctx.shadowBlur = 18 * pulse; ctx.fillStyle = '#ff5e68';
    ctx.beginPath(); ctx.arc(food.x * cell + cell / 2, food.y * cell + cell / 2, cell * .28, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#ffd2d5'; ctx.fillRect(food.x * cell + cell * .45, food.y * cell + cell * .2, cell * .1, cell * .1);
    snake.forEach((part, index) => {
      const inset = index === 0 ? 2 : 3;
      const x = part.x * cell + inset, y = part.y * cell + inset, size = cell - inset * 2;
      ctx.save(); ctx.shadowColor = '#6cff8d'; ctx.shadowBlur = index === 0 ? 16 : 7;
      ctx.fillStyle = index === 0 ? '#a4ffb8' : `hsl(133 100% ${Math.max(48, 64 - index * .7)}%)`;
      ctx.beginPath(); ctx.roundRect(x, y, size, size, index === 0 ? 7 : 5); ctx.fill(); ctx.restore();
      if (index === 0) {
        ctx.fillStyle = '#07130f';
        const eye1 = direction.x ? { x: part.x * cell + cell * .68, y: part.y * cell + cell * .3 } : { x: part.x * cell + cell * .3, y: part.y * cell + cell * .68 };
        const eye2 = direction.x ? { x: part.x * cell + cell * .68, y: part.y * cell + cell * .7 } : { x: part.x * cell + cell * .7, y: part.y * cell + cell * .68 };
        if (direction.x < 0) eye1.x = eye2.x = part.x * cell + cell * .32;
        if (direction.y < 0) eye1.y = eye2.y = part.y * cell + cell * .32;
        ctx.beginPath(); ctx.arc(eye1.x, eye1.y, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eye2.x, eye2.y, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    });
  }
  function updateUi() {
    scoreEl.textContent = pad(score); bestEl.textContent = pad(best);
    const level = Math.min(5, Math.floor(score / 50) + 1);
    speedBars.forEach((bar, i) => bar.classList.toggle('active', i < level));
    speedBars[0].parentElement.setAttribute('aria-label', `速度 ${level} 级`);
  }
  function setStatus(text, mode = '') { statusText.textContent = text; statusBlock.className = `status-block ${mode}`.trim(); }
  function beep(frequency, duration = .06) {
    if (!soundOn) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      oscillator.type = 'square'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.035, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
    } catch { /* Audio is optional. */ }
  }
  function placeFood() {
    do { food = { x: Math.floor(Math.random() * grid), y: Math.floor(Math.random() * grid) }; }
    while (snake.some(part => part.x === food.x && part.y === food.y));
  }
  function speed() { return Math.max(62, 145 - Math.floor(score / 50) * 16); }
  function step() {
    direction = queuedDirection;
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    const hitsWall = head.x < 0 || head.x >= grid || head.y < 0 || head.y >= grid;
    const hitsSelf = snake.some(part => part.x === head.x && part.y === head.y);
    if (hitsWall || hitsSelf) { finishGame(); return; }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      if (score > best) { best = score; localStorage.setItem('neon-snake-best', String(best)); }
      beep(620, .08); placeFood(); updateUi();
    } else snake.pop();
  }
  function loop(time) {
    if (running && !paused && time - lastStep >= speed()) { step(); lastStep = time; }
    draw(); requestAnimationFrame(loop);
  }
  function resetGame() {
    snake = initialSnake.map(part => ({ ...part })); direction = { x: 1, y: 0 }; queuedDirection = { ...direction }; score = 0; placeFood(); updateUi();
  }
  function startGame() {
    resetGame(); running = true; paused = false; gameOver = false; lastStep = performance.now(); overlay.classList.add('hidden');
    pauseButton.disabled = false; pauseButton.textContent = '暂停'; setStatus('游戏中', 'active'); beep(440, .07);
  }
  function finishGame() {
    running = false; gameOver = true; pauseButton.disabled = true; setStatus('游戏结束', 'danger');
    overlayKicker.textContent = `本局得分 ${score}`; overlayTitle.textContent = '游戏结束';
    overlayText.textContent = score === best && score > 0 ? '新纪录！再挑战一次？' : '差一点，再挑战一次？';
    startButton.textContent = '再玩一次'; overlay.classList.remove('hidden'); beep(130, .18);
  }
  function togglePause() {
    if (!running || gameOver) return;
    paused = !paused; pauseButton.textContent = paused ? '继续' : '暂停'; setStatus(paused ? '已暂停' : '游戏中', paused ? '' : 'active');
    if (paused) {
      overlayKicker.textContent = '休息一下'; overlayTitle.textContent = '已暂停'; overlayText.textContent = '准备好后继续移动';
      startButton.textContent = '继续游戏'; overlay.classList.remove('hidden');
    } else { lastStep = performance.now(); overlay.classList.add('hidden'); }
  }
  function setDirection(next) {
    if (!running || paused) return;
    if (next.x + direction.x === 0 && next.y + direction.y === 0) return;
    queuedDirection = next;
  }
  const directions = {
    ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 }
  };
  document.addEventListener('keydown', event => {
    if (directions[event.key]) { event.preventDefault(); setDirection(directions[event.key]); }
    else if (event.code === 'Space') { event.preventDefault(); togglePause(); }
    else if (event.key === 'Enter' && (!running || paused)) paused ? togglePause() : startGame();
  });
  startButton.addEventListener('click', () => paused ? togglePause() : startGame());
  pauseButton.addEventListener('click', togglePause);
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn; soundButton.setAttribute('aria-pressed', String(soundOn));
    soundButton.setAttribute('aria-label', soundOn ? '关闭音效' : '开启音效'); soundButton.querySelector('span').textContent = soundOn ? '♪' : '×'; if (soundOn) beep(520);
  });
  document.querySelectorAll('[data-direction]').forEach(button => {
    const map = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    button.addEventListener('pointerdown', event => { event.preventDefault(); setDirection(map[button.dataset.direction]); });
  });
  canvas.addEventListener('pointerdown', event => { touchStart = { x: event.clientX, y: event.clientY }; });
  canvas.addEventListener('pointerup', event => {
    if (!touchStart) return;
    const dx = event.clientX - touchStart.x, dy = event.clientY - touchStart.y; touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    setDirection(Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) });
  });
  bestEl.textContent = pad(best); updateUi(); draw(); requestAnimationFrame(loop);
})();
