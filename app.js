// ══════════════════════════════════════════
// Gra w Rymy — shared game engine (locale-agnostic)
// Reads window.APP_CONFIG and window.STRINGS, injected per-locale
// by the page's inline <script> block before this file loads.
// ══════════════════════════════════════════

const CONFIG  = window.APP_CONFIG;
const STRINGS = window.STRINGS;

// ══════════════════════════════════════════
// LANGUAGE SUGGESTION MODAL
// Suggests a language based on the visitor's browser locale, not the
// page's own — deliberately independent of STRINGS/CONFIG.locale so it
// speaks the *suggested* language, e.g. a German browser lands on the
// Polish page: modal text renders in German, not Polish.
// ══════════════════════════════════════════
const LANGUAGES = {
    pl: { path: '/',    headline: 'Zagraj po polsku?',    switchBtn: 'Zagraj po polsku',   stayBtn: 'Zostań tutaj' },
    de: { path: '/de/', headline: 'Auf Deutsch spielen?', switchBtn: 'Auf Deutsch spielen', stayBtn: 'Hier bleiben' },
    es: { path: '/es/', headline: '¿Jugar en español?',   switchBtn: 'Jugar en español',    stayBtn: 'Quedarme aquí' },
    en: { path: '/en/', headline: 'Play in English?',     switchBtn: 'Play in English',     stayBtn: 'Stay here' },
};

function dismissLangBanner() {
    localStorage.setItem('rap_lang_banner_dismissed', '1');
    hideModal('modalLangSuggest');
}

(function initLangBanner() {
    if (localStorage.getItem('rap_lang_banner_dismissed')) return;
    // Don't stack on top of the first-visit tutorial modal — try again next visit instead.
    if (!localStorage.getItem('rap_tutorial')) return;
    const browserLang = (navigator.language || '').slice(0, 2).toLowerCase();
    const suggestion = LANGUAGES[browserLang];
    if (!suggestion || browserLang === CONFIG.locale) return;
    document.getElementById('langSuggestText').textContent = suggestion.headline;
    document.getElementById('langSuggestStay').textContent = suggestion.stayBtn;
    const goBtn = document.getElementById('langSuggestGo');
    goBtn.textContent = suggestion.switchBtn;
    goBtn.onclick = () => { window.location.href = suggestion.path; };
    showModal('modalLangSuggest');
})();

// ══════════════════════════════════════════
// SUPABASE
// ══════════════════════════════════════════
const SUPABASE_URL      = 'https://jexmqozhplyddyupeaxl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-qMhTqpHlQQbyVwsq4tTVA_AUo1WRP_';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

sb.auth.onAuthStateChange((_, session) => {
    currentUser = session?.user || null;
    updateUserUI();
});

// ══════════════════════════════════════════
// ROW LIMIT
// ══════════════════════════════════════════
function DAILY_LIMIT() { return currentUser ? CONFIG.dailyLimitRegistered : CONFIG.dailyLimitFree; }
const STORAGE_KEY = 'rap_rows';

function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

function getRowsToday() {
    try {
        const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return d.date === todayKey() ? (d.count || 0) : 0;
    } catch { return 0; }
}

function addRow() {
    const count = getRowsToday() + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), count }));
    updateCounter();
    return count;
}

function isLimited() {
    return !currentUser && getRowsToday() >= DAILY_LIMIT();
}

function updateCounter() {
    const el = document.getElementById('rowCounter');
    if (isPaid()) { el.classList.add('hidden'); return; }
    const n = getRowsToday();
    el.classList.remove('hidden', 'warning', 'danger');
    el.innerHTML = `${STRINGS.counterLabel}: <span>${n}</span> / ${DAILY_LIMIT()}`;
    if (n >= DAILY_LIMIT())     el.classList.add('danger');
    else if (n >= DAILY_LIMIT() * 0.7) el.classList.add('warning');
}

// ══════════════════════════════════════════
// TUTORIAL
// ══════════════════════════════════════════
function closeTutorial() {
    localStorage.setItem('rap_tutorial', '1');
    hideModal('modalTutorial');
    window.umami?.track('tutorial_completed');
}

if (!localStorage.getItem('rap_tutorial')) {
    document.getElementById('modalTutorial').classList.remove('hidden');
} else {
    hideModal('modalTutorial');
}

// ══════════════════════════════════════════
// PREMIUM
// ══════════════════════════════════════════
const PREMIUM_FEATURES = {
    beat: { icon: '🎵', title: STRINGS.premiumBeatTitle, desc: STRINGS.premiumBeatDesc },
    ads:  { icon: '✨', title: STRINGS.premiumAdsTitle,  desc: STRINGS.premiumAdsDesc },
};

