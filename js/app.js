/* ========================================
   女拔 P1 中文詞彙 PWA — App Logic
   ======================================== */

// ============== State ==============
const state = {
  currentScreen: 'home',
  selectedCategory: null,
  mode: null,             // 'all' or 'redo'
  currentWords: [],       // array of word objects
  currentIndex: 0,
  knownInSession: [],
  unknownInSession: [],
  sessionSize: 0,
};

// ============== Storage ==============
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.warn('Failed to save progress', e);
  }
}

function getCategoryProgress(categoryId) {
  const all = loadProgress();
  return all[categoryId] || {
    seen: {},      // { wordIndex: 'known' | 'unknown' | 'skip' }
    completedAt: null,
  };
}

function setCategoryProgress(categoryId, progress) {
  const all = loadProgress();
  all[categoryId] = progress;
  saveProgress(all);
}

function clearAllProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

function markWord(categoryId, wordIndex, status) {
  // status: 'known' | 'unknown'
  const progress = getCategoryProgress(categoryId);
  progress.seen[wordIndex] = status;
  setCategoryProgress(categoryId, progress);
}

// ============== Word helpers ==============
function getCategoryWords(cat) {
  return [...cat.mustKnow, ...cat.extra].map((word, i) => ({
    word,
    type: i < cat.mustKnow.length ? 'must' : 'extra',
    index: i,
  }));
}

function getUnfinishedWords(cat) {
  // Words not yet marked as 'known' in any completed session
  const progress = getCategoryProgress(cat.id);
  const all = getCategoryWords(cat);
  // Words never seen OR seen but still unknown
  return all.filter(w => progress.seen[w.index] !== 'known');
}

function getUnknownWords(cat) {
  // Words specifically marked as 'unknown' (X)
  const progress = getCategoryProgress(cat.id);
  const all = getCategoryWords(cat);
  return all.filter(w => progress.seen[w.index] === 'unknown');
}

function getKnownCount(cat) {
  const progress = getCategoryProgress(cat.id);
  return Object.values(progress.seen).filter(s => s === 'known').length;
}

function getUnknownCount(cat) {
  const progress = getCategoryProgress(cat.id);
  return Object.values(progress.seen).filter(s => s === 'unknown').length;
}

function isCategoryCompleted(cat) {
  // Completed = all words marked as 'known' at least once
  const total = cat.mustKnow.length + cat.extra.length;
  return getKnownCount(cat) >= total && total > 0;
}

// ============== Text-to-Speech (removed) ==============
function speak(text) {
  // Pronunciation disabled per user request
}

// ============== UI Helpers ==============
function $(selector) { return document.querySelector(selector); }
function $$(selector) { return document.querySelectorAll(selector); }

function showToast(message, duration = 2000) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

function showModal(message, onOk, onCancel) {
  const modal = $('#modal');
  $('#modal-message').textContent = message;
  modal.classList.remove('hidden');
  const okBtn = $('#modal-ok');
  const cancelBtn = $('#modal-cancel');
  const cleanup = () => {
    modal.classList.add('hidden');
    okBtn.onclick = null;
    cancelBtn.onclick = null;
  };
  okBtn.onclick = () => { cleanup(); onOk && onOk(); };
  cancelBtn.onclick = () => { cleanup(); onCancel && onCancel(); };
}

// ============== Screens ==============
function render() {
  const app = $('#app');
  switch (state.currentScreen) {
    case 'home': renderHome(app); break;
    case 'category': renderCategory(app); break;
    case 'flashcard': renderFlashcard(app); break;
    case 'complete': renderComplete(app); break;
  }
  // Pre-load voices for TTS
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
  }
}

