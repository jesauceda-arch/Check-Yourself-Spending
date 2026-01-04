// Check Yourself Spending — Local Login MVP (GitHub Pages friendly)
// - Buttons reliably work (event binding after DOMContentLoaded)
// - Local email+password accounts stored in localStorage (MVP)
// - Each user gets separate budgets/expenses
// - Monthly budget resets per month key (YYYY-MM)
// - Export current month category totals to XLSX (SheetJS)
//
// Firebase later: replace local auth + local storage with Firebase Auth + Firestore.

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  // ---------- Helpers ----------
  function money(n) {
    const num = Number(n || 0);
    return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }
  function yyyyMmDd(d = new Date()) {
    const pad = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function yyyyMm(d = new Date()) {
    const pad = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }
  function startOfWeek(date = new Date()) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // Mon=0
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function monthStartEnd(monthKey) {
    const [y, m] = monthKey.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return { startKey: yyyyMmDd(start), endKey: yyyyMmDd(end) };
  }
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function uid() {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  // ---------- MVP Local Auth (basic) ----------
  const LS_USERS = "cys_users_v1";        // { email: { salt, hash } }
  const LS_SESSION = "cys_session_v1";    // { email }

  function loadUsers() {
    try { return JSON.parse(localStorage.getItem(LS_USERS) || "{}"); }
    catch { return {}; }
  }
  function saveUsers(map) {
    localStorage.setItem(LS_USERS, JSON.stringify(map));
  }
  function setSession(email) {
    localStorage.setItem(LS_SESSION, JSON.stringify({ email }));
  }
  function getSession() {
    try { return JSON.parse(localStorage.getItem(LS_SESSION) || "null"); }
    catch { return null; }
  }
  function clearSession() {
    localStorage.removeItem(LS_SESSION);
  }
  function randomSalt() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return btoa(String.fromCharCode(...arr));
  }
  async function sha256Base64(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    const bytes = new Uint8Array(buf);
    let bin = "";
    bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin);
  }
  async function makeHash(password, salt) {
    // simple salted hash for MVP (not production-grade)
    return sha256Base64(`${salt}:${password}`);
  }

  // ---------- Per-user storage keys ----------
  function keyExpenses(email) { return `cys_expenses_${email}_v1`; }
  function keyBudgets(email)  { return `cys_budgets_${email}_v1`; }

  function loadExpenses(email) {
    try { return JSON.parse(localStorage.getItem(keyExpenses(email)) || "[]"); }
    catch { return []; }
  }
  function saveExpenses(email, items) {
    localStorage.setItem(keyExpenses(email), JSON.stringify(items));
  }
  function loadBudgets(email) {
    try { return JSON.parse(localStorage.getItem(keyBudgets(email)) || "{}"); }
    catch { return {}; }
  }
  function saveBudgets(email, map) {
    localStorage.setItem(keyBudgets(email), JSON.stringify(map));
  }

  // ---------- UI Elements ----------
  const authCard = $("authCard");
  const appCard = $("appCard");
  const authMsg = $("authMsg");
  const appMsg = $("appMsg");

  const authEmailEl = $("authEmail");
  const authPasswordEl = $("authPassword");
  const btnSignIn = $("btnSignIn");
  const btnSignUp = $("btnSignUp");
  const btnSignOut = $("btnSignOut");

  const userPill = $("userPill");
  const todayTotalPill = $("todayTotalPill");
  const rangeTotalPill = $("rangeTotalPill");
  const monthKeyPill = $("monthKeyPill");

  const monthlyLimitEl = $("monthlyLimit");
  const btnSaveBudget = $("btnSaveBudget");
  const btnExportXlsx = $("btnExportXlsx");
  const btnResetMonth = $("btnResetMonth");

  const budgetStatusEl = $("budgetStatus");
  const budgetPctEl = $("budgetPct");
  const budgetRemainingEl = $("budgetRemaining");
  const budgetBarEl = $("budgetBar");
  const roastBoxEl = $("roastBox");

  const amountEl = $("amount");
  const categoryEl = $("category");
  const noteEl = $("note");
  const dateEl = $("date");
  const expenseListEl = $("expenseList");

  // ---------- State ----------
  let currentUserEmail = null;
  let currentRange = "today";
  let currentMonthKey = yyyyMm(new Date());

  // Default date
  dateEl.value = yyyyMmDd(new Date());

  // ---------- Auth UI ----------
  function showAuth() {
    authCard.classList.remove("hidden");
    appCard.classList.add("hidden");
    btnSignOut.classList.add("hidden");
    todayTotalPill.textContent = "$0.00 today";
  }
  function showApp() {
    authCard.classList.add("hidden");
    appCard.classList.remove("hidden");
    btnSignOut.classList.remove("hidden");
    userPill.textContent = currentUserEmail;
  }

  btnSignUp.addEventListener("click", async () => {
    authMsg.textContent = "";
    const email = (authEmailEl.value || "").trim().toLowerCase();
    const pw = authPasswordEl.value || "";

    if (!email || !pw) {
      authMsg.textContent = "Enter email + password.";
      return;
    }

    const users = loadUsers();
    if (users[email]) {
      authMsg.textContent = "Account already exists. Sign in instead.";
      return;
    }

    const salt = randomSalt();
    const hash = await makeHash(pw, salt);
    users[email] = { salt, hash };
    saveUsers(users);

    setSession(email);
    currentUserEmail = email;
    showApp();
    initForUser();
  });

  btnSignIn.addEventListener("click", async () => {
    authMsg.textContent = "";
    const email = (authEmailEl.value || "").trim().toLowerCase();
    const pw = authPasswordEl.value || "";

    if (!email || !pw) {
      authMsg.textContent = "Enter email + password.";
      return;
    }

    const users = loadUsers();
    if (!users[email]) {
      authMsg.textContent = "No account found. Create an account first.";
      return;
    }

    const { salt, hash } = users[email];
    const test = await makeHash(pw, salt);
    if (test !== hash) {
      authMsg.textContent = "Wrong password.";
      return;
    }

    setSession(email);
    currentUserEmail = email;
    showApp();
    initForUser();
  });

  btnSignOut.addEventListener("click", () => {
    clearSession();
    currentUserEmail = null;
    authPasswordEl.value = "";
    showAuth();
  });

  // ---------- App logic ----------
  function getBudgetForMonth(monthKey) {
    const budgets = loadBudgets(currentUserEmail);
    const limit = Number(budgets[monthKey] || 0);
    return limit > 0 ? limit : 0;
  }
  function setBudgetForMonth(monthKey, limit) {
    const budgets = loadBudgets(currentUserEmail);
    budgets[monthKey] = Number(limit);
    saveBudgets(currentUserEmail, budgets);
  }
  function getExpensesForRange(startKey, endKey) {
    return loadExpenses(currentUserEmail)
      .filter(e => e.date >= startKey && e.date <= endKey)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  function addExpense(exp) {
    const items = loadExpenses(currentUserEmail);
    items.push(exp);
    saveExpenses(currentUserEmail, items);
  }
  function deleteExpenseById(id) {
    const items = loadExpenses(currentUserEmail).filter(e => e.id !== id);
    saveExpenses(currentUserEmail, items);
  }
  function deleteExpensesForMonth(monthKey) {
    const items = loadExpenses(currentUserEmail).filter(e => !String(e.date || "").startsWith(monthKey));
    saveExpenses(currentUserEmail, items);
  }
  function calcTotal(items) {
    return items.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  }
  function rangeKeys() {
    const now = new Date();

    if (currentRange === "today") {
      const key = yyyyMmDd(now);
      return { startKey: key, endKey: key };
    }
    if (currentRange === "week") {
      const s = startOfWeek(now);
      const e = new Date(s);
      e.setDate(e.getDate() + 6);
      return { startKey: yyyyMmDd(s), endKey: yyyyMmDd(e) };
    }
    const { startKey, endKey } = monthStartEnd(currentMonthKey);
    return { startKey, endKey };
  }

  function roastMessage(pctUsed, remaining, overBy) {
    const pct = Math.round(pctUsed * 100);

    if (!Number.isFinite(pctUsed)) return "Set a budget and start logging expenses.";
    if (pctUsed < 0.35) return `${pct}% used. This is… surprisingly responsible. Keep going.`;
    if (pctUsed < 0.50) return `${pct}% used. Solid start. Don’t turn this into “just one more thing.”`;
    if (pctUsed < 0.65) return `${pct}% used. You’re trending toward regret. Tighten it up.`;
    if (pctUsed < 0.80) return `${pct}% used. That “small purchase” pile is adding up fast.`;
    if (pctUsed < 0.90) return `${pct}% used. You’re getting close. Please tell me there’s a plan.`;
    if (pctUsed < 0.95) return `${pct}% used. ${money(remaining)} left. One random shopping stop and it’s cooked.`;
    if (pctUsed < 1.0)  return `${pct}% used. ${money(remaining)} left. Maybe… stop “treating yourself.”`;
    if (pctUsed < 1.10) return `Budget exceeded by ${money(overBy)}. Bold. Not smart, but bold.`;
    if (pctUsed < 1.25) return `Over by ${money(overBy)}. Was it worth it? Don’t answer that.`;
    return `Over by ${money(overBy)}. This isn’t tracking anymore—this is evidence.`;
  }

  function renderList(items) {
    expenseListEl.innerHTML = "";
    if (!items.length) {
      expenseListEl.innerHTML = `<div class="muted">No expenses in this range.</div>`;
      return;
    }

    for (const it of items) {
      const wrap = document.createElement("div");
      wrap.className = "item";

      const left = document.createElement("div");
      left.innerHTML = `
        <div style="font-weight:900; margin-bottom:4px;">${escapeHtml(it.note || "Expense")}</div>
        <div class="tag">${escapeHtml(it.category || "Other")}</div>
      `;

      const date = document.createElement("div");
      date.className = "date";
      date.textContent = it.date || "";

      const amt = document.createElement("div");
      amt.className = "amt";
      amt.textContent = money(it.amount);

      const del = document.createElement("button");
      del.className = "trash";
      del.textContent = "🗑️";
      del.title = "Delete";
      del.addEventListener("click", () => {
        deleteExpenseById(it.id);
        refresh();
      });

      wrap.appendChild(left);
      wrap.appendChild(date);
      wrap.appendChild(amt);
      wrap.appendChild(del);

      expenseListEl.appendChild(wrap);
    }
  }

  function refreshBudgetUI() {
    const limit = getBudgetForMonth(currentMonthKey);
    const { startKey, endKey } = monthStartEnd(currentMonthKey);
    const monthItems = getExpensesForRange(startKey, endKey);
    const monthTotal = calcTotal(monthItems);

    monthKeyPill.textContent = currentMonthKey;

    if (!limit) {
      budgetStatusEl.textContent = `${money(monthTotal)} / (no budget)`;
      budgetPctEl.textContent = "—";
      budgetRemainingEl.textContent = "—";
      budgetBarEl.style.width = "0%";
      roastBoxEl.textContent = "Set a budget and start logging expenses.";
      return;
    }

    const pctUsed = monthTotal / limit;
    const pctLabel = Math.min(999, Math.round(pctUsed * 100));
    const remaining = Math.max(0, limit - monthTotal);
    const overBy = Math.max(0, monthTotal - limit);

    budgetStatusEl.textContent = `${money(monthTotal)} / ${money(limit)}`;
    budgetPctEl.textContent = `${pctLabel}%`;
    budgetRemainingEl.textContent = overBy > 0 ? `-${money(overBy)}` : money(remaining);

    budgetBarEl.style.width = `${Math.min(100, Math.round(pctUsed * 100))}%`;
    roastBoxEl.textContent = roastMessage(pctUsed, remaining, overBy);
  }

  function exportCategoryTotalsXlsx() {
    if (!window.XLSX) {
      appMsg.textContent = "XLSX export library failed to load. Refresh the page.";
      return;
    }

    const { startKey, endKey } = monthStartEnd(currentMonthKey);
    const monthItems = getExpensesForRange(startKey, endKey);

    const map = {};
    for (const it of monthItems) {
      const cat = it.category || "Other";
      const amt = Number(it.amount || 0);
      map[cat] = (map[cat] || 0) + amt;
    }

    const rows = Object.entries(map)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    const data = [
      ["Month", currentMonthKey],
      [],
      ["Category", "Total"]
    ];

    let grand = 0;
    for (const r of rows) {
      data.push([r.category, Number(r.total.toFixed(2))]);
      grand += r.total;
    }
    data.push([]);
    data.push(["Grand Total", Number(grand.toFixed(2))]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 22 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Totals ${currentMonthKey}`);

    XLSX.writeFile(wb, `spending_category_totals_${currentMonthKey}.xlsx`);
  }

  function refresh() {
    appMsg.textContent = "";

    // auto month rollover
    const nowMonth = yyyyMm(new Date());
    if (nowMonth !== currentMonthKey) {
      currentMonthKey = nowMonth;
      const limit = getBudgetForMonth(currentMonthKey);
      monthlyLimitEl.value = limit ? String(limit) : "";
    }

    // today
    const todayKey = yyyyMmDd(new Date());
    const todayItems = getExpensesForRange(todayKey, todayKey);
    todayTotalPill.textContent = `${money(calcTotal(todayItems))} today`;

    // range
    const { startKey, endKey } = rangeKeys();
    const rangeItems = getExpensesForRange(startKey, endKey);
    rangeTotalPill.textContent = `${money(calcTotal(rangeItems))}`;

    renderList(rangeItems);
    refreshBudgetUI();
  }

  // ---------- Button handlers ----------
  $("btnAdd").addEventListener("click", () => {
    const amountStr = (amountEl.value || "").trim().replace("$", "");
    const amount = Number(amountStr);
    const category = categoryEl.value;
    const note = noteEl.value.trim();
    const date = dateEl.value || yyyyMmDd(new Date());

    if (!Number.isFinite(amount) || amount <= 0) {
      appMsg.textContent = "Enter a valid amount (example: 12.50).";
      return;
    }

    addExpense({ id: uid(), amount, category, note, date });

    amountEl.value = "";
    noteEl.value = "";
    refresh();
  });

  $("btnQuickCoffee").addEventListener("click", () => {
    amountEl.value = "5";
    categoryEl.value = "Eat Out";
    noteEl.value = "Coffee";
    $("btnAdd").click();
  });

  $("btnQuickLunch").addEventListener("click", () => {
    amountEl.value = "12";
    categoryEl.value = "Eat Out";
    noteEl.value = "Lunch";
    $("btnAdd").click();
  });

  $("btnQuickGas").addEventListener("click", () => {
    amountEl.value = "40";
    categoryEl.value = "Gas";
    noteEl.value = "Gas";
    $("btnAdd").click();
  });

  btnSaveBudget.addEventListener("click", () => {
    const raw = (monthlyLimitEl.value || "").trim().replace("$", "");
    const limit = Number(raw);

    if (!Number.isFinite(limit) || limit <= 0) {
      appMsg.textContent = "Enter a valid monthly limit (example: 600).";
      return;
    }

    setBudgetForMonth(currentMonthKey, limit);
    roastBoxEl.textContent = "Budget saved. Now make choices you won’t have to explain later.";
    refresh();
  });

  btnExportXlsx.addEventListener("click", () => exportCategoryTotalsXlsx());

  btnResetMonth.addEventListener("click", () => {
    const ok = confirm(`Reset ${currentMonthKey}? This deletes this month's expenses (local only).`);
    if (!ok) return;
    deleteExpensesForMonth(currentMonthKey);
    refresh();
  });

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentRange = btn.dataset.range;
      refresh();
    });
  });

  function initForUser() {
    currentMonthKey = yyyyMm(new Date());
    monthKeyPill.textContent = currentMonthKey;

    const limit = getBudgetForMonth(currentMonthKey);
    monthlyLimitEl.value = limit ? String(limit) : "";

    dateEl.value = yyyyMmDd(new Date());
    refresh();
  }

  // ---------- Init ----------
  const session = getSession();
  if (session?.email) {
    currentUserEmail = session.email;
    showApp();
    initForUser();
  } else {
    showAuth();
  }
});

