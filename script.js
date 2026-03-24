// =====================================================================
// NEURACORE — Full Feature Engine
// Features: LLM (Gemini), Three.js, Audio Soundscape, Chart.js Radar,
//           Compatibility Mode, Social Share, ID Card Download
// =====================================================================

// ── State ──────────────────────────────────────────────────────────────
let currentMode = null;
let apiKey = localStorage.getItem('neuracore_api_key') || '';
let ambientActive = false;
let ambientInterval = null;
let ambientMode = 'neutral';
let radarChart = null;
let synergyChart = null;
let lastResultText = '';
let lastInput = '';
let lastUserName = '';
let analysisHistory = JSON.parse(localStorage.getItem('neuracore_history') || '[]');

const views = {
    landing: document.getElementById('landing'),
    input: document.getElementById('input-view'),
    compat: document.getElementById('compat-view'),
    result: document.getElementById('result-view'),
    guided: document.getElementById('guided-view')
};

// ── Init ───────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
    initThree();
    updateApiStatusBadge();
    updateHistoryBadge();
    document.getElementById('user-input').addEventListener('input', updateCharCounter);
    document.getElementById('card-date').innerText =
        new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
});

// ── Navigation ─────────────────────────────────────────────────────────
function navigateTo(viewId) {
    playUiSound(440, 'sine', 0.08);
    Object.values(views).forEach(v => v.classList.remove('active'));
    if (views[viewId]) views[viewId].classList.add('active');

    // Set glow background mode
    const glowBg = document.getElementById('glow-bg');
    glowBg.className = 'glow-bg';
    if (viewId === 'compat') glowBg.classList.add('mode-compat');
}

function resetApp() {
    document.getElementById('user-input').value = '';
    document.getElementById('compat-input-a').value = '';
    document.getElementById('compat-input-b').value = '';
    document.getElementById('results-container').innerHTML = '';
    document.getElementById('radar-container').classList.add('hidden');
    document.getElementById('compat-score-container').classList.add('hidden');
    updateCharCounter();
    navigateTo('landing');
}

function updateCharCounter() {
    const input = document.getElementById('user-input');
    const counter = document.getElementById('char-counter');
    const count = input.value.length;
    counter.textContent = `${count} / 2000`;
    counter.classList.toggle('warn', count > 1800);
    if (input.value.length > 2000) input.value = input.value.substring(0, 2000);
}

function usePrompt(btn) {
    const textarea = document.getElementById('user-input');
    textarea.value = btn.textContent;
    textarea.focus();
    // Move cursor to end
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    updateCharCounter();
    playUiSound(528, 'sine', 0.08);
}

// ── Guided Q&A Mode ──────────────────────────────────────────────────
const GUIDED_QUESTIONS = [
    {
        q: "What do you want most right now?",
        hint: "A goal, an outcome, a feeling you're chasing — be specific, not abstract.",
        placeholder: "e.g. I want to finally launch my own thing but something always stops me..."
    },
    {
        q: "What's secretly holding you back?",
        hint: "Not the excuse you tell people — the real reason underneath it.",
        placeholder: "e.g. I'm terrified of public failure. I'd rather not try than try and look stupid..."
    },
    {
        q: "How do others describe you vs. how you see yourself?",
        hint: "There's almost always a gap. Explore it honestly.",
        placeholder: "e.g. People say I'm confident and driven. I actually feel like an impostor most of the time..."
    },
    {
        q: "What do you keep failing at, despite trying?",
        hint: "A recurring pattern, not a one-off mistake.",
        placeholder: "e.g. I start projects with full energy then quietly abandon them when they get hard..."
    },
    {
        q: "What are you most proud of, and why?",
        hint: "Your proudest moments reveal your core values.",
        placeholder: "e.g. I built something from scratch with no help. It showed me I can figure anything out..."
    },
    {
        q: "When things go wrong, what does your gut do first?",
        hint: "Fight, freeze, flee, or fix? Be brutally honest.",
        placeholder: "e.g. I go quiet, withdraw, then overcompensate later with a burst of energy..."
    }
];

let guidedAnswers = [];
let guidedIndex = 0;

function startGuidedMode() {
    guidedAnswers = new Array(GUIDED_QUESTIONS.length).fill('');
    guidedIndex = 0;
    document.getElementById('guided-question-area').innerHTML = `
        <h2 class="guided-question" id="guided-question-text"></h2>
        <p class="guided-hint" id="guided-hint-text"></p>
        <textarea id="guided-answer" class="guided-textarea" rows="4"></textarea>
    `;
    document.getElementById('guided-nav').style.display = 'flex';
    document.getElementById('guided-name').value = '';
    renderGuidedQuestion();
    navigateTo('guided');
    playUiSound(440, 'sine', 0.1);
}

function exitGuided() {
    navigateTo('landing');
}

