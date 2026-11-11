window.QuizEngine = (function () {
  'use strict';

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
    if (cfg.type === 'range') return [];
    const { digits, allowedDigits, distinctDigits, requireSpecificDigit, firstDigitExclude } = cfg;
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

  function is5Smooth(n, primes) {
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

  function generateSpecialQuestions(cfg) {
    let validNumbers = [];
    if (cfg.primes) {
      for (let n = 2; n <= 999; n++) {
        if (is5Smooth(n, cfg.primes)) validNumbers.push(n);
      }
    }

    const noReuse = cfg.uniqueness === 'no-reused-numbers';
    const usedKeys = new Set();
    const questions = [];

    for (let q = 0; q < cfg.questionCount; q++) {
      let question, ok = false, attempts = 0;
      while (!ok && attempts < 5000) {
        attempts++;
        
        if (cfg.type === 'prime-factorization') {
          const min = cfg.minNumber || 10, max = cfg.maxNumber || 99;
          const pool = validNumbers.filter(n => n >= min && n <= max);
          const number = pool[Math.floor(Math.random() * pool.length)];
          if (noReuse && usedKeys.has(number)) continue;
          ok = true; usedKeys.add(number);
          question = { number, mathjax: primeFactorization(number, cfg.primes, true), plain: primeFactorization(number, cfg.primes, false) };
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
            n1 = validNumbers[Math.floor(Math.random() * validNumbers.length)];
            d1 = validNumbers[Math.floor(Math.random() * validNumbers.length)];
            n2 = validNumbers[Math.floor(Math.random() * validNumbers.length)];
            d2 = validNumbers[Math.floor(Math.random() * validNumbers.length)];
          }
          if (n1 === d1 || n2 === d2) continue;
          const key = `${n1}/${d1} ${cfg.operator} ${n2}/${d2}`;
          if (noReuse && usedKeys.has(key)) continue;
          let rawNum, rawDen;
          if (cfg.operator === '×') { rawNum = n1 * n2; rawDen = d1 * d2; }
          else { rawNum = n1 * d2; rawDen = d1 * n2; }
          const g = gcd(rawNum, rawDen);
          const cNum = rawNum / g, cDen = rawDen / g;
          if (cNum === 1 && cDen === 1) continue;
          ok = true; usedKeys.add(key);
          question = { n1, d1, n2, d2, correctNum: cNum, correctDen: cDen };
        }
        else if (cfg.type === 'fraction-whole') {
          const smooth2 = validNumbers.filter(n => n >= 10 && n <= 99);
          const smooth3 = validNumbers.filter(n => n >= 100 && n <= 999);
          
          let den, wholeNum, numerator = 1, foundNum = false;
          
          if (cfg.operator === '×') {
            const denPool = Math.random() < 0.5 ? smooth2 : smooth3;
            den = denPool[Math.floor(Math.random() * denPool.length)];
            wholeNum = Math.floor(Math.random() * 11) + 2;

            for (let attemptNum = 0; attemptNum < 1000; attemptNum++) {
              const candidateNum = Math.floor(Math.random() * 90) + 10;
              const product = candidateNum * wholeNum;
              if ((product >= 10 && product <= 999) && is5Smooth(product, cfg.primes)) {
                numerator = candidateNum; foundNum = true; break;
              }
            }
            if (!foundNum) {
              const ansPool = Math.random() < 0.5 ? smooth2 : smooth3;
              const ans = ansPool[Math.floor(Math.random() * ansPool.length)];
              const factors = getFactors(ans);
              const possibleWholes = factors.filter(f => f >= 2 && f <= 12);
              if (possibleWholes.length > 0) {
                wholeNum = possibleWholes[Math.floor(Math.random() * possibleWholes.length)];
                numerator = ans / wholeNum; foundNum = true;
              }
            }
          } else {
            const comp1 = validNumbers.filter(n => n >= 2 && n <= 9 && ![2,3,5].includes(n));
            const comp2 = smooth2;
            const denPool = Math.random() < 0.5 ? comp1 : comp2;
            const wholePool = Math.random() < 0.5 ? comp1 : comp2;
            const numPool = Math.random() < 0.5 ? comp1 : comp2;
            den = denPool[Math.floor(Math.random() * denPool.length)];
            wholeNum = wholePool[Math.floor(Math.random() * wholePool.length)];
            numerator = numPool[Math.floor(Math.random() * numPool.length)];
            foundNum = true;
          }
          if (!foundNum) continue;
          if (gcd(numerator, den) === den) continue; 

          const isFractionFirst = Math.random() < 0.5;
          const key = `${isFractionFirst ? 'F' : 'W'}${wholeNum}-${numerator}/${den}`;
          if (noReuse && usedKeys.has(key)) continue;

          let rawNum, rawDen;
          if (cfg.operator === '×') { rawNum = numerator * wholeNum; rawDen = den; }
          else {
            if (isFractionFirst) { rawNum = numerator; rawDen = den * wholeNum; }
            else { rawNum = wholeNum * den; rawDen = numerator; }
          }
          const g = gcd(rawNum, rawDen);
          ok = true; usedKeys.add(key);
          question = { wholeNum, numerator, den, isFractionFirst, correctNum: rawNum / g, correctDen: rawDen / g };
        }
        else if (cfg.type === 'fraction-add-sub') {
          const max = cfg.numbersType === '1-digit' ? 9 : 99;
          const d = Math.floor(Math.random() * (max - 2)) + 2;
          let n1, n2;
          if (cfg.numbersType === '1-digit') {
            const cands = []; for(let i=1; i<=9; i++) if(i !== d) cands.push(i);
            n1 = cands[Math.floor(Math.random() * cands.length)];
            do { n2 = cands[Math.floor(Math.random() * cands.length)]; } while (n1 === n2);
          } else {
            n1 = Math.floor(Math.random() * 99) + 1; if (n1 === d) continue;
            n2 = Math.floor(Math.random() * 99) + 1; if (n2 === d || n2 === n1) continue;
          }
          const op = Math.random() < 0.5 ? '+' : '−';
          const rawNum = op === '+' ? n1 + n2 : n1 - n2;
          if (rawNum <= 0) continue;
          const g = gcd(rawNum, d);
          if (rawNum / g === d / g) continue;
          const key = `${n1}/${d} ${op} ${n2}/${d}`;
          if (noReuse && usedKeys.has(key)) continue;
          ok = true; usedKeys.add(key);
          question = { n1, n2, d, operation: op, correctNum: rawNum / g, correctDen: d / g };
        }
      }
      if (!ok) return null;
      questions.push(question);
    }
    return questions;
  }

  function buildSpecialOptions(correctQ, cfg, validNumbers) {
    const distractors = [];
    const seen = new Set();
    
    if (cfg.type === 'prime-factorization') {
      seen.add(correctQ.plain);
      let attempts = 0;
      while (distractors.length < cfg.options.count - 1 && attempts < 3000) {
        attempts++;
        const cand = validNumbers[Math.floor(Math.random() * validNumbers.length)];
        if (cand === correctQ.number) continue;
        const plain = primeFactorization(cand, cfg.primes, false);
        if (seen.has(plain)) continue;
        seen.add(plain);
        distractors.push({ mathjax: primeFactorization(cand, cfg.primes, true), plain });
      }
    } 
    else if (cfg.type === 'lcm' || cfg.type === 'hcf') {
      seen.add(correctQ.result);
      let attempts = 0;
      while (distractors.length < cfg.options.count - 1 && attempts < 3000) {
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
    else if (cfg.type === 'fraction') {
      seen.add(correctQ.correctNum + '/' + correctQ.correctDen);
      let attempts = 0;
      while (distractors.length < cfg.options.count - 1 && attempts < 3000) {
        attempts++;
        let cNum = correctQ.correctNum, cDen = correctQ.correctDen;
        if (Math.random() < 0.5) cNum = Math.max(1, cNum + (Math.floor(Math.random() * 5) - 2));
        else cDen = Math.max(1, cDen + (Math.floor(Math.random() * 5) - 2));
        const g = gcd(cNum, cDen); cNum /= g; cDen /= g;
        const key = cNum + '/' + cDen;
        if (seen.has(key)) continue;
        seen.add(key); distractors.push({ num: cNum, den: cDen });
      }
    }
    else if (['fraction-op', 'fraction-whole', 'fraction-add-sub'].includes(cfg.type)) {
      seen.add(correctQ.correctNum + '/' + correctQ.correctDen);
      let attempts = 0;
      while (distractors.length < cfg.options.count - 1 && attempts < 3000) {
        attempts++;
        let cNum, cDen;
        if (Math.random() < 0.6) {
          if (cfg.numbersType === '1-digit' || cfg.type === 'fraction-whole') {
            cNum = Math.floor(Math.random() * 8) + 2; cDen = Math.floor(Math.random() * 8) + 2;
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
    }

    const correctOption = (['prime-factorization'].includes(cfg.type)) ? { mathjax: correctQ.mathjax, plain: correctQ.plain }
      : (['fraction', 'fraction-op', 'fraction-whole', 'fraction-add-sub'].includes(cfg.type)) ? { num: correctQ.correctNum, den: correctQ.correctDen }
      : correctQ.result;

    const options = [correctOption, ...distractors];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return options;
  }

  function generateStandardQuestions(cfg, poolA, poolB) {
    const noReuse = cfg.uniqueness === 'no-reused-numbers';
    const usedNums = new Set();
    const questions = [];

    if (cfg.operandB.type === 'range') {
      const validDivisors = [];
      for (let d = cfg.operandB.min; d <= cfg.operandB.max; d++) {
        let skip = false;
        for (let ex of cfg.operandB.excludeMultiplesOf) { if (d % ex === 0) { skip = true; break; } }
        if (!skip) validDivisors.push(d);
      }
      for (let q = 0; q < cfg.questionCount; q++) {
        let divisor, dividend, ok = false, attempts = 0;
        while (!ok && attempts < 5000) {
          attempts++;
          divisor = validDivisors[Math.floor(Math.random() * validDivisors.length)];
          const quotient = poolA[Math.floor(Math.random() * poolA.length)];
          dividend = quotient * divisor;
          if (noReuse && (usedNums.has(quotient) || usedNums.has(divisor))) continue;
          ok = true;
        }
        if (!ok) return null;
        usedNums.add(dividend); usedNums.add(divisor);
        questions.push({ num1: dividend, num2: divisor, result: dividend / divisor });
      }
      return questions;
    }

    for (let q = 0; q < cfg.questionCount; q++) {
      let num1, num2, ok = false, attempts = 0;
      while (!ok && attempts < 5000) {
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
      if (result <= 0) { q--; continue; }
      questions.push({ num1, num2, result });
    }
    return questions;
  }

  function buildStandardOptions(correctResult, cfg, poolA, poolB) {
    const optCfg = cfg.options;
    const needCount = (optCfg.count || 4) - 1;
    const distractors = [];
    const seen = new Set([correctResult]);
    const [pLo, pHi] = optCfg.perturbRange  || [-100, 100];
    const [fLo, fHi] = optCfg.fallbackRange || [-1000, 1000];
    
    let attempts = 0;
    while (distractors.length < needCount && attempts < 3000) {
      attempts++;
      const a = poolA[Math.floor(Math.random() * poolA.length)];
      const b = poolB[Math.floor(Math.random() * poolB.length)];
      let candidate = computeResult(a, b, cfg.operator);
      if (Math.random() < (optCfg.perturbChance || 0)) candidate += Math.floor(Math.random() * (pHi - pLo + 1)) + pLo;
      if (candidate <= 0 || seen.has(candidate)) continue;
      seen.add(candidate); distractors.push(candidate);
    }
    while (distractors.length < needCount) {
      const delta = Math.floor(Math.random() * (fHi - fLo + 1)) + fLo;
      const candidate = Math.max(1, correctResult + delta);
      if (seen.has(candidate)) continue;
      seen.add(candidate); distractors.push(candidate);
    }
    const options = [correctResult, ...distractors];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return options;
  }

  function createController(levelConfig, hostEl, onFinished, onStateChange) {
    const cfg = levelConfig;
    const totalQuestions = cfg.questionCount;
    let questions = [], optionsList = [], poolA = [], poolB = [], validNums = [];
    const specialTypes = ['prime-factorization', 'lcm', 'hcf', 'fraction', 'fraction-op', 'fraction-whole', 'fraction-add-sub'];
    
    if (specialTypes.includes(cfg.type)) {
      loadMathJax();
      if (cfg.primes) {
        for (let n = 2; n <= 999; n++) {
          if (is5Smooth(n, cfg.primes)) validNums.push(n);
        }
      }
      let attempts = 0;
      while (questions.length === 0 && attempts < 300) {
        const q = generateSpecialQuestions(cfg);
        if (q) questions = q;
        attempts++;
      }
      if (questions.length === 0) throw new Error('Could not generate questions.');
      optionsList = questions.map(q => buildSpecialOptions(q, cfg, validNums));
    } else {
      if (cfg.operandB.type === 'range') poolA = generateAllNumbers(cfg.operandA.operandB);
      else { poolA = generateAllNumbers(cfg.operandA); poolB = generateAllNumbers(cfg.operandB); }

      let attempts = 0;
      while (questions.length === 0 && attempts < 300) {
        const q = generateStandardQuestions(cfg, poolA, poolB);
        if (q) questions = q;
        attempts++;
      }
      if (questions.length === 0) throw new Error('Could not generate questions.');
      optionsList = questions.map(q => buildStandardOptions(q.result, cfg, poolA, poolB));
    }

    let state = { levelId: cfg.id, questions, currentIndex: 0, answers: new Array(totalQuestions).fill(null), optionsList, completed: false, score: 0 };
    const notify = () => { if (typeof onStateChange === 'function') { try { onStateChange(JSON.parse(JSON.stringify(state))); } catch (e) {} } };

    hostEl.innerHTML = `
      <div class="qe-root">
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
      </div>`;
    const root = hostEl.querySelector('.qe-root');
    const titleEl = root.querySelector('.qe-title'), statusEl = root.querySelector('.qe-status'), badgeEl = root.querySelector('.qe-progress-badge');
    const qViewEl = root.querySelector('.qe-question-view'), rViewEl = root.querySelector('.qe-result-view');
    const qTextEl = root.querySelector('.qe-question-text'), optionsGrid = root.querySelector('.qe-options-grid'), submitBtn = root.querySelector('.qe-submit-btn');
    const scoreBigEl = root.querySelector('.qe-score-big'), scoreMsgEl = root.querySelector('.qe-score-message'), congratsEl = root.querySelector('.qe-congrats'), tryAgainBtn = root.querySelector('.qe-try-again-btn');
    titleEl.textContent = cfg.title || 'Quiz';

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
        const opSymbol = cfg.operator === '×' ? '&times;' : '&divide;';
        qTextEl.innerHTML = `Multiply/Divide and reduce to lowest form: <br><br><span style="display:inline-flex; align-items:center; font-size:clamp(24px, 5vh, 40px); font-weight:800; color:#1d5b4e; line-height:1.1; margin-top:10px;"><span style="display:inline-flex; flex-direction:column; align-items:center; margin: 0 10px;"><span style="border-bottom: 3px solid #123c35; padding: 0 15px 5px 15px;">${q.n1}</span><span style="padding: 5px 15px 0 15px;">${q.d1}</span></span><span style="margin: 0 10px;">${opSymbol}</span><span style="display:inline-flex; flex-direction:column; align-items:center; margin: 0 10px;"><span style="border-bottom: 3px solid #123c35; padding: 0 15px 5px 15px;">${q.n2}</span><span style="padding: 5px 15px 0 15px;">${q.d2}</span></span></span>`;
      } else if (cfg.type === 'fraction-whole') {
        const fractionHtml = `<span style="display:inline-flex; flex-direction:column; align-items:center; margin: 0 10px;"><span style="border-bottom: 3px solid #123c35; padding: 0 15px 5px 15px;">${q.numerator}</span><span style="padding: 5px 15px 0 15px;">${q.den}</span></span>`;
        const wholeHtml = `<span style="margin: 0 10px; font-size: clamp(28px, 6vh, 48px); font-weight:800; color:#1d5b4e;">${q.wholeNum}</span>`;
        const opSymbol = cfg.operator === '×' ? '&times;' : '&divide;';
        const exprHtml = q.isFractionFirst ? fractionHtml + `<span style="margin:0 10px;">${opSymbol}</span>` + wholeHtml : wholeHtml + `<span style="margin:0 10px;">${opSymbol}</span>` + fractionHtml;
        qTextEl.innerHTML = `Multiply/Divide and reduce to lowest form: <br><br><span style="display:inline-flex; align-items:center; font-size:clamp(28px, 6vh, 48px); font-weight:800; color:#1d5b4e; line-height:1.1; margin-top:10px;">${exprHtml}</span>`;
      } else if (cfg.type === 'fraction-add-sub') {
        qTextEl.innerHTML = `<span style="display:inline-flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:8px;"><span style="display:inline-flex; flex-direction:column; align-items:center; font-size:clamp(24px,5vh,40px); font-weight:800; color:#1d5b4e; line-height:1.1;"><span style="border-bottom:3px solid #123c35; padding:0 12px 4px 12px;">${q.n1}</span><span style="padding:4px 12px 0 12px;">${q.d}</span></span><span style="font-size:clamp(28px,5vh,44px); font-weight:300; margin:0 6px;">${q.operation}</span><span style="display:inline-flex; flex-direction:column; align-items:center; font-size:clamp(24px,5vh,40px); font-weight:800; color:#1d5b4e; line-height:1.1;"><span style="border-bottom:3px solid #123c35; padding:0 12px 4px 12px;">${q.n2}</span><span style="padding:4px 12px 0 12px;">${q.d}</span></span><span style="font-size:clamp(24px,5vh,40px); font-weight:700; margin-left:8px; color:#123c35;">= ?</span></span>`;
      } else {
        qTextEl.innerHTML = `<span class="qe-operand">${q.num1}</span><span class="qe-op">${cfg.operator}</span><span class="qe-operand">${q.num2}</span><span class="qe-eq">=</span><span class="qe-qmark">?</span>`;
      }

      optionsGrid.innerHTML = '';
      opts.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'qe-option-btn';
        if (sel === idx) btn.classList.add('qe-selected');
        
        if (cfg.type === 'prime-factorization') {
          btn.innerHTML = opt.mathjax;
        } else if (['fraction', 'fraction-op', 'fraction-whole', 'fraction-add-sub'].includes(cfg.type)) {
          btn.innerHTML = `<span style="display:inline-flex; flex-direction:column; align-items:center; line-height:1.1;"><span style="border-bottom: 2px solid currentColor; padding: 0 8px 2px 8px;">${opt.num}</span><span style="padding: 2px 8px 0 8px;">${opt.den}</span></span>`;
        } else {
          btn.textContent = opt;
        }

        btn.addEventListener('click', () => {
          if (state.completed) return;
          state.answers[qi] = idx;
          optionsGrid.querySelectorAll('.qe-option-btn').forEach(b => b.classList.remove('qe-selected'));
          btn.classList.add('qe-selected');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Next question →';
          notify();
        });
        optionsGrid.appendChild(btn);
      });

      if (['prime-factorization', 'lcm', 'hcf'].includes(cfg.type) && window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([optionsGrid]).catch(err => console.log('MathJax error:', err));
      }

      const hasSel = state.answers[qi] !== null && state.answers[qi] !== undefined;
      submitBtn.disabled = !hasSel;
      submitBtn.textContent = hasSel ? 'Next question →' : 'Submit answer';
      qViewEl.classList.remove('qe-hide'); rViewEl.classList.add('qe-hide');
    }

    function finalize() {
      let score = 0;
      state.questions.forEach((q, idx) => {
        const chosenOpt = state.optionsList[idx][state.answers[idx]];
        if (cfg.type === 'prime-factorization') { if (chosenOpt && chosenOpt.plain === q.plain) score++; }
        else if (['fraction', 'fraction-op', 'fraction-whole', 'fraction-add-sub'].includes(cfg.type)) { if (chosenOpt && chosenOpt.num === q.correctNum && chosenOpt.den === q.correctDen) score++; }
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
    return { getState: () => JSON.parse(JSON.stringify(state)), destroy: () => { hostEl.innerHTML = ''; } };
  }

  return {
    mount({ levelConfig, hostEl, onFinished, onStateChange }) {
      if (!levelConfig) throw new Error('mount() requires levelConfig');
      if (!hostEl) throw new Error('mount() requires hostEl');
      return createController(levelConfig, hostEl, onFinished, onStateChange);
    },
    unmount(hostEl) { if (hostEl) hostEl.innerHTML = ''; }
  };
})();