// ============== Home Screen ==============
function renderHome(container) {
  let totalWords = 0;
  let knownWords = 0;
  VOCAB_DATA.forEach(cat => {
    totalWords += cat.mustKnow.length + cat.extra.length;
    knownWords += getKnownCount(cat);
  });
  const overallPct = totalWords > 0 ? (knownWords / totalWords * 100) : 0;

  let html = `
    <div class="topbar">
      <h1>女拔 P1 中文詞彙</h1>
    </div>
    <div class="container">
      <div class="home-header">
        <h2>選擇分類</h2>
        <p>${VOCAB_DATA.length} 個分類 · ${totalWords} 個詞彙</p>
        <div class="home-progress">
          <div class="home-progress-fill" style="width: ${overallPct.toFixed(1)}%"></div>
        </div>
        <div class="home-progress-text">${knownWords} / ${totalWords} 個已識 (${overallPct.toFixed(1)}%)</div>
      </div>
  `;

  const chineseNumerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
                            '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
                            '二十一', '二十二', '二十三', '二十四'];

  VOCAB_DATA.forEach((cat, idx) => {
    const total = cat.mustKnow.length + cat.extra.length;
    const known = getKnownCount(cat);
    const pct = total > 0 ? (known / total * 100) : 0;
    const isComplete = isCategoryCompleted(cat);
    const unknown = getUnknownCount(cat);
    const numLabel = chineseNumerals[idx] || (idx + 1).toString();

    html += `
      <div class="category-card ${isComplete ? 'completed' : ''}" data-cat-id="${cat.id}">
        <div class="category-icon">${numLabel}</div>
        <div class="category-info">
          <div class="category-name">${cat.name}</div>
          <div class="category-meta">
            ${total} 個字${isComplete ? ' · 完成' : (unknown > 0 ? ' · ' + unknown + ' 個要重做' : '')}
          </div>
          <div class="category-progress">
            <div class="category-progress-fill ${isComplete ? 'done' : ''}" style="width: ${pct.toFixed(0)}%"></div>
          </div>
        </div>
        ${isComplete ? '<div class="category-badge">完</div>' : ''}
      </div>
    `;
  });

  html += `
      <div class="footer" id="footer-reset" style="cursor:pointer;color:var(--red);">
        重置所有進度
      </div>
      <div class="footer">
        女拔 P1 中文詞彙學習 · v${APP_VERSION}
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Bind events
  $$('.category-card').forEach(card => {
    card.addEventListener('click', () => {
      const catId = card.dataset.catId;
      const cat = VOCAB_DATA.find(c => c.id === catId);
      if (cat) {
        state.selectedCategory = cat;
        state.currentScreen = 'category';
        render();
      }
    });
  });

  $('#footer-reset').addEventListener('click', () => {
    showModal('確定要重置所有學習進度？呢個動作無法還原。', () => {
      clearAllProgress();
      showToast('已重置所有進度');
      render();
    });
  });
}

// ============== Category Detail Screen ==============
function renderCategory(container) {
  const cat = state.selectedCategory;
  const total = cat.mustKnow.length + cat.extra.length;
  const known = getKnownCount(cat);
  const unknown = getUnknownCount(cat);
  const unknownWords = getUnknownWords(cat);

  let html = `
    <div class="topbar">
      <button class="back-btn" id="back-btn">←</button>
      <h1>${cat.name}</h1>
    </div>
    <div class="container">
      <div class="detail-info">
        <div class="icon-large">字</div>
        <h2>${cat.name}</h2>
        <p>共 ${total} 個字詞 · 已識 ${known} 個</p>
        ${cat.subsections ? `<p style="margin-top:8px;font-size:12px;">${Object.keys(cat.subsections).length} 個子分類</p>` : ''}
      </div>
      <div class="section-title">選擇學習模式</div>

      <div class="mode-card primary" id="mode-all">
        <div class="mode-icon">全</div>
        <div class="mode-content">
          <h3>所有字詞</h3>
          <p>${unknown > 0 ? '仲有 ' + unknown + ' 個未識，由頭開始讀' : '由頭開始溫一次'}</p>
          <span class="count">${total} 個</span>
        </div>
      </div>

      <div class="mode-card review ${unknown === 0 ? 'disabled' : ''}" id="mode-redo">
        <div class="mode-icon">重</div>
        <div class="mode-content">
          <h3>重做</h3>
          <p>${unknown > 0 ? '重溫標咗 X 嘅字' : '暫時冇要重做嘅字'}</p>
          ${unknown > 0 ? `<span class="count">${unknown} 個</span>` : ''}
        </div>
      </div>

      <div class="footer">
        提示：所有字都要讀一次先算完成
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Back button
  $('#back-btn').addEventListener('click', () => {
    state.currentScreen = 'home';
    state.selectedCategory = null;
    render();
  });

  // All words mode
  $('#mode-all').addEventListener('click', () => {
    startSession('all');
  });

  // Redo mode
  $('#mode-redo').addEventListener('click', () => {
    if (unknown > 0) startSession('redo');
  });
}

