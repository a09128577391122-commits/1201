let spriteSheetWalk;
let spriteSheetKick;
let spriteSheetPrepare; // 新增：準備攻擊 spritesheet (folder 1)
let spriteSheetAttack;  // 新增：攻擊 spritesheet (folder 4)

let framesWalk = [];
let framesKick = [];
let framesPrepare = []; // 新增
let framesAttack = [];  // 新增

const frameCountWalk = 8;
const frameCountKick = 5;
const frameCountPrepare = 6; // all 1.png 有 6 張
const frameCountAttack = 9;  // all 4.png 有 9 張

let currentFrame = 0;
let baseFrameDelay = 6; // 基礎動畫速度（越小越快）
let frameTicker = 0;
let spriteScale = 1.6; // 動畫放大倍率（原為 3.0），改成較小的數值使角色變小

// 踢擊動畫專用
let kickFrame = 0;
let kickTicker = 0;
let kickFrameDelay = 6; // 踢擊每幀間隔
let isKicking = false;

// 準備/攻擊動畫專用
let prepareFrame = 0;
let prepareTicker = 0;
let prepareFrameDelay = 6;
let isPreparing = false;

let isAttacking = false; // 代表角色處於攻擊姿勢（攻擊特效播放期間角色保持攻擊姿勢）

// 攻擊特效（獨立於角色）
let attackEffectActive = false;
let attackEffectFrame = 0;
let attackEffectTicker = 0;
let attackEffectFrameDelay = 6;
let attackEffectScale = 1.0; // 特效大小，可調整

// 位置與物理行為
let x = 0;
let y = 0;
let vx = 0;
let ax = 0;
const maxSpeed = 6;    // 最大速度
const accel = 0.6;     // 加速度
const friction = 0.4;  // 減速度（鬆手時的摩擦力）
let facing = 1;        // 1 = 面向右, -1 = 面向左

function preload() {
  // 請確認以下檔案存在於工作目錄
  spriteSheetWalk = loadImage('2/all 2.png');    // 1259*235, 8 frames
  spriteSheetKick = loadImage('3/all 3.png');    // 1130*246, 5 frames
  spriteSheetPrepare = loadImage('1/all 1.png'); // 1483*289, 6 frames
  spriteSheetAttack = loadImage('4/all 4.png');  // 769*62,   9 frames (攻擊特效)
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  imageMode(CENTER);
  // 初始化位置在畫面中央
  x = width / 2;
  y = height / 2;

  // 將 walk spritesheet 切成多張 frame
  const fw = spriteSheetWalk.width / frameCountWalk;
  const fh = spriteSheetWalk.height;
  for (let i = 0; i < frameCountWalk; i++) {
    const sx = Math.round(i * fw);
    const sw = Math.round(fw);
    framesWalk.push(spriteSheetWalk.get(sx, 0, sw, fh));
  }

  // 將 kick spritesheet 切成多張 frame
  const kw = spriteSheetKick.width / frameCountKick;
  const kh = spriteSheetKick.height;
  for (let i = 0; i < frameCountKick; i++) {
    const sx = Math.round(i * kw);
    const sw = Math.round(kw);
    framesKick.push(spriteSheetKick.get(sx, 0, sw, kh));
  }

  // 將 prepare spritesheet (folder 1) 切成多張 frame
  const pw = spriteSheetPrepare.width / frameCountPrepare;
  const ph = spriteSheetPrepare.height;
  for (let i = 0; i < frameCountPrepare; i++) {
    const sx = Math.round(i * pw);
    const sw = Math.round(pw);
    framesPrepare.push(spriteSheetPrepare.get(sx, 0, sw, ph));
  }

  // 將 attack spritesheet (folder 4) 切成多張 frame（攻擊特效）
  const aw = spriteSheetAttack.width / frameCountAttack;
  const ah = spriteSheetAttack.height;
  for (let i = 0; i < frameCountAttack; i++) {
    const sx = Math.round(i * aw);
    const sw = Math.round(aw);
    framesAttack.push(spriteSheetAttack.get(sx, 0, sw, ah));
  }
}