let currentPremiumAction = null;

function isPaid() {
    return currentUser?.user_metadata?.paid === true;
}

function premiumAction(feature) {
    // free users still get a beat picker (daily + one more) — full paywall
    // gate only applies to features with no free tier at all
    if (feature === 'beat') { openBeatPicker(); return; }
    if (isPaid()) {
        if (feature === 'ads') alert(STRINGS.premiumAdsDisabledAlert);
        return;
    }
    showPaywall(feature);
}

function showPaywall(feature) {
    currentPremiumAction = feature;
    window.umami?.track('paywall_shown', { feature });
    const f = PREMIUM_FEATURES[feature];
    document.getElementById('paywallIcon').textContent  = f.icon;
    document.getElementById('paywallTitle').textContent = f.title;
    document.getElementById('paywallDesc').textContent  = f.desc;

    document.getElementById('paywallCta').textContent = !currentUser
        ? STRINGS.premiumUnlockLoginCta
        : STRINGS.premiumUnlockCta;

    showModal('modalPaywall');
}

function paywallCtaClick() {
    hideModal('modalPaywall');
    if (!currentUser) {
        window.umami?.track('paywall_cta_click', { authed: false, feature: currentPremiumAction });
        openAuth('register');
    } else {
        window.umami?.track('checkout_started', { feature: currentPremiumAction });
        const url = CONFIG.stripePaymentLink
            + '?prefilled_email=' + encodeURIComponent(currentUser.email)
            + '&client_reference_id=' + currentUser.id;
        window.location.href = url;
    }
}

function updatePremiumUI() {
    const paid = isPaid();
    ['btnChangeBeat'].forEach(id => {
        document.getElementById(id)?.classList.toggle('unlocked', paid);
    });
}

// sprawdź po powrocie ze Stripe (?payment=success)
if (new URLSearchParams(location.search).get('payment') === 'success') {
    sb.auth.refreshSession().then(() => updatePremiumUI());
}

// ══════════════════════════════════════════
// AUTH UI
// ══════════════════════════════════════════
let authMode = 'register';

function openAuth(mode = 'register') {
    if (currentUser) { sb.auth.signOut(); return; }
    authMode = mode;
    updateAuthModal();
    showModal('modalAuth');
}

function updateAuthModal() {
    const isReg = authMode === 'register';
    document.getElementById('authTitle').textContent    = isReg ? STRINGS.authRegisterTitle : STRINGS.authLoginTitle;
    document.getElementById('authSubtitle').textContent = isReg ? STRINGS.authRegisterSubtitle : STRINGS.authLoginSubtitle;
    document.getElementById('authSubmit').textContent   = isReg ? STRINGS.authRegisterSubmit : STRINGS.authLoginSubmit;
    document.getElementById('authToggle').innerHTML     = isReg
        ? STRINGS.authToggleToLogin
        : STRINGS.authToggleToRegister;
    document.getElementById('authError').textContent = '';
}

function toggleAuthMode() {
    authMode = authMode === 'register' ? 'login' : 'register';
    updateAuthModal();
}

async function submitAuth() {
    const email    = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const errEl    = document.getElementById('authError');
    errEl.textContent = '';

    if (!email || !password) { errEl.textContent = STRINGS.authFillBoth; return; }

    const btn = document.getElementById('authSubmit');
    btn.disabled = true;
    btn.textContent = '…';

    const fn = authMode === 'register'
        ? sb.auth.signUp({ email, password })
        : sb.auth.signInWithPassword({ email, password });

    const { error } = await fn;

    btn.disabled = false;
    updateAuthModal();

    if (error) {
        errEl.textContent = error.message;
    } else {
        if (authMode === 'register') {
            errEl.style.color = '#7ee870';
            errEl.textContent = STRINGS.authCheckEmail;
            window.umami?.track('signed_up');
        } else {
            hideModal('modalAuth');
            window.umami?.track('logged_in');
        }
    }
}

function updateUserUI() {
    const authBtn = document.getElementById('authBtn');
    if (currentUser) {
        authBtn.textContent = currentUser.email.split('@')[0] + STRINGS.authLogoutSuffix;
        authBtn.classList.add('logged-in');
    } else {
        authBtn.textContent = STRINGS.authLoginBtn;
        authBtn.classList.remove('logged-in');
    }
    updateCounter();
    updatePremiumUI();
}

