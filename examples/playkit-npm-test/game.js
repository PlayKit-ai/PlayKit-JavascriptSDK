// PlayKit SDK instance
let sdk = null;
let chatClient = null;
let isInitialized = false;

// Snake game state
let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let foods = []; // 改为数组存储多个食物
let maxFoods = 10; // 场上最多同时存在的食物数量
let gridSize = 20;
let cols, rows;
let gameArea = { x: 20, y: 80, width: 560, height: 560 };

// Chinese characters pool (poetic words)
const chineseChars = [
  '春', '夏', '秋', '冬', '花', '月', '风', '雨', '雪', '云',
  '山', '水', '天', '地', '日', '星', '江', '河', '湖', '海',
  '树', '草', '竹', '梅', '兰', '菊', '莲', '桃', '柳', '松',
  '红', '绿', '青', '白', '黄', '紫', '金', '银', '明', '暗',
  '东', '西', '南', '北', '上', '下', '远', '近', '高', '低',
  '诗', '词', '歌', '赋', '琴', '棋', '书', '画', '酒', '茶',
  '梦', '情', '思', '念', '心', '意', '缘', '爱', '恨', '愁',
  '笑', '泪', '声', '影', '光', '色', '香', '味', '雅', '韵'
];

// Collected characters
let collectedChars = [];

// Timer
let gameStartTime = 0;
let gameDuration = 30000; // 30 seconds
let gameOver = false;
let gameStarted = false;

// AI poem generation
let isGeneratingPoem = false;
let generatedPoem = '';
let poemLines = [];

// UI state
let showingPoem = false;

function setup() {
  createCanvas(800, 680);

  // Calculate grid
  cols = floor(gameArea.width / gridSize);
  rows = floor(gameArea.height / gridSize);

  // Initialize SDK
  initializeSDK();

  textFont('Arial');
}

async function initializeSDK() {
  try {
    // Initialize SDK with developer token
    const gameId = 'ef6eaf4b-39ae-4c76-bcf6-b07541cf0ccc'; // Replace with actual game ID
    const developerToken = 'dev-8d43ba7e-977a-4239-9424-8515d76607e2'; // Replace with actual token

    if (gameId === 'your-game-id') {
      console.log('Please edit game.js and add your Game ID');
      return;
    }

    sdk = new PlayKitSDK.PlayKitSDK({
      gameId: gameId,
      developerToken: developerToken,
      debug: true
    });

    // Setup event listeners
    sdk.on('authenticated', () => {
      console.log('SDK authenticated');
      chatClient = sdk.createChatClient('gpt-4.1-mini');
      isInitialized = true;
    });

    sdk.on('error', (error) => {
      console.error('SDK error:', error);
    });

    // Initialize SDK
    await sdk.initialize();

  } catch (error) {
    console.error('Failed to initialize SDK:', error);
  }
}

function startGame() {
  // Initialize snake in the center
  const startX = floor(cols / 2);
  const startY = floor(rows / 2);
  snake = [
    { x: startX, y: startY },
    { x: startX - 1, y: startY },
    { x: startX - 2, y: startY }
  ];

  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  collectedChars = [];
  gameOver = false;
  gameStarted = true;
  showingPoem = false;
  generatedPoem = '';
  poemLines = [];

  gameStartTime = millis();

  // 初始化多个食物
  foods = [];
  spawnInitialFoods();
}

// 生成初始的多个食物
function spawnInitialFoods() {
  for (let i = 0; i < maxFoods; i++) {
    spawnFood();
  }
}

// 生成一个新食物
function spawnFood() {
  let validPosition = false;
  let newFood;
  let attempts = 0;
  const maxAttempts = 100;

  while (!validPosition && attempts < maxAttempts) {
    attempts++;
    newFood = {
      x: floor(random(cols)),
      y: floor(random(rows)),
      char: random() < 0.5 ? random(chineseChars) : '' // 50% 概率有汉字
    };

    // Check if position is not on snake
    validPosition = true;
    for (let segment of snake) {
      if (segment.x === newFood.x && segment.y === newFood.y) {
        validPosition = false;
        break;
      }
    }

    // Check if position is not on other foods
    if (validPosition) {
      for (let food of foods) {
        if (food.x === newFood.x && food.y === newFood.y) {
          validPosition = false;
          break;
        }
      }
    }
  }

  if (validPosition) {
    foods.push(newFood);
  }
}