function renderGuidedQuestion() {
    const total = GUIDED_QUESTIONS.length;
    const q = GUIDED_QUESTIONS[guidedIndex];

    document.getElementById('guided-current').textContent = guidedIndex + 1;
    document.getElementById('guided-total').textContent = total;
    document.getElementById('guided-bar-fill').style.width = `${((guidedIndex + 1) / total) * 100}%`;

    // Animate question in
    const area = document.getElementById('guided-question-area');
    area.classList.remove('slide-in');
    void area.offsetWidth; // reflow
    area.classList.add('slide-in');

    document.getElementById('guided-question-text').textContent = q.q;
    document.getElementById('guided-hint-text').textContent = q.hint;
    const ta = document.getElementById('guided-answer');
    ta.placeholder = q.placeholder;
    ta.value = guidedAnswers[guidedIndex] || '';
    setTimeout(() => ta.focus(), 350);

    document.getElementById('guided-back-btn').style.visibility = guidedIndex === 0 ? 'hidden' : 'visible';
    const nextBtn = document.getElementById('guided-next-btn');
    nextBtn.textContent = guidedIndex === total - 1 ? 'Build My Profile →' : 'Next →';
}

function guidedNext() {
    const ta = document.getElementById('guided-answer');
    const answer = ta.value.trim();
    if (!answer) {
        ta.classList.add('shake');
        setTimeout(() => ta.classList.remove('shake'), 500);
        return;
    }
    guidedAnswers[guidedIndex] = answer;
    if (guidedIndex < GUIDED_QUESTIONS.length - 1) {
        guidedIndex++;
        renderGuidedQuestion();
        playUiSound(528, 'sine', 0.08);
    } else {
        guidedAnswers[guidedIndex] = answer;
        showGuidedComplete();
    }
}

function guidedBack() {
    guidedAnswers[guidedIndex] = document.getElementById('guided-answer').value.trim();
    if (guidedIndex > 0) {
        guidedIndex--;
        renderGuidedQuestion();
    }
}

function showGuidedComplete() {
    document.getElementById('guided-bar-fill').style.width = '100%';
    document.getElementById('guided-nav').style.display = 'none';
    document.getElementById('guided-question-area').innerHTML = `
        <div class="guided-complete">
            <div class="guided-complete-check">✓</div>
            <h2 class="guided-question">Profile built. Choose your analysis.</h2>
            <p class="guided-hint">Your answers have been compiled. Pick how the AI should read you.</p>
            <div class="action-grid" style="margin-top:2rem">
                <button onclick="runGuidedAnalysis('decode')" class="btn-action decode">
                    <span class="btn-icon">👁</span>
                    <span class="btn-label">Decode Me</span>
                    <span class="btn-sub">Big Five + MBTI</span>
                </button>
                <button onclick="runGuidedAnalysis('roast')" class="btn-action roast">
                    <span class="btn-icon">🔥</span>
                    <span class="btn-label">Roast Me</span>
                    <span class="btn-sub">Brutal Truth</span>
                </button>
                <button onclick="runGuidedAnalysis('boost')" class="btn-action boost">
                    <span class="btn-icon">🚀</span>
                    <span class="btn-label">Boost Me</span>
                    <span class="btn-sub">30-Day Blueprint</span>
                </button>
            </div>
        </div>
    `;
    playUiSound(660, 'sine', 0.2);
}

async function runGuidedAnalysis(mode) {
    const userName = document.getElementById('guided-name').value.trim();
    const profile = GUIDED_QUESTIONS.map((q, i) =>
        `Q: ${q.q}\nA: ${guidedAnswers[i]}`
    ).join('\n\n');

    // Sync to main textarea for history
    document.getElementById('user-input').value = profile;
    if (userName) document.getElementById('user-name-input').value = userName;
    updateCharCounter();

    currentMode = mode;
    const glowBg = document.getElementById('glow-bg');
    glowBg.className = 'glow-bg';
    if (mode === 'roast') glowBg.classList.add('mode-roast');
    else if (mode === 'boost') glowBg.classList.add('mode-boost');

    showLoader(mode);

    let aiData = null;
    if (apiKey) {
        const promptFn = { decode: buildDecodePrompt, roast: buildRoastPrompt, boost: buildBoostPrompt }[mode];
        const rawText = await callGemini(promptFn(profile, userName));
        if (rawText) aiData = parseAIResponse(rawText);
    }
    const data = aiData || { decode: mockDecodeData, roast: mockRoastData, boost: mockBoostData }[mode];
    lastResultText = buildShareText(data, mode);
    saveToHistory(mode, data, profile, userName);

    hideLoader();
    renderSoloResults(mode, data);
    prepareIdCard(data, mode, userName);
    navigateTo('result');
}