// ══════════════════════════════════════════
// MODAL HELPERS
// ══════════════════════════════════════════
function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id) { document.getElementById(id).classList.add('hidden'); }

// ══════════════════════════════════════════
// GAME
// ══════════════════════════════════════════
const THEMES = [
    { bg: '#132b0a', border: '#3f8f1a', text: '#7cdb4a' },
    { bg: '#2a2a2a', border: '#767676', text: '#d4d4d4' },
];

const CELL_W = 150, CELL_H = 64, GAP = 8, ROW_H = CELL_H + GAP, AHEAD = 20;
const COUNTDOWN_SEC = 3; // also caps how long a beat's intro is skipped before start

let allPairs = [], cells = [], rowCount = 0, pairIndex = 0, currentCell = 0;
let stepTimer = null, countdownTimer = null, running = false;
let beatBpm = 100, firstBeat = 0, beatDurSec = 60 / 100;

let libraryBeats = [], selectedBeat = null, dailyBeatId = null;

const gridScroll = document.getElementById('gridScroll');
const dot        = document.getElementById('dot');
const ball       = document.getElementById('rapBall');
const btn        = document.getElementById('btn');
const audio      = document.getElementById('audio');
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownNumber  = document.getElementById('countdownNumber');

// tracks the active cell's column AND row — the row it lands above is
// always slot 0 (very first row) or slot 1 thereafter, since updateScroll()
// keeps the active row pinned to that position once scrolling starts
function updateBall(cellIndex) {
    const col      = cellIndex % 4;
    const rowSlot  = Math.floor(cellIndex / 4) === 0 ? 0 : 1;
    const hopDur   = Math.min(beatDurSec, 0.45);

    ball.style.transitionDuration = hopDur + 's';
    ball.style.left = (col * (CELL_W + GAP) + CELL_W / 2) + 'px';
    ball.style.top  = (rowSlot * ROW_H) + 'px';
    ball.classList.remove('idle');
    ball.style.animation = 'none';
    void ball.offsetWidth; // restart the bounce keyframe from 0%
    ball.style.animation = `ballHop ${hopDur}s ease-in-out`;
}

async function loadBeat(infoPath, audioPath) {
    const info = await fetch(infoPath).then(r => r.json()).catch(() => null);
    if (info) {
        beatBpm    = info.bpm;
        firstBeat  = info.first_beat;
        beatDurSec = 60 / beatBpm;
        document.getElementById('status').textContent =
            `${info.title || ''} · ${beatBpm.toFixed(1)} BPM · start ${firstBeat.toFixed(2)}s`;
    }
    audio.src = audioPath;
    await new Promise(res => { audio.oncanplaythrough = res; audio.load(); });
}

async function loadLibraryBeat(beat) {
    beatBpm    = beat.bpm;
    firstBeat  = beat.first_beat;
    beatDurSec = 60 / beatBpm;
    selectedBeat = beat;
    document.getElementById('status').textContent =
        `${beat.title} · ${beatBpm.toFixed(1)} BPM`;
    audio.src = beat.audio_url;
    await new Promise(res => {
        audio.oncanplaythrough = res;
        audio.onerror = res;
        audio.load();
        setTimeout(res, 6000);
    });
}

function dailyIndex(beats) {
    const dateStr = new Date().toISOString().slice(0, 10);
    let hash = 0;
    for (const c of dateStr) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    return hash % beats.length;
}

async function loadTodayBeat() {
    try {
        const { data, error } = await sb.from('beats').select('*').order('created_at');
        if (!error && data?.length) {
            libraryBeats = data;
            const daily = data.find(b => b.is_daily) ?? data[dailyIndex(data)];
            dailyBeatId = daily.id;
            await loadLibraryBeat(daily);
            return;
        }
    } catch {}

    // fallback: stary beats_index.json (shared across locales, lives at site root)
    try {
        const today = new Date().toISOString().slice(0, 10);
        const index = await fetch('/beats_index.json').then(r => r.json());
        const entry = index.find(b => b.date === today) || index[0];
        if (entry) {
            await loadBeat(entry.info, entry.info.replace('.json', '.mp3'));
            return;
        }
    } catch {}
    await loadBeat('/beat_info.json', '/beat.mp3').catch(() => {});
}

function openBeatPicker() {
    renderBeatList();
    showModal('modalBeatPicker');
}