function draw() {
  background(245, 245, 250);

  if (!gameStarted) {
    drawStartScreen();
  } else if (showingPoem) {
    drawPoemScreen();
  } else {
    // Update game
    if (!gameOver && frameCount % 8 === 0) {
      updateSnake();
    }

    // Draw game
    drawGame();

    // Check timer
    const timeLeft = gameDuration - (millis() - gameStartTime);
    if (timeLeft <= 0 && !gameOver) {
      endGame();
    }
  }
}

function drawStartScreen() {
  // Title
  fill(80, 50, 120);
  textSize(48);
  textAlign(CENTER, CENTER);
  text('贪吃蛇诗歌创作', width / 2, height / 3);

  // Instructions
  fill(100);
  textSize(18);
  text('收集汉字，让AI为你作诗', width / 2, height / 3 + 60);

  textSize(16);
  fill(60);
  const instructions = [
    '游戏规则：',
    '1. 使用方向键控制贪吃蛇',
    '2. 吃到食物会随机获得汉字',
    '3. 游戏时间30秒',
    '4. 时间结束后，AI会用收集的汉字作诗',
    '',
    isInitialized ? '按 空格键 开始游戏' : '正在初始化SDK...'
  ];

  let yPos = height / 2;
  for (let line of instructions) {
    text(line, width / 2, yPos);
    yPos += 30;
  }
}

function drawGame() {
  // Draw game area border
  stroke(150);
  strokeWeight(2);
  noFill();
  rect(gameArea.x, gameArea.y, gameArea.width, gameArea.height);

  // Draw grid (subtle)
  stroke(230);
  strokeWeight(1);
  for (let i = 0; i <= cols; i++) {
    const x = gameArea.x + i * gridSize;
    line(x, gameArea.y, x, gameArea.y + gameArea.height);
  }
  for (let i = 0; i <= rows; i++) {
    const y = gameArea.y + i * gridSize;
    line(gameArea.x, y, gameArea.x + gameArea.width, y);
  }

  // Draw all foods
  for (let food of foods) {
    const fx = gameArea.x + food.x * gridSize;
    const fy = gameArea.y + food.y * gridSize;

    // 有汉字的食物用不同颜色显示
    if (food.char) {
      fill(255, 150, 50); // 橙色 - 有汉字
    } else {
      fill(255, 100, 100); // 红色 - 普通食物
    }

    noStroke();
    circle(fx + gridSize / 2, fy + gridSize / 2, gridSize * 0.8);

    // Draw character on food if exists
    if (food.char) {
      fill(255);
      textSize(16);
      textAlign(CENTER, CENTER);
      text(food.char, fx + gridSize / 2, fy + gridSize / 2);
    }
  }

  // Draw snake
  for (let i = 0; i < snake.length; i++) {
    const segment = snake[i];
    const sx = gameArea.x + segment.x * gridSize;
    const sy = gameArea.y + segment.y * gridSize;

    if (i === 0) {
      // Head
      fill(100, 200, 100);
    } else {
      // Body
      fill(120, 220, 120);
    }

    noStroke();
    rect(sx + 1, sy + 1, gridSize - 2, gridSize - 2, 3);
  }

  // Draw UI
  drawUI();

  // Draw game over message
  if (gameOver) {
    fill(0, 0, 0, 150);
    rect(0, 0, width, height);

    fill(255);
    textSize(36);
    textAlign(CENTER, CENTER);
    text('游戏结束！', width / 2, height / 2 - 20);

    textSize(18);
    text('撞墙或撞到自己了', width / 2, height / 2 + 20);

    textSize(16);
    text('按 空格键 重新开始', width / 2, height / 2 + 60);
  }
}

function drawUI() {
  // Title
  fill(80, 50, 120);
  textSize(28);
  textAlign(CENTER, TOP);
  text('贪吃蛇诗歌创作', width / 2, 20);

  // Timer
  const timeLeft = max(0, gameDuration - (millis() - gameStartTime));
  const seconds = ceil(timeLeft / 1000);

  fill(seconds <= 5 ? color(255, 100, 100) : color(100));
  textSize(20);
  textAlign(LEFT, TOP);
  text('时间: ' + seconds + 's', 620, 100);

  // Timer bar
  const timerBarWidth = 140;
  const timerBarHeight = 10;
  stroke(200);
  strokeWeight(2);
  noFill();
  rect(620, 130, timerBarWidth, timerBarHeight, 5);

  noStroke();
  fill(seconds <= 5 ? color(255, 100, 100) : color(100, 200, 100));
  const fillWidth = map(timeLeft, 0, gameDuration, 0, timerBarWidth);
  rect(620, 130, fillWidth, timerBarHeight, 5);

  // Score
  fill(100);
  textSize(18);
  text('长度: ' + snake.length, 620, 160);

  // Collected characters
  fill(80, 50, 120);
  textSize(18);
  text('收集的汉字:', 620, 200);

  fill(100);
  textSize(16);
  let charDisplay = '';
  for (let i = 0; i < collectedChars.length; i++) {
    charDisplay += collectedChars[i];
    if ((i + 1) % 6 === 0) {
      charDisplay += '\n';
    } else {
      charDisplay += ' ';
    }
  }
  text(charDisplay || '还没有收集', 620, 230);

  // Instructions
  fill(150);
  textSize(12);
  text('方向键: 控制方向', 620, 520);
  text('空格键: 重新开始', 620, 540);
}

