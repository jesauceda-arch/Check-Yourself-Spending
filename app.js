// =====================================================
// Check Yourself Spending — app.js (FULL FILE)
// Auth: Email/Password + Google + Apple
// Data: Firestore per-user: users/{uid}/expenses
// Roast level chosen at sign-in and saved per user.
// Persistence: Session by default; "Remember me" enables Local persistence.
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ---------- Firebase Config ----------
const firebaseConfig = {
  apiKey: "AIzaSyAcjejaIXVB9RQpL-5RWlyezYugNCMN0NQ",
  authDomain: "check-yourself-spending.firebaseapp.com",
  projectId: "check-yourself-spending",
  storageBucket: "check-yourself-spending.firebasestorage.app",
  messagingSenderId: "464693115714",
  appId: "1:464693115714:web:f57fe7d28167e41df3a6db",
  measurementId: "G-R7WG1R1MP7"
};

// ---------- Init ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- DOM ----------
const authCard = document.getElementById("authCard");
const appCard = document.getElementById("appCard");

const emailInput = document.getElementById("authEmail");
const passwordInput = document.getElementById("authPassword");

const btnSignIn = document.getElementById("btnSignIn");
const btnSignUp = document.getElementById("btnSignUp");
const btnSignOutTop = document.getElementById("btnSignOutTop");

const btnGoogle = document.getElementById("btnGoogle");
const btnApple = document.getElementById("btnApple");

const roastLevelAuth = document.getElementById("roastLevelAuth");
const rememberMe = document.getElementById("rememberMe");

const authMsg = document.getElementById("authMsg");
const userPill = document.getElementById("userPill");

const amountInput = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("date");
const noteInput = document.getElementById("note");
const btnAdd = document.getElementById("btnAdd");
const expenseList = document.getElementById("expenseList");

const appMsg = document.getElementById("appMsg");
const roastBox = document.getElementById("roastBox");