// ── History Management ─────────────────────────────────────────────────
function saveToHistory(mode, data, userInput, userName) {
    const summary = data.summary || data.reality_check || data.foundation || data.dynamic || '';
    const entry = {
        id: Date.now(), mode,
        archetype: data.archetype || data.verdict || 'Unknown',
        summary: summary.substring(0, 120),
        timestamp: new Date().toISOString(),
        userName: userName || '',
        data, userInput
    };
    analysisHistory.unshift(entry);
    if (analysisHistory.length > 20) analysisHistory = analysisHistory.slice(0, 20);
    localStorage.setItem('neuracore_history', JSON.stringify(analysisHistory));
    updateHistoryBadge();
}

function updateHistoryBadge() {
    const badge = document.getElementById('history-badge');
    const btn = document.getElementById('history-toggle-btn');
    if (analysisHistory.length > 0) {
        badge.textContent = analysisHistory.length;
        badge.style.display = 'flex';
        btn.classList.add('has-history');
    } else {
        badge.style.display = 'none';
        btn.classList.remove('has-history');
    }
}

function openHistory() {
    renderHistory();
    document.getElementById('history-drawer').classList.add('open');
    document.getElementById('history-backdrop').classList.add('open');
    playUiSound(528, 'sine', 0.1);
}

function closeHistory() {
    document.getElementById('history-drawer').classList.remove('open');
    document.getElementById('history-backdrop').classList.remove('open');
}

function getModeLabel(mode) {
    return { decode: '👁 Decode', roast: '🔥 Roast', boost: '🚀 Boost', compat: '⚡ Compat' }[mode] || mode;
}

function renderHistory() {
    const list = document.getElementById('history-list');
    if (analysisHistory.length === 0) {
        list.innerHTML = '<p class="history-empty">No analyses yet. Run your first analysis and it will appear here.</p>';
        return;
    }
    list.innerHTML = analysisHistory.map((entry, i) => `
        <div class="history-item" onclick="restoreFromHistory(${i})">
            <div class="history-item-meta">
                <span class="history-mode-badge mode-${entry.mode}">${getModeLabel(entry.mode)}</span>
                <span class="history-date">${new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="history-archetype">${entry.archetype}</div>
            ${entry.userName ? `<div class="history-user">— ${entry.userName}</div>` : ''}
            <div class="history-snippet">${entry.summary}...</div>
        </div>
    `).join('');
}

function restoreFromHistory(index) {
    const entry = analysisHistory[index];
    closeHistory();
    currentMode = entry.mode;
    lastResultText = buildShareText(entry.data, entry.mode);
    const glowBg = document.getElementById('glow-bg');
    glowBg.className = 'glow-bg';
    if (entry.mode === 'roast') glowBg.classList.add('mode-roast');
    else if (entry.mode === 'boost') glowBg.classList.add('mode-boost');
    else if (entry.mode === 'compat') glowBg.classList.add('mode-compat');
    if (entry.mode === 'compat') renderCompatResults(entry.data);
    else renderSoloResults(entry.mode, entry.data);
    prepareIdCard(entry.data, entry.mode, entry.userName);
    navigateTo('result');
    playUiSound(660, 'sine', 0.15);
}

function clearHistory() {
    if (!confirm('Clear all analysis history? This cannot be undone.')) return;
    analysisHistory = [];
    localStorage.removeItem('neuracore_history');
    renderHistory();
    updateHistoryBadge();
}

// ── API Key Management ─────────────────────────────────────────────────
function openApiModal() {
    const modal = document.getElementById('api-modal');
    modal.classList.remove('hidden');
    document.getElementById('api-key-input').value = apiKey ? '••••••••••••••••' : '';
    document.getElementById('api-status-note').textContent = '';
}

function closeApiModal() {
    document.getElementById('api-modal').classList.add('hidden');
}

function saveApiKey() {
    const input = document.getElementById('api-key-input').value.trim();
    const note = document.getElementById('api-status-note');
    if (!input || input.includes('•')) {
        note.textContent = apiKey ? '✓ Keeping existing key.' : 'No key entered. Using demo mode.';
        setTimeout(closeApiModal, 1200);
        return;
    }
    apiKey = input;
    localStorage.setItem('neuracore_api_key', apiKey);
    note.textContent = '✓ Key saved! AI Intelligence activated.';
    note.style.color = 'var(--accent-green)';
    updateApiStatusBadge();
    setTimeout(closeApiModal, 1500);
}

function updateApiStatusBadge() {
    const dot = document.querySelector('.status-dot');
    const text = document.getElementById('ai-status-text');
    if (apiKey) {
        dot.className = 'status-dot live';
        text.textContent = 'Live AI — Gemini Powered';
    } else {
        dot.className = 'status-dot demo';
        text.textContent = 'Demo Mode — Click to Connect AI';
    }
}

