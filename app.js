// =====================================================
// Check Yourself Spending — app.js (FULL)
// Fixes:
// ✅ Visible Sign out button (btnSignOutTop)
// ✅ Email + Google + Apple sign-in
// ✅ Roast level chosen at sign-in (saved per user in Firestore)
// ✅ "Remember me" controls session vs persistent login
// ✅ Expenses stored per user: users/{uid}/expenses
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

const btnGoogle = document.getElementById("btnGoogle");
const btnApple = document.getElementById("btnApple");

const roastLevelAuth = document.getElementById("roastLevelAuth");
const rememberMe = document.getElementById("rememberMe");

const btnSignOutTop = document.getElementById("btnSignOutTop");

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
if (dateInput) dateInput.value = todayISO();

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

// ---------- Persistence control ----------
async function applyPersistenceFromUI() {
  const persist = rememberMe?.checked ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, persist);
}

// ---------- Profile ----------
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

    // Popup first; fallback to redirect if blocked
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

    // Apple is most reliable with redirect
    await signInWithRedirect(auth, provider);
  } catch (err) {
    showAuthError(err);
  }
});

// Handle redirect results (no-op if none)
getRedirectResult(auth).catch(() => {});

// ---------- Sign out (bulletproof + always visible) ----------
async function doSignOut() {
  clearMsgs();
  try {
    await signOut(auth);
  } catch (err) {
    showAuthError(err);
  }
}

if (btnSignOutTop) {
  btnSignOutTop.addEventListener("click", doSignOut);
  // Make sure it never gets stuck hidden by CSS
  btnSignOutTop.style.display = "none";
}

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

// ---------- Auth state UI ----------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    authCard.classList.add("hidden");
    appCard.classList.remove("hidden");

    // ✅ force signout visible
    if (btnSignOutTop) btnSignOutTop.style.display = "inline-block";

    userPill.textContent = user.email || "Signed in";

    try {
      // Ensure profile exists
      await ensureProfile(user.uid, user.email);

      // Save roast level selected at sign-in screen (overwrites profile)
      if (roastLevelAuth) await applyAuthScreenRoastChoice(user);

      // Show roast message
      const updated = await ensureProfile(user.uid, user.email);
      if (roastBox) roastBox.textContent = `Roast level: ${updated.roastLevel}. ${roastLine(updated.roastLevel)}`;

      await loadExpenses();
    } catch (err) {
      showAppError(err);
    }
  } else {
    authCard.classList.remove("hidden");
    appCard.classList.add("hidden");

    // ✅ hide signout when logged out
    if (btnSignOutTop) btnSignOutTop.style.display = "none";

    userPill.textContent = "Signed out";
    expenseList.innerHTML = "";
  }
});



