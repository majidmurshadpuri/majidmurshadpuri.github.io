window.QuizEngine = (function () {
  'use strict';

  let activeRegenerateCallback = null;

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
        triggerSecurityWarning('Screen capture or developer shortcuts are restricted!');
        return false;
      }
    });

    document.addEventListener('keyup', e => {
      if (e.key === 'PrintScreen') {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('Restricted content').catch(() => {});
        }
        triggerSecurityWarning('Screenshot attempt detected!');
      }
    });

    document.addEventListener('copy', e => {
      e.preventDefault();
      if (e.clipboardData) e.clipboardData.setData('text/plain', 'Copying is prohibited!');
      triggerSecurityWarning('Copying quiz content is restricted!');
    });
  }

  function triggerSecurityWarning(msg) {
    document.querySelectorAll('.qe-root').forEach(el => el.classList.add('qe-security-blur'));
    if (typeof activeRegenerateCallback === 'function') {
      activeRegenerateCallback();
    }
    if (document.getElementById('qe-security-warning-modal')) return;

    const warningEl = document.createElement('div');
    warningEl.id = 'qe-security-warning-modal';
    warningEl.className = 'qe-security-warning';
    warningEl.innerHTML = `
      <h2>âš ï¸ Security Alert</h2>
      <p>${msg}</p>
      <p><small>For quiz integrity, a fresh question has been generated for this slot.</small></p>
      <button class="qe-btn qe-btn-primary" id="qe-dismiss-warning">Resume Quiz</button>
    `;
    document.body.appendChild(warningEl);

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
    if (op === 'Ã—') return a * b;
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === 'Ã·') return a / b;
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
    return isMathJax ? `\\(${factors.join(' \\times ')}\\)` : factors.join(' Ã— ');
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

  function buildQuestionLevel31(displays, level, forcedDirection) {
    if (!Array.isArray(displays) || displays.length !== 4) return null;
    for (const s of displays) {
      if (typeof s !== 'string' || (s.match(/\./g) || []).length !== 1) return null;
      const [ip, fp] = s.split('.');
      if (ip.length === 0 || fp.length === 0 || !/^\d+$/.test(ip) || !/^\d+$/.test(fp)) return null;
    }
    const opts = displays.map(s => ({ str: s, val: parseFloat(s) }));
    if (new Set(opts.map(o => o.str)).size !== 4 || new Set(opts.map(o => o.val)).size !== 4) return null;
    if (new Set(opts.map(o => o.str.split('.')[1].length)).size < 2) return null;
    if (new Set(opts.map(o => o.str.split('.')[0].length)).size < 2) return null;

    for (let i = 0; i < opts.length; i++) {
      for (let j = i + 1; j < opts.length; j++) {
        if (compareDecimalStrings(opts[i].str, opts[j].str) === 0) return null;
      }
    }
    const direction = forcedDirection || (Math.random() < 0.5 ? 'greatest' : 'smallest');
    const sorted = [...opts].sort((a, b) => compareDecimalStrings(a.str, b.str));
    const correct = direction === 'greatest' ? sorted[3].str : sorted[0].str;
    return { level, direction, options: shuffle(opts), correctStr: correct };
  }

  function buildQuestionLevel32(displays, level, forcedDirection) {
    if (!Array.isArray(displays) || displays.length !== 4) return null;
    for (const s of displays) {
      if (typeof s !== 'string' || s.length === 0) return null;
      const dotCount = (s.match(/\./g) || []).length;
      if (dotCount > 1) return null;
      if (dotCount === 1) {
        const [ip, fp] = s.split('.');
        if (!ip || !fp || !/^\d+$/.test(ip) || !/^\d+$/.test(fp)) return null;
      } else {
        if (!/^\d+$/.test(s)) return null;
      }
    }
    const opts = displays.map(s => ({ str: s, val: parseFloat(s) }));
    if (new Set(opts.map(o => o.str)).size !== 4 || new Set(opts.map(o => o.val)).size !== 4) return null;
    if (new Set(opts.map(o => o.str.includes('.') ? o.str.split('.')[1].length : 0)).size < 2) return null;
    if (new Set(opts.map(o => o.str.split('.')[0].length)).size < 2) return null;

    const totalDigits = s => s.replace('.', '').length;
    const isWhole = s => !s.includes('.');
    const direction = forcedDirection || (Math.random() < 0.5 ? 'greatest' : 'smallest');
    const sorted = [...opts].sort((a, b) => compareDecimalStrings(a.str, b.str));
    const correctStr = direction === 'greatest' ? sorted[3].str : sorted[0].str;
    const others = opts.filter(o => o.str !== correctStr);

    const wholeCount = opts.filter(o => isWhole(o.str)).length;
    if (wholeCount === 1 && isWhole(correctStr)) return null;
    if (opts.length - wholeCount === 1 && !isWhole(correctStr)) return null;

    const correctLen = totalDigits(correctStr);
    if (others.every(o => totalDigits(o.str) < correctLen) || others.every(o => totalDigits(o.str) > correctLen)) return null;
    if (!others.some(o => totalDigits(o.str) > correctLen) || !others.some(o => totalDigits(o.str) < correctLen)) return null;

    const lens = opts.map(o => o.str.length);
    if (correctStr.length === Math.max(...lens) && lens.filter(l => l === Math.max(...lens)).length === 1) return null;
    if (correctStr.length === Math.min(...lens) && lens.filter(l => l === Math.min(...lens)).length === 1) return null;
    if (new Set(lens).size < 3) return null;

    const correctIntLen = correctStr.split('.')[0].length;
    if (others.every(o => o.str.split('.')[0].length < correctIntLen) || others.every(o => o.str.split('.')[0].length > correctIntLen)) return null;

    return { level, direction, options: shuffle(opts), correctStr };
  }

  function buildQuestionLevel33(displays, forcedDirection) {
    if (!Array.isArray(displays) || displays.length !== 4) return null;
    for (const s of displays) {
      if (typeof s !== 'string' || s.length === 0) return null;
      if ((s.match(/\./g) || []).length !== 1) return null;
      const [ip, fp] = s.split('.');
      if (fp.length === 0 || !/^\d*$/.test(ip) || !/^\d+$/.test(fp)) return null;
      if (ip.length > 0 && !/^0+$/.test(ip)) return null;
    }
    const opts = displays.map(s => ({ str: s, val: parseFloat(s) }));
    if (new Set(opts.map(o => o.str)).size !== 4 || new Set(opts.map(o => o.val)).size !== 4) return null;

    const fracLen = s => (s.split('.')[1] || '').length;
    const totalDigits = s => s.replace('.', '').length;
    const leadingZerosCount = s => s.split('.')[0].length;

    if (new Set(opts.map(o => fracLen(o.str))).size < 3) return null;
    const lens = opts.map(o => o.str.length);
    if (new Set(lens).size < 3) return null;

    const direction = forcedDirection || (Math.random() < 0.5 ? 'greatest' : 'smallest');
    const sorted = [...opts].sort((a, b) => compareDecimalStrings(a.str, b.str));
    const correctStr = direction === 'greatest' ? sorted[3].str : sorted[0].str;
    const others = opts.filter(o => o.str !== correctStr);

    if (correctStr.length === Math.max(...lens) && lens.filter(l => l === Math.max(...lens)).length === 1) return null;
    if (correctStr.length === Math.min(...lens) && lens.filter(l => l === Math.min(...lens)).length === 1) return null;

    const cDigits = totalDigits(correctStr);
    if (!others.some(o => totalDigits(o.str) > cDigits) || !others.some(o => totalDigits(o.str) < cDigits)) return null;

    const cLead = leadingZerosCount(correctStr);
    const leads = opts.map(o => leadingZerosCount(o.str));
    if (cLead === Math.min(...leads) && leads.filter(l => l === Math.min(...leads)).length === 1) return null;
    if (cLead === Math.max(...leads) && leads.filter(l => l === Math.max(...leads)).length === 1) return null;

    const dotCount = opts.filter(o => o.str.startsWith('.')).length;
    if (dotCount === 1 && correctStr.startsWith('.')) return null;

    const cFrac = fracLen(correctStr);
    if (others.every(o => fracLen(o.str) < cFrac) || others.every(o => fracLen(o.str) > cFrac)) return null;

    return { direction, options: shuffle(opts), correctStr };
  }

  function buildQuestionLevel34(displays, forcedDirection) {
    if (!Array.isArray(displays) || displays.length !== 4) return null;
    for (const s of displays) {
      if (typeof s !== 'string' || s.length === 0) return null;
      const dotCount = (s.match(/\./g) || []).length;
      if (dotCount > 1) return null;
      if (dotCount === 1) {
        const [ip, fp] = s.split('.');
        if (!ip || !fp || !/^\d+$/.test(ip) || !/^\d+$/.test(fp) || !/^0+$/.test(fp)) return null;
      } else {
        if (!/^\d+$/.test(s)) return null;
      }
    }
    const canon = displays.map(canonicalInteger);
    if (new Set(canon).size !== 4) return null;
    if (new Set(displays.map(s => canonicalInteger(s).length)).size < 3) return null;
    const lens = displays.map(s => s.length);
    if (new Set(lens).size < 3) return null;
    if (!displays.some(s => s.includes('.')) || !displays.some(s => !s.includes('.'))) return null;

    const direction = forcedDirection || (Math.random() < 0.5 ? 'greatest' : 'smallest');
    const sortedCanon = [...canon].sort(compareIntegerStrings);
    const correctCanon = direction === 'greatest' ? sortedCanon[3] : sortedCanon[0];
    const correctStr = displays.find(s => canonicalInteger(s) === correctCanon);
    const others = displays.filter(s => canonicalInteger(s) !== correctCanon);

    if (correctStr.length === Math.max(...lens) && lens.filter(l => l === Math.max(...lens)).length === 1) return null;
    if (correctStr.length === Math.min(...lens) && lens.filter(l => l === Math.min(...lens)).length === 1) return null;
    if (!others.some(o => o.length > correctStr.length) || !others.some(o => o.length < correctStr.length)) return null;

    const correctIsDecimal = correctStr.includes('.');
    if (others.filter(o => o.includes('.') === correctIsDecimal).length === 0) return null;

    return { direction, options: shuffle(displays.map(s => ({ str: s, canon: canonicalInteger(s) }))), correctCanon, correctStr };
  }

  function generateSingleSpecialQuestion(cfg, q, validNumbers, usedKeys) {
    const primesList = cfg.primes || [2, 3, 5];
    const smooth1Digit = validNumbers.filter(n => n >= 2 && n <= 9);
    const smooth2Digit = validNumbers.filter(n => n >= 10 && n <= 99);
    const compositeSmooth1Digit = smooth1Digit.filter(n => !primesList.includes(n));
    const compositeSmooth2Digit = smooth2Digit;
    const noReuse = cfg.uniqueness === 'no-reused-numbers';

    let question, ok = false, attempts = 0;
    while (!ok && attempts < 20000) {
      attempts++;

      if (cfg.type === 'prime-factorization') {
        const min = cfg.minNumber || 10, max = cfg.maxNumber || 99;
        const pool = validNumbers.filter(n => n >= min && n <= max);
        const number = pool[Math.floor(Math.random() * pool.length)];
        if (noReuse && usedKeys.has(number)) continue;
        ok = true; usedKeys.add(number);
        question = { number, mathjax: primeFactorization(number, primesList, true), plain: primeFactorization(number, primesList, false) };
      } 
      else if (cfg.type === 'lcm' || cfg.type === 'hcf') {
        const min = cfg.minNumber || 10, max = cfg.maxNumber || 99;
        const pool = validNumbers.filter(n => n >= min && n <= max);
        const nums = [];
        for (let i = 0; i < cfg.numCount; i++) nums.push(pool[Math.floor(Math.random() * pool.length)]);
        const sortedKey = [...nums].sort((a,b)=>a-b).join('-');
        if (noReuse && usedKeys.has(sortedKey)) continue;
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
        if (noReuse && usedKeys.has(pairKey)) continue;
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
        if (noReuse && usedKeys.has(key)) continue;
        let rawNum, rawDen;
        if (cfg.operator === 'Ã—') { rawNum = n1 * n2; rawDen = d1 * d2; }
        else { rawNum = n1 * d2; rawDen = d1 * n2; }
        const g = gcd(rawNum, rawDen);
        const cNum = rawNum / g, cDen = rawDen / g;
        if (cNum === 1 && cDen === 1) continue;
        ok = true; usedKeys.add(key);
        question = { n1, d1, n2, d2, correctNum: cNum, correctDen: cDen };
      }
      else if (cfg.type === 'fraction-whole') {
        let den, wholeNum, numerator;
        const isFractionFirst = Math.random() < 0.5;

        if (cfg.operator === 'Ã—') {
          den = Math.floor(Math.random() * 8) + 2;
          numerator = Math.floor(Math.random() * 8) + 1;
          wholeNum = Math.floor(Math.random() * 11) + 2;
        } else {
          const denPool = Math.random() < 0.5 ? compositeSmooth1Digit : compositeSmooth2Digit;
          den = denPool[Math.floor(Math.random() * denPool.length)];
          const wholePool = Math.random() < 0.5 ? compositeSmooth1Digit : compositeSmooth2Digit;
          wholeNum = wholePool[Math.floor(Math.random() * wholePool.length)];
          const numPool = Math.random() < 0.5 ? compositeSmooth1Digit : compositeSmooth2Digit;
          numerator = numPool[Math.floor(Math.random() * numPool.length)];
        }

        if (gcd(numerator, den) === den) continue; 
        const key = `${isFractionFirst ? 'F' : 'W'}${wholeNum}-${numerator}/${den}`;
        if (noReuse && usedKeys.has(key)) continue;

        let rawNum, rawDen;
        if (cfg.operator === 'Ã—') {
          rawNum = numerator * wholeNum; rawDen = den; 
        } else {
          if (isFractionFirst) { rawNum = numerator; rawDen = den * wholeNum; }
          else { rawNum = wholeNum * den; rawDen = numerator; }
        }

        const g = gcd(rawNum, rawDen);
        ok = true; usedKeys.add(key);
        question = { wholeNum, numerator, den, isFractionFirst, correctNum: rawNum / g, correctDen: rawDen / g };
      }
      else if (cfg.type === 'fraction-add-sub') {
        let d, n1, n2;
        if (cfg.numbersType === '1-digit') {
          d = Math.floor(Math.random() * 8) + 2;
          const cands = [];
          for (let n = 1; n <= 9; n++) if (n !== d) cands.push(n);
          if (cands.length < 2) continue;
          n1 = cands[Math.floor(Math.random() * cands.length)];
          do { n2 = cands[Math.floor(Math.random() * cands.length)]; } while (n1 === n2);
        } else {
          d = Math.floor(Math.random() * 98) + 2;
          n1 = Math.floor(Math.random() * 99) + 1;
          if (n1 === d) continue;
          n2 = Math.floor(Math.random() * 99) + 1;
          if (n2 === d || n2 === n1) continue;
        }

        const op = Math.random() < 0.5 ? '+' : 'âˆ’';
        const rawNum = op === '+' ? n1 + n2 : n1 - n2;
        if (rawNum <= 0) continue;

        const g = gcd(rawNum, d);
        const cNum = rawNum / g, cDen = d / g;
        if (cNum === 0 || cNum === cDen) continue;

        const key = `${n1}/${d} ${op} ${n2}/${d}`;
        if (noReuse && usedKeys.has(key)) continue;
        ok = true; usedKeys.add(key);
        question = { n1, n2, d, operation: op, correctNum: cNum, correctDen: cDen };
      }
      else if (cfg.type === 'proper-fraction-add-sub') {
        let n1, d1, n2, d2;
        if (cfg.numbersType === '1-digit') {
          d1 = Math.floor(Math.random() * 8) + 2;
          n1 = Math.floor(Math.random() * (d1 - 1)) + 1;
          d2 = Math.floor(Math.random() * 8) + 2;
          n2 = Math.floor(Math.random() * (d2 - 1)) + 1;
          if (n1 === d1 || n2 === d2 || n1 === n2 || d1 === d2 || n1 === d2 || d1 === n2) continue;
        } else {
          n1 = Math.floor(Math.random() * 9) + 1;
          n2 = Math.floor(Math.random() * 9) + 1;
          if (n2 === n1) continue;
          d1 = smooth2Digit[Math.floor(Math.random() * smooth2Digit.length)];
          d2 = smooth2Digit[Math.floor(Math.random() * smooth2Digit.length)];
          if (d2 === d1 || n1 === d1 || n1 === d2 || n2 === d1 || n2 === d2) continue;
        }

        const op = Math.random() < 0.5 ? '+' : 'âˆ’';
        let rawNum, rawDen;
        if (op === '+') { rawNum = n1 * d2 + n2 * d1; rawDen = d1 * d2; }
        else { rawNum = n1 * d2 - n2 * d1; rawDen = d1 * d2; if (rawNum <= 0) continue; }

        const g = gcd(rawNum, rawDen);
        const cNum = rawNum / g, cDen = rawDen / g;
        if (cNum === 0 || cNum === cDen) continue;

        const key = `${n1}/${d1} ${op} ${n2}/${d2}`;
        if (usedKeys.has(key)) continue;
        ok = true; usedKeys.add(key);
        question = { n1, d1, n2, d2, operation: op, correctNum: cNum, correctDen: cDen };
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
          for (let n = 1; n < d; n++) {
            if (!usedNums.has(n) && !denoms.includes(n)) possible.push(n);
          }
          if (possible.length === 0) { validFracs = false; break; }
          const n = possible[Math.floor(Math.random() * possible.length)];
          usedNums.add(n);
          fracs.push({ n, d });
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
      else if (cfg.type === 'division-to-fraction') {
        const a = Math.floor(Math.random() * 12) + 1;
        const b = Math.floor(Math.random() * 11) + 2;
        const key = `${a}Ã·${b}`;
        if (usedKeys.has(key)) continue;
        ok = true; usedKeys.add(key);
        question = { a, b, correctNum: a, correctDen: b };
      }
      else if (cfg.type === 'improper-to-decimal') {
        const [minNum, maxNum] = cfg.numRange || [2, 99];
        const [minDen, maxDen] = cfg.denRange || [2, 99];
        const den = Math.floor(Math.random() * (maxDen - minDen + 1)) + minDen;
        const num = Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;

        if (num <= den || num % den === 0) continue;
        const key = `${num}/${den}`;
        if (usedKeys.has(key)) continue;

        const presentation = Math.random() < 0.5 ? 'fraction' : 'division';
        ok = true; usedKeys.add(key);
        question = { num, den, presentation, correctStr: decimalString(num, den) };
      }
      else if (cfg.type === 'decimal-comparison') {
        const direction = Math.random() < 0.5 ? 'greatest' : 'smallest';
        let opts = [], correctStr = '';
        const subLevel = q + 1;

        if (cfg.mode === 'randomized-challenge') {
          const generators = [
            () => {
              const id = randInt(1, 9), h = randInt(7, 9), low = randInt(0, h - 1), m = randDigit(), n = randDigit(), p = randDigit();
              return buildQuestionLevel31([`${id}.${h}`, `${id}.${low}${m}`, `${id}.${low}${m}${n}`, `${id}.${low}${m}${n}${p}`], 1);
            },
            () => {
              const id = randInt(1, 9), nz = randInt(1, 9);
              return buildQuestionLevel31([`${id}.${nz}`, `${id}.0${nz}`, `${id}.00${nz}`, `${id}.000${nz}${randDigit()}`], 2);
            },
            () => {
              const id = randInt(1, 9), d = randInt(7, 9), d2 = d - 1;
              return buildQuestionLevel31([`${id}.0${d}${d}${d}`, `${id}.0${d}${d}${d}${d}`, `${id}.0${d}${d}${d}${d}${d}`, `${id}.0${d2}${d}${d}${d}${d}`], 3);
            },
            () => {
              const ip = randInt(10, 99), v = randInt(1, 9);
              return buildQuestionLevel31([`${ip}.${v}`, `${ip}.${v - 1}99`, `${ip}.${v - 1}9999`, `${ip}.${v}00000${randInt(1, 9)}`], 4);
            }
          ];
          const qObj = generators[q % generators.length]();
          if (!qObj) continue;
          const key = qObj.options.map(o => o.str).sort().join('|') + '|' + qObj.direction;
          if (usedKeys.has(key)) continue;
          ok = true; usedKeys.add(key);
          question = { options: qObj.options, direction: qObj.direction, correctStr: qObj.correctStr, level: subLevel };
        }
        else if (cfg.mode === 'unpredictable-traps') {
          const generators = [
            () => {
              const base = randInt(10, 60), w1 = base, d1 = `${base - 1}.${randInt(900, 999)}`, d2 = `${base}.${randInt(1, 9)}${randInt(10, 99)}`, w2 = base + randInt(1, 3);
              return buildQuestionLevel32([String(w1), d1, d2, String(w2)], 1);
            },
            () => {
              const base = randInt(5, 30), s1 = String(base), s2 = `${base - 1}.${randInt(9990, 9999)}`, s3 = `${base}.${randInt(1, 9)}`, s4 = `${base + 1}.${randInt(1, 9)}${randInt(10, 99)}`;
              return buildQuestionLevel32([s1, s2, s3, s4], 2);
            },
            () => {
              const base = randInt(10, 99), s1 = `${base}.${randInt(1, 9)}`, s2 = `${base - 1}.${randInt(900, 999)}`, s3 = `${base + 1}.${randInt(1, 9)}${randInt(10, 99)}`, s4 = `${base - 1}.${randInt(9000, 9999)}`;
              return buildQuestionLevel32([s1, s2, s3, s4], 3);
            }
          ];
          const qObj = generators[q % generators.length]();
          if (!qObj) continue;
          const key = qObj.options.map(o => o.str).sort().join('|') + '|' + qObj.direction;
          if (usedKeys.has(key)) continue;
          ok = true; usedKeys.add(key);
          question = { options: qObj.options, direction: qObj.direction, correctStr: qObj.correctStr, level: subLevel };
        }
        else if (cfg.mode === 'sub-1-traps') {
          const fmtWithZeros = f => Math.random() < 0.35 ? '.' + f : '0'.repeat(randInt(1, 4)) + '.' + f;
          const generators = [
            () => {
              const h = randInt(7, 9), low = randInt(1, h - 1);
              return buildQuestionLevel33([fmtWithZeros(String(h)), fmtWithZeros(`${low}${randDigit()}`), fmtWithZeros(`${low}${randDigit()}${randDigit()}`), fmtWithZeros(`${low}${randDigit()}${randDigit()}${randDigit()}`)]);
            },
            () => {
              const nz = randInt(1, 9);
              return buildQuestionLevel33([fmtWithZeros(`${nz}`), fmtWithZeros(`0${nz}`), fmtWithZeros(`00${nz}`), fmtWithZeros(`000${nz}${randDigit()}`)]);
            }
          ];
          const qObj = generators[q % generators.length]();
          if (!qObj) continue;
          const key = qObj.options.map(o => o.str).sort().join('|') + '|' + qObj.direction;
          if (usedKeys.has(key)) continue;
          ok = true; usedKeys.add(key);
          question = { options: qObj.options, direction: qObj.direction, correctStr: qObj.correctStr, level: subLevel };
        }
        else if (cfg.mode === 'whole-and-decimal-repr') {
          const randomDisplayFor = intStr => Math.random() < 0.45 ? '0'.repeat(randInt(0, 3)) + intStr : '0'.repeat(randInt(0, 3)) + intStr + '.' + '0'.repeat(randInt(1, 5));
          const base = randInt(90, 1100);
          const ints = [String(base), String(base - randInt(1, 3)), String(base + randInt(1, 3)), String(base + randInt(4, 9))];
          const qObj = buildQuestionLevel34(ints.map(randomDisplayFor));
          if (!qObj) continue;
          const key = qObj.options.map(o => o.str).sort().join('|') + '|' + qObj.direction;
          if (usedKeys.has(key)) continue;
          ok = true; usedKeys.add(key);
          question = { options: qObj.options, direction: qObj.direction, correctStr: qObj.correctStr, correctCanon: qObj.correctCanon, level: subLevel };
        }
        else if (cfg.mode === 'equal-lengths' || subLevel === 1) {
          const intDigits = Math.random() < 0.5 ? 1 : 2;
          const fracDigits = Math.random() < 0.5 ? 2 : 1;
          const nums = [];
          const seenStr = new Set(), seenVal = new Set();
          while (nums.length < 4) {
            const integerPart = Math.floor(Math.random() * Math.pow(10, intDigits));
            const fracPart = Math.floor(Math.random() * Math.pow(10, fracDigits));
            const display = String(integerPart).padStart(intDigits, '0') + '.' + String(fracPart).padStart(fracDigits, '0');
            const val = parseFloat(display);
            if (seenStr.has(display) || seenVal.has(val)) continue;
            seenStr.add(display); seenVal.add(val);
            nums.push({ display, val });
          }
          const sorted = [...nums].sort((a, b) => a.val - b.val);
          if (Math.abs(sorted[3].val - sorted[0].val) < 0.01) continue;
          opts = nums.map(n => ({ str: n.display, val: n.val }));
          correctStr = (direction === 'greatest' ? sorted[3] : sorted[0]).display;
          const key = opts.map(o => o.str).sort().join('|') + '|' + direction;
          if (usedKeys.has(key)) continue;
          ok = true; usedKeys.add(key);
          question = { options: opts, direction, correctStr, level: subLevel };
        }
        else if (cfg.mode === 'equal-frac-varied-int') {
          const fracLen = subLevel === 5 ? 4 : (subLevel === 3 ? 3 : 2);
          const fracs = [];
          while (fracs.length < 4) {
            let f = ''; for (let i = 0; i < fracLen; i++) f += String(randDigit());
            if (!fracs.includes(f)) fracs.push(f);
          }
          let ints = [];
          if (subLevel === 3) {
            const repDigit = randInt(1, 9);
            const repStr = String(repDigit).repeat(2) + '.' + String(repDigit).repeat(3);
            const bigInt = randInt(parseInt(String(repDigit).repeat(2), 10) + 1, 999);
            const bigStr = String(bigInt) + '.' + fracs[0];
            const f1 = String(randInt(1, 9)) + '.' + fracs[1];
            const f2 = String(randInt(10, 99)) + '.' + fracs[2];
            opts = shuffle([{ str: repStr }, { str: bigStr }, { str: f1 }, { str: f2 }]);
          } else {
            const one = String(randInt(1, 9));
            const two = String(randInt(10, 99));
            const three1 = String(randInt(100, 999));
            const three2 = '0' + String(randInt(10, 99));
            ints = shuffle([one, two, three1, three2]);
            opts = ints.map((ip, i) => ({ str: ip + '.' + fracs[i] }));
          }
          const sorted = [...opts].sort((x, y) => compareDecimalStrings(x.str, y.str));
          correctStr = (direction === 'greatest' ? sorted[3] : sorted[0]).str;
          const key = opts.map(o => o.str).sort().join('|') + '|' + direction;
          if (usedKeys.has(key)) continue;
          ok = true; usedKeys.add(key);
          question = { options: opts, direction, correctStr, level: subLevel };
        }
        else if (cfg.mode === 'equal-int-varied-frac') {
          const intLen = randInt(1, 2);
          let ip = String(randInt(1, 9));
          for (let i = 1; i < intLen; i++) ip += String(randDigit());
          const fracLens = shuffle([1, 2, 3, 4]);
          opts = fracLens.map(fl => {
            let f = ''; for (let i = 0; i < fl; i++) f += String(randDigit());
            return { str: ip + '.' + f };
          });
          const sorted = [...opts].sort((x, y) => compareDecimalStrings(x.str, y.str));
          correctStr = (direction === 'greatest' ? sorted[3] : sorted[0]).str;
          const key = opts.map(o => o.str).sort().join('|') + '|' + direction;
          if (usedKeys.has(key)) continue;
          ok = true; usedKeys.add(key);
          question = { options: opts, direction, correctStr, level: subLevel };
        }
      }
    }
    return ok ? question : null;
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
    const primesList = cfg.primes || [2, 3, 5];
    const smooth2Digit = validNumbers.filter(n => n >= 10 && n <= 99);
    const optCount = (cfg.options && cfg.options.count) ? cfg.options.count : 4;
    
    if (cfg.type === 'prime-factorization') {
      seen.add(correctQ.plain);
      let attempts = 0;
      while (distractors.length < optCount - 1 && attempts < 1000) {
        attempts++;
        const cand = validNumbers[Math.floor(Math.random() * validNumbers.length)];
        if (cand === correctQ.number) continue;
        const plain = primeFactorization(cand, primesList, false);
        if (seen.has(plain)) continue;
        seen.add(plain);
        distractors.push({ mathjax: primeFactorization(cand, primesList, true), plain });
      }
    } 
    else if (cfg.type === 'lcm' || cfg.type === 'hcf') {
      seen.add(correctQ.result);
      let attempts = 0;
      while (distractors.length < optCount - 1 && attempts < 1000) {
        attempts++;
        let cand = correctQ.result;
        const roll = Math.random();
        if (roll < 0.4) {
          const f = [2,3,4,5][Math.floor(Math.random() * 4)];
          cand = Math.random() < 0.5 ? correctQ.result * f : Math.floor(correctQ.result / f);
        } else { cand = correctQ.result + (Math.floor(Math.random() * 20) - 10); }
        if (cand <= 0 || seen.has(cand)) continue;
        seen.add(cand); distractors.push(cand);
      }
    }
    else if (['fraction', 'fraction-op', 'fraction-whole', 'fraction-add-sub', 'proper-fraction-add-sub'].includes(cfg.type)) {
      seen.add(correctQ.correctNum + '/' + correctQ.correctDen);
      let attempts = 0;
      while (distractors.length < optCount - 1 && attempts < 2000) {
        attempts++;
        let cNum, cDen;
        if (Math.random() < 0.6) {
          if (cfg.numbersType === '1-digit' || (cfg.type === 'fraction-whole' && cfg.operator === 'Ã—')) {
            cNum = Math.floor(Math.random() * 8) + 2; cDen = Math.floor(Math.random() * 8) + 2;
          } else if (cfg.numbersType === '2-digit' || cfg.numbersType === 'smooth-2digit-den') {
            const n = Math.floor(Math.random() * 9) + 1;
            const d = smooth2Digit[Math.floor(Math.random() * smooth2Digit.length)];
            cNum = n; cDen = d;
          } else {
            cNum = Math.floor(Math.random() * 99) + 1; cDen = Math.floor(Math.random() * 98) + 2;
          }
          if (cNum === cDen) continue;
          const g = gcd(cNum, cDen); cNum /= g; cDen /= g;
        } else {
          cNum = correctQ.correctNum; cDen = correctQ.correctDen;
          if (Math.random() < 0.5) cNum = Math.max(1, cNum + (Math.floor(Math.random() * 5) - 2));
          else cDen = Math.max(1, cDen + (Math.floor(Math.random() * 5) - 2));
          const g = gcd(cNum, cDen); cNum /= g; cDen /= g;
        }
        const key = cNum + '/' + cDen;
        if (seen.has(key) || (cNum === 1 && cDen === 1)) continue;
        seen.add(key); distractors.push({ num: cNum, den: cDen });
      }
      while (distractors.length < optCount - 1) {
        const n = Math.floor(Math.random() * 99) + 1;
        const d = Math.floor(Math.random() * 98) + 2;
        if (n === d) continue;
        const g = gcd(n, d);
        const fn = n / g, fd = d / g;
        if (fn === fd) continue;
        const key = fn + '/' + fd;
        if (seen.has(key)) continue;
        seen.add(key);
        distractors.push({ num: fn, den: fd });
      }
    }
    else if (cfg.type === 'order-4-fractions') {
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
        } else if (Math.random() < 0.8) {
          const base = correct.slice();
          let i = Math.floor(Math.random() * 4), j = Math.floor(Math.random() * 4);
          if (i === j) continue;
          [base[i], base[j]] = [base[j], base[i]];
          candidate = base;
        } else {
          candidate = shuffle(correct);
        }

        const key = candidate.map(f => `${f.n}/${f.d}`).join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({ order: candidate, isCorrect: false });
      }

      while (options.length < 4) {
        const candidate = shuffle(correct);
        const key = candidate.map(f => `${f.n}/${f.d}`).join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({ order: candidate, isCorrect: false });
      }
      return shuffle(options);
    }
    else if (cfg.type === 'division-to-fraction') {
      const { a, b } = correctQ;
      seen.add(a + '/' + b);
      const raw = [
        { num: b, den: a }, { num: a, den: a + b }, { num: a + b, den: b },
        { num: b, den: a + b }, { num: a + b, den: a },
        { num: Math.max(1, a - 1), den: b }, { num: a, den: Math.max(1, b - 1) },
        { num: b + 1, den: a + 1 }
      ];
      for (const c of raw) {
        if (c.num < 1 || c.den < 1) continue;
        const key = c.num + '/' + c.den;
        if (!seen.has(key)) { seen.add(key); distractors.push(c); }
        if (distractors.length >= 3) break;
      }
      let extra = 1;
      while (distractors.length < 3) {
        const c = { num: a + extra, den: b + extra };
        const key = c.num + '/' + c.den;
        if (!seen.has(key)) { seen.add(key); distractors.push(c); }
        extra++;
      }
    }
    else if (cfg.type === 'improper-to-decimal') {
      const { num, den } = correctQ;
      const correctVal = parseFloat(correctQ.correctStr);
      seen.add(correctQ.correctStr);

      const fracCands = [];
      if (den >= 2 && num <= 99) fracCands.push({ n: den, d: num });
      if (den + 1 <= 99) fracCands.push({ n: num, d: den + 1 });
      if (num - 1 >= 2) fracCands.push({ n: num - 1, d: den });
      if (num + 1 <= 99) fracCands.push({ n: num + 1, d: den });
      if (den - 1 >= 2) fracCands.push({ n: num, d: den - 1 });

      let attempts = 0;
      while (distractors.length < 3 && attempts < 1000) {
        attempts++;
        let candStr, candVal;
        const roll = Math.random();
        if (roll < 0.6 && fracCands.length > 0) {
          const idx = Math.floor(Math.random() * fracCands.length);
          const c = fracCands.splice(idx, 1)[0];
          if (c.n <= 0 || c.d <= 0 || c.d === 1 || c.n % c.d === 0) continue;
          candStr = decimalString(c.n, c.d);
          candVal = parseFloat(candStr);
        } else if (roll < 0.8) {
          const factor = Math.random() < 0.5 ? 10 : 0.1;
          candVal = parseFloat((correctVal * factor).toFixed(4));
          candStr = trimTrailingZeros(candVal.toFixed(4));
        } else {
          const delta = (Math.random() < 0.5 ? 1 : -1) * (Math.floor(Math.random() * 9) + 1) / 100;
          candVal = parseFloat((correctVal + delta).toFixed(4));
          candStr = trimTrailingZeros(candVal.toFixed(4));
        }

        if (!candStr || candVal <= 0 || candStr === correctQ.correctStr || seen.has(candStr)) continue;
        if (Number.isInteger(candVal) && candVal > 0 && candStr.indexOf('.') === -1) continue;
        seen.add(candStr); distractors.push(candStr);
      }

      let delta = 0.1;
      while (distractors.length < 3) {
        const v = parseFloat((correctVal + delta).toFixed(4));
        const s = trimTrailingZeros(v.toFixed(4));
        if (!seen.has(s) && v > 0) { seen.add(s); distractors.push(s); }
        delta += 0.1;
      }
      return shuffle([correctQ.correctStr, ...distractors]);
    }
    else if (cfg.type === 'decimal-comparison') {
      return shuffle(correctQ.options);
    }

    const correctOption = (['prime-factorization'].includes(cfg.type)) ? { mathjax: correctQ.mathjax, plain: correctQ.plain }
      : (['fraction', 'fraction-op', 'fraction-whole', 'fraction-add-sub', 'proper-fraction-add-sub', 'division-to-fraction'].includes(cfg.type)) ? { num: correctQ.correctNum, den: correctQ.correctDen }
      : correctQ.result;

    return shuffle([correctOption, ...distractors]);
  }

  function generateSingleStandardQuestion(cfg, poolA, poolB, usedNums) {
    const noReuse = cfg.uniqueness === 'no-reused-numbers';

    if (cfg.operandB && cfg.operandB.type === 'range') {
      const validDivisors = [];
      for (let d = cfg.operandB.min; d <= cfg.operandB.max; d++) {
        let skip = false;
        if (cfg.operandB.excludeMultiplesOf) {
          for (let ex of cfg.operandB.excludeMultiplesOf) { if (d % ex === 0) { skip = true; break; } }
        }
        if (!skip) validDivisors.push(d);
      }
      let divisor, dividend, ok = false, attempts = 0;
      while (!ok && attempts < 1000) {
        attempts++;
        divisor = validDivisors[Math.floor(Math.random() * validDivisors.length)];
        const quotient = poolA[Math.floor(Math.random() * poolA.length)];
        dividend = quotient * divisor;
        if (noReuse && (usedNums.has(quotient) || usedNums.has(divisor))) continue;
        ok = true;
      }
      if (!ok) return null;
      usedNums.add(dividend); usedNums.add(divisor);
      return { num1: dividend, num2: divisor, result: dividend / divisor };
    }

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
    const optCfg = cfg.options || {};
    const needCount = (optCfg.count || 4) - 1;
    const distractors = [];
    const seen = new Set([correctResult]);
    const [pLo, pHi] = optCfg.perturbRange  || [-100, 100];
    const [fLo, fHi] = optCfg.fallbackRange || [-1000, 1000];
    
    let attempts = 0;
    while (distractors.length < needCount && attempts < 1000) {
      attempts++;
      if (optCfg.distractorMode === 'derive-from-answer') {
        const strAns = String(correctResult);
        const len = strAns.length;
        const digitsPool = optCfg.answerDigits || [0,6,7,8,9];
        let candDigits = [];
        for (let i = 0; i < len; i++) {
          let d = digitsPool[Math.floor(Math.random() * digitsPool.length)];
          if (i === 0 && d === 0) d = digitsPool.filter(x => x !== 0)[0] || 6;
          candDigits.push(d);
        }
        if (optCfg.requireSpecificDigitInAnswer !== undefined && !candDigits.includes(optCfg.requireSpecificDigitInAnswer)) {
          candDigits[len - 1] = optCfg.requireSpecificDigitInAnswer;
        }
        const cand = Number(candDigits.join(''));
        if (cand <= 0 || seen.has(cand)) continue;
        seen.add(cand); distractors.push(cand);
      } else {
        const a = poolA[Math.floor(Math.random() * poolA.length)];
        const b = poolB[Math.floor(Math.random() * poolB.length)];
        let candidate = computeResult(a, b, cfg.operator);
        if (Math.random() < (optCfg.perturbChance || 0)) candidate += Math.floor(Math.random() * (pHi - pLo + 1)) + pLo;
        if (candidate <= 0 || seen.has(candidate)) continue;
        seen.add(candidate); distractors.push(candidate);
      }
    }
    while (distractors.length < needCount) {
      const delta = Math.floor(Math.random() * (fHi - fLo + 1)) + fLo;
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
      const primesList = cfg.primes || [2, 3, 5];
      for (let n = 2; n <= 999; n++) {
        if (is5Smooth(n, primesList)) validNums.push(n);
      }
      let attempts = 0;
      while (questions.length === 0 && attempts < 100) {
        const q = generateSpecialQuestions(cfg);
        if (q) questions = q;
        attempts++;
      }
      if (questions.length === 0) throw new Error('Could not generate questions.');
      optionsList = questions.map(qObj => buildSpecialOptions(qObj, cfg, validNums));
    } else {
      if (cfg.operandB && cfg.operandB.type === 'range') poolA = generateAllNumbers(cfg.operandA.operandB);
      else { poolA = generateAllNumbers(cfg.operandA); poolB = generateAllNumbers(cfg.operandB); }

      let attempts = 0;
      while (questions.length === 0 && attempts < 100) {
        const q = generateStandardQuestions(cfg, poolA, poolB);
        if (q) questions = q;
        attempts++;
      }
      if (questions.length === 0) throw new Error('Could not generate questions.');
      optionsList = questions.map(qObj => buildStandardOptions(qObj.result, cfg, poolA, poolB));
    }

    let state = { levelId: cfg.id, questions, currentIndex: 0, answers: new Array(totalQuestions).fill(null), optionsList, completed: false, score: 0 };
    const notify = () => { if (typeof onStateChange === 'function') { try { onStateChange(JSON.parse(JSON.stringify(state))); } catch (e) {} } };

    const studentName = (studentData && studentData.name) ? studentData.name : 'Student';
    const studentClass = (studentData && studentData.class) ? `Class ${studentData.class}` : '';
    const watermarkText = `${studentName} â€¢ ${studentClass} â€¢ Level ${cfg.id}`;

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
              <div class="qe-btn-group" style="margin-top:24px"><button class="qe-btn qe-try-again-btn">ðŸ”„ Try again</button></div>
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

    function regenerateCurrentSlot() {
      if (state.completed) return;
      const qi = state.currentIndex;
      if (qi >= totalQuestions) return;

      const usedKeys = new Set();
      let freshQ = null;
      if (specialTypes.includes(cfg.type)) {
        freshQ = generateSingleSpecialQuestion(cfg, qi, validNums, usedKeys);
        if (freshQ) {
          state.questions[qi] = freshQ;
          state.optionsList[qi] = buildSpecialOptions(freshQ, cfg, validNums);
          state.answers[qi] = null;
        }
      } else {
        freshQ = generateSingleStandardQuestion(cfg, poolA, poolB, usedKeys);
        if (freshQ) {
          state.questions[qi] = freshQ;
          state.optionsList[qi] = buildStandardOptions(freshQ.result, cfg, poolA, poolB);
          state.answers[qi] = null;
        }
      }
      renderQuestion();
      notify();
    }

    activeRegenerateCallback = regenerateCurrentSlot;

    let wasHiddenOrBlurred = false;
    function handleTabDeparture() {
      if (state.completed) return;
      if (document.hidden || !document.hasFocus()) {
        root.classList.add('qe-security-blur');
        if (!wasHiddenOrBlurred) {
          wasHiddenOrBlurred = true;
          regenerateCurrentSlot();
        }
      } else {
        wasHiddenOrBlurred = false;
        root.classList.remove('qe-security-blur');
      }
    }

    window.addEventListener('visibilitychange', handleTabDeparture);
    window.addEventListener('blur', handleTabDeparture);
    window.addEventListener('focus', handleTabDeparture);

    function renderQuestion() {
      if (state.completed) { renderResult(); return; }
      const qi = state.currentIndex;
      if (qi >= totalQuestions) { state.completed = true; renderResult(); return; }
      const q = state.questions[qi], opts = state.optionsList[qi], sel = state.answers[qi];
      badgeEl.textContent = `${qi + 1} / ${totalQuestions}`;
      statusEl.textContent = `Question ${qi + 1} of ${totalQuestions}`;

      if (cfg.type === 'prime-factorization') {
        qTextEl.innerHTML = cfg.questionTemplate.replace('{number}', `<span class="qe-number-highlight" style="font-weight:800;color:#1d5b4e;font-size:1.2em;background:#edf5ef;padding:2px 14px;border-radius:12px;border:1px solid #c8ddd0;">${q.number}</span>`);
      } else if (cfg.type === 'lcm') {
        const numStr = q.nums.map(n => `<span class="qe-number-highlight" style="font-weight:800;color:#1d5b4e;font-size:1.2em;background:#edf5ef;padding:2px 14px;border-radius:12px;border:1px solid #c8ddd0;">${n}</span>`).join(' and ');
        qTextEl.innerHTML = `Find the LCM of ${numStr}`;
      } else if (cfg.type === 'hcf') {
        const numStr = q.nums.map(n => `<span class="qe-number-highlight" style="font-weight:800;color:#1d5b4e;font-size:1.2em;background:#edf5ef;padding:2px 14px;border-radius:12px;border:1px solid #c8ddd0;">${n}</span>`).join(' and ');
        qTextEl.innerHTML = `Find the HCF of ${numStr}`;
      } else if (cfg.type === 'fraction') {
        const topText = cfg.hasExpression ? `${q.numF1} &times; ${q.numF2}` : `${q.num}`;
        const botText = cfg.hasExpression ? `${q.denF1} &times; ${q.denF2}` : `${q.den}`;
        qTextEl.innerHTML = `Reduce the fraction to its lowest form: <br><br><span style="display:inline-flex; flex-direction:column; align-items:center; font-size:clamp(28px, 6vh, 48px); font-weight:800; color:#1d5b4e; line-height:1.1; margin-top:10px;"><span style="border-bottom: 3px solid #123c35; padding: 0 15px 5px 15px;">${topText}</span><span style="padding: 5px 15px 0 15px;">${botText}</span></span>`;
      } else if (cfg.type === 'fraction-op') {
        const opSymbol = cfg.operator === 'Ã—' ? '&times;' : '&divide;';
        qTextEl.innerHTML = `Multiply/Divide and reduce to lowest form: <br><br><span style="display:inline-flex; align-items:center; font-size:clamp(24px, 5vh, 40px); font-weight:800; color:#1d5b4e; line-height:1.1; margin-top:10px;"><span style="display:inline-flex; flex-direction:column; align-items:center; margin: 0 10px;"><span style="border-bottom: 3px solid #123c35; padding: 0 15px 5px 15px;">${q.n1}</span><span style="padding: 5px 15px 0 15px;">${q.d1}</span></span><span style="margin: 0 10px;">${opSymbol}</span><span style="display:inline-flex; flex-direction:column; align-items:center; margin: 0 10px;"><span style="border-bottom: 3px solid #123c35; padding: 0 15px 5px 15px;">${q.n2}</span><span style="padding: 5px 15px 0 15px;">${q.d2}</span></span></span>`;
      } else if (cfg.type === 'fraction-whole') {
        const fractionHtml = `<span style="display:inline-flex; flex-direction:column; align-items:center; margin: 0 10px;"><span style="border-bottom: 3px solid #123c35; padding: 0 15px 5px 15px;">${q.numerator}</span><span style="padding: 5px 15px 0 15px;">${q.den}</span></span>`;
        const wholeHtml = `<span style="margin: 0 10px; font-size: clamp(28px, 6vh, 48px); font-weight:800; color:#1d5b4e;">${q.wholeNum}</span>`;
        const opSymbol = cfg.operator === 'Ã—' ? '&times;' : '&divide;';
        const exprHtml = q.isFractionFirst ? fractionHtml + `<span style="margin:0 10px;">${opSymbol}</span>` + wholeHtml : wholeHtml + `<span style="margin:0 10px;">${opSymbol}</span>` + fractionHtml;
        qTextEl.innerHTML = `Multiply/Divide and reduce to lowest form: <br><br><span style="display:inline-flex; align-items:center; font-size:clamp(28px, 6vh, 48px); font-weight:800; color:#1d5b4e; line-height:1.1; margin-top:10px;">${exprHtml}</span>`;
      } else if (cfg.type === 'fraction-add-sub' || cfg.type === 'proper-fraction-add-sub') {
        const opSymbol = q.operation || '+';
        qTextEl.innerHTML = `<span style="display:inline-flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:8px;"><span style="display:inline-flex; flex-direction:column; align-items:center; font-size:clamp(24px,5vh,40px); font-weight:800; color:#1d5b4e; line-height:1.1;"><span style="border-bottom:3px solid #123c35; padding:0 12px 4px 12px;">${q.n1}</span><span style="padding:4px 12px 0 12px;">${q.d1 || q.d}</span></span><span style="font-size:clamp(28px,5vh,44px); font-weight:300; margin:0 6px;">${opSymbol}</span><span style="display:inline-flex; flex-direction:column; align-items:center; font-size:clamp(24px,5vh,40px); font-weight:800; color:#1d5b4e; line-height:1.1;"><span style="border-bottom:3px solid #123c35; padding:0 12px 4px 12px;">${q.n2}</span><span style="padding:4px 12px 0 12px;">${q.d2 || q.d}</span></span><span style="font-size:clamp(24px,5vh,40px); font-weight:700; margin-left:8px; color:#123c35;">= ?</span></span>`;
      } else if (cfg.type === 'order-4-fractions') {
        let listHTML = '<div style="display:flex; flex-wrap:wrap; justify-content:center; gap:clamp(10px,2vw,18px); margin:6px 0 4px 0;">';
        q.fractions.forEach((f, i) => {
          if (i > 0) listHTML += `<span style="font-weight:900; color:#66736e; align-self:center; font-size:clamp(20px, 3.5vh, 30px);">,</span>`;
          listHTML += `<span style="display:inline-flex; flex-direction:column; align-items:center; font-weight:800; color:#1d5b4e; font-size:clamp(22px,4vh,34px); line-height:1.05;"><span style="border-bottom:3px solid #123c35; padding:0 12px 3px 12px;">${f.n}</span><span style="padding:3px 12px 0 12px;">${f.d}</span></span>`;
        });
        listHTML += '</div>';
        qTextEl.innerHTML = `<div style="text-align:center;"><span style="display:inline-block; background:#e7b95b; color:#3d2f10; font-weight:900; font-size:clamp(11px,1.6vh,13px); padding:4px 14px; border-radius:30px; margin-bottom:12px; letter-spacing:0.4px; text-transform:uppercase;">${q.direction === 'asc' ? 'Ascending order' : 'Descending order'}</span></div>` + listHTML + `<div style="font-size:clamp(14px,2vh,18px); margin-top:10px; color:#66736e; font-weight:600;">Which option shows them in ${q.direction === 'asc' ? 'ascending' : 'descending'} order?</div>`;
      } else if (cfg.type === 'division-to-fraction') {
        qTextEl.innerHTML = `<div style="margin-bottom:12px; font-size:clamp(15px,2.2vh,19px); color:#66736e; font-weight:700;">Write the division as a fraction:</div><div style="display:inline-flex; align-items:center; gap:10px; font-size:clamp(26px,5vh,42px); font-weight:800; color:#1d5b4e;"><span>${q.a}</span><span style="font-weight:400; color:#123c35;">Ã·</span><span>${q.b}</span><span style="font-weight:400; color:#123c35;">=</span><span>?</span></div>`;
      } else if (cfg.type === 'improper-to-decimal') {
        const promptHTML = `<div style="font-size:clamp(14px, 2.1vh, 18px); color:#66736e; font-weight:700; margin-bottom:0px;">Convert to a decimal:</div>`;
        let exprHTML;
        if (q.presentation === 'fraction') {
          exprHTML = `<div style="display:flex; justify-content:center; align-items:center; margin-top:12px;"><span style="display:inline-flex; flex-direction:column; align-items:center; line-height:1.05; font-weight:800; font-size:clamp(30px,5.5vh,48px); color:#1d5b4e;"><span style="border-bottom:3px solid currentColor; padding:0 10px 2px 10px;">${q.num}</span><span style="padding:3px 10px 0 10px;">${q.den}</span></span><span style="font-size:clamp(28px,5vh,44px); font-weight:700; margin-left:14px; color:#123c35;">= ?</span></div>`;
        } else {
          exprHTML = `<div style="display:block; font-size:clamp(26px, 5vh, 42px); font-weight:800; color:#1d5b4e; margin-top:12px;"><div style="display:inline-flex; align-items:center; gap:10px;"><span>${q.num}</span><span style="font-weight:400; color:#123c35;">Ã·</span><span>${q.den}</span><span style="font-weight:400; color:#123c35;">=</span><span>?</span></div></div>`;
        }
        qTextEl.innerHTML = promptHTML + exprHTML;
      } else if (cfg.type === 'decimal-comparison') {
        let listHTML = '<div style="display:flex; flex-wrap:wrap; justify-content:center; gap:clamp(10px, 2vw, 16px); margin-top:8px;">';
        q.options.forEach((opt) => {
          listHTML += `<span style="background:#f2f7f1; border:2px solid #d3e0d5; border-radius:12px; padding:10px 18px; font-size:clamp(18px, 3.2vh, 28px); font-weight:800; color:#1d5b4e; font-family:'Courier New', monospace; letter-spacing:1.5px; word-break:break-all;">${opt.str}</span>`;
        });
        listHTML += '</div>';
        const badgeText = q.direction === 'greatest' ? 'â¬† Select the Greatest' : 'â¬‡ Select the Smallest';
        qTextEl.innerHTML = `<div style="text-align:center;"><span style="display:inline-block; background:#e7b95b; color:#3d2f10; font-weight:900; font-size:clamp(12px, 1.8vh, 15px); padding:5px 18px; border-radius:30px; margin-bottom:12px; letter-spacing:0.5px; text-transform:uppercase;">${badgeText}</span></div>` + listHTML + `<div style="font-size:clamp(14px,2.1vh,18px); margin-top:14px; color:#66736e; font-weight:700;">Which one is the ${q.direction} number?</div>`;
      } else {
        qTextEl.innerHTML = `<div style="display:inline-flex; align-items:center; gap:12px;"><span class="qe-operand">${q.num1}</span><span class="qe-op">${cfg.operator}</span><span class="qe-operand">${q.num2}</span><span class="qe-eq">=</span><span class="qe-qmark">?</span></div>`;
      }

      optionsGrid.innerHTML = '';
      opts.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'qe-option-btn';
        if (sel === idx) btn.classList.add('qe-selected');
        
        if (cfg.type === 'prime-factorization') {
          btn.innerHTML = opt.mathjax;
        } else if (['fraction', 'fraction-op', 'fraction-whole', 'fraction-add-sub', 'proper-fraction-add-sub', 'division-to-fraction'].includes(cfg.type)) {
          btn.innerHTML = `<span style="display:inline-flex; flex-direction:column; align-items:center; line-height:1.1;"><span style="border-bottom: 2px solid currentColor; padding: 0 8px 2px 8px;">${opt.num}</span><span style="padding: 2px 8px 0 8px;">${opt.den}</span></span>`;
        } else if (cfg.type === 'order-4-fractions') {
          let html = '<span style="display:inline-flex; align-items:center; flex-wrap:wrap; justify-content:center; gap:6px; font-size:clamp(15px, 2.4vh, 20px);">';
          opt.order.forEach((f, i) => {
            if (i > 0) html += '<span style="font-weight:900; color:#66736e; font-size:0.9em;">,</span>';
            html += `<span style="display:inline-flex; flex-direction:column; align-items:center; line-height:1.05; font-weight:800; color:#1d5b4e; margin:0 1px;"><span style="border-bottom:2px solid currentColor; padding:0 5px 1px 5px;">${f.n}</span><span style="padding:1px 5px 0 5px;">${f.d}</span></span>`;
          });
          html += '</span>';
          btn.innerHTML = html;
        } else if (cfg.type === 'improper-to-decimal') {
          btn.textContent = opt;
        } else if (cfg.type === 'decimal-comparison') {
          btn.textContent = opt.str;
          btn.style.fontFamily = "'Courier New', monospace";
          btn.style.letterSpacing = '1px';
        } else {
          btn.textContent = opt;
        }

        btn.addEventListener('click', () => {
          if (state.completed) return;
          state.answers[qi] = idx;
          optionsGrid.querySelectorAll('.qe-option-btn').forEach(b => b.classList.remove('qe-selected'));
          btn.classList.add('qe-selected');
          submitBtn.disabled = false;
          submitBtn.textContent = (qi < totalQuestions - 1) ? 'Next question â†’' : 'Submit quiz âœ“';
          notify();
        });
        optionsGrid.appendChild(btn);
      });

      if (['prime-factorization', 'lcm', 'hcf'].includes(cfg.type) && window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([optionsGrid]).catch(err => console.log('MathJax error:', err));
      }

      const hasSel = state.answers[qi] !== null && state.answers[qi] !== undefined;
      submitBtn.disabled = !hasSel;
      submitBtn.textContent = hasSel ? ((qi < totalQuestions - 1) ? 'Next question â†’' : 'Submit quiz âœ“') : 'Submit answer';
      qViewEl.classList.remove('qe-hide'); rViewEl.classList.add('qe-hide');
    }

    function finalize() {
      let score = 0;
      state.questions.forEach((q, idx) => {
        const chosenOpt = state.optionsList[idx][state.answers[idx]];
        if (cfg.type === 'prime-factorization') { if (chosenOpt && chosenOpt.plain === q.plain) score++; }
        else if (['fraction', 'fraction-op', 'fraction-whole', 'fraction-add-sub', 'proper-fraction-add-sub', 'division-to-fraction'].includes(cfg.type)) { if (chosenOpt && chosenOpt.num === q.correctNum && chosenOpt.den === q.correctDen) score++; }
        else if (cfg.type === 'order-4-fractions') { if (chosenOpt && chosenOpt.isCorrect) score++; }
        else if (cfg.type === 'improper-to-decimal') { if (chosenOpt === q.correctStr) score++; }
        else if (cfg.type === 'decimal-comparison') {
          if (cfg.mode === 'whole-and-decimal-repr') {
            if (chosenOpt && chosenOpt.canon === q.correctCanon) score++;
          } else {
            if (chosenOpt && chosenOpt.str === q.correctStr) score++;
          }
        }
        else if (cfg.type === 'lcm' || cfg.type === 'hcf') { if (chosenOpt === q.result) score++; }
        else { if (chosenOpt === q.result) score++; }
      });
      state.score = score;
      state.completed = true;
      renderResult();
      notify();
      if (typeof onFinished === 'function') { try { onFinished(score, totalQuestions); } catch (e) { console.error(e); } }
    }

    function renderResult() {
      qViewEl.classList.add('qe-hide'); rViewEl.classList.remove('qe-hide');
      scoreBigEl.innerHTML = `${state.score}<small>/${totalQuestions}</small>`;
      if (state.score === totalQuestions) {
        scoreMsgEl.style.display = 'none'; scoreMsgEl.textContent = '';
        congratsEl.classList.remove('qe-hide'); congratsEl.textContent = `ðŸŽ‰ Congratulations! Perfect ${totalQuestions}/${totalQuestions}!`;
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
      if (!freshQuestions) return;
      state = { levelId: cfg.id, questions: freshQuestions, currentIndex: 0, answers: new Array(totalQuestions).fill(null), optionsList: freshOptionsList, completed: false, score: 0 };
      notify(); renderQuestion();
    });

    renderQuestion();
    notify();

    return {
      getState: () => JSON.parse(JSON.stringify(state)),
      destroy: () => {
        activeRegenerateCallback = null;
        window.removeEventListener('visibilitychange', handleTabDeparture);
        window.removeEventListener('blur', handleTabDeparture);
        window.removeEventListener('focus', handleTabDeparture);
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