// ── Three.js Background ────────────────────────────────────────────────
let scene, camera, renderer, particles;
function initThree() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('three-canvas-container').appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    for (let i = 0; i < 6000; i++) {
        vertices.push(
            THREE.MathUtils.randFloatSpread(2000),
            THREE.MathUtils.randFloatSpread(2000),
            THREE.MathUtils.randFloatSpread(2000)
        );
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.PointsMaterial({ color: 0x9d50bb, size: 1.8, transparent: true, opacity: 0.7 });
    particles = new THREE.Points(geometry, material);
    scene.add(particles);
    camera.position.z = 1000;

    function animate() {
        requestAnimationFrame(animate);
        particles.rotation.x += 0.0003;
        particles.rotation.y += 0.0004;
        renderer.render(scene, camera);
    }
    animate();
}
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Web Audio API ──────────────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let ambientNodes = [];

function playUiSound(freq, type = 'sine', duration = 0.1) {
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
}

function setAmbientMode(mode) {
    ambientMode = mode;
    document.querySelectorAll('.sound-mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`snd-${mode}`).classList.add('active');
    if (ambientActive) {
        stopAmbient();
        startAmbient();
    }
}

function toggleAmbient() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const btn = document.getElementById('sound-toggle');
    if (ambientActive) {
        stopAmbient();
        btn.textContent = '🔇';
    } else {
        startAmbient();
        btn.textContent = '🔊';
    }
    ambientActive = !ambientActive;
}

function startAmbient() {
    // Base drone
    const freqMap = { neutral: [55, 82.5, 110], calm: [48, 72, 96], intense: [65, 97.5, 130] };
    const freqs = freqMap[ambientMode] || freqMap.neutral;
    freqs.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.value = freq;
        lfo.frequency.value = 0.2 + i * 0.15;
        lfoGain.gain.value = 2;
        gain.gain.value = 0.03 - i * 0.007;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        lfo.start();
        osc.start();
        ambientNodes.push(osc, gain, lfo, lfoGain);
    });
}

function stopAmbient() {
    ambientNodes.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch(e) {} });
    ambientNodes = [];
}

// ── Gemini AI Integration ──────────────────────────────────────────────
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function callGemini(prompt) {
    if (!apiKey) return null;
    try {
        const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.9, maxOutputTokens: 1200 }
            })
        });
        if (!res.ok) { console.error('Gemini error:', res.status); return null; }
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (e) {
        console.error('Gemini fetch failed:', e);
        return null;
    }
}

function buildDecodePrompt(input, name) {
    const ctx = name ? `The person's name is ${name}. ` : '';
    return `You are NEURACORE, an elite AI behavioral psychologist. ${ctx}Analyze the following user input and respond ONLY with a valid JSON object matching this exact schema (no markdown, no extra text):
{"archetype":"2-3 word archetype","summary":"2-3 insightful sentences","traits":[{"label":"Openness","score":0},{"label":"Conscientiousness","score":0},{"label":"Extraversion","score":0},{"label":"Agreeableness","score":0},{"label":"Emotional Stability","score":0}],"mbti_hint":"Most likely MBTI type with one-sentence reasoning","strengths":"2-3 specific hidden strengths","weaknesses":"2-3 specific blind spots","prediction":"5-year prediction: without change vs with change"}
User Input: """${input}"""`;
}

function buildRoastPrompt(input, name) {
    const ctx = name ? `The person's name is ${name}. ` : '';
    return `You are NEURACORE's Roast Engine. ${ctx}Savage, witty, brutally honest. Respond ONLY with valid JSON (no markdown):
{"archetype":"darkly funny 2-3 word roast archetype","reality_check":"3-4 sentence devastating but fair roast, specific to their text","myth_busted":"a belief they hold that is clearly false and why","blindspot":"the one thing sabotaging them they can't see","verdict":"one punchy final sentence that stings because it's true"}
User Input: """${input}"""`;
}

function buildBoostPrompt(input, name) {
    const ctx = name ? `The person's name is ${name}. ` : '';
    return `You are NEURACORE's Peak Performance Engine. ${ctx}Respond ONLY with valid JSON (no markdown):
{"archetype":"empowering 2-3 word archetype","foundation":"single most important mindset shift, be specific","strategy":"core strategic principle for their situation","blueprint":["Week 1: specific action","Week 2: specific action","Week 3: specific action","Week 4: specific action"],"superpower":"unique competitive advantage they are underusing"}
User Input: """${input}"""`;
}

function buildCompatPrompt(inputA, inputB) {
    return `You are NEURACORE's Neural Synergy Engine. Analyze two people's profiles and determine their compatibility. Respond ONLY with a valid JSON object (no markdown):
{
  "synergy_score": <0-100 integer, representing compatibility percentage>,
  "verdict": "A 3-5 word relationship/compatibility verdict (e.g. Explosive Creative Tension)",
  "dynamic": "2-3 sentences describing the core dynamic between these two people specifically.",
  "strengths": "What makes this pairing powerful, if anything. Be specific.",
  "tensions": "The fundamental clash point. Where will this relationship hit a wall?",
  "advice": "One specific, actionable piece of advice for these two people to maximize their synergy."
}
Person A: """${inputA}"""
Person B: """${inputB}"""`;
}

