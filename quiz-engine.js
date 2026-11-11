window.QuizEngine = (function () {
  'use strict';

  function initGlobalAntiCheat() {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('selectstart', e => e.preventDefault());
    document.addEventListener('dragstart', e => e.preventDefault());

    document.addEventListener('keydown', e => {
      const isControl = e.ctrlKey || e.metaKey;
      const key = e.key ? e.key.toLowerCase() : '';

      if (
        e.key === 'F12' ||
        e.key === 'PrintScreen' ||
        (isControl && ['c', 'u', 's', 'p', 'a', 'i', 'j'].includes(key)) ||
        (isControl && e.shiftKey && ['i', 'j', 'c'].includes(key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerSecurityWarning('Screen capture or shortcuts disabled!');
        return false;
      }
    });

    document.addEventListener('copy', e => {
      e.preventDefault();
      if (e.clipboardData) e.clipboardData.setData('text/plain', 'Cheating prohibited!');
      triggerSecurityWarning('Copying text is restricted!');
    });
  }

  function triggerSecurityWarning(msg) {
    if (document.getElementById('qe-security-warning-modal')) return;

    const warningEl = document.createElement('div');
    warningEl.id = 'qe-security-warning-modal';
    warningEl.className = 'qe-security-warning';
    warningEl.innerHTML = `
      <h2>⚠️ Security Alert</h2>
      <p>${msg}</p>
      <p><small>The current question will be regenerated to preserve quiz integrity.</small></p>
      <button class="qe-btn qe-btn-primary" id="qe-dismiss-warning">Resume Test</button>
    `;
    document.body.appendChild(warningEl);

    document.querySelectorAll('.qe-root').forEach(el => el.classList.add('qe-security-blur'));

    document.getElementById('qe-dismiss-warning').addEventListener('click', () => {
      warningEl.remove();
      document.querySelectorAll('.qe-root').forEach(el => el.classList.remove('qe-security-blur'));
    });
  }

  if (typeof window !== 'undefined') initGlobalAntiCheat();

  function loadMathJax() {
    if (!window.MathJax) {
      window.MathJax = {
        tex: { inlineMath: [['$', '$'], ['\\(', '\\)']], processEscapes: true },
        options: { ignoreHtmlClass: 'tex2jax_ignore', processHtmlClass: 'tex2jax_process' }
      };
      const script = document.createElement('script');
      script.id = 'MathJax-script';
      script.async = true;
      script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
      document.head.appendChild(script);
    }
  }

  function generateAllNumbers(cfg) {
    if (!cfg || cfg.type === 'range') return [];
    const { digits, allowedDigits = [], distinctDigits, requireSpecificDigit, firstDigitExclude } = cfg;
    const results = [];
    (function recurse(prefix, used) {
      if (prefix.length === digits) {
        if (requireSpecificDigit !== undefined && !prefix.includes(requireSpecificDigit)) return;
        if (firstDigitExclude && prefix.length > 0 && firstDigitExclude.includes(prefix[0])) return;
        results.push(Number(prefix.join('')));
        return;
      }
      for (const d of allowedDigits) {
        if (distinctDigits && used.has(d)) continue;
        used.add(d); prefix.push(d);
        recurse(prefix, used);
        prefix.pop(); used.delete(d);
      }
    })([], new Set());
    return results;
  }

  function computeResult(a, b, op) {
    if (op === '×') return a * b;
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '÷') return a / b;
    throw new Error('Op not supported');
  }

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { let t = b; b = a % b; a = t; }
    return a;
  }

  function is5Smooth(n, primes = [2, 3, 5]) {
    if (n < 1) return false;
    let x = n;
    for (let p of primes) { while (x % p === 0) x /= p; }
    return x === 1;
  }

  function primeFactorization(n, primes, isMathJax) {
    if (n < 2) return String(n);
    const factors = [];
    let x = n;
    for (let p of primes) {
      if (x % p === 0) {
        let count = 0;
        while (x % p === 0) { x /= p; count++; }
        factors.push(count === 1 ? String(p) : (isMathJax ? `${p}^{${count}}` : `${p}^${count}`));
      }
    }
    return isMathJax ? `\\(${factors.join(' \\times ')}\\)` : factors.join(' × ');
  }

  function getFactors(n) {
    const factors = [];
    for (let i = 1; i <= n; i++) { if (n % i === 0) factors.push(i); }
    return factors;
  }

  function decimalString(num, den) {
    const integerPart = Math.floor(num / den);
    let r = num % den;
    if (r === 0) return String(integerPart);
    let digits = '';
    for (let i = 0; i < 4; i++) {
      r = r * 10;
      const digit = Math.floor(r / den);
      digits += digit;
      r = r % den;
      if (r === 0) break;
    }
    let s = integerPart + '.' + digits;
    s = s.replace(/0+$/, '');
    if (s.endsWith('.')) s = s.slice(0, -1);
    return s;
  }

  function trimTrailingZeros(s) {
    if (s.indexOf('.') !== -1) {
      s = s.replace(/0+$/, '');
      s = s.replace(/\.$/, '');
    }
    return s;
  }

  function compareDecimalStrings(a, b) {
    const [ai, af = ''] = String(a).split('.');
    const [bi, bf = ''] = String(b).split('.');
    const intLen = Math.max(ai.length, bi.length);
    const Aint = ai.padStart(intLen, '0');
    const Bint = bi.padStart(intLen, '0');
    if (Aint < Bint) return -1;
    if (Aint > Bint) return 1;
    const fracLen = Math.max(af.length, bf.length);
    const Af = af.padEnd(fracLen, '0');
    const Bf = bf.padEnd(fracLen, '0');
    if (Af < Bf) return -1;
    if (Af > Bf) return 1;
    return 0;
  }

  function compareIntegerStrings(a, b) {
    const ai = a.replace(/^0+/, '') || '0';
    const bi = b.replace(/^0+/, '') || '0';
    if (ai.length < bi.length) return -1;
    if (ai.length > bi.length) return 1;
    if (ai < bi) return -1;
    if (ai > bi) return 1;
    return 0;
  }

  function canonicalInteger(s) {
    const [ip] = String(s).split('.');
    return ip.replace(/^0+/, '') || '0';
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randDigit(exclude = []) {
    const pool = [0,1,2,3,4,5,6,7,8,9].filter(d => !exclude.includes(d));
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function isDifficultySuitable(fracs) {
    const vals = fracs.map(f => f.n / f.d);
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        if (Math.abs(vals[i] - vals[j]) < 1e-12) return false;
      }
    }
    const numSet = new Set(fracs.map(f => f.n));
    if (numSet.size < 4) return false;

    const sortedVals = [...vals].sort((x, y) => x - y);
    const range = sortedVals[3] - sortedVals[0];
    if (range < 0.18 || range > 0.85) return false;

    const gaps = [];
    for (let i = 1; i < 4; i++) gaps.push(sortedVals[i] - sortedVals[i-1]);
    if (Math.max(...gaps) > 0.32) return false;

    const byNum = [...fracs].sort((a,b) => a.n - b.n);
    const byVal = [...fracs].sort((a,b) => (a.n/a.d) - (b.n/b.d));
    let alignedNum = 0;
    for (let i = 0; i < 4; i++) if (byNum[i].n === byVal[i].n) alignedNum++;
    if (alignedNum >= 3) return false;

    const byDen = [...fracs].sort((a,b) => a.d - b.d);
    const byValDesc = [...fracs].sort((a,b) => (b.n/b.d) - (a.n/a.d));
    let alignedDen = 0;
    for (let i = 0; i < 4; i++) if (byDen[i].d === byValDesc[i].d) alignedDen++;
    if (alignedDen >= 3) return false;

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (i === j) continue;
        const ratio = vals[i] / vals[j];
        if (Math.abs(ratio - 2) < 0.05 || Math.abs(ratio - 0.5) < 0.05) return false;
        if (Math.abs(ratio - 3) < 0.05 || Math.abs(ratio - 1/3) < 0.05) return false;
      }
    }
    return true;
  }

  function generateSingleSpecialQuestion(cfg, index, validNumbers, usedKeys) {
    const primesList = cfg.primes || [2, 3, 5];
    const smooth1Digit = validNumbers.filter(n => n >= 2 && n <= 9);
    const smooth2Digit = validNumbers.filter(n => n >= 10 && n <= 99);
    const compositeSmooth1Digit = smooth1Digit.filter(n => !primesList.includes(n));
    const compositeSmooth2Digit = smooth2Digit;

    let question, ok = false, attempts = 0;
    while (!ok && attempts < 10000) {
      attempts++;
      
      if (cfg.type === 'prime-factorization') {
        const min = cfg.minNumber || 10, max = cfg.maxNumber || 99;
        const pool = validNumbers.filter(n => n >= min && n <= max);
        const number = pool[Math.floor(Math.random() * pool.length)];
        if (usedKeys.has(number)) continue;
        ok = true; usedKeys.add(number);
        question = { number, mathjax: primeFactorization(number, primesList, true), plain: primeFactorization(number, primesList, false) };
      } 
      else if (cfg.type === 'lcm' || cfg.type === 'hcf') {
        const min = cfg.minNumber || 10, max = cfg.maxNumber || 99;
        const pool = validNumbers.filter(n => n >= min && n <= max);
        const nums = [];
        for (let i = 0; i < cfg.numCount; i++) nums.push(pool[Math.floor(Math.random() * pool.length)]);
        const sortedKey = [...nums].sort((a,b)=>a-b).join('-');
        if (usedKeys.has(sortedKey)) continue;
        let result = nums[0];
        for (let i = 1; i < nums.length; i++) {
          if (cfg.type === 'lcm') result = (result * nums[i]) / gcd(result, nums[i]);
          else result = gcd(result, nums[i]);
        }
        ok = true; usedKeys.add(sortedKey);
        question = { nums, result };
      }
      else if (cfg.type === 'fraction') {
        const min = cfg.minNumber || 10, max = cfg.maxNumber || 99;
        const pool = validNumbers.filter(n => n >= min && n <= max);
        const num = pool[Math.floor(Math.random() * pool.length)];
        const den = pool[Math.floor(Math.random() * pool.length)];
        if (num === den) continue;
        const g = gcd(num, den);
        if (g === 1) continue; 
        const pairKey = num + '/' + den;
        if (usedKeys.has(pairKey)) continue;
        let numF1 = 1, numF2 = num, denF1 = 1, denF2 = den;
        if (cfg.hasExpression) {
          if (cfg.expressionMode === 'both' || Math.random() < 0.5) {
            const fs = getFactors(num).filter(f => f !== 1 && f !== num);
            if (fs.length > 0) { numF1 = fs[Math.floor(Math.random() * fs.length)]; numF2 = num / numF1; }
          }
          if (cfg.expressionMode === 'both' || Math.random() < 0.5) {
            const fs = getFactors(den).filter(f => f !== 1 && f !== den);
            if (fs.length > 0) { denF1 = fs[Math.floor(Math.random() * fs.length)]; denF2 = den / denF1; }
          }
        }
        ok = true; usedKeys.add(pairKey);
        question = { num, den, numF1, numF2, denF1, denF2, correctNum: num / g, correctDen: den / g };
      }
      else if (cfg.type === 'fraction-op') {
        let n1, d1, n2, d2;
        if (cfg.numbersType === '1-digit') {
          n1 = Math.floor(Math.random() * 8) + 2; d1 = Math.floor(Math.random() * 8) + 2;
          n2 = Math.floor(Math.random() * 8) + 2; d2 = Math.floor(Math.random() * 8) + 2;
        } else {
          n1 = smooth2Digit[Math.floor(Math.random() * smooth2Digit.length)];
          d1 = smooth2Digit[Math.floor(Math.random() * smooth2Digit.length)];
          n2 = smooth2Digit[Math.floor(Math.random() * smooth2Digit.length)];
          d2 = smooth2Digit[Math.floor(Math.random() * smooth2Digit.length)];
        }
        if (n1 === d1 || n2 === d2) continue;
        const key = `${n1}/${d1} ${cfg.operator} ${n2}/${d2}`;
        if (usedKeys.has(key)) continue;
        let rawNum, rawDen;
        if (cfg.operator === '×') { rawNum = n1 * n2; rawDen = d1 * d2; }
        else { rawNum = n1 * d2; rawDen = d1 * n2; }
        const g = gcd(rawNum, rawDen);
        const cNum = rawNum / g, cDen = rawDen / g;
        if (cNum === 1 && cDen === 1) continue;
        ok = true; usedKeys.add(key);
        question = { n1, d1, n2, d2, correctNum: cNum, correctDen: cDen };
      }
      else if (cfg.type === 'order-4-fractions') {
        const allDen = [2,3,4,5,6,7,8,9];
        for (let i = allDen.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allDen[i], allDen[j]] = [allDen[j], allDen[i]];
        }
        const denoms = allDen.slice(0, 4);
        const fracs = [];
        let validFracs = true;
        const usedNums = new Set();
        for (const d of denoms) {
          const possible = [];
          for (let n = 1; n < d; n++) { if (!usedNums.has(n) && !denoms.includes(n)) possible.push(n); }
          if (possible.length === 0) { validFracs = false; break; }
          const n = possible[Math.floor(Math.random() * possible.length)];
          usedNums.add(n); fracs.push({ n, d });
        }
        if (!validFracs || !isDifficultySuitable(fracs)) continue;

        const fracStr = fracs.map(f => `${f.n}/${f.d}`).sort().join('|');
        if (usedKeys.has(fracStr)) continue;

        const direction = Math.random() < 0.5 ? 'asc' : 'desc';
        const sorted = [...fracs].sort((a, b) => (a.n * b.d) - (b.n * a.d));
        if (direction === 'desc') sorted.reverse();

        ok = true; usedKeys.add(fracStr);
        question = { fractions: fracs, direction, correctOrder: sorted };
      }
      else {
        break;
      }
    }
    return question;
  }

  function generateSpecialQuestions(cfg) {
    let validNumbers = [];
    const primesList = cfg.primes || [2, 3, 5];
    for (let n = 2; n <= 999; n++) {
      if (is5Smooth(n, primesList)) validNumbers.push(n);
    }
    const usedKeys = new Set();
    const questions = [];

    for (let q = 0; q < cfg.questionCount; q++) {
      const question = generateSingleSpecialQuestion(cfg, q, validNumbers, usedKeys);
      if (!question) return null;
      questions.push(question);
    }
    return questions;
  }

  function buildSpecialOptions(correctQ, cfg, validNumbers) {
    const distractors = [];
    const seen = new Set();
    
    if (cfg.type === 'order-4-fractions') {
      const correct = correctQ.correctOrder;
      const correctKey = correct.map(f => `${f.n}/${f.d}`).join('|');
      seen.add(correctKey);
      const options = [{ order: correct.slice(), isCorrect: true }];

      let attempts = 0;
      while (options.length < 4 && attempts < 5000) {
        attempts++;
        let candidate;
        if (Math.random() < 0.55) {
          const base = correct.slice();
          const i = Math.floor(Math.random() * 3);
          [base[i], base[i+1]] = [base[i+1], base[i]];
          candidate = base;
        } else {
          candidate = shuffle(correct);
        }

        const key = candidate.map(f => `${f.n}/${f.d}`).join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({ order: candidate, isCorrect: false });
      }

      return shuffle(options);
    }

    const options = [correctQ.result, ...distractors];
    return shuffle(options);
  }

  function generateSingleStandardQuestion(cfg, poolA, poolB, usedNums) {
    const noReuse = cfg.uniqueness === 'no-reused-numbers';
    let num1, num2, ok = false, attempts = 0;
    while (!ok && attempts < 1000) {
      attempts++;
      num1 = poolA[Math.floor(Math.random() * poolA.length)];
      num2 = poolB[Math.floor(Math.random() * poolB.length)];
      if (poolA === poolB && num1 === num2) continue;
      if (noReuse && (usedNums.has(num1) || usedNums.has(num2))) continue;
      ok = true;
    }
    if (!ok) return null;
    usedNums.add(num1); usedNums.add(num2);
    const result = computeResult(num1, num2, cfg.operator);
    if (result <= 0) return null;
    return { num1, num2, result };
  }

  function generateStandardQuestions(cfg, poolA, poolB) {
    const usedNums = new Set();
    const questions = [];
    for (let q = 0; q < cfg.questionCount; q++) {
      const question = generateSingleStandardQuestion(cfg, poolA, poolB, usedNums);
      if (!question) return null;
      questions.push(question);
    }
    return questions;
  }

  function buildStandardOptions(correctResult, cfg, poolA, poolB) {
    const needCount = 3;
    const distractors = [];
    const seen = new Set([correctResult]);
    
    let attempts = 0;
    while (distractors.length < needCount && attempts < 1000) {
      attempts++;
      const delta = (Math.floor(Math.random() * 20) - 10);
      const candidate = Math.max(1, correctResult + delta);
      if (seen.has(candidate)) continue;
      seen.add(candidate); distractors.push(candidate);
    }
    return shuffle([correctResult, ...distractors]);
  }

  function createController(levelConfig, hostEl, onFinished, onStateChange, studentData) {
    const cfg = levelConfig;
    const totalQuestions = cfg.questionCount;
    let questions = [], optionsList = [], poolA = [], poolB = [], validNums = [];
    const specialTypes = ['prime-factorization', 'lcm', 'hcf', 'fraction', 'fraction-op', 'fraction-whole', 'fraction-add-sub', 'proper-fraction-add-sub', 'order-4-fractions', 'division-to-fraction', 'improper-to-decimal', 'decimal-comparison'];
    
    if (specialTypes.includes(cfg.type)) {
      loadMathJax();
      for (let n = 2; n <= 999; n++) { if (is5Smooth(n)) validNums.push(n); }
      const q = generateSpecialQuestions(cfg);
      if (q) questions = q;
      optionsList = questions.map(qObj => buildSpecialOptions(qObj, cfg, validNums));
    } else {
      poolA = generateAllNumbers(cfg.operandA); 
      poolB = generateAllNumbers(cfg.operandB);
      const q = generateStandardQuestions(cfg, poolA, poolB);
      if (q) questions = q;
      optionsList = questions.map(qObj => buildStandardOptions(qObj.result, cfg, poolA, poolB));
    }

    let state = { levelId: cfg.id, questions, currentIndex: 0, answers: new Array(totalQuestions).fill(null), optionsList, completed: false, score: 0 };
    const notify = () => { if (typeof onStateChange === 'function') { try { onStateChange(JSON.parse(JSON.stringify(state))); } catch (e) {} } };

    const studentName = (studentData && studentData.name) ? studentData.name : 'Student';
    const studentClass = (studentData && studentData.class) ? `Class ${studentData.class}` : '';
    const watermarkText = `${studentName} • ${studentClass} • Level ${cfg.id}`;

    hostEl.innerHTML = `
      <div class="qe-root">
        <div class="qe-watermark-overlay" id="qeWatermarkContainer"></div>
        <div class="qe-content-wrapper">
          <h1 class="qe-title"></h1>
          <div class="qe-subhead"><div class="qe-status">Question 1 of ${totalQuestions}</div><div class="qe-progress-badge">1 / ${totalQuestions}</div></div>
          <div class="qe-question-view">
            <div class="qe-question-area"><div class="qe-question-text"></div><div class="qe-options-grid"></div></div>
            <div class="qe-btn-group"><button class="qe-btn qe-btn-primary qe-submit-btn" disabled>Submit answer</button></div>
          </div>
          <div class="qe-result-view qe-hide">
            <div class="qe-result-area">
              <div class="qe-score-big">0<small>/${totalQuestions}</small></div><div class="qe-score-message"></div><div class="qe-congrats qe-hide"></div>
              <div class="qe-btn-group" style="margin-top:24px"><button class="qe-btn qe-try-again-btn">🔄 Try again</button></div>
            </div>
          </div>
        </div>
      </div>`;

    const root = hostEl.querySelector('.qe-root');
    const watermarkContainer = root.querySelector('#qeWatermarkContainer');
    
    for (let i = 0; i < 8; i++) {
      const item = document.createElement('div');
      item.className = 'qe-watermark-item';
      item.textContent = watermarkText;
      watermarkContainer.appendChild(item);
    }

    const titleEl = root.querySelector('.qe-title'), statusEl = root.querySelector('.qe-status'), badgeEl = root.querySelector('.qe-progress-badge');
    const qViewEl = root.querySelector('.qe-question-view'), rViewEl = root.querySelector('.qe-result-view');
    const qTextEl = root.querySelector('.qe-question-text'), optionsGrid = root.querySelector('.qe-options-grid'), submitBtn = root.querySelector('.qe-submit-btn');
    const scoreBigEl = root.querySelector('.qe-score-big'), scoreMsgEl = root.querySelector('.qe-score-message'), congratsEl = root.querySelector('.qe-congrats'), tryAgainBtn = root.querySelector('.qe-try-again-btn');
    titleEl.textContent = cfg.title || 'Quiz';

    function handleVisibilityOrBlur() {
      if (document.hidden || !document.hasFocus()) {
        root.classList.add('qe-security-blur');
      } else {
        root.classList.remove('qe-security-blur');
      }
    }

    window.addEventListener('visibilitychange', handleVisibilityOrBlur);
    window.addEventListener('blur', handleVisibilityOrBlur);
    window.addEventListener('focus', handleVisibilityOrBlur);

    function renderQuestion() {
      if (state.completed) { renderResult(); return; }
      const qi = state.currentIndex;
      if (qi >= totalQuestions) { state.completed = true; renderResult(); return; }
      const q = state.questions[qi], opts = state.optionsList[qi], sel = state.answers[qi];
      badgeEl.textContent = `${qi + 1} / ${totalQuestions}`;
      statusEl.textContent = `Question ${qi + 1} of ${totalQuestions}`;

      if (cfg.type === 'order-4-fractions') {
        let listHTML = '<div style="display:flex; flex-wrap:wrap; justify-content:center; gap:clamp(10px,2vw,18px); margin:12px 0 6px 0;">';
        q.fractions.forEach((f, i) => {
          if (i > 0) listHTML += `<span style="font-weight:900; color:#66736e; align-self:center; font-size:clamp(20px, 3.5vh, 30px);">,</span>`;
          listHTML += `<span style="display:inline-flex; flex-direction:column; align-items:center; font-weight:800; color:#1d5b4e; font-size:clamp(24px,4.5vh,36px); line-height:1.05;"><span style="border-bottom:3px solid #123c35; padding:0 12px 3px 12px;">${f.n}</span><span style="padding:3px 12px 0 12px;">${f.d}</span></span>`;
        });
        listHTML += '</div>';
        qTextEl.innerHTML = `<div style="text-align:center;"><span style="display:inline-block; background:#e7b95b; color:#3d2f10; font-weight:900; font-size:clamp(12px,1.8vh,14px); padding:5px 16px; border-radius:30px; margin-bottom:8px; letter-spacing:0.5px; text-transform:uppercase;">${q.direction === 'asc' ? 'Ascending order' : 'Descending order'}</span></div>` + listHTML + `<div style="font-size:clamp(14px,2vh,18px); margin-top:8px; color:#66736e; font-weight:600;">Which option shows them in ${q.direction === 'asc' ? 'ascending' : 'descending'} order?</div>`;
      } else {
        qTextEl.innerHTML = `<span class="qe-operand">${q.num1}</span><span class="qe-op">${cfg.operator}</span><span class="qe-operand">${q.num2}</span><span class="qe-eq">=</span><span class="qe-qmark">?</span>`;
      }

      optionsGrid.innerHTML = '';
      opts.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'qe-option-btn';
        if (sel === idx) btn.classList.add('qe-selected');

        if (cfg.type === 'order-4-fractions') {
          let html = '<span style="display:inline-flex; align-items:center; flex-wrap:nowrap; justify-content:center; gap:4px; font-size:clamp(14px, 2.2vh, 18px);">';
          opt.order.forEach((f, i) => {
            if (i > 0) html += '<span style="font-weight:900; color:#66736e; font-size:0.85em;">,</span>';
            html += `<span style="display:inline-flex; flex-direction:column; align-items:center; line-height:1; font-weight:800; color:#1d5b4e; margin:0 1px;"><span style="border-bottom:2px solid currentColor; padding:0 4px 1px 4px;">${f.n}</span><span style="padding:1px 4px 0 4px;">${f.d}</span></span>`;
          });
          html += '</span>';
          btn.innerHTML = html;
        } else {
          btn.textContent = opt;
        }

        btn.addEventListener('click', () => {
          if (state.completed) return;
          state.answers[qi] = idx;
          optionsGrid.querySelectorAll('.qe-option-btn').forEach(b => b.classList.remove('qe-selected'));
          btn.classList.add('qe-selected');
          submitBtn.disabled = false;
          submitBtn.textContent = (qi < totalQuestions - 1) ? 'Next question →' : 'Submit quiz ✓';
          notify();
        });
        optionsGrid.appendChild(btn);
      });

      const hasSel = state.answers[qi] !== null && state.answers[qi] !== undefined;
      submitBtn.disabled = !hasSel;
      submitBtn.textContent = hasSel ? ((qi < totalQuestions - 1) ? 'Next question →' : 'Submit quiz ✓') : 'Submit answer';
      
      qViewEl.classList.remove('qe-hide');
      rViewEl.classList.add('qe-hide');
    }

    function finalize() {
      let score = 0;
      state.questions.forEach((q, idx) => {
        const chosenOpt = state.optionsList[idx][state.answers[idx]];
        if (cfg.type === 'order-4-fractions') { if (chosenOpt && chosenOpt.isCorrect) score++; }
        else { if (chosenOpt === q.result) score++; }
      });
      state.score = score;
      state.completed = true;
      renderResult();
      notify();
      if (typeof onFinished === 'function') { try { onFinished(score, totalQuestions); } catch (e) { console.error(e); } }
    }

    function renderResult() {
      qViewEl.classList.add('qe-hide'); 
      rViewEl.classList.remove('qe-hide');
      scoreBigEl.innerHTML = `${state.score}<small>/${totalQuestions}</small>`;
      if (state.score === totalQuestions) {
        scoreMsgEl.style.display = 'none'; scoreMsgEl.textContent = '';
        congratsEl.classList.remove('qe-hide'); congratsEl.textContent = `🎉 Congratulations! Perfect ${totalQuestions}/${totalQuestions}!`;
        tryAgainBtn.style.display = 'none';
      } else {
        scoreMsgEl.style.display = 'block'; scoreMsgEl.textContent = `You scored ${state.score}/${totalQuestions}. Try again to improve.`;
        scoreMsgEl.style.color = '#a83e37'; congratsEl.classList.add('qe-hide'); tryAgainBtn.style.display = 'inline-flex';
      }
      statusEl.textContent = 'Quiz completed'; badgeEl.textContent = `${totalQuestions} / ${totalQuestions}`;
    }

    submitBtn.addEventListener('click', () => {
      const qi = state.currentIndex;
      if (state.answers[qi] === null || state.answers[qi] === undefined) return;
      optionsGrid.querySelectorAll('.qe-option-btn').forEach(b => b.classList.add('qe-disabled'));
      if (state.currentIndex < totalQuestions - 1) { state.currentIndex++; notify(); renderQuestion(); }
      else { finalize(); }
    });

    tryAgainBtn.addEventListener('click', () => {
      let freshQuestions, freshOptionsList;
      if (specialTypes.includes(cfg.type)) {
        freshQuestions = generateSpecialQuestions(cfg);
        if (freshQuestions) freshOptionsList = freshQuestions.map(q => buildSpecialOptions(q, cfg, validNums));
      } else {
        freshQuestions = generateStandardQuestions(cfg, poolA, poolB);
        if (freshQuestions) freshOptionsList = freshQuestions.map(q => buildStandardOptions(q.result, cfg, poolA, poolB));
      }
      if (!freshQuestions) { alert('Could not regenerate a quiz. Please reload.'); return; }
      state = { levelId: cfg.id, questions: freshQuestions, currentIndex: 0, answers: new Array(totalQuestions).fill(null), optionsList: freshOptionsList, completed: false, score: 0 };
      notify(); renderQuestion();
    });

    renderQuestion();
    notify();

    return {
      getState: () => JSON.parse(JSON.stringify(state)),
      destroy: () => {
        window.removeEventListener('visibilitychange', handleVisibilityOrBlur);
        window.removeEventListener('blur', handleVisibilityOrBlur);
        window.removeEventListener('focus', handleVisibilityOrBlur);
        hostEl.innerHTML = '';
      }
    };
  }

  return {
    mount({ levelConfig, hostEl, onFinished, onStateChange, studentData }) {
      if (!levelConfig) throw new Error('mount() requires levelConfig');
      if (!hostEl) throw new Error('mount() requires hostEl');
      return createController(levelConfig, hostEl, onFinished, onStateChange, studentData);
    },
    unmount(hostEl) { if (hostEl) hostEl.innerHTML = ''; }
  };
})();