// ---------- Helpers ----------
function showAuthError(err) { authMsg.textContent = err?.message || String(err); }
function showAppError(err) { appMsg.textContent = err?.message || String(err); }
function clearMsgs() { authMsg.textContent = ""; appMsg.textContent = ""; }

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function money(n) {
  const num = Number(n || 0);
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function roastLine(level) {
  const nice = [
    "Good choice. Future you approves.",
    "Awareness is a win. Keep going.",
    "Nice. Staying intentional."
  ];
  const balanced = [
    "Alright… we’re watching it.",
    "Not bad, but don’t get cute with it.",
    "The budget sees all."
  ];
  const savage = [
    "You didn’t need that. You wanted chaos.",
    "Your budget just flinched.",
    "Congratulations, you funded someone else’s dreams."
  ];

  const arr = level === "savage" ? savage : level === "nice" ? nice : balanced;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------- Firestore paths ----------
const userDocRef = (uid) => doc(db, "users", uid);
const expensesColRef = (uid) => collection(db, "users", uid, "expenses");

// ---------- Persistence control (fixes “auto logged in” feeling) ----------
async function applyPersistenceFromUI() {
  const persist = rememberMe?.checked ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, persist);
}

// ---------- Profile (roast level saved per user) ----------
async function ensureProfile(uid, email) {
  const ref = userDocRef(uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      email: email || "",
      roastLevel: "balanced",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { roastLevel: "balanced" };
  }

  const data = snap.data();
  return { roastLevel: data.roastLevel || "balanced" };
}

async function saveRoastLevel(uid, level) {
  await setDoc(
    userDocRef(uid),
    { roastLevel: level, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// Save roast level chosen on sign-in screen AFTER auth succeeds
async function applyAuthScreenRoastChoice(user) {
  const level = roastLevelAuth?.value || "balanced";
  await saveRoastLevel(user.uid, level);
}

// ---------- Auth handlers ----------
btnSignUp?.addEventListener("click", async () => {
  clearMsgs();
  try {
    await applyPersistenceFromUI();
    await createUserWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value.trim());
  } catch (err) {
    showAuthError(err);
  }
});

btnSignIn?.addEventListener("click", async () => {
  clearMsgs();
  try {
    await applyPersistenceFromUI();
    await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value.trim());
  } catch (err) {
    showAuthError(err);
  }
});

btnGoogle?.addEventListener("click", async () => {
  clearMsgs();
  try {
    await applyPersistenceFromUI();
    const provider = new GoogleAuthProvider();

    // Popup first; if blocked, fallback to redirect.
    try {
      await signInWithPopup(auth, provider);
    } catch {
      await signInWithRedirect(auth, provider);
    }
  } catch (err) {
    showAuthError(err);
  }
});

btnApple?.addEventListener("click", async () => {
  clearMsgs();
  try {
    await applyPersistenceFromUI();
    const provider = new OAuthProvider("apple.com");

    // Apple is most reliable with redirect (esp. Safari/iOS)
    await signInWithRedirect(auth, provider);
  } catch (err) {
    showAuthError(err);
  }
});

async function doSignOut() {
  clearMsgs();
  try {
    await signOut(auth);
  } catch (err) {
    showAuthError(err);
  }
}

btnSignOutTop?.addEventListener("click", doSignOut);

// Handle redirect results (Apple/Google redirect flow)
// (No-op if there isn't a redirect result)
getRedirectResult(auth).catch(() => {});

// ---------- Expenses ----------
btnAdd?.addEventListener("click", async () => {
  clearMsgs();
  const user = auth.currentUser;
  if (!user) return;

  const amt = Number(amountInput.value);
  if (!Number.isFinite(amt) || amt <= 0) return showAppError("Enter a valid amount.");

  const dateVal = dateInput.value || todayISO();
  const noteVal = noteInput.value || "";

  try {
    await addDoc(expensesColRef(user.uid), {
      amount: amt,
      category: categoryInput.value,
      date: dateVal,
      note: noteVal,
      createdAt: serverTimestamp()
    });

    amountInput.value = "";
    noteInput.value = "";

    // Roast feedback
    const profile = await ensureProfile(user.uid, user.email);
    if (roastBox) roastBox.textContent = roastLine(profile.roastLevel);

    await loadExpenses();
  } catch (err) {
    showAppError(err);
  }
});

async function loadExpenses() {
  clearMsgs();
  const user = auth.currentUser;
  if (!user) return;

  expenseList.innerHTML = "";

  try {
    const qy = query(expensesColRef(user.uid), orderBy("date", "desc"));
    const snap = await getDocs(qy);

    snap.forEach((d) => {
      const e = d.data();
      const div = document.createElement("div");
      div.className = "expense";
      div.textContent = `${money(e.amount)} — ${e.category} (${e.date})`;
      expenseList.appendChild(div);
    });
  } catch (err) {
    showAppError(err);
  }
}

// Default date
if (dateInput) dateInput.value = todayISO();

// ---------- Auth state UI ----------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    authCard.classList.add("hidden");
    appCard.classList.remove("hidden");

    // show signout
    if (btnSignOutTop) btnSignOutTop.classList.remove("hidden");

    userPill.textContent = user.email || "Signed in";

    try {
      // Ensure profile exists
      await ensureProfile(user.uid, user.email);

      // Save roast level selected at login screen
      if (roastLevelAuth) {
        await applyAuthScreenRoastChoice(user);
      }

      // Reload profile to show correct level message
      const updated = await ensureProfile(user.uid, user.email);
      if (roastBox) roastBox.textContent = `Roast level: ${updated.roastLevel}. ${roastLine(updated.roastLevel)}`;

      await loadExpenses();
    } catch (err) {
      showAppError(err);
    }
  } else {
    authCard.classList.remove("hidden");
    appCard.classList.add("hidden");

    if (btnSignOutTop) btnSignOutTop.classList.add("hidden");

    userPill.textContent = "Signed out";
    expenseList.innerHTML = "";
  }
});