// ── Mock Response Fallbacks ─────────────────────────────────────────────
const mockDecodeData = {
    archetype: "The Aesthetic Pragmatist",
    summary: "You operate at the intersection of a systems engineer and a creative director. You are driven by the elimination of friction—you want things to work and look exceptional, and you find mediocrity physically uncomfortable.",
    traits: [
        { label: "Openness", score: 88 },
        { label: "Conscientiousness", score: 74 },
        { label: "Extraversion", score: 45 },
        { label: "Agreeableness", score: 52 },
        { label: "Emotional Stability", score: 63 }
    ],
    mbti_hint: "INTJ — High openness + low extraversion + strategic thinking pattern maps directly to the Architect profile: visionary, self-critical, and relentlessly systems-oriented.",
    strengths: "• Sunk-Cost Immunity: You pivot without ego-driven resistance.\n• Full-Stack Mindset: You track how backend changes impact user experience.\n• Aesthetic Intelligence: You see design as a strategic advantage, not decoration.",
    weaknesses: "• Perfectionism paralysis: You can obsess over presentation at the cost of shipping.\n• Scope creep: Every project becomes a canvas for new ideas before the old ones are solid.\n• Underestimates emotional bandwidth needed for collaboration.",
    prediction: "WITHOUT change: A brilliant solo operator who builds impressive things that never quite scale. WITH change: A product visionary who learns to trust a team and ships something world-class."
};

const mockRoastData = {
    archetype: "The Chaos Architect",
    reality_check: "You spend three hours debating font weights while your core logic is broken. You call it 'attention to detail.' It's actually avoidance. You're afraid your ideas aren't good enough, so you never finish testing them.",
    myth_busted: "You think you're a big-picture thinker. You are not. You're a 'next cool feature' thinker, which is very different. Big-picture thinkers finish things.",
    blindspot: "You unconsciously introduce complexity to make problems feel worthy of your intelligence. Simple, working solutions bore you—even when they're correct.",
    verdict: "You have the vision of a founder and the finishing rate of a procrastinator. Pick one to fix."
};

const mockBoostData = {
    archetype: "The Latent Titan",
    foundation: "Adopt 'Functional Freeze' periods: No new features, no aesthetic changes until the core logic passes three consecutive edge-case tests. Completion is the skill you need most.",
    strategy: "Apply the 'One Boring Week' rule monthly: Only bug fixes, tests, and documentation. This will feel like torture and produce your best work.",
    blueprint: [
        "Week 1: Logic Hardening — Achieve zero-bug baseline on core user flows",
        "Week 2: Performance Audit — Target sub-100ms response times across all interactions",
        "Week 3: Aesthetic Sprint — Execute one Awwwards-level polish pass with no scope changes",
        "Week 4: Scaling & Automation — Implement CI/CD and automate your most repeated manual task"
    ],
    superpower: "Your visual intelligence is a rare technical advantage. Most engineers can't think in design and systems simultaneously. You can. Stop treating it as a hobby and start deploying it as your primary competitive weapon."
};

const mockCompatData = {
    synergy_score: 74,
    verdict: "Complementary Creative Friction",
    dynamic: "Person A brings structure and relentless execution; Person B brings chaos and bold ideas. Together you can build things neither could alone—but only if you establish clear roles and trust each other's domain.",
    strengths: "A's discipline will ground B's ideas into reality. B's risk-taking will push A out of their comfort zone and into genuine innovation. The creative tension is the actual product.",
    tensions: "The fundamental clash: A optimizes for stability, B optimizes for novelty. This will manifest as arguments about when to ship vs. when to keep iterating. Neither is wrong. Both are right at different times.",
    advice: "Agree in advance on a 'lock-in' date for each project phase. B gets to go wild in ideation. A gets full authority in execution. This boundary is what will save you."
};

// ── Parse AI Response ──────────────────────────────────────────────────
function parseAIResponse(text) {
    try {
        const cleaned = text.replace(/```json|```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        return null;
    }
}

// ── SOLO ANALYSIS ──────────────────────────────────────────────────────
async function analyze(mode) {
    const input = document.getElementById('user-input').value;
    const userName = document.getElementById('user-name-input').value.trim();
    if (!input.trim()) {
        alert("Please write something first — the more you share, the better the analysis.");
        return;
    }

    lastInput = input;
    lastUserName = userName;

    currentMode = mode;
    const glowBg = document.getElementById('glow-bg');
    glowBg.className = 'glow-bg';
    if (mode === 'roast') glowBg.classList.add('mode-roast');
    else if (mode === 'boost') glowBg.classList.add('mode-boost');

    showLoader(mode);

    let aiData = null;
    if (apiKey) {
        const promptFn = { decode: buildDecodePrompt, roast: buildRoastPrompt, boost: buildBoostPrompt }[mode];
        const rawText = await callGemini(promptFn(input, userName));
        if (rawText) aiData = parseAIResponse(rawText);
    }

    const fallbackMap = { decode: mockDecodeData, roast: mockRoastData, boost: mockBoostData };
    const data = aiData || fallbackMap[mode];
    lastResultText = buildShareText(data, mode);
    saveToHistory(mode, data, input, userName);

    hideLoader();
    renderSoloResults(mode, data);
    prepareIdCard(data, mode, userName);
    navigateTo('result');
}

function buildShareText(data, mode) {
    const blurb = data.summary || data.reality_check || data.foundation || '';
    return `My NEURACORE result: ${data.archetype || ''}. "${blurb.substring(0, 120)}..." — neuracore.ai`;
}

function renderSoloResults(mode, data) {
    document.getElementById('compat-score-container').classList.add('hidden');

    const title = document.getElementById('result-title');
    const container = document.getElementById('results-container');
    container.innerHTML = '';

    const titleMap = {
        decode: `<span class="gradient-text">Your Personality Report</span>`,
        roast:  `<span class="gradient-text">The Honest Truth</span>`,
        boost:  `<span class="gradient-text">Your Success Plan</span>`
    };
    title.innerHTML = titleMap[mode];

    const cardsMap = {
        decode: [
            { title: "Your Personality Type",  content: data.archetype },
            { title: "Personality Summary",     content: data.summary },
            { title: "Personality Style (MBTI)", content: data.mbti_hint || 'Not available.' },
            { title: "Your Strengths",           content: (data.strengths || '').replace(/\n/g, '<br>') },
            { title: "Areas to Work On",         content: (data.weaknesses || '').replace(/\n/g, '<br>') },
            { title: "Where You're Headed",     content: data.prediction },
        ],
        roast: [
            { title: "Your Personality Type",   content: data.archetype },
            { title: "The Honest Truth",         content: data.reality_check },
            { title: "What You've Got Wrong",   content: data.myth_busted },
            { title: "Your Biggest Weakness",   content: data.blindspot },
            { title: "The Bottom Line",          content: `<em style="color: var(--accent-pink)">${data.verdict}</em>` },
        ],
        boost: [
            { title: "Your Type",               content: data.archetype },
            { title: "First, Change This",      content: data.foundation },
            { title: "Your Game Plan",          content: data.strategy },
            { title: "Your Biggest Strength",  content: data.superpower },
        ]
    };

    const cards = cardsMap[mode];
    cards.forEach((card, i) => {
        appendCard(container, card.title, card.content, i);
    });

    if (mode === 'boost' && data.blueprint) {
        const bpCard = document.createElement('div');
        bpCard.className = 'result-card';
        bpCard.style.animationDelay = `${cards.length * 0.2}s`;
        bpCard.innerHTML = `
            <div class="card-title">Your 30-Day Action Plan</div>
            <ul class="blueprint-list">
                ${data.blueprint.map(item => {
                    const [week, ...rest] = item.split(':');
                    return `<li class="blueprint-item"><span class="blueprint-week">${week.trim()}</span><span>${rest.join(':').trim()}</span></li>`;
                }).join('')}
            </ul>
        `;
        container.appendChild(bpCard);
        setTimeout(() => bpCard.classList.add('show'), 50);

        const dlBtn = document.createElement('button');
        dlBtn.className = 'btn-secondary';
        dlBtn.style.cssText = 'margin-top: 1.5rem; display: block; margin-left: auto; margin-right: auto;';
        dlBtn.innerText = '⬇ Download Blueprint (.txt)';
        dlBtn.onclick = () => downloadBlueprint(data.blueprint);
        container.appendChild(dlBtn);
    }

    // Render trait radar for decode mode
    if (mode === 'decode' && data.traits) {
        renderTraitRadar(data.traits);
    } else {
        document.getElementById('radar-container').classList.add('hidden');
    }

    // Prep identity card
    prepareIdCard(data, mode, lastUserName);
    updateSwitchBtns(mode);
    document.getElementById('switch-mode-panel').style.display = '';
}

function updateSwitchBtns(activeMode) {
    ['decode', 'roast', 'boost'].forEach(m => {
        const btn = document.getElementById(`switch-${m}`);
        if (!btn) return;
        btn.disabled = (m === activeMode);
        btn.style.opacity = (m === activeMode) ? '0.35' : '1';
        btn.style.cursor = (m === activeMode) ? 'default' : 'pointer';
    });
}

async function switchMode(mode) {
    if (!lastInput) return;
    currentMode = mode;
    const glowBg = document.getElementById('glow-bg');
    glowBg.className = 'glow-bg';
    if (mode === 'roast') glowBg.classList.add('mode-roast');
    else if (mode === 'boost') glowBg.classList.add('mode-boost');

    showLoader(mode);
    let aiData = null;
    if (apiKey) {
        const promptFn = { decode: buildDecodePrompt, roast: buildRoastPrompt, boost: buildBoostPrompt }[mode];
        const rawText = await callGemini(promptFn(lastInput, lastUserName));
        if (rawText) aiData = parseAIResponse(rawText);
    }
    const data = aiData || { decode: mockDecodeData, roast: mockRoastData, boost: mockBoostData }[mode];
    lastResultText = buildShareText(data, mode);
    saveToHistory(mode, data, lastInput, lastUserName);
    hideLoader();
    renderSoloResults(mode, data);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function appendCard(container, titleText, contentHtml, index) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.style.animationDelay = `${index * 0.15}s`;
    card.innerHTML = `<div class="card-title">${titleText}</div><div class="card-content">${contentHtml}</div>`;
    container.appendChild(card);
    setTimeout(() => card.classList.add('show'), 50);
}

// ── COMPATIBILITY ANALYSIS ─────────────────────────────────────────────
async function analyzeCompatibility() {
    const inputA = document.getElementById('compat-input-a').value.trim();
    const inputB = document.getElementById('compat-input-b').value.trim();
    if (!inputA || !inputB) {
        alert('Both profiles are required for Neural Synergy analysis.');
        return;
    }

    showLoader('compat');

    let data = null;
    if (apiKey) {
        const raw = await callGemini(buildCompatPrompt(inputA, inputB));
        if (raw) data = parseAIResponse(raw);
    }
    data = data || mockCompatData;
    lastResultText = `Our Compatibility Score: ${data.synergy_score}% — "${data.verdict}". Analysed by NEURACORE.`;
    saveToHistory('compat', data, inputA + ' | ' + inputB, '');

    hideLoader();
    renderCompatResults(data);
    navigateTo('result');
    document.getElementById('switch-mode-panel').style.display = 'none';
}

function renderCompatResults(data) {
    document.getElementById('radar-container').classList.add('hidden');
    document.getElementById('result-title').innerHTML = `<span class="gradient-text">⚡ Neural Synergy Report</span>`;
    const container = document.getElementById('results-container');
    container.innerHTML = '';

    // Synergy score ring
    renderSynergyGauge(data.synergy_score, data.verdict);

    const cards = [
        { title: "The Synergy Verdict", content: data.verdict },
        { title: "The Dynamic", content: data.dynamic },
        { title: "What Makes It Work", content: data.strengths },
        { title: "The Tension Point", content: data.tensions },
        { title: "Strategic Advice", content: data.advice },
    ];
    cards.forEach((card, i) => appendCard(container, card.title, card.content, i));

    // Prep ID card for compat
    prepareIdCard({ archetype: data.verdict, summary: data.dynamic, traits: [] }, 'compat');
}

// ── CHART: Trait Radar ─────────────────────────────────────────────────
function renderTraitRadar(traits) {
    const container = document.getElementById('radar-container');
    container.classList.remove('hidden');
    if (radarChart) radarChart.destroy();

    const ctx = document.getElementById('traitRadar').getContext('2d');
    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: traits.map(t => t.label),
            datasets: [{
                label: 'Neural Profile',
                data: traits.map(t => t.score),
                backgroundColor: 'rgba(33, 230, 255, 0.12)',
                borderColor: 'rgba(33, 230, 255, 0.8)',
                pointBackgroundColor: 'rgba(157, 80, 187, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(33, 230, 255, 1)',
                borderWidth: 2,
                pointRadius: 5,
            }]
        },
        options: {
            responsive: true,
            scales: {
                r: {
                    min: 0, max: 100,
                    grid: { color: 'rgba(255,255,255,0.08)' },
                    angleLines: { color: 'rgba(255,255,255,0.08)' },
                    pointLabels: {
                        color: 'rgba(255,255,255,0.7)',
                        font: { family: 'Outfit', size: 12 }
                    },
                    ticks: { display: false }
                }
            },
            plugins: {
                legend: { display: false }
            },
            animation: {
                duration: 1200,
                easing: 'easeOutQuart'
            }
        }
    });
}

// ── CHART: Synergy Gauge ───────────────────────────────────────────────
function renderSynergyGauge(score, verdict) {
    const wrapper = document.getElementById('compat-score-container');
    wrapper.classList.remove('hidden');
    document.getElementById('synergy-number').textContent = score;
    document.getElementById('synergy-verdict').textContent = verdict;

    if (synergyChart) synergyChart.destroy();
    const ctx = document.getElementById('synergyGauge').getContext('2d');

    const getScoreColor = (s) => {
        if (s >= 80) return '#00f5a0';
        if (s >= 60) return '#21e6ff';
        if (s >= 40) return '#9d50bb';
        return '#ff0080';
    };

    synergyChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [score, 100 - score],
                backgroundColor: [getScoreColor(score), 'rgba(255,255,255,0.05)'],
                borderColor: 'transparent',
                borderWidth: 0,
            }]
        },
        options: {
            cutout: '75%',
            rotation: -90,
            circumference: 360,
            responsive: true,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            animation: { duration: 1500, easing: 'easeOutQuart' }
        }
    });
}

// ── LOADER ─────────────────────────────────────────────────────────────
const loaderTexts = {
    decode: ["Reading your words...", "Checking personality traits...", "Finding patterns...", "Looking at your future...", "Almost done..."],
    roast:  ["Getting ready to be honest...", "Finding what to say...", "No sugar-coating...", "This might sting a little...", "Almost ready..."],
    boost:  ["Finding your strengths...", "Building your plan...", "Working out the best path...", "Putting it all together...", "Almost there..."],
    compat: ["Reading both profiles...", "Comparing personalities...", "Finding common ground...", "Spotting the differences...", "Almost done..."]
};