function renderBeatList() {
    const el = document.getElementById('beatList');
    const upsell = document.getElementById('beatUpsell');
    if (libraryBeats.length === 0) {
        el.innerHTML = `<div class="beat-list-empty">${STRINGS.beatEmpty}</div>`;
        upsell.classList.add('hidden');
        return;
    }
    const paid = isPaid();
    // free users see only the daily beat + one more, with an upsell to unlock the rest
    let visibleBeats = libraryBeats;
    if (!paid) {
        const daily  = libraryBeats.find(b => b.id === dailyBeatId);
        const second = libraryBeats.find(b => b.id !== dailyBeatId);
        visibleBeats = [daily, second].filter(Boolean);
    }
    el.innerHTML = '';
    visibleBeats.forEach(beat => {
        const isSelected = selectedBeat?.id === beat.id;
        const isDaily    = beat.id === dailyBeatId;
        const item = document.createElement('div');
        item.className = 'beat-item' + (isSelected ? ' selected' : '');
        item.innerHTML = `
            <div>
                <div class="beat-item-title">${beat.title}</div>
                <div class="beat-item-meta">
                    ${beat.bpm.toFixed(1)} BPM
                    ${isDaily ? `<span class="beat-daily-badge">${STRINGS.beatDailyBadge}</span>` : ''}
                </div>
            </div>
            <div style="color:#c49a00;font-size:1rem">${isSelected ? '▶' : ''}</div>
        `;
        item.onclick = () => selectLibraryBeat(beat);
        el.appendChild(item);
    });
    upsell.classList.toggle('hidden', paid || libraryBeats.length <= visibleBeats.length);
}

async function selectLibraryBeat(beat) {
    if (running) stopAll();
    await loadLibraryBeat(beat);
    hideModal('modalBeatPicker');
}

// ══════════════════════════════════════════
// SHARE (hrefs built here so per-locale text doesn't need
// hand-encoded URLs baked into the template)
// ══════════════════════════════════════════
function initShareLinks() {
    const url = encodeURIComponent(CONFIG.canonicalUrl);
    const waText = encodeURIComponent(STRINGS.shareNativeText + ' — ' + CONFIG.canonicalUrl);
    const twText = encodeURIComponent(STRINGS.shareNativeText);
    document.getElementById('shareWa').href = `https://wa.me/?text=${waText}`;
    document.getElementById('shareFb').href = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    document.getElementById('shareTw').href = `https://twitter.com/intent/tweet?text=${twText}&url=${url}`;
}

function handleShare() {
    if (navigator.share) {
        navigator.share({
            title: STRINGS.shareNativeTitle,
            text: STRINGS.shareNativeText,
            url: CONFIG.canonicalUrl
        }).catch(() => {});
    } else {
        document.getElementById('sharePanel').classList.toggle('hidden');
    }
}

async function copyLink() {
    const btn = document.getElementById('copyBtn');
    try {
        await navigator.clipboard.writeText(CONFIG.canonicalUrl);
        btn.textContent = STRINGS.copySuccess;
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = STRINGS.copyDefault;
            btn.classList.remove('copied');
        }, 2200);
    } catch {
        prompt(STRINGS.copyPromptLabel, CONFIG.canonicalUrl);
    }
}

Promise.all([
    fetch(CONFIG.dataPath).then(r => r.json()),
    sb.auth.getSession(),
    loadTodayBeat(),
]).then(([pairs, { data: sessionData }]) => {
    currentUser = sessionData.session?.user || null;
    updateUserUI();
    initShareLinks();
    allPairs = pairs;
    initGrid();
    btn.textContent = STRINGS.statusStart;
    btn.disabled = false;
    updateCounter();
});

function randPair() { return allPairs[Math.floor(Math.random() * allPairs.length)]; }

function appendPair() {
    const pair = randPair(), theme = THEMES[pairIndex % 2];
    pairIndex++;
    pair.forEach(word => {
        const rowEl = document.createElement('div');
        rowEl.className = 'grid-row';
        for (let c = 0; c < 3; c++) {
            const d = document.createElement('div');
            d.className = 'cell blank';
            rowEl.appendChild(d);
            cells.push(d);
        }
        const d = document.createElement('div');
        d.className = 'cell';
        d.style.background  = theme.bg;
        d.style.borderColor = theme.border;
        d.style.color       = theme.text;
        d.textContent       = word;
        rowEl.appendChild(d);
        cells.push(d);
        gridScroll.appendChild(rowEl);
        rowCount++;
    });
}

function ensureAhead() {
    const curRow = Math.floor(currentCell / 4);
    while (rowCount - curRow < AHEAD) appendPair();
}