function draw() {
  background('#a3cef1');

  // 讀取左右按鍵（使用 keyIsDown 可支援連續按住）
  let movingInput = false;
  if (keyIsDown(RIGHT_ARROW)) {
    ax = accel;
    facing = 1;
    movingInput = true;
  } else if (keyIsDown(LEFT_ARROW)) {
    ax = -accel;
    facing = -1;
    movingInput = true;
  } else {
    ax = 0;
  }

  // 更新速度（加速度）
  vx += ax;
  // 當沒有輸入時施加摩擦使速度趨近於 0（平滑停止）
  if (!movingInput) {
    if (vx > 0) {
      vx = max(0, vx - friction);
    } else if (vx < 0) {
      vx = min(0, vx + friction);
    }
  }

  // 限制速度
  vx = constrain(vx, -maxSpeed, maxSpeed);

  // 更新位置
  x += vx;

  // 若移出畫面邊界，將角色保持在邊界內（可移除如果要讓角色出畫面）
  const refFrame = framesWalk[0] || framesKick[0] || framesPrepare[0] || framesAttack[0];
  const frameW = refFrame ? refFrame.width * spriteScale : 100;
  if (x < frameW / 2) x = frameW / 2;
  if (x > width - frameW / 2) x = width - frameW / 2;

  // 動畫邏輯：準備 -> 設定角色攻擊姿勢 & 觸發攻擊特效 -> 踢擊 -> 走路/靜止
  let charImg = null;

  if (isPreparing) {
    // 播放準備動作（播放一次，結束後觸發攻擊特效並讓角色保持攻擊姿勢）
    prepareTicker++;
    if (prepareTicker >= prepareFrameDelay) {
      prepareFrame++;
      prepareTicker = 0;
    }
    if (prepareFrame >= framesPrepare.length) {
      // 準備結束，開始攻擊特效與角色攻擊姿勢
      isPreparing = false;
      prepareFrame = 0;
      prepareTicker = 0;

      isAttacking = true; // 角色保持攻擊姿勢（可依需要改為短暫）
      attackEffectActive = true;
      attackEffectFrame = 0;
      attackEffectTicker = 0;
    } else {
      charImg = framesPrepare[prepareFrame];
    }
  } else {
    // 非正在準備時，決定角色顯示哪個動畫（攻擊姿勢 / 踢擊 / 走路）
    if (isAttacking) {
      // 角色在攻擊期間保持準備動畫的最後一幀作為攻擊姿勢（若有其他攻擊姿勢圖，可改用）
      charImg = framesPrepare[framesPrepare.length - 1];
    } else if (isKicking) {
      // 踢擊
      kickTicker++;
      if (kickTicker >= kickFrameDelay) {
        kickFrame++;
        kickTicker = 0;
      }
      if (kickFrame >= framesKick.length) {
        isKicking = false;
        kickFrame = 0;
        kickTicker = 0;
      } else {
        charImg = framesKick[kickFrame];
      }
    } else {
      // 走路或靜止
      const isMoving = abs(vx) > 0.3;
      if (isMoving) {
        const speedFactor = map(abs(vx), 0, maxSpeed, 1.5, 0.6);
        const frameDelay = max(1, Math.round(baseFrameDelay * speedFactor));
        frameTicker++;
        if (frameTicker >= frameDelay) {
          currentFrame = (currentFrame + 1) % framesWalk.length;
          frameTicker = 0;
        }
      } else {
        currentFrame = 0;
        frameTicker = 0;
      }
      charImg = framesWalk[currentFrame];
    }
  }

  // 繪製角色
  if (charImg) {
    const dw = charImg.width * spriteScale;
    const dh = charImg.height * spriteScale;

    push();
    translate(x, y);
    scale(facing, 1); // facing = 1 或 -1 會左右翻轉
    image(charImg, 0, 0, dw, dh);
    pop();
  }

  // 處理並繪製攻擊特效（獨立於角色）
  if (attackEffectActive && framesAttack.length > 0) {
    attackEffectTicker++;
    if (attackEffectTicker >= attackEffectFrameDelay) {
      attackEffectFrame++;
      attackEffectTicker = 0;
    }

    if (attackEffectFrame >= framesAttack.length) {
      // 特效播放結束
      attackEffectActive = false;
      attackEffectFrame = 0;
      attackEffectTicker = 0;
      isAttacking = false; // 角色回復正常
    } else {
      const effImg = framesAttack[attackEffectFrame];
      if (effImg) {
        const effW = effImg.width * attackEffectScale;
        const effH = effImg.height * attackEffectScale;

        // 特效在角色旁邊顯示，位移根據角色寬度與特效寬度調整
        const characterHalf = (refFrame ? refFrame.width * spriteScale : 100) / 2;
        const offset = characterHalf + effW / 2 + 10; // 10px 間距
        const effX = x + facing * offset;
        const effY = y; // 可調整高度

        push();
        // 若想讓特效隨角色面向翻轉，可以對 scale 做處理；目前不翻轉特效
        translate(effX, effY);
        image(effImg, 0, 0, effW, effH);
        pop();
      }
    }
  }
}

function keyPressed() {
  // 按上鍵觸發一次踢擊動畫（若尚未在踢擊中）
  if (keyCode === UP_ARROW) {
    if (!isKicking && !isPreparing && !isAttacking && !attackEffectActive) {
      isKicking = true;
      kickFrame = 0;
      kickTicker = 0;
    }
  }

  // 按空白鍵觸發準備->攻擊特效序列（若目前沒有準備或攻擊中或踢擊中）
  if (keyCode === 32) { // SPACE
    if (!isPreparing && !isAttacking && !isKicking && !attackEffectActive) {
      isPreparing = true;
      prepareFrame = 0;
      prepareTicker = 0;
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // 重新置中 y，並在畫面改變時確保 x 還在可視範圍
  y = height / 2;
  const refFrame = framesWalk[0] || framesKick[0] || framesPrepare[0] || framesAttack[0];
  const frameW = refFrame ? refFrame.width * spriteScale : 100;
  if (x < frameW / 2) x = frameW / 2;
  if (x > width - frameW / 2) x = width - frameW / 2;
}