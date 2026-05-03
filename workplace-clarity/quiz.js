// quiz.js — Workplace Clarity Quiz
// Vanilla JS, no dependencies. All processing is client-side.

(function () {
  'use strict';

  const { QUIZ, EXPLAINERS, NEXT_STEPS_POOL, DOCUMENTATION_CHECKLIST, LIKERT } = window.QUIZ_DATA;

  const STORAGE_KEY = 'wcq.answers.v1';
  const STATE = {
    currentSection: 0,
    answers: {} // questionId -> value (number for likert, string for text)
  };

  // ----- DOM refs -----
  const $ = (id) => document.getElementById(id);
  const screens = {
    intro: $('screen-intro'),
    quiz: $('screen-quiz'),
    results: $('screen-results')
  };
  const liveRegion = $('live-region');

  // ============================================================
  // PERSISTENCE (localStorage only — never sent anywhere)
  // ============================================================
  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.answers === 'object') return parsed;
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        answers: STATE.answers,
        currentSection: STATE.currentSection,
        savedAt: Date.now()
      }));
    } catch (e) { /* ignore */ }
  }

  function clearSaved() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    STATE.answers = {};
    STATE.currentSection = 0;
  }

  // ============================================================
  // SCREEN MANAGEMENT
  // ============================================================
  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      el.hidden = (key !== name);
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ============================================================
  // QUIZ RENDERING
  // ============================================================
  function renderSection(idx) {
    const section = QUIZ.sections[idx];
    const container = $('quiz-content');
    container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'quiz-section';

    const header = document.createElement('div');
    header.className = 'quiz-section__header';
    header.innerHTML = `
      <h2 class="quiz-section__title">${escapeHtml(section.title)}</h2>
      <p class="quiz-section__blurb">${escapeHtml(section.blurb)}</p>
    `;
    wrap.appendChild(header);

    section.questions.forEach((q) => {
      wrap.appendChild(renderQuestion(q));
    });

    container.appendChild(wrap);

    // Update progress
    const pct = ((idx + 1) / QUIZ.sections.length) * 100;
    $('progress-fill').style.width = pct + '%';
    $('progress-text').textContent = `Section ${idx + 1} of ${QUIZ.sections.length}: ${section.title}`;

    // Nav buttons
    $('quiz-prev').hidden = (idx === 0);
    $('quiz-next').textContent = (idx === QUIZ.sections.length - 1) ? 'See my results →' : 'Next →';
  }

  function renderQuestion(q) {
    const div = document.createElement('div');
    div.className = 'question';
    div.dataset.questionId = q.id;

    const prompt = document.createElement('p');
    prompt.className = 'question__prompt';
    prompt.id = `q-${q.id}-label`;
    prompt.textContent = q.prompt;
    div.appendChild(prompt);

    if (q.type === 'likert') {
      const group = document.createElement('div');
      group.className = 'likert';
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-labelledby', `q-${q.id}-label`);

      LIKERT.forEach((opt) => {
        const id = `q-${q.id}-${opt.value}`;
        const label = document.createElement('label');
        label.setAttribute('for', id);

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `q-${q.id}`;
        input.id = id;
        input.value = opt.value;
        if (STATE.answers[q.id] === opt.value) input.checked = true;
        input.addEventListener('change', () => {
          STATE.answers[q.id] = opt.value;
          saveProgress();
        });

        const span = document.createElement('span');
        span.textContent = opt.label;

        label.appendChild(input);
        label.appendChild(span);
        group.appendChild(label);
      });

      div.appendChild(group);
    } else if (q.type === 'text') {
      const isShortField = q.id === 'employer-name';
      const input = document.createElement(isShortField ? 'input' : 'textarea');
      if (isShortField) input.type = 'text';
      input.className = 'text-input';
      input.id = `q-${q.id}-input`;
      input.placeholder = q.placeholder || '';
      input.setAttribute('aria-labelledby', `q-${q.id}-label`);
      if (STATE.answers[q.id]) input.value = STATE.answers[q.id];
      input.addEventListener('input', () => {
        STATE.answers[q.id] = input.value;
        saveProgress();
      });
      div.appendChild(input);
    }

    return div;
  }

  // ============================================================
  // SCORING
  // ============================================================
  function computeScores() {
    // Initialize accumulators
    const dims = ['payClarity', 'roleClarity', 'unpaidWork', 'classification', 'retaliation', 'collectiveReadiness'];
    const points = {}, maxPoints = {};
    dims.forEach((d) => { points[d] = 0; maxPoints[d] = 0; });

    // Walk every likert question
    QUIZ.sections.forEach((section) => {
      section.questions.forEach((q) => {
        if (q.type !== 'likert') return;
        const ans = STATE.answers[q.id];

        Object.entries(q.weights).forEach(([dim, cfg]) => {
          maxPoints[dim] += cfg.max;
          if (typeof ans !== 'number') return; // unanswered = 0 contribution

          // Likert is 1..5. (ans - 1) gives 0..4.
          const raw = ans - 1;
          // If positive: agreeing adds points (good).
          // If positive=true and dim is concern, agreeing reduces concern (we don't store negative)
          //   — instead, "positive" means "this question's higher value reduces the concern score
          //     (or raises the clarity score)."
          // If positive=false: disagreeing adds points to concern, agreeing adds none.
          //   Wait — that's backwards for concern dims. Let me clarify:
          //
          // For CLARITY dims (positive direction = more clarity = good):
          //   positive=true  -> agree adds points (good; raw)
          //   positive=false -> disagree adds points (good; 4 - raw) — used for "I feel safe asking
          //                     about pay" where disagreeing means LOW clarity. But wait — we use
          //                     positive=true for that. So positive=false on a clarity dim is rare.
          //
          // For CONCERN dims (positive direction = more concern = bad):
          //   positive=false -> agreeing with a NEGATIVE statement adds concern (raw)
          //                     e.g. "I fear retaliation" — agreeing = concern
          //   positive=true  -> agreeing with a POSITIVE statement REDUCES concern,
          //                     so disagreeing adds concern points (4 - raw)
          //                     e.g. "I trust management" — disagreeing = concern
          //
          // The same convention works for both clarity and concern dims because we're just asking:
          // does this answer contribute "points in this direction"?
          const contribution = cfg.positive ? raw : (4 - raw);
          points[dim] += contribution;
        });
      });
    });

    // Normalize to 0-100
    const scores = {};
    dims.forEach((d) => {
      scores[d] = maxPoints[d] === 0 ? 0 : Math.round((points[d] / maxPoints[d]) * 100);
    });

    // Composite "Workplace Clarity Need"
    // High = high need for clarity/support/documentation.
    // It's an average of the concern dims, with low clarity dims also pulling it up.
    const concernAvg = (scores.unpaidWork + scores.classification + scores.retaliation) / 3;
    const clarityGap = ((100 - scores.payClarity) + (100 - scores.roleClarity)) / 2;
    scores.overall = Math.round((concernAvg * 0.6) + (clarityGap * 0.4));

    return scores;
  }

  function bandFor(score, isPositive) {
    // isPositive = true means high is good (e.g. payClarity)
    // For positive dims, we invert: a LOW positive score = concern.
    const effectiveConcern = isPositive ? (100 - score) : score;
    if (effectiveConcern < 25) return { label: 'Low concern', cls: 'good' };
    if (effectiveConcern < 50) return { label: 'Emerging', cls: 'watch' };
    if (effectiveConcern < 75) return { label: 'Significant', cls: 'concern' };
    return { label: 'High concern', cls: 'concern' };
  }

  // ============================================================
  // RESULTS RENDERING
  // ============================================================
  const SCORE_META = [
    { key: 'payClarity', label: 'Pay clarity', positive: true, blurb: 'How clearly you understand how you\'re paid.' },
    { key: 'roleClarity', label: 'Role clarity', positive: true, blurb: 'How clearly your role and duties were defined.' },
    { key: 'unpaidWork', label: 'Unpaid work concern', positive: false, blurb: 'How likely some of your work may have gone unpaid.' },
    { key: 'classification', label: 'Employee-like control signals', positive: false, blurb: 'How employee-like the working relationship is. Only a concern if your label is contractor/1099/etc.' },
    { key: 'retaliation', label: 'Retaliation / safety concern', positive: false, blurb: 'How safe it feels to raise concerns at work.' },
    { key: 'collectiveReadiness', label: 'Shared concern readiness', positive: true, neutral: true, blurb: 'Whether issues feel shared, and your openness to outside help.' }
  ];

  function renderResults() {
    const scores = computeScores();

    // ----- Plain-English summary -----
    renderSummary(scores);

    // ----- Score grid -----
    const grid = $('scores-grid');
    grid.innerHTML = '';
    SCORE_META.forEach((meta) => {
      const score = scores[meta.key];
      const band = meta.neutral
        ? { label: score >= 50 ? 'Open to outreach' : 'Less ready', cls: score >= 50 ? 'good' : 'watch' }
        : bandFor(score, meta.positive);
      const fillClass = meta.neutral ? '' : `score__bar-fill--${band.cls}`;

      const card = document.createElement('div');
      card.className = 'score';
      card.innerHTML = `
        <div class="score__top">
          <span class="score__name">${escapeHtml(meta.label)}</span>
          <span class="score__band score__band--${band.cls}">${band.label}</span>
        </div>
        <div class="score__bar"><div class="score__bar-fill ${fillClass}" style="width: ${score}%"></div></div>
        <div class="score__top" style="margin-top: 0.3rem; margin-bottom: 0;">
          <span class="muted small">${escapeHtml(meta.blurb)}</span>
          <span class="score__value">${score} / 100</span>
        </div>
      `;
      grid.appendChild(card);
    });

    // ----- Top signals -----
    renderSignals(scores);

    // ----- Documentation checklist -----
    const docList = $('doc-checklist');
    docList.innerHTML = '';
    DOCUMENTATION_CHECKLIST.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      docList.appendChild(li);
    });

    // ----- Next steps -----
    renderNextSteps(scores);

    // ----- AI prompt -----
    $('ai-prompt').value = generateAIPrompt(scores);
  }

  function renderSummary(scores) {
    const el = $('summary-text');
    const parts = [];

    // Overall framing
    if (scores.overall >= 75) {
      parts.push(`<p>Your answers point to <strong>significant areas worth paying attention to</strong>. That doesn't mean anything has been "proven" — it means there's enough going on that documenting calmly and getting qualified guidance would put you in a stronger position.</p>`);
    } else if (scores.overall >= 50) {
      parts.push(`<p>Your answers point to <strong>real areas of concern alongside some clarity</strong>. A few specific things look worth pinning down — ideally in writing, ideally before they get bigger.</p>`);
    } else if (scores.overall >= 25) {
      parts.push(`<p>Your answers suggest <strong>mostly okay with a few things worth tightening up</strong>. Asking for written clarification on the unclear pieces is usually low-cost and can prevent bigger confusion later.</p>`);
    } else {
      parts.push(`<p>Your answers suggest <strong>relatively clear pay and role definitions</strong>. That's a good starting position. The documentation habits below are still worth keeping in your back pocket.</p>`);
    }

    // Specific callouts
    const callouts = [];
    if (scores.payClarity < 50) callouts.push('pay terms feel unclear');
    if (scores.roleClarity < 50) callouts.push('your role or status feels ambiguous');
    if (scores.unpaidWork >= 50) callouts.push('some of your work may not have been paid for');
    if (scores.classification >= 50) callouts.push('your working relationship looks employee-like, which is worth flagging if your label says otherwise');
    if (scores.retaliation >= 50) callouts.push('it doesn\'t feel safe to raise concerns');

    if (callouts.length) {
      parts.push(`<p>Specifically, your answers suggest ${joinList(callouts)}. The sections below break each of these down.</p>`);
    }

    parts.push(`<p class="muted small">Reminder: this snapshot is based on what you told the quiz, not a review of your actual situation. Use it to organize your thinking, not as a conclusion.</p>`);

    el.innerHTML = parts.join('');
  }

  function renderSignals(scores) {
    const list = $('signals-list');
    list.innerHTML = '';

    // Pick the top 3 concerns
    const candidates = [
      { key: 'payClarity', concernScore: 100 - scores.payClarity, dim: 'payClarity', mode: 'low' },
      { key: 'roleClarity', concernScore: 100 - scores.roleClarity, dim: 'roleClarity', mode: 'low' },
      { key: 'unpaidWork', concernScore: scores.unpaidWork, dim: 'unpaidWork', mode: 'high' },
      { key: 'classification', concernScore: scores.classification, dim: 'classification', mode: 'high' },
      { key: 'retaliation', concernScore: scores.retaliation, dim: 'retaliation', mode: 'high' }
    ];
    candidates.sort((a, b) => b.concernScore - a.concernScore);

    const top = candidates.filter(c => c.concernScore >= 25).slice(0, 3);

    if (top.length === 0) {
      list.innerHTML = `<p class="muted">No strong signal areas surfaced — your answers came back relatively clear across the board. The documentation habits below are still worth building.</p>`;
      return;
    }

    top.forEach((c) => {
      const explainer = EXPLAINERS[c.dim];
      const text = explainer[c.mode]; // 'low' for clarity dims, 'high' for concern dims
      if (!text) return;
      const div = document.createElement('div');
      div.className = `signal ${c.concernScore >= 75 ? 'signal--high' : ''}`;
      div.innerHTML = `
        <h3>${escapeHtml(explainer.title)}</h3>
        <p>${escapeHtml(text)}</p>
      `;
      list.appendChild(div);
    });
  }

  function renderNextSteps(scores) {
    const ol = $('next-steps-list');
    ol.innerHTML = '';

    const steps = [...NEXT_STEPS_POOL.always];

    if (scores.payClarity < 60) steps.push(...NEXT_STEPS_POOL.payClarity);
    if (scores.unpaidWork >= 40) steps.push(...NEXT_STEPS_POOL.unpaidWork);
    if (scores.classification >= 40) steps.push(...NEXT_STEPS_POOL.classification);
    if (scores.retaliation >= 40) steps.push(...NEXT_STEPS_POOL.retaliation);
    if (scores.collectiveReadiness >= 50) steps.push(...NEXT_STEPS_POOL.collectiveReadiness);

    steps.push(...NEXT_STEPS_POOL.closing);

    // Cap at 7 to stay readable
    const final = steps.slice(0, 7);
    final.forEach((s) => {
      const li = document.createElement('li');
      li.textContent = s;
      ol.appendChild(li);
    });
  }

  // ============================================================
  // AI PROMPT GENERATION
  // ============================================================
  function generateAIPrompt(scores) {
    const a = STATE.answers;

    const scoreSummary = SCORE_META.map(m => {
      const s = scores[m.key];
      const band = m.neutral ? '' : ` (${bandFor(s, m.positive).label})`;
      return `- ${m.label}: ${s}/100${band}`;
    }).join('\n') + `\n- Overall workplace clarity need: ${scores.overall}/100`;

    const narrative = [];
    if (a['narr-1']) narrative.push(`What feels unclear or unfair: ${a['narr-1']}`);
    if (a['narr-2']) narrative.push(`Work that may not have been paid: ${a['narr-2']}`);
    if (a['narr-3']) narrative.push(`What outcome would feel fair: ${a['narr-3']}`);
    if (a['narr-4']) narrative.push(`What I'm afraid might happen if I speak up: ${a['narr-4']}`);
    const employer = a['employer-name'] ? `\n- Employer / industry context: ${a['employer-name']}` : '';

    // Map concrete answers into a fact summary so the AI has signal even without narrative
    const factHighlights = buildFactHighlights();

    return `Act as a neutral workplace rights education assistant. I am not asking for legal advice. Help me understand my workplace situation, organize my facts, identify what I should document, and decide what questions to ask a labor attorney, government agency, worker center, union organizer, or trusted coworker.

Here are my quiz results:
${scoreSummary}${employer}

Specific signals from my quiz answers:
${factHighlights || '- (No specific signals stood out beyond the scores above.)'}

${narrative.length ? 'My main concerns in my own words:\n' + narrative.map(n => `- ${n}`).join('\n') : 'I did not write narrative notes; please ask me clarifying questions instead.'}

Please help me:
1. Separate facts, assumptions, unknowns, risks, and next steps.
2. Identify possible wage, classification, retaliation, safety, or organizing issues based on what I've shared.
3. Create a documentation checklist tailored to my situation.
4. Draft a calm, non-confrontational message I could send asking for written clarification on the most important unclear point.
5. Suggest non-escalatory next steps in priority order.
6. Tell me what specific information I should gather before contacting an attorney or labor agency.
7. Flag anything in my answers that seems contradictory or where I'd benefit from clarifying my own facts before going further.

Important constraints:
- Do not tell me I definitely have a legal claim.
- Do not encourage threats, public accusations, or escalation.
- Keep the advice calm, practical, and documentation-focused.
- Do not suggest I record people without their knowledge.
- Do not suggest I delete, alter, or hide evidence.
- If you're uncertain about jurisdiction-specific rules, say so and tell me what to ask a qualified attorney or agency.`;
  }

  function buildFactHighlights() {
    const a = STATE.answers;
    const lines = [];

    // Pay
    if (likertConcern(a['pay-1'], false)) lines.push("I don't fully understand how I'm paid.");
    if (likertConcern(a['pay-2'], false)) lines.push("I don't have written pay terms.");
    if (likertConcern(a['pay-3'], false)) lines.push("I don't fully understand when commissions/bonuses are earned.");
    if (likertConcern(a['pay-4'], false)) lines.push("I don't fully understand when commissions/bonuses are paid.");
    if (likertConcern(a['pay-5'], false)) lines.push("Required meetings, training, admin, or travel time may not be paid.");
    if (likertConcern(a['pay-6'], false)) lines.push("I don't understand the rules for reimbursing work expenses.");

    // Role
    if (likertConcern(a['role-1'], false)) lines.push("My status (employee/contractor/trainee/etc.) is unclear.");
    if (likertConcern(a['role-3'], false)) lines.push("My actual duties don't match what I was told.");
    if (likertConcern(a['role-4'], false)) lines.push("I don't have written terms describing my role.");

    // Work performed (signals for unpaid work + classification)
    if (likertAgrees(a['work-1'])) lines.push("I attend required meetings or trainings.");
    if (likertAgrees(a['work-2'])) lines.push("I perform admin, CRM, route planning, vendor coordination, or operations work.");
    if (likertAgrees(a['work-3'])) lines.push("I use company tools, systems, scripts, uniforms, or processes.");
    if (likertAgrees(a['work-4'])) lines.push("My work benefits the company even when it doesn't directly produce a sale.");
    if (likertAgrees(a['work-5'])) lines.push("I'm expected to be available at certain times.");

    // Classification
    if (likertAgrees(a['ctrl-1'])) lines.push("The company controls when, where, or how I work.");
    if (likertAgrees(a['ctrl-2'])) lines.push("I was trained by the company.");
    if (likertAgrees(a['ctrl-3'])) lines.push("I report to a supervisor regularly.");
    if (likertAgrees(a['ctrl-4'])) lines.push("I'm directed or disciplined by someone at the company.");
    if (likertConcern(a['ctrl-5'], false)) lines.push("I cannot meaningfully negotiate prices or terms with customers.");
    if (likertConcern(a['ctrl-6'], false)) lines.push("I don't have a meaningful opportunity for profit or loss.");
    if (likertConcern(a['ctrl-7'], false)) lines.push("I don't really work for multiple independent clients.");
    if (likertConcern(a['ctrl-8'], false)) lines.push("I don't provide my own tools or run my own independent business.");

    // Safety / retaliation
    if (likertConcern(a['safe-1'], false)) lines.push("I don't feel safe asking about pay.");
    if (likertConcern(a['safe-2'], false)) lines.push("I don't feel safe discussing wages with coworkers.");
    if (likertAgrees(a['safe-3'])) lines.push("I fear retaliation if I raise concerns.");
    if (likertConcern(a['safe-4'], false)) lines.push("I don't trust management to fix problems fairly.");
    if (likertAgrees(a['safe-6'])) lines.push("Workers seem to discuss pay/fairness privately because they don't feel heard.");

    // Collective
    if (likertAgrees(a['col-1'])) lines.push("I think other workers may share similar concerns.");
    if (likertAgrees(a['col-4'])) lines.push("I'm open to contacting outside help (attorney, agency, worker center, or organizer).");

    return lines.map(l => `- ${l}`).join('\n');
  }

  // Helpers for fact highlighting
  function likertAgrees(v) { return typeof v === 'number' && v >= 4; }
  function likertConcern(v, agreeMeansConcern) {
    if (typeof v !== 'number') return false;
    return agreeMeansConcern ? v >= 4 : v <= 2;
  }

  // ============================================================
  // UTILITIES
  // ============================================================
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  function joinList(items) {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return items[0] + ' and ' + items[1];
    return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
  }
  function announce(msg) {
    liveRegion.textContent = msg;
    setTimeout(() => { liveRegion.textContent = ''; }, 2000);
  }

  // ============================================================
  // EVENT WIRING
  // ============================================================
  function startQuiz(resume = false) {
    if (!resume) STATE.currentSection = 0;
    showScreen('quiz');
    renderSection(STATE.currentSection);
  }

  $('start-quiz').addEventListener('click', () => startQuiz(false));

  $('quiz-next').addEventListener('click', () => {
    if (STATE.currentSection < QUIZ.sections.length - 1) {
      STATE.currentSection++;
      saveProgress();
      renderSection(STATE.currentSection);
    } else {
      // Done
      showScreen('results');
      renderResults();
    }
  });

  $('quiz-prev').addEventListener('click', () => {
    if (STATE.currentSection > 0) {
      STATE.currentSection--;
      saveProgress();
      renderSection(STATE.currentSection);
    }
  });

  $('clear-mid-quiz').addEventListener('click', () => {
    if (confirm('Clear all your answers and start over? This can\'t be undone.')) {
      clearSaved();
      showScreen('intro');
      checkResume();
    }
  });

  $('clear-saved').addEventListener('click', () => {
    if (confirm('Clear your saved answers? This can\'t be undone.')) {
      clearSaved();
      $('resume-line').hidden = true;
      announce('Saved answers cleared.');
    }
  });

  $('resume-quiz').addEventListener('click', () => startQuiz(true));

  $('restart-quiz').addEventListener('click', () => {
    clearSaved();
    showScreen('intro');
    checkResume();
  });

  $('copy-prompt').addEventListener('click', async () => {
    const text = $('ai-prompt').value;
    try {
      await navigator.clipboard.writeText(text);
      const btn = $('copy-prompt');
      const original = btn.textContent;
      btn.textContent = '✓ Copied';
      setTimeout(() => { btn.textContent = original; }, 1800);
      announce('Prompt copied to clipboard.');
    } catch (e) {
      // Fallback: select the textarea
      const ta = $('ai-prompt');
      ta.select();
      document.execCommand('copy');
      announce('Prompt copied (fallback).');
    }
  });

  $('print-results').addEventListener('click', () => window.print());

  // ============================================================
  // INIT
  // ============================================================
  function checkResume() {
    const saved = loadSaved();
    const resumeLine = $('resume-line');
    if (saved && saved.answers && Object.keys(saved.answers).length > 0) {
      STATE.answers = saved.answers;
      STATE.currentSection = Math.min(saved.currentSection || 0, QUIZ.sections.length - 1);
      resumeLine.hidden = false;
    } else {
      resumeLine.hidden = true;
    }
  }

  checkResume();
  showScreen('intro');
})();