async function showLoader(mode) {
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loader-text');
    const loaderBar = document.getElementById('loader-bar');
    loader.classList.remove('hidden');
    const texts = loaderTexts[mode] || loaderTexts.decode;
    for (let i = 0; i < texts.length; i++) {
        loaderText.innerText = texts[i];
        loaderBar.style.width = `${((i + 1) / texts.length) * 100}%`;
        await new Promise(r => setTimeout(r, 700));
    }
}

function hideLoader() {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('loader-bar').style.width = '0%';
}

// ── ID CARD ────────────────────────────────────────────────────────────
function prepareIdCard(data, mode, userName) {
    const displayName = userName
        ? userName.toUpperCase()
        : (data.archetype || 'THE UNKNOWN').toUpperCase();
    document.getElementById('card-username').innerText = displayName;
    const insight = data.summary || data.reality_check || data.foundation || '';
    document.getElementById('card-insight').innerText = `"${insight.substring(0, 110)}..."`;

    const statsContainer = document.getElementById('card-stats');
    statsContainer.innerHTML = '';

    const defaultStats = [
        { label: 'Intelligence', value: 82 },
        { label: mode === 'roast' ? 'Chaos' : 'Vision', value: mode === 'roast' ? 95 : 88 },
        { label: 'Design', value: 90 },
        { label: 'Ambition', value: 87 }
    ];

    const stats = (data.traits && data.traits.length > 0)
        ? data.traits.slice(0, 4).map(t => ({ label: t.label, value: t.score }))
        : defaultStats;

    stats.forEach(stat => {
        statsContainer.innerHTML += `
            <div class="stat-row">
                <span class="stat-label">${stat.label}</span>
                <div class="stat-bar-bg">
                    <div class="stat-bar-fill" style="width: ${stat.value}%"></div>
                </div>
            </div>`;
    });
}

// ── SHARING ────────────────────────────────────────────────────────────
async function shareResult() {
    const btn = document.getElementById('share-btn');
    const original = btn.innerHTML;
    btn.innerText = "Generating ID Card...";
    btn.disabled = true;

    const idCard = document.getElementById('id-card');
    try {
        const canvas = await html2canvas(idCard, { backgroundColor: "#050508", scale: 2 });
        const image = canvas.toDataURL("image/png");
        const link = document.createElement('a');
        link.download = `neuracore_id_${Date.now()}.png`;
        link.href = image;
        link.click();
        playUiSound(660, 'sine', 0.2);
        btn.innerText = "✓ Downloaded! Share it.";
    } catch (err) {
        console.error("Card generation failed", err);
        btn.innerText = "Error generating. Try again.";
    }
    setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 2500);
}

function shareToTwitter() {
    const text = encodeURIComponent(lastResultText || 'I just got analyzed by NEURACORE AI. The results are wild. — neuracore.ai');
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
}

async function shareGeneric() {
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'My NEURACORE AI Analysis',
                text: lastResultText || 'Check out my NEURACORE AI behavioral analysis!',
                url: 'https://neuracore.ai'
            });
        } catch(e) { /* dismissed */ }
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(lastResultText).then(() => {
            const btn = document.querySelector('.btn-social.native');
            const orig = btn.innerText;
            btn.innerText = '✓ Copied!';
            setTimeout(() => btn.innerText = orig, 2000);
        });
    }
}

function downloadBlueprint(blueprint) {
    const content = `NEURACORE — 30-Day Success Blueprint\nGenerated: ${new Date().toLocaleDateString()}\n\n` + blueprint.join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `neuracore_30day_blueprint_${Date.now()}.txt`;
    link.click();
}