function drawPoemScreen() {
  background(250, 248, 245);

  // Title
  fill(139, 69, 19);
  textSize(36);
  textAlign(CENTER, TOP);
  text('AI 诗作', width / 2, 60);

  // Collected characters
  fill(100);
  textSize(16);
  text('收集的汉字: ' + collectedChars.join(' '), width / 2, 120);

  // Divider
  stroke(200);
  strokeWeight(1);
  line(100, 160, width - 100, 160);

  // Poem
  if (isGeneratingPoem) {
    fill(100);
    textSize(18);
    const dots = '.'.repeat((frameCount % 60) / 20 + 1);
    text('AI 正在创作' + dots, width / 2, height / 2);
  } else if (poemLines.length > 0) {
    fill(60);
    textSize(20);
    textAlign(CENTER, TOP);
    let yPos = 200;

    for (let line of poemLines) {
      text(line, width / 2, yPos);
      yPos += 40;
    }

    // Instructions
    fill(150);
    textSize(16);
    text('按 空格键 重新开始游戏', width / 2, yPos + 60);
  }
}

function updateSnake() {
  // Update direction
  direction = { ...nextDirection };

  // Calculate new head position
  const head = { ...snake[0] };
  head.x += direction.x;
  head.y += direction.y;

  // Check collision with walls
  if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
    gameOver = true;
    return;
  }

  // Check collision with self
  for (let segment of snake) {
    if (head.x === segment.x && head.y === segment.y) {
      gameOver = true;
      return;
    }
  }

  // Add new head
  snake.unshift(head);

  // Check if ate any food
  let ateFood = false;
  for (let i = foods.length - 1; i >= 0; i--) {
    const food = foods[i];
    if (head.x === food.x && head.y === food.y) {
      // Collect character if exists
      if (food.char) {
        collectedChars.push(food.char);
      }

      // Remove eaten food
      foods.splice(i, 1);
      ateFood = true;

      // Spawn a new food to maintain count
      spawnFood();
      break;
    }
  }

  if (!ateFood) {
    // Remove tail (only if didn't eat)
    snake.pop();
  }
}

async function endGame() {
  if (gameOver || collectedChars.length === 0) {
    gameOver = true;
    return;
  }

  gameOver = true;
  showingPoem = true;

  if (!isInitialized || !chatClient) {
    poemLines = ['AI未初始化', '无法生成诗歌'];
    return;
  }

  isGeneratingPoem = true;

  try {
    const chars = collectedChars.join('、');
    const prompt = `请使用以下汉字创作一首诗（可以是古诗、现代诗或打油诗）。不需要使用所有字，但尽量多用一些。保持诗歌简洁优美，4-8行即可。

汉字：${chars}

请直接给出诗歌内容，不要额外解释。`;

    let response = '';
    await chatClient.chatStream(prompt, (chunk) => {
      response += chunk;
    });

    generatedPoem = response.trim();
    poemLines = generatedPoem.split('\n').filter(line => line.trim());

  } catch (error) {
    console.error('Failed to generate poem:', error);
    poemLines = ['生成诗歌失败', error.message];
  } finally {
    isGeneratingPoem = false;
  }
}

function keyPressed() {
  if (!gameStarted || showingPoem) {
    // Start/restart game
    if (keyCode === 32) { // Space
      startGame();
      return false;
    }
  } else if (!gameOver) {
    // Control snake
    if (keyCode === LEFT_ARROW && direction.x !== 1) {
      nextDirection = { x: -1, y: 0 };
    } else if (keyCode === RIGHT_ARROW && direction.x !== -1) {
      nextDirection = { x: 1, y: 0 };
    } else if (keyCode === UP_ARROW && direction.y !== 1) {
      nextDirection = { x: 0, y: -1 };
    } else if (keyCode === DOWN_ARROW && direction.y !== -1) {
      nextDirection = { x: 0, y: 1 };
    }
  } else {
    // Game over, restart
    if (keyCode === 32) { // Space
      startGame();
      return false;
    }
  }

  return false;
}
