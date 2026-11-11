/* ============================================================
   Quiz Engine
   ============================================================ */

window.QuizEngine = (function () {
  'use strict';

  function generateAllNumbers(operandCfg) {
    if (operandCfg.type === 'range') return []; // handled differently

    const { digits, allowedDigits, distinctDigits, requireSpecificDigit, firstDigitExclude } = operandCfg;
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
        used.add(d);
        prefix.push(d);
        recurse(prefix, used);
        prefix.pop();
        used.delete(d);
      }
    })([], new Set());
    return results;
  }

  function computeResult(a, b, operator) {
    switch (operator) {
      case '×': return a * b;
      case '+': return a + b;
      case '-': return a - b;
      case '÷': return a / b;
      default:  throw new Error('Unsupported operator: ' + operator);
    }
  }

  function generateQuestionSet(cfg, poolA, poolB) {
    const noReuse = cfg.uniqueness === 'no-reused-numbers';
    const usedNums = new Set();
    const questions = [];

    // Handle Division Range (Level 2)
    if (cfg.operandB.type === 'range') {
      const { min, max, excludeMultiplesOf } = cfg.operandB;
      const validDivisors = [];
      for (let d = min; d <= max; d++) {
        let skip = false;
        for (let ex of excludeMultiplesOf) {
          if (d % ex === 0) { skip = true; break; }
        }
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

        usedNums.add(dividend);
        usedNums.add(divisor);
        questions.push({ num1: dividend, num2: divisor, result: dividend / divisor });
      }
      return questions;
    }

    // Handle standard Operators (Level 1)
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

      usedNums.add(num1);
      usedNums.add(num2);

      const result = computeResult(num1, num2, cfg.operator);
      if (result <= 0) { q--; continue; }
      questions.push({ num1, num2, result });
    }
    return questions;
  }

  function buildOptions(correctResult, cfg, poolA, poolB) {
    const optCfg = cfg.options;
    const needCount = (optCfg.count || 4) - 1;
    const distractors = [];
    const seen = new Set([correctResult]);

    // Handle Division Options (Derived from Quotient)
    if (optCfg.distractorMode === 'derive-from-answer') {
      let attempts = 0;
      while (distractors.length < needCount && attempts < 3000) {
        attempts++;
        if (Math.random() < 0.6) {
          const candidate = poolA[Math.floor(Math.random() * poolA.length)];
          if (seen.has(candidate)) continue;
          seen.add(candidate);
          distractors.push(candidate);
        } else {
          const s = correctResult.toString();
          const digits = s.split('').map(Number);
          const pos = Math.floor(Math.random() * digits.length);
          const replacements = optCfg.answerDigits.filter(d => d !== digits[pos]);
          if (replacements.length === 0) continue;
          const newDigit = replacements[Math.floor(Math.random() * replacements.length)];
          const newDigits = [...digits];
          newDigits[pos] = newDigit;
          if (newDigits[0] === 0) continue;
          const candidate = parseInt(newDigits.join(''), 10);
          if (seen.has(candidate)) continue;
          seen.add(candidate);
          distractors.push(candidate);
        }
      }
    } else {
      // Standard Distractors (Level 1)
      const [pLo, pHi] = optCfg.perturbRange  || [-100, 100];
      const [fLo, fHi] = optCfg.fallbackRange || [-1000, 1000];

      let attempts = 0;
      while (distractors.length < needCount && attempts < 3000) {
        attempts++;
        const a = poolA[Math.floor(Math.random() * poolA.length)];
        const b = poolB[Math.floor(Math.random() * poolB.length)];
        let candidate = computeResult(a, b, cfg.operator);
        if (Math.random() < (optCfg.perturbChance || 0)) {
          candidate += Math.floor(Math.random() * (pHi - pLo + 1)) + pLo;
        }
        if (candidate <= 0 || seen.has(candidate)) continue;
        seen.add(candidate);
        distractors.push(candidate);
      }

      while (distractors.length < needCount) {
        const delta = Math.floor(Math.random() * (fHi - fLo + 1)) + fLo;
        const candidate = Math.max(1, correctResult + delta);
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        distractors.push(candidate);
      }
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
    let poolA = [];
    let poolB = [];
    
    if (cfg.operandB.type === 'range') {
      poolA = generateAllNumbers(cfg.operandA.operandB); // The quotient rules
    } else {
      poolA = generateAllNumbers(cfg.operandA);
      poolB = generateAllNumbers(cfg.operandB);
    }

    if (poolA.length === 0) throw new Error('Operand config produced an empty number pool.');

    let questions = null;
    let attempts = 0;
    while (!questions && attempts < 300) {
      questions = generateQuestionSet(cfg, poolA, poolB);
      attempts++;
    }
    if (!questions) throw new Error('Could not generate a question set.');

    const optionsList = questions.map(q =>
      buildOptions(q.result, cfg, poolA, poolB)
    );

    let state = {
      levelId: cfg.id,
      questions,
      currentIndex: 0,
      answers: new Array(totalQuestions).fill(null),
      optionsList,
      completed: false,
      score: 0
    };

    const notify = () => {
      if (typeof onStateChange === 'function') {
        try { onStateChange(JSON.parse(JSON.stringify(state))); } catch (e) {}
      }
    };

    hostEl.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'qe-root';
    root.innerHTML = `
      <h1 class="qe-title"></h1>
      <div class="qe-subhead">
        <div class="qe-status">Question 1 of ${totalQuestions}</div>
        <div class="qe-progress-badge">1 / ${totalQuestions}</div>
      </div>
      <div class="qe-question-view">
        <div class="qe-question-area">
          <div class="qe-question-text"></div>
          <div class="qe-options-grid"></div>
        </div>
        <div class="qe-btn-group">
          <button class="qe-btn qe-btn-primary qe-submit-btn" disabled>Submit answer</button>
        </div>
      </div>
      <div class="qe-result-view qe-hide">
        <div class="qe-result-area">
          <div class="qe-score-big">0<small>/${totalQuestions}</small></div>
          <div class="qe-score-message"></div>
          <div class="qe-congrats qe-hide"></div>
          <div class="qe-btn-group" style="margin-top:24px">
            <button class="qe-btn qe-try-again-btn">🔄 Try again</button>
          </div>
        </div>
      </div>
    `;
    hostEl.appendChild(root);

    const titleEl     = root.querySelector('.qe-title');
    const statusEl    = root.querySelector('.qe-status');
    const badgeEl     = root.querySelector('.qe-progress-badge');
    const qViewEl     = root.querySelector('.qe-question-view');
    const rViewEl     = root.querySelector('.qe-result-view');
    const qTextEl     = root.querySelector('.qe-question-text');
    const optionsGrid = root.querySelector('.qe-options-grid');
    const submitBtn   = root.querySelector('.qe-submit-btn');
    const scoreBigEl  = root.querySelector('.qe-score-big');
    const scoreMsgEl  = root.querySelector('.qe-score-message');
    const congratsEl  = root.querySelector('.qe-congrats');
    const tryAgainBtn = root.querySelector('.qe-try-again-btn');

    titleEl.textContent = cfg.title || 'Quiz';

    function renderQuestion() {
      if (state.completed) { renderResult(); return; }
      const qi = state.currentIndex;
      if (qi >= totalQuestions) { state.completed = true; renderResult(); return; }

      const q = state.questions[qi];
      const opts = state.optionsList[qi];
      const sel = state.answers[qi];

      badgeEl.textContent = `${qi + 1} / ${totalQuestions}`;
      statusEl.textContent = `Question ${qi + 1} of ${totalQuestions}`;

      qTextEl.innerHTML = `
        <span class="qe-operand">${q.num1}</span>
        <span class="qe-op">${cfg.operator}</span>
        <span class="qe-operand">${q.num2}</span>
        <span class="qe-eq">=</span>
        <span class="qe-qmark">?</span>`;

      optionsGrid.innerHTML = '';
      opts.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'qe-option-btn';
        if (sel === idx) btn.classList.add('qe-selected');
        btn.textContent = opt;
        btn.addEventListener('click', () => {
          if (state.completed) return;
          state.answers[qi] = idx;
          optionsGrid.querySelectorAll('.qe-option-btn').forEach(b =>
            b.classList.remove('qe-selected'));
          btn.classList.add('qe-selected');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Next question →';
          notify();
        });
        optionsGrid.appendChild(btn);
      });

      const hasSel = state.answers[qi] !== null && state.answers[qi] !== undefined;
      submitBtn.disabled = !hasSel;
      submitBtn.textContent = hasSel ? 'Next question →' : 'Submit answer';

      qViewEl.classList.remove('qe-hide');
      rViewEl.classList.add('qe-hide');
    }

    function finalize() {
      let score = 0;
      state.questions.forEach((q, idx) => {
        const chosen = state.optionsList[idx][state.answers[idx]];
        if (chosen === q.result) score++;
      });
      state.score = score;
      state.completed = true;
      renderResult();
      notify();
      if (typeof onFinished === 'function') {
        try { onFinished(score, totalQuestions); } catch (e) { console.error(e); }
      }
    }

    function renderResult() {
      qViewEl.classList.add('qe-hide');
      rViewEl.classList.remove('qe-hide');
      scoreBigEl.innerHTML = `${state.score}<small>/${totalQuestions}</small>`;

      if (state.score === totalQuestions) {
        scoreMsgEl.style.display = 'none';
        scoreMsgEl.textContent = '';
        congratsEl.classList.remove('qe-hide');
        congratsEl.textContent =
          `🎉 Congratulations! Perfect ${totalQuestions}/${totalQuestions}!`;
        tryAgainBtn.style.display = 'none';
      } else {
        scoreMsgEl.style.display = 'block';
        scoreMsgEl.textContent =
          `You scored ${state.score}/${totalQuestions}. Try again to improve.`;
        scoreMsgEl.style.color = '#a83e37';
        congratsEl.classList.add('qe-hide');
        tryAgainBtn.style.display = 'inline-flex';
      }

      statusEl.textContent = 'Quiz completed';
      badgeEl.textContent = `${totalQuestions} / ${totalQuestions}`;
    }

    submitBtn.addEventListener('click', () => {
      const qi = state.currentIndex;
      if (state.answers[qi] === null || state.answers[qi] === undefined) return;
      optionsGrid.querySelectorAll('.qe-option-btn')
        .forEach(b => b.classList.add('qe-disabled'));

      if (state.currentIndex < totalQuestions - 1) {
        state.currentIndex++;
        notify();
        renderQuestion();
      } else {
        finalize();
      }
    });

    tryAgainBtn.addEventListener('click', () => {
      const freshQuestions = generateQuestionSet(cfg, poolA, poolB);
      if (!freshQuestions) { alert('Could not regenerate a quiz. Please reload.'); return; }
      state = {
        levelId: cfg.id,
        questions: freshQuestions,
        currentIndex: 0,
        answers: new Array(totalQuestions).fill(null),
        optionsList: freshQuestions.map(q =>
          buildOptions(q.result, cfg, poolA, poolB)),
        completed: false,
        score: 0
      };
      notify();
      renderQuestion();
    });

    renderQuestion();
    notify();

    return {
      getState: () => JSON.parse(JSON.stringify(state)),
      destroy: () => { hostEl.innerHTML = ''; }
    };
  }

  return {
    mount({ levelConfig, hostEl, onFinished, onStateChange }) {
      if (!levelConfig) throw new Error('mount() requires levelConfig');
      if (!hostEl)      throw new Error('mount() requires hostEl');
      return createController(levelConfig, hostEl, onFinished, onStateChange);
    },
    unmount(hostEl) {
      if (hostEl) hostEl.innerHTML = '';
    }
  };
})();
