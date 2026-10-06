/* Adventure Dog Club booking demo.
   Everything lives in localStorage; there is no backend and no real payment. */
(() => {
  'use strict';

  const STORE_KEY = 'adc-demo-v1';
  const CLASS_CAP = 6;
  const STANDARD_LIMIT = 5;
  const FIELDS_PER_BOOKING = 9; // name, email, phone, dog name/breed/age, membership code, waiver, notes
  const MINUTES_PER_BOOKING = 3;
  const LOCATION = 'Summit Dog Training, 2906 E. Mulberry Street, Fort Collins, CO 80524';

  const TIERS = {
    standard: { name: 'Standard', price: 250, desc: 'Up to 5 drop-in classes / month', limit: STANDARD_LIMIT },
    unlimited: { name: 'Unlimited', price: 375, desc: 'Unlimited drop-in classes / month', limit: Infinity },
  };

  // Bandana rank → the highest level a dog can attend. 0 = puppy (Puppy PlaySchool only).
  const RANKS = [
    { value: 0, label: 'Puppy, no bandana yet', color: '#ece6d6' },
    { value: 1, label: 'White bandana', color: '#ffffff' },
    { value: 2, label: 'Orange bandana', color: '#f0913f' },
    { value: 3, label: 'Green bandana', color: '#3f9b5d' },
    { value: 4, label: 'Blue bandana', color: '#3b78c4' },
  ];

  const LEVELS = {
    0: { short: 'Puppy', name: 'Puppy PlaySchool', color: 'var(--lv-puppy)',
         themes: ['Puppy Focus & Self-Control', 'Puppy Confidence', 'Puppy Body Handling', 'Puppy Polite Greetings', 'Puppy Recall', 'Puppy Leash Walking'] },
    1: { short: 'Level 1', name: 'Teen Spirit', color: 'var(--lv-1)',
         themes: ['Self-Control', 'Relaxation', 'Focus & Engagement', 'Intro to Life Skills'] },
    2: { short: 'Level 2', name: 'Life Skills', color: 'var(--lv-2)',
         themes: ['Loose Leash Walking', 'Recalls & Stays', 'Polite Greetings', 'Fun & Games', 'Wildcard (Instructor’s Choice)'] },
    3: { short: 'Level 3', name: 'Advanced', color: 'var(--lv-3)',
         themes: ['Advanced Life Skills (CGC & Therapy Dog Prep)', 'Rally Obedience'] },
    4: { short: 'Level 4', name: 'Expert', color: 'var(--lv-4)',
         themes: ['Trail & Hiking Skills', 'Parkour & Urban Adventures'] },
    e: { short: 'Elective', name: 'Recreational Elective', color: 'var(--lv-e)', themes: [] },
  };

  // Weekly template, keyed by JS weekday (0 = Sunday). [time, level, elective name?]
  const WEEK = {
    0: [['09:00', 'e', 'Beyond Play (Socialization Group)'], ['10:30', 2], ['12:00', 3]],
    1: [['09:00', 0], ['18:00', 1], ['19:15', 2]],
    2: [['17:30', 0], ['18:45', 2], ['18:45', 3]],
    3: [['09:30', 'e', 'Sniff Games (Enrichment & Fun)'], ['18:00', 1], ['19:15', 2]],
    4: [['18:00', 0], ['18:00', 3], ['19:15', 1]],
    5: [],
    6: [['08:00', 'e', 'Training Treks (Out & About)'], ['09:30', 0], ['10:45', 1], ['12:00', 4]],
  };

  const SAMPLE = {
    name: 'Sam Rivera', email: 'sam@example.com', phone: '(970) 555-0142',
    dog: { name: 'Juniper', breed: 'Australian Shepherd mix', age: '2 years', rank: 2 },
  };

  const DOG_EMOJI = ['🐕', '🐶', '🦮', '🐩', '🐕‍🦺'];

  /* ---------- state ---------- */

  const blank = () => ({ profile: null, dogs: [], bookings: [], waitlist: [], stats: { booked: 0 }, activeDog: null });

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return Object.assign(blank(), JSON.parse(raw));
    } catch (_) { /* storage blocked: run in memory */ }
    return blank();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) { /* ignore */ }
  }

  let state = load();
  const ui = { week: 0, onlyEligible: true, selected: new Set(), firstPickAt: null, undo: null };

  /* ---------- helpers ---------- */

  const $ = (sel, root = document) => root.querySelector(sel);
  const app = $('#app');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const poss = (n) => (/s$/i.test(n) ? `${n}’` : `${n}’s`);
  const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'friend';
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const fmtTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const fmtDay = (d) => d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  const fmtShort = (d) => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const monthName = (d) => d.toLocaleDateString([], { month: 'long' });

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function weekIndex(d) {
    const start = new Date(2026, 0, 4); // a Sunday
    return Math.floor((d - start) / (7 * 864e5));
  }

  /* ---------- schedule ---------- */

  function buildSchedule() {
    const out = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const day = new Date(today); day.setDate(today.getDate() + i);
      (WEEK[day.getDay()] || []).forEach(([time, level, elective], slot) => {
        const [h, m] = time.split(':').map(Number);
        const start = new Date(day); start.setHours(h, m, 0, 0);
        const id = `${ymd(day)}-${time.replace(':', '')}-${level}`;
        const lv = LEVELS[level];
        const themes = lv.themes;
        const theme = elective || themes[(weekIndex(day) + slot) % themes.length];
        const others = [1, 2, 3, 4, 5, 6, 2, 3, 4, 3][hash(id) % 10];
        out.push({ id, start, level, theme, name: lv.name, short: lv.short, color: lv.color, others, weekOffset: i < 7 ? 0 : 1 });
      });
    }
    return out;
  }
  let schedule = buildSchedule();
  const byId = (id) => schedule.find((c) => c.id === id);

  const dogById = (id) => state.dogs.find((d) => d.id === id);
  const activeDog = () => dogById(state.activeDog) || state.dogs[0];
  const isBooked = (classId, dogId) => state.bookings.some((b) => b.classId === classId && b.dogId === dogId);
  const mineCount = (classId) => state.bookings.filter((b) => b.classId === classId).length;
  const takenCount = (c) => Math.min(CLASS_CAP, c.others + mineCount(c.id));
  const isFull = (c) => takenCount(c) >= CLASS_CAP;
  const onWaitlist = (classId, dogId) => state.waitlist.some((w) => w.classId === classId && w.dogId === dogId);

  function eligible(dog, c) {
    if (c.level === 'e') return dog.rank >= 2;
    if (dog.rank === 0) return c.level === 0;
    return c.level >= 1 && c.level <= dog.rank;
  }
  function needs(c) {
    if (c.level === 'e') return 'Orange bandana';
    if (c.level === 0) return 'Puppies only';
    return RANKS[c.level].label;
  }

  function usedInMonth(dog, key) {
    return state.bookings.filter((b) => {
      if (b.dogId !== dog.id) return false;
      const c = byId(b.classId);
      const when = c ? c.start : new Date(b.start);
      return monthKey(when) === key;
    }).length;
  }

  /* ---------- rendering ---------- */

  function render() {
    $('#resetBtn').hidden = !state.profile;
    if (!state.profile || !state.dogs.length) renderOnboarding();
    else renderDashboard();
    renderCart();
  }

  function rankOptions(selected) {
    return RANKS.map((r) => `<option value="${r.value}" ${r.value === selected ? 'selected' : ''}>${esc(r.label)}</option>`).join('');
  }

  function tierPicker(name, checked = 'standard') {
    return `<div class="tiers">${Object.entries(TIERS).map(([k, t]) => `
      <label class="tier">
        <input type="radio" name="${name}" value="${k}" ${k === checked ? 'checked' : ''}>
        <div class="t-name">${t.name}</div>
        <div class="t-price">$${t.price}<small> / month</small></div>
        <div class="t-desc">${t.desc}</div>
      </label>`).join('')}</div>`;
  }

  function dogFields(prefix = '') {
    return `
      <div class="grid-2">
        <div class="field"><label for="${prefix}dogName">Dog's name</label><input id="${prefix}dogName" name="dogName" required autocomplete="off"></div>
        <div class="field"><label for="${prefix}breed">Breed</label><input id="${prefix}breed" name="breed" placeholder="Mutt is a breed"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label for="${prefix}age">Age</label><input id="${prefix}age" name="age" placeholder="e.g. 14 weeks, 3 years"></div>
        <div class="field"><label for="${prefix}rank">Current level</label><select id="${prefix}rank" name="rank">${rankOptions(1)}</select></div>
      </div>
      <label class="check"><input type="checkbox" name="vax" required> Vaccine records are current (you'd upload them once, here)</label>`;
  }

  function renderOnboarding() {
    app.innerHTML = `
      <section class="onboard">
        <div class="onboard-hero">
          <div class="kicker">Adventure Dog Club</div>
          <h1>Type your info once. Then never again.</h1>
          <p class="lede">Join the club in one form. After that, booking a class takes a tap: no re-entering your phone number, no digging for a membership code.</p>
          <ul class="promise">
            <li><span class="ico">📝</span><div><strong>One form, one time.</strong> You, your dog, your membership.</div></li>
            <li><span class="ico">✅</span><div><strong>Tick classes, tap book.</strong> Book a week or a month in one go.</div></li>
            <li><span class="ico">🎟️</span><div><strong>Your credits, visible.</strong> See how many of your 5 classes you have left.</div></li>
            <li><span class="ico">🐕‍🦺</span><div><strong>Two dogs?</strong> Add the second one without retyping yourself.</div></li>
          </ul>
        </div>
        <form class="card form" id="joinForm" novalidate>
          <fieldset>
            <legend><span class="num">1</span> You</legend>
            <div class="field"><label for="name">Full name</label><input id="name" name="name" required autocomplete="name"></div>
            <div class="grid-2">
              <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required autocomplete="email"></div>
              <div class="field"><label for="phone">Mobile (for waitlist texts)</label><input id="phone" name="phone" type="tel" autocomplete="tel"></div>
            </div>
          </fieldset>
          <fieldset>
            <legend><span class="num">2</span> Your dog</legend>
            ${dogFields()}
          </fieldset>
          <fieldset>
            <legend><span class="num">3</span> Membership</legend>
            ${tierPicker('tier')}
            <label class="check" style="margin-top:12px"><input type="checkbox" name="waiver" required> I agree to the training waiver &amp; class policies (you'd sign this once, too)</label>
          </fieldset>
          <p class="form-error" id="formError" role="alert" style="color:var(--warn);font-weight:600" hidden></p>
          <div class="form-foot">
            <button type="button" class="linkish" data-action="sample">Fill with sample info</button>
            <button type="submit" class="btn btn-sunset">Continue to checkout →</button>
          </div>
          <p class="secure" style="margin-top:12px">🔒 Payment would be handled by Stripe Checkout. This demo never asks for a card.</p>
        </form>
      </section>`;

    $('#joinForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const err = $('#formError');
      if (!f.checkValidity()) {
        const bad = [...f.elements].find((el) => el.willValidate && !el.checkValidity());
        err.textContent = bad?.type === 'checkbox' ? 'Please tick the vaccine and waiver boxes.' : 'Please fill in your name, a valid email and your dog\'s name.';
        err.hidden = false;
        bad?.focus();
        return;
      }
      err.hidden = true;
      const data = new FormData(f);
      const dog = readDog(data);
      const tier = data.get('tier');
      openCheckout({
        tier, dogName: dog.name,
        onPaid: () => {
          state.profile = { name: data.get('name').trim(), email: data.get('email').trim(), phone: data.get('phone').trim(), joinedAt: Date.now() };
          dog.tier = tier;
          state.dogs = [dog];
          state.activeDog = dog.id;
          save();
          render();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          toast(`Welcome to the club, ${firstName(state.profile.name)}! That's the last form you'll fill out.`);
        },
      });
    });
  }

  function readDog(data) {
    return {
      id: uid(),
      name: String(data.get('dogName') || '').trim(),
      breed: String(data.get('breed') || '').trim(),
      age: String(data.get('age') || '').trim(),
      rank: Number(data.get('rank') || 0),
      emoji: DOG_EMOJI[state.dogs.length % DOG_EMOJI.length],
      tier: data.get('tier') || 'standard',
    };
  }

  function fillSample() {
    const f = $('#joinForm');
    if (!f) return;
    const el = f.elements;
    el.name.value = SAMPLE.name;
    el.email.value = SAMPLE.email;
    el.phone.value = SAMPLE.phone;
    el.dogName.value = SAMPLE.dog.name;
    el.breed.value = SAMPLE.dog.breed;
    el.age.value = SAMPLE.dog.age;
    el.rank.value = String(SAMPLE.dog.rank);
    el.vax.checked = true;
    el.waiver.checked = true;
  }

  function renderDashboard() {
    schedule = buildSchedule();
    const dog = activeDog();
    state.activeDog = dog.id;
    const now = new Date();
    const tier = TIERS[dog.tier] || TIERS.standard;
    const used = usedInMonth(dog, monthKey(now));
    const pct = tier.limit === Infinity ? 100 : Math.min(100, (used / tier.limit) * 100);

    const upcoming = state.bookings
      .map((b) => ({ ...b, c: byId(b.classId), dog: dogById(b.dogId) }))
      .filter((b) => b.c && b.dog && b.c.start > now)
      .sort((a, b) => a.c.start - b.c.start);
    const nextForDog = upcoming.find((b) => b.dogId === dog.id);

    const booked = state.stats.booked || 0;
    const visible = schedule.filter((c) => c.weekOffset === ui.week && c.start > now && (!ui.onlyEligible || eligible(dog, c)));
    const days = groupByDay(visible);

    app.innerHTML = `
      <section class="dash">
        <div class="hello">
          <div class="card">
            <h1>Hi ${esc(firstName(state.profile.name))}! 👋</h1>
            <p class="sub">Everything's on file. Pick classes, tap book, go train.</p>
            <div class="dogs" role="group" aria-label="Choose dog">
              ${state.dogs.map((d) => `
                <button class="dog-chip" data-action="dog" data-id="${d.id}" aria-pressed="${d.id === dog.id}">
                  <span class="av">${d.emoji}</span>${esc(d.name)}
                  <span class="bandana" style="background:${RANKS[d.rank].color}" title="${esc(RANKS[d.rank].label)}"></span>
                </button>`).join('')}
              <button class="btn btn-ghost btn-sm" data-action="add-dog">+ Add a dog</button>
            </div>
          </div>
          <div class="card meter-card">
            <h3>${esc(poss(dog.name))} ${monthName(now)}</h3>
            <div class="meter-note">${tier.name} membership · $${tier.price}/mo</div>
            <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="${tier.limit === Infinity ? used : tier.limit}" aria-valuenow="${used}"><span style="width:${pct}%"></span></div>
            <div class="meter-note">${tier.limit === Infinity
              ? `<strong>${used}</strong> booked this month · unlimited`
              : `<strong>${used} of ${tier.limit}</strong> classes used · ${Math.max(0, tier.limit - used)} left`}</div>
            <div class="meter-note" style="margin-top:8px">${nextForDog
              ? `Next up: <strong>${fmtShort(nextForDog.c.start)}, ${fmtTime(nextForDog.c.start)}</strong> · ${esc(nextForDog.c.theme)}`
              : 'Nothing booked yet. Pick something below 👇'}</div>
          </div>
        </div>

        <div class="stats">
          <div class="stat"><div class="v">${booked}</div><div class="k">classes booked here</div></div>
          <div class="stat highlight"><div class="v">${booked * FIELDS_PER_BOOKING}</div><div class="k">form fields you didn't retype</div></div>
          <div class="stat"><div class="v">~${booked * MINUTES_PER_BOOKING} min</div><div class="k">of your life returned (est.)</div></div>
        </div>

        <div>
          <div class="section-head">
            <h2>Book classes for ${esc(dog.name)}</h2>
            <div class="filters">
              <label class="toggle"><input type="checkbox" data-action="eligible" ${ui.onlyEligible ? 'checked' : ''}> Only ${esc(poss(dog.name))} levels</label>
              <div class="week-tabs" role="group" aria-label="Week">
                <button data-action="week" data-week="0" aria-pressed="${ui.week === 0}">This week</button>
                <button data-action="week" data-week="1" aria-pressed="${ui.week === 1}">Next week</button>
              </div>
            </div>
          </div>
          <div class="days">
            ${days.length ? days.map(([label, isToday, list]) => `
              <div class="day">
                <h3>${isToday ? '<span class="today">Today · </span>' : ''}${label}</h3>
                <div class="classes">${list.map((c) => classCard(c, dog)).join('')}</div>
              </div>`).join('') : `<div class="empty">No classes match. Try turning off "Only ${esc(poss(dog.name))} levels".</div>`}
          </div>
        </div>

        <div>
          <div class="section-head">
            <h2>Your upcoming classes</h2>
            ${upcoming.length ? '<button class="btn btn-ghost btn-sm" data-action="ics-all">📅 Add all to calendar</button>' : ''}
          </div>
          <div class="mine-list">
            ${upcoming.length ? upcoming.map((b) => `
              <div class="mine-row">
                <div>
                  <div class="when">${fmtShort(b.c.start)} · ${fmtTime(b.c.start)}</div>
                  <div class="what">${b.dog.emoji} ${esc(b.dog.name)} · ${esc(b.c.short)} · ${esc(b.c.theme)}</div>
                </div>
                <div class="mine-actions">
                  <button class="btn btn-ghost btn-sm" data-action="ics" data-class="${b.classId}" data-dog="${b.dogId}">📅 Calendar</button>
                  <button class="btn btn-ghost btn-sm" data-action="cancel" data-class="${b.classId}" data-dog="${b.dogId}">Cancel</button>
                </div>
              </div>`).join('') : '<div class="empty">No classes booked yet.</div>'}
          </div>
        </div>
      </section>`;
  }

  function groupByDay(list) {
    const map = new Map();
    const todayKey = ymd(new Date());
    list.forEach((c) => {
      const k = ymd(c.start);
      if (!map.has(k)) map.set(k, [fmtDay(c.start), k === todayKey, []]);
      map.get(k)[2].push(c);
    });
    return [...map.values()];
  }

  function classCard(c, dog) {
    const mine = isBooked(c.id, dog.id);
    const ok = eligible(dog, c);
    const taken = takenCount(c);
    const full = taken >= CLASS_CAP;
    const sel = ui.selected.has(c.id);
    const myDogsHere = state.bookings.filter((b) => b.classId === c.id).length;
    const dots = Array.from({ length: CLASS_CAP }, (_, i) => {
      const cls = i < myDogsHere ? 'taken mine' : i < taken ? 'taken' : '';
      return `<i class="${cls}"></i>`;
    }).join('');
    const left = CLASS_CAP - taken;

    let action;
    if (mine) action = `<span class="badge-ok">✓ Booked</span>`;
    else if (!ok) action = `<span class="k-level">Needs ${esc(needs(c))}</span>`;
    else if (full) action = onWaitlist(c.id, dog.id)
      ? `<button class="btn btn-ghost btn-sm" data-action="waitlist" data-id="${c.id}">On waitlist ✓</button>`
      : `<button class="btn btn-ghost btn-sm" data-action="waitlist" data-id="${c.id}">Join waitlist</button>`;
    else action = `<label class="pick"><input type="checkbox" data-action="pick" data-id="${c.id}" ${sel ? 'checked' : ''}> ${sel ? 'Selected' : 'Select'}</label>`;

    return `
      <article class="klass ${mine ? 'booked' : ''} ${sel ? 'selected' : ''} ${!ok ? 'ineligible' : ''}" style="--lv:${c.color}">
        <div class="k-top"><span class="k-time">${fmtTime(c.start)}</span><span class="k-level">${esc(c.short)}</span></div>
        <div class="k-name">${esc(c.level === 'e' ? c.theme : c.name)}</div>
        <div class="k-theme">${c.level === 'e' ? 'Recreational Elective · Level 2 & up' : `This week: ${esc(c.theme)}`}</div>
        <div class="k-bottom">
          <div class="spots" title="${taken} of ${CLASS_CAP} spots taken">${dots}<span>${full ? 'Full' : `${left} left`}</span></div>
          ${action}
        </div>
      </article>`;
  }

  function cartProblem(dog) {
    const tier = TIERS[dog.tier] || TIERS.standard;
    if (tier.limit === Infinity) return null;
    const perMonth = {};
    ui.selected.forEach((id) => {
      const c = byId(id);
      if (!c) return;
      const k = monthKey(c.start);
      perMonth[k] = perMonth[k] || { n: 0, d: c.start };
      perMonth[k].n++;
    });
    for (const [k, { n, d }] of Object.entries(perMonth)) {
      const used = usedInMonth(dog, k);
      if (used + n > tier.limit) return { month: monthName(d), used, n, limit: tier.limit };
    }
    return null;
  }

  function renderCart() {
    const cart = $('#cart');
    const dog = state.dogs.length ? activeDog() : null;
    if (!dog || !ui.selected.size) { cart.hidden = true; cart.innerHTML = ''; return; }
    const n = ui.selected.size;
    const problem = cartProblem(dog);
    cart.hidden = false;
    cart.innerHTML = problem
      ? `<div class="c-text"><strong>${n} selected, but Standard covers ${problem.limit} a month</strong>${dog.name} has ${problem.used} booked in ${problem.month}. Remove ${problem.used + problem.n - problem.limit}, or go Unlimited.</div>
         <button class="btn btn-sunset" data-action="upgrade">Go Unlimited</button>`
      : `<div class="c-text"><strong>${n} class${n > 1 ? 'es' : ''} for ${esc(dog.name)}</strong>No forms. No codes. Just tap.</div>
         <div class="c-btns"><button class="btn btn-ghost btn-sm" data-action="clear">Clear</button>
         <button class="btn btn-sunset" data-action="book">Book ${n} →</button></div>`;
  }

  /* ---------- modals ---------- */

  const modal = $('#modal');
  function openModal(html, onMount) {
    modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    modal.hidden = false;
    onMount?.(modal.firstElementChild);
    const focusable = modal.querySelector('input, button.btn');
    focusable?.focus();
  }
  function closeModal() { modal.hidden = true; modal.innerHTML = ''; }

  function openCheckout({ tier, dogName, onPaid, upgrade = false }) {
    const t = TIERS[tier];
    openModal(`
      <span class="stripe-tag">stripe · checkout (simulated)</span>
      <h2 style="margin-top:12px">${upgrade ? 'Upgrade membership' : 'Start membership'}</h2>
      <p style="color:var(--muted);margin:0">In the real version, Stripe hosts this page, so card details never touch the training site.</p>
      <div class="stripe-mock">
        <div class="row"><span>Adventure Dog Club, ${t.name}</span><span>$${t.price}.00</span></div>
        <div class="row" style="color:var(--muted)"><span>For ${esc(dogName)} · billed monthly</span><span>cancel anytime</span></div>
        <div class="row total"><span>Due today</span><span>$${t.price}.00</span></div>
      </div>
      <p style="font-size:.85rem;color:var(--muted)">This is a demo, so no card is needed and nothing is charged.</p>
      <div class="modal-actions">
        <button class="btn" data-modal="pay">Simulate successful payment</button>
        <button class="btn btn-ghost" data-modal="close">Back</button>
      </div>`, (el) => {
      el.querySelector('[data-modal="pay"]').addEventListener('click', () => {
        const b = el.querySelector('[data-modal="pay"]');
        b.disabled = true; b.textContent = 'Processing…';
        setTimeout(() => { closeModal(); onPaid(); }, 700);
      });
    });
  }

  function openAddDog() {
    openModal(`
      <h2>Add a dog</h2>
      <p style="color:var(--muted)">We already have <strong>${esc(state.profile.name)}</strong>, ${esc(state.profile.email)}${state.profile.phone ? `, ${esc(state.profile.phone)}` : ''}. Just tell us about the pup.</p>
      <form class="form" id="dogForm" novalidate>
        ${dogFields('m-')}
        <div style="margin-top:12px">${tierPicker('tier')}</div>
        <p class="form-error" id="dogError" role="alert" style="color:var(--warn);font-weight:600" hidden></p>
        <div class="modal-actions">
          <button class="btn btn-sunset" type="submit">Continue to checkout →</button>
          <button class="btn btn-ghost" type="button" data-modal="close">Cancel</button>
        </div>
      </form>`, (el) => {
      el.querySelector('#dogForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target;
        if (!f.checkValidity()) {
          const err = el.querySelector('#dogError');
          err.textContent = 'Add a name and confirm vaccines.';
          err.hidden = false;
          return;
        }
        const dog = readDog(new FormData(f));
        openCheckout({
          tier: dog.tier, dogName: dog.name,
          onPaid: () => {
            state.dogs.push(dog);
            state.activeDog = dog.id;
            ui.selected.clear();
            save(); render();
            toast(`${dog.name} is in! You didn't retype a thing.`);
          },
        });
      });
    });
  }

  /* ---------- actions ---------- */

  function book() {
    const dog = activeDog();
    if (cartProblem(dog)) return;
    const ids = [...ui.selected].filter((id) => {
      const c = byId(id);
      return c && !isFull(c) && !isBooked(id, dog.id) && eligible(dog, c);
    });
    const added = ids.map((classId) => ({ classId, dogId: dog.id, start: byId(classId).start.toISOString(), at: Date.now() }));
    state.bookings.push(...added);
    state.stats.booked = (state.stats.booked || 0) + added.length;
    const elapsed = ui.firstPickAt ? (Date.now() - ui.firstPickAt) / 1000 : 0;
    const secs = elapsed >= 0.5 ? elapsed.toFixed(1) : null;
    ui.selected.clear(); ui.firstPickAt = null;
    ui.undo = added;
    save(); render();
    toast(`Booked ${added.length} class${added.length === 1 ? '' : 'es'} for ${dog.name}${secs ? ` in ${secs} seconds` : ''}. Confirmation sent to ${state.profile.email} (well, it would be).`, true);
  }

  function undoLast() {
    if (!ui.undo) return;
    const undo = ui.undo;
    state.bookings = state.bookings.filter((b) => !undo.some((u) => u.classId === b.classId && u.dogId === b.dogId));
    state.stats.booked = Math.max(0, (state.stats.booked || 0) - undo.length);
    ui.undo = null;
    save(); render();
    toast('Undone.');
  }

  function cancel(classId, dogId) {
    const c = byId(classId);
    const dog = dogById(dogId);
    state.bookings = state.bookings.filter((b) => !(b.classId === classId && b.dogId === dogId));
    save(); render();
    toast(`Cancelled ${dog ? poss(dog.name) + ' ' : ''}${c ? fmtShort(c.start) + ' ' : ''}class. Your credit is back.`);
  }

  function toggleWaitlist(classId) {
    const dog = activeDog();
    if (onWaitlist(classId, dog.id)) {
      state.waitlist = state.waitlist.filter((w) => !(w.classId === classId && w.dogId === dog.id));
      toast('Left the waitlist.');
    } else {
      state.waitlist.push({ classId, dogId: dog.id });
      toast(`You're on the waitlist. We'd text ${state.profile.phone || 'you'} the moment a spot opens.`);
    }
    save(); render();
  }

  function upgrade() {
    const dog = activeDog();
    openCheckout({
      tier: 'unlimited', dogName: dog.name, upgrade: true,
      onPaid: () => { dog.tier = 'unlimited'; save(); render(); toast(`${dog.name} is Unlimited now. Book away.`); },
    });
  }

  function icsFor(list) {
    const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const escIcs = (s) => String(s).replace(/([,;\\])/g, '\\$1');
    const events = list.map(({ c, dog }) => {
      const end = new Date(c.start.getTime() + 60 * 60000);
      return [
        'BEGIN:VEVENT',
        `UID:${c.id}-${dog.id}@adventure-dog-club-demo`,
        `DTSTAMP:${stamp(new Date())}`,
        `DTSTART:${stamp(c.start)}`,
        `DTEND:${stamp(end)}`,
        `SUMMARY:${escIcs(`${dog.name}: ${c.short} ${c.level === 'e' ? '' : c.name}`.trim())}`,
        `DESCRIPTION:${escIcs(`Theme: ${c.theme}`)}`,
        `LOCATION:${escIcs(LOCATION)}`,
        'END:VEVENT',
      ].join('\r\n');
    });
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Adventure Dog Club Demo//EN', ...events, 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
    a.download = list.length === 1 ? 'dog-class.ics' : 'dog-classes.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  let toastTimer;
  function toast(msg, withUndo = false) {
    const t = $('#toast');
    t.innerHTML = `${esc(msg)}${withUndo ? ' <button class="linkish" style="color:inherit;margin-left:6px" data-action="undo">Undo</button>' : ''}`;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; if (withUndo) ui.undo = null; }, withUndo ? 6000 : 3500);
  }

  /* ---------- events ---------- */

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action], [data-modal]');
    if (!el) {
      if (e.target === modal) closeModal();
      return;
    }
    if (el.dataset.modal === 'close') return closeModal();
    switch (el.dataset.action) {
      case 'home': e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); break;
      case 'sample': fillSample(); break;
      case 'reset':
        if (confirm('Reset the demo? This clears the profile and bookings saved in this browser.')) {
          try { localStorage.removeItem(STORE_KEY); } catch (_) { /* ignore */ }
          state = blank(); ui.selected.clear(); render();
        }
        break;
      case 'dog': state.activeDog = el.dataset.id; ui.selected.clear(); save(); render(); break;
      case 'add-dog': openAddDog(); break;
      case 'week': ui.week = Number(el.dataset.week); render(); break;
      case 'book': book(); break;
      case 'clear': ui.selected.clear(); ui.firstPickAt = null; render(); break;
      case 'undo': $('#toast').hidden = true; undoLast(); break;
      case 'cancel': cancel(el.dataset.class, el.dataset.dog); break;
      case 'waitlist': toggleWaitlist(el.dataset.id); break;
      case 'upgrade': upgrade(); break;
      case 'ics': {
        const c = byId(el.dataset.class), dog = dogById(el.dataset.dog);
        if (c && dog) icsFor([{ c, dog }]);
        break;
      }
      case 'ics-all': {
        const now = new Date();
        const list = state.bookings.map((b) => ({ c: byId(b.classId), dog: dogById(b.dogId) })).filter((x) => x.c && x.dog && x.c.start > now);
        if (list.length) icsFor(list);
        break;
      }
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.action === 'pick') {
      if (el.checked) { ui.selected.add(el.dataset.id); ui.firstPickAt ??= Date.now(); }
      else ui.selected.delete(el.dataset.id);
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
    } else if (el.dataset.action === 'eligible') {
      ui.onlyEligible = el.checked;
      render();
    }
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  render();
})();