function initGrid() {
    gridScroll.innerHTML = '';
    gridScroll.style.transform = 'translateY(0)';
    cells = []; rowCount = 0; pairIndex = 0; currentCell = 0;
    for (let i = 0; i < AHEAD; i++) appendPair();
}

function updateScroll() {
    const curRow = Math.floor(currentCell / 4);
    gridScroll.style.transform = `translateY(-${Math.max(0, curRow - 1) * ROW_H}px)`;
}

function step() {
    // check limit at the start of each new row
    if (currentCell % 4 === 0 && currentCell > 0) {
        const count = addRow();
        if (!currentUser && count > DAILY_LIMIT()) {
            stopAll();
            showModal('modalLimit');
            window.umami?.track('daily_limit_hit');
            return;
        }
    }

    ensureAhead();

    const prev = currentCell - 1;
    const curRow  = Math.floor(currentCell / 4);
    const prevRow = Math.floor(prev / 4);

    if (prev >= 0 && cells[prev]) {
        cells[prev].classList.remove('active');
        if (curRow === prevRow) cells[prev].classList.add('passed');
    }
    if (currentCell % 4 === 0 && currentCell > 0) {
        for (let i = prevRow * 4; i < prevRow * 4 + 4; i++)
            if (cells[i]) cells[i].classList.remove('passed');
    }

    cells[currentCell].classList.add('active');
    if (currentCell % 4 === 0) updateScroll();
    updateBall(currentCell);

    dot.classList.remove('dim');
    setTimeout(() => dot.classList.add('dim'), 110);

    currentCell++;
    scheduleNext();
}

function scheduleNext() {
    if (!running) return;
    if (audio.paused) { stopAll(); return; }
    const now      = audio.currentTime;
    const elapsed  = now - firstBeat;
    const nextBeat = Math.ceil(elapsed / beatDurSec + 0.02);
    const delay    = (firstBeat + nextBeat * beatDurSec - now) * 1000;
    stepTimer = setTimeout(step, Math.max(50, delay));
}

function waitForFirstBeat() {
    const delay = (firstBeat - audio.currentTime) * 1000;
    stepTimer = delay > 0
        ? setTimeout(waitForFirstBeat, Math.min(delay, 50))
        : setTimeout(step, 0);
}

// Runs the countdown UI (3, 2, 1) on its own real-time clock while the beat
// plays underneath, then hands off to onDone. Always takes COUNTDOWN_SEC,
// regardless of the beat's own intro length (see toggleGame's seek).
function startCountdown(onDone) {
    let n = COUNTDOWN_SEC;
    const renderTick = () => {
        countdownNumber.textContent = n;
        countdownNumber.classList.remove('pop');
        void countdownNumber.offsetWidth; // restart the pop keyframe from 0%
        countdownNumber.classList.add('pop');
    };
    countdownOverlay.classList.remove('hidden');
    renderTick();
    const tick = () => {
        n--;
        if (n > 0) {
            renderTick();
            countdownTimer = setTimeout(tick, 1000);
        } else {
            countdownOverlay.classList.add('hidden');
            onDone();
        }
    };
    countdownTimer = setTimeout(tick, 1000);
}

function cancelCountdown() {
    clearTimeout(countdownTimer);
    countdownOverlay.classList.add('hidden');
}

function stopAll() {
    clearTimeout(stepTimer);
    cancelCountdown();
    running = false;
    audio.pause();
    audio.currentTime = 0;
    if (cells[currentCell - 1]) cells[currentCell - 1].classList.remove('active');
    dot.classList.add('dim');
    ball.classList.add('idle');
    ball.style.animation = 'none';
    btn.textContent = STRINGS.statusStart;
    btn.classList.remove('running');
    initGrid();
}

audio.addEventListener('pause', () => {
    if (running) stopAll();
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden && running) stopAll();
});

function toggleGame() {
    if (running) { stopAll(); return; }
    if (isLimited()) { showModal('modalLimit'); return; }
    window.umami?.track('game_started', { paid: isPaid(), logged_in: !!currentUser });
    running = true;
    btn.textContent = STRINGS.statusStop;
    btn.classList.add('running');
    initGrid();
    // skip straight to COUNTDOWN_SEC before the first beat so a long intro
    // (e.g. 50s) never makes the player wait — audio still plays underneath
    // the countdown, so short intros are heard in full as before
    audio.currentTime = Math.max(0, firstBeat - COUNTDOWN_SEC);
    audio.play().catch(() => stopAll());
    startCountdown(waitForFirstBeat);
}
