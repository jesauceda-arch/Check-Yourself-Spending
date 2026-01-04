// Check Yourself Spending (LocalStorage MVP)
// - Works on GitHub Pages immediately
// - Monthly budget per month (YYYY-MM) with auto "reset" (new month = new budget/total)
// - Expense tracking with categories
// - Roast messages when you approach/exceed the budget
// - Export category totals for the current month to .xlsx (SheetJS)
//
// FIREBASE LATER: Replace storage functions with Firestore calls.

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
  const day = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
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
  // Simple unique id for local entries
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// ---------- Local Storage Keys ----------
const LS_EXPENSES = "cys_expenses_v1";
const LS_BUDGETS  = "cys_budgets_v1";

// ---------- State ----------
let currentRange = "today";
let currentMonthKey = yyyyMm(new Date());

// ---------- UI Elements ----------
const appMsg = $("appMsg");

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

// Default date = today
dateEl.value = yyyyMmDd(new Date());

// ---------- Storage Functions ----------
function loadExpenses() {
  try { return JSON.parse(localStorage.getItem(LS_EXPENSES) || "[]"); }
  catch { return []; }
}

function saveExpenses(items) {
  localStorage.setItem(LS_EXPENSES, JSON.stringify(items));
}

function loadBudgets() {
  try { return JSON.parse(localStorage.getItem(LS_BUDGETS) || "{}"); }
  catch { return {}; }
}

function saveBudgets(map) {
  localStorage.setItem(LS_BUDGETS, JSON.stringify(map));
}

function getBudgetForMonth(monthKey) {
  const budgets = loadBudgets();
  const limit = Number(budgets[monthKey] || 0);
  return limit > 0 ? limit : 0;
}

function setBudgetForMonth(monthKey, limit) {
  const budgets = loadBudgets();
  budgets[monthKey] = Number(limit);
  saveBudgets(budgets);
}

function deleteExpensesForMonth(monthKey) {
  const items = loadExpenses().filter(e => !String(e.date || "").startsWith(monthKey));
  saveExpenses(items);
}

function getExpensesForDateRange(startKey, endKey) {
  // dates are YYYY-MM-DD so lexicographic comparisons work
  return loadExpenses()
    .filter(e => e.date >= startKey && e.date <= endKey)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function addExpense(expense) {
  const items = loadExpenses();
  items.push(expense);
  saveExpenses(items);
}

function deleteExpenseById(id) {
  const items = loadExpenses().filter(e => e.id !== id);
  saveExpenses(items);
}

// ---------- Range helpers ----------
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

  const s = startOfMonth(now);
  const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startKey: yyyyMmDd(s), endKey: yyyyMmDd(e) };
}

function monthStartEnd(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return { startKey: yyyyMmDd(start), endKey: yyyyMmDd(end) };
}

// ---------- Roast logic ----------
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

// ---------- UI render ----------
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

function calcTotal(items) {
  return items.reduce((sum, x) => sum + Number(x.amount || 0), 0);
}

function refreshBudgetUI() {
  const monthKey = currentMonthKey;
  const limit = getBudgetForMonth(monthKey);

  const { startKey, endKey } = monthStartEnd(monthKey);
  const monthItems = getExpensesForDateRange(startKey, endKey);
  const monthTotal = calcTotal(monthItems);

  monthKeyPill.textContent = monthKey;

  if (!limit || limit <= 0) {
    budgetStatusEl.textContent = `${money(monthTotal)} / (no budget)`;
    budgetPctEl.textContent = `—`;
    budgetRemainingEl.textContent = `—`;
    budgetBarEl.style.width = `0%`;
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

  const barPct = Math.min(100, Math.round(pctUsed * 100));
  budgetBarEl.style.width = `${barPct}%`;

  roastBoxEl.textContent = roastMessage(pctUsed, remaining, overBy);
}

function refreshTotalsAndList() {
  // auto-switch month if needed (page left open)
  const nowMonth = yyyyMm(new Date());
  if (nowMonth !== currentMonthKey) {
    currentMonthKey = nowMonth;
    // load budget for new month into input
    const limit = getBudgetForMonth(currentMonthKey);
    monthlyLimitEl.value = limit ? String(limit) : "";
  }

  // Today total
  const todayKey = yyyyMmDd(new Date());
  const todayItems = getExpensesForDateRange(todayKey, todayKey);
  todayTotalPill.textContent = `${money(calcTotal(todayItems))} today`;

  // Range total + list
  const { startKey, endKey } = rangeKeys();
  const rangeItems = getExpensesForDateRange(startKey, endKey);
  rangeTotalPill.textContent = `${money(calcTotal(rangeItems))}`;

  renderList(rangeItems);
  refreshBudgetUI();
}

function refresh() {
  appMsg.textContent = "";
  refreshTotalsAndList();
}

// ---------- Export to XLSX ----------
function getCategoryTotalsForCurrentMonth() {
  const { startKey, endKey } = monthStartEnd(currentMonthKey);
  const monthItems = getExpensesForDateRange(startKey, endKey);

  const map = {};
  for (const it of monthItems) {
    const cat = it.category || "Other";
    const amt = Number(it.amount || 0);
    map[cat] = (map[cat] || 0) + amt;
  }

  return Object.entries(map)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

function exportCategoryTotalsXlsx() {
  if (!window.XLSX) {
    appMsg.textContent = "XLSX export library failed to load. Refresh the page.";
    return;
  }

  const rows = getCategoryTotalsForCurrentMonth();
  const month = currentMonthKey;

  const data = [
    ["Month", month],
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
  XLSX.utils.book_append_sheet(wb, ws, `Totals ${month}`);

  XLSX.writeFile(wb, `spending_category_totals_${month}.xlsx`);
}

// ---------- Event handlers ----------
$("btnAdd").addEventListener("click", () => {
  const amountStr = (amountEl.value || "").trim().replace("$", "");
  const amount = Number(amountStr);
  const category = categoryEl.value;
  const note = noteEl.value.trim();
  const date = dateEl.value || yyyyMmDd();

  if (!Number.isFinite(amount) || amount <= 0) {
    appMsg.textContent = "Enter a valid amount (example: 12.50).";
    return;
  }

  addExpense({
    id: uid(),
    amount,
    category,
    note,
    date
  });

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

btnExportXlsx.addEventListener("click", () => {
  exportCategoryTotalsXlsx();
});

btnResetMonth.addEventListener("click", () => {
  const ok = confirm(`Reset ${currentMonthKey}? This deletes this month's expenses (local only).`);
  if (!ok) return;

  deleteExpensesForMonth(currentMonthKey);
  refresh();
});

// Tabs
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentRange = btn.dataset.range;
    refresh();
  });
});

// ---------- Init ----------
function init() {
  currentMonthKey = yyyyMm(new Date());
  monthKeyPill.textContent = currentMonthKey;

  const limit = getBudgetForMonth(currentMonthKey);
  monthlyLimitEl.value = limit ? String(limit) : "";

  refresh();
}
init();


  refresh();
}
init();
