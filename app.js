// Daily Expenses (Firebase Auth + Firestore) — ready for GitHub Pages
// 1) Create Firebase project
// 2) Enable Auth (Email/Password)
// 3) Create Firestore database
// 4) Add your firebaseConfig below
// 5) Add your GitHub Pages domain to Firebase Authorized domains

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ✅ PASTE YOUR FIREBASE WEB CONFIG HERE
const firebaseConfig = {
  apiKey: "PASTE_ME",
  authDomain: "PASTE_ME",
  projectId: "PASTE_ME",
  storageBucket: "PASTE_ME",
  messagingSenderId: "PASTE_ME",
  appId: "PASTE_ME"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);

function money(n) {
  const num = Number(n || 0);
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function yyyyMmDd(d = new Date()) {
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfWeek(date = new Date()) {
  // week starts Monday
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

function toDateKey(dateObj) {
  // dateObj could be Date or YYYY-MM-DD
  if (typeof dateObj === "string") return dateObj;
  return yyyyMmDd(dateObj);
}

// ---------- UI Elements ----------
const authCard = $("authCard");
const appCard = $("appCard");

const authMsg = $("authMsg");
const appMsg = $("appMsg");

const emailEl = $("email");
const passwordEl = $("password");

const amountEl = $("amount");
const categoryEl = $("category");
const noteEl = $("note");
const dateEl = $("date");

const expenseListEl = $("expenseList");
const todayTotalPill = $("todayTotalPill");
const rangeTotalPill = $("rangeTotalPill");
const userEmailEl = $("userEmail");

let currentRange = "today"; // today | week | month
let currentUser = null;

// Set default date to today
dateEl.value = yyyyMmDd();

// ---------- Auth ----------
$("btnSignUp").addEventListener("click", async () => {
  authMsg.textContent = "";
  const email = emailEl.value.trim();
  const pass = passwordEl.value;

  try {
    await createUserWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    authMsg.textContent = friendlyAuthError(e);
  }
});

$("btnSignIn").addEventListener("click", async () => {
  authMsg.textContent = "";
  const email = emailEl.value.trim();
  const pass = passwordEl.value;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    authMsg.textContent = friendlyAuthError(e);
  }
});

$("btnForgot").addEventListener("click", async () => {
  authMsg.textContent = "";
  const email = emailEl.value.trim();
  if (!email) {
    authMsg.textContent = "Enter your email first, then click Forgot password.";
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    authMsg.textContent = "Password reset email sent. Check your inbox.";
  } catch (e) {
    authMsg.textContent = friendlyAuthError(e);
  }
});

$("btnSignOut").addEventListener("click", async () => {
  await signOut(auth);
});

function friendlyAuthError(e) {
  const code = e?.code || "";
  if (code.includes("auth/invalid-email")) return "That email address doesn’t look right.";
  if (code.includes("auth/missing-password")) return "Please enter a password.";
  if (code.includes("auth/weak-password")) return "Password must be at least 6 characters.";
  if (code.includes("auth/email-already-in-use")) return "That email already has an account. Click Sign in (or Forgot password).";
  if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password")) return "Incorrect email or password.";
  if (code.includes("auth/user-not-found")) return "No account found with that email. Click Create account.";
  return e?.message || "Auth error. Try again.";
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  authMsg.textContent = "";
  appMsg.textContent = "";

  if (!user) {
    authCard.classList.remove("hidden");
    appCard.classList.add("hidden");
    todayTotalPill.textContent = "$0.00 today";
    return;
  }

  // signed in
  authCard.classList.add("hidden");
  appCard.classList.remove("hidden");
  userEmailEl.textContent = user.email || "";
  await refresh();
});

// ---------- Expenses ----------
$("btnAdd").addEventListener("click", async () => addExpenseFromInputs());

$("btnQuickCoffee").addEventListener("click", async () => quickAdd(5, "Eat Out", "Coffee"));
$("btnQuickLunch").addEventListener("click", async () => quickAdd(12, "Eat Out", "Lunch"));
$("btnQuickGas").addEventListener("click", async () => quickAdd(40, "Gas", "Gas"));

async function quickAdd(amount, category, note) {
  amountEl.value = String(amount);
  categoryEl.value = category;
  noteEl.value = note;
  await addExpenseFromInputs();
}

async function addExpenseFromInputs() {
  appMsg.textContent = "";
  if (!currentUser) return;

  const amountStr = (amountEl.value || "").trim().replace("$", "");
  const amount = Number(amountStr);
  const category = categoryEl.value;
  const note = noteEl.value.trim();
  const date = dateEl.value || yyyyMmDd();

  if (!Number.isFinite(amount) || amount <= 0) {
    appMsg.textContent = "Enter a valid amount (example: 12.50).";
    return;
  }

  try {
    await addDoc(collection(db, "expenses"), {
      uid: currentUser.uid,
      amount,
      category,
      note,
      date, // YYYY-MM-DD
      createdAt: serverTimestamp()
    });

    // clear quick fields
    amountEl.value = "";
    noteEl.value = "";

    await refresh();
  } catch (e) {
    appMsg.textContent = e?.message || "Could not save expense.";
  }
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
  // month
  const s = startOfMonth(now);
  const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startKey: yyyyMmDd(s), endKey: yyyyMmDd(e) };
}

async function fetchExpensesForRange() {
  const { startKey, endKey } = rangeKeys();

  // Firestore: query by uid and date range using string dates (YYYY-MM-DD works lexicographically)
  const q = query(
    collection(db, "expenses"),
    where("uid", "==", currentUser.uid),
    where("date", ">=", startKey),
    where("date", "<=", endKey),
    orderBy("date", "desc")
  );

  const snap = await getDocs(q);
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
  return items;
}

async function fetchTodayTotal() {
  const key = yyyyMmDd(new Date());
  const q = query(
    collection(db, "expenses"),
    where("uid", "==", currentUser.uid),
    where("date", "==", key)
  );
  const snap = await getDocs(q);
  let total = 0;
  snap.forEach((d) => { total += Number(d.data().amount || 0); });
  return total;
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
      <div style="font-weight:800; margin-bottom:4px;">${escapeHtml(it.note || "Expense")}</div>
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
    del.addEventListener("click", async () => {
      await deleteDoc(doc(db, "expenses", it.id));
      await refresh();
    });

    wrap.appendChild(left);
    wrap.appendChild(date);
    wrap.appendChild(amt);
    wrap.appendChild(del);

    expenseListEl.appendChild(wrap);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- Tabs ----------
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", async () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentRange = btn.dataset.range;
    await refresh();
  });
});

// ---------- Refresh ----------
async function refresh() {
  if (!currentUser) return;

  // Today total pill
  const todayTotal = await fetchTodayTotal();
  todayTotalPill.textContent = `${money(todayTotal)} today`;

  // Range items + total
  const items = await fetchExpensesForRange();
  const rangeTotal = items.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  rangeTotalPill.textContent = `${money(rangeTotal)}`;

  renderList(items);
}