// ============== Start a flashcard session ==============
function startSession(mode) {
  const cat = state.selectedCategory;
  let words;
  if (mode === 'all') {
    // All words not yet known
    words = getUnfinishedWords(cat);
  } else {
    // Just unknown words
    words = getUnknownWords(cat);
  }

  if (words.length === 0) {
    showToast('呢個分類已經全部識晒！完成了');
    return;
  }

  // Shuffle for variety
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }

  state.mode = mode;
  state.currentWords = words;
  state.currentIndex = 0;
  state.knownInSession = [];
  state.unknownInSession = [];
  state.sessionSize = words.length;
  state.currentScreen = 'flashcard';
  render();
}

// ============== Flashcard Screen ==============
function renderFlashcard(container) {
  const word = state.currentWords[state.currentIndex];
  if (!word) {
    state.currentScreen = 'complete';
    render();
    return;
  }

  const progress = state.currentIndex;
  const total = state.sessionSize;
  const pct = (progress / total * 100);
  const isLast = progress === total - 1;

  const html = `
    <div class="topbar">
      <button class="back-btn" id="back-btn">←</button>
      <h1>${state.selectedCategory.name}</h1>
      <span class="topbar-stats">${state.mode === 'redo' ? '重做' : '所有'}</span>
    </div>
    <div class="container">
      <div class="flashcard-progress">
        <div class="flashcard-progress-text">
          <span>進度</span>
          <strong>${progress + 1} / ${total}</strong>
        </div>
        <div class="flashcard-progress-bar">
          <div class="flashcard-progress-fill" style="width: ${pct.toFixed(0)}%"></div>
        </div>
      </div>

      <div class="flashcard" id="flashcard">
        <div class="flashcard-counter">${progress + 1}/${total}</div>
        <span class="flashcard-label ${word.type === 'extra' ? 'extra' : ''}">
          ${word.type === 'must' ? '必識' : '補充'}
        </span>
        <div class="flashcard-word len-${word.word.length}" id="word">${word.word}</div>
      </div>

      <div class="flashcard-buttons">
        <button class="btn btn-cross" id="btn-cross">
          <span class="btn-mark">✗</span>
          <span>唔識</span>
        </button>
        <button class="btn btn-tick" id="btn-tick">
          <span class="btn-mark">✓</span>
          <span>識</span>
        </button>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Back button
  $('#back-btn').addEventListener('click', () => {
    showModal('確定要離開？今次溫書嘅進度會保存。', () => {
      state.currentScreen = 'category';
      render();
    });
  });

  // Cross (don't know) button
  $('#btn-cross').addEventListener('click', () => handleAnswer(false));

  // Tick (know) button
  $('#btn-tick').addEventListener('click', () => handleAnswer(true));

  // Keyboard support
  document.onkeydown = (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      handleAnswer(true);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handleAnswer(false);
    }
  };
}

function handleAnswer(known) {
  const word = state.currentWords[state.currentIndex];
  if (known) {
    state.knownInSession.push(word);
    markWord(state.selectedCategory.id, word.index, 'known');
    // Show feedback animation
    const card = $('#flashcard');
    if (card) {
      card.classList.add('correct');
      setTimeout(() => card.classList.remove('correct'), 400);
    }
    showToast('識', 500);
  } else {
    state.unknownInSession.push(word);
    markWord(state.selectedCategory.id, word.index, 'unknown');
    const card = $('#flashcard');
    if (card) {
      card.classList.add('wrong');
      setTimeout(() => card.classList.remove('wrong'), 400);
    }
    showToast('唔識 — 已加入重做', 800);
  }

  // Move to next word after short delay
  setTimeout(() => {
    state.currentIndex++;
    if (state.currentIndex >= state.sessionSize) {
      state.currentScreen = 'complete';
    }
    document.onkeydown = null;
    render();
  }, 500);
}

// ============== Complete Screen ==============
function renderComplete(container) {
  const known = state.knownInSession.length;
  const unknown = state.unknownInSession.length;
  const total = state.sessionSize;
  const allKnown = unknown === 0;
  const emoji = allKnown ? '完成' : (known > unknown ? '完成了' : '加油');
  const title = allKnown ? '完美！全部識晒！' : (known > 0 ? '完成！' : '加油！');
  const subtitle = allKnown
    ? '呢個分類已經 100% 完成喇 恭喜'
    : `下次再嚟重溫 ${unknown} 個未識嘅字`;

  let html = `
    <div class="topbar">
      <button class="back-btn" id="back-btn">←</button>
      <h1>${state.selectedCategory.name}</h1>
    </div>
    <div class="container">
      <div class="complete-screen">
        <div class="complete-emoji">${emoji}</div>
        <h2>${title}</h2>
        <p>${subtitle}</p>

        <div class="complete-stats">
          <div class="stat-box green">
            <div class="num">${known}</div>
            <div class="label">已識</div>
          </div>
          <div class="stat-box red">
            <div class="num">${unknown}</div>
            <div class="label">未識</div>
          </div>
        </div>

        <div class="complete-actions">
  `;

  if (unknown > 0) {
    html += `
      <button class="btn btn-gold btn-block" id="redo-btn">
        <span class="btn-icon"></span>
        <span>重做 ${unknown} 個唔識嘅字</span>
      </button>
    `;
  }

  if (allKnown) {
    html += `
      <button class="btn btn-primary btn-block" id="next-btn">
        <span class="btn-icon"></span>
        <span>挑戰下一個分類</span>
      </button>
    `;
  }

  html += `
          <button class="btn btn-secondary btn-block" id="home-btn">
            <span class="btn-icon">返回</span>
            <span>返回主頁</span>
          </button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  $('#back-btn').addEventListener('click', () => {
    state.currentScreen = 'category';
    render();
  });

  if (unknown > 0) {
    $('#redo-btn').addEventListener('click', () => {
      // Filter current words to only unknowns that were marked
      const unknownWordSet = new Set(state.unknownInSession.map(w => w.word));
      state.currentWords = state.currentWords.filter(w => unknownWordSet.has(w.word));
      state.currentIndex = 0;
      state.knownInSession = [];
      state.unknownInSession = [];
      state.sessionSize = state.currentWords.length;
      state.mode = 'redo';
      state.currentScreen = 'flashcard';
      render();
    });
  }

  if (allKnown) {
    $('#next-btn').addEventListener('click', () => {
      // Find next incomplete category
      const idx = VOCAB_DATA.findIndex(c => c.id === state.selectedCategory.id);
      let nextIdx = -1;
      for (let i = 1; i <= VOCAB_DATA.length; i++) {
        const next = VOCAB_DATA[(idx + i) % VOCAB_DATA.length];
        if (!isCategoryCompleted(next)) {
          nextIdx = VOCAB_DATA.indexOf(next);
          break;
        }
      }
      if (nextIdx >= 0) {
        state.selectedCategory = VOCAB_DATA[nextIdx];
        state.currentScreen = 'category';
        render();
      } else {
        // All complete
        showToast('恭喜 恭喜！所有分類都完成晒！');
        state.currentScreen = 'home';
        render();
      }
    });
  }

  $('#home-btn').addEventListener('click', () => {
    state.currentScreen = 'home';
    state.selectedCategory = null;
    render();
  });
}

// ============== Init ==============
document.addEventListener('DOMContentLoaded', () => {
  // Register service worker for offline support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('SW registration failed', err);
    });
  }
  render();
});

// Prevent double-tap zoom on iOS
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
