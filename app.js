// app.js (FULL) — Debug + Robust Auth
// IMPORTANT: index.html must have: <script type="module" src="app.js"></script>

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
  setDoc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

console.log("✅ app.js loaded");

// ---------- Firebase config ----------
const firebaseConfig = {
  apiKey: "AIzaSyACjejaIXVB9RQpL-5RWlyezYugNCMN0NQ",
  authDomain: "check-yourself-spending.firebaseapp.com",
  projectId: "check-yourself-spending",
  storageBucket: "check-yourself-spending.firebasestorage.app",
  messagingSenderId: "464693115714",
  appId: "1:464693115714:web:f57fe7d28167e41df3a6db"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- DOM (with safety checks) ----------
const $ = (id) => document.getElementById(id);

const authCard = $("authCard");
const appCard = $("appCard");

const email = $("authEmail");
const password = $("authPassword");
const roastSelect = $("roastLevelAuth");
const rememberMe = $("rememberMe");

const btnSignIn = $("btnSignIn");
const btnSignUp = $("btnSignUp");
const btnGoogle = $("btnGoogle");
const btnApple = $("btnApple");
const btnSignOut = $("btnSignOutTop");

const userPill = $("userPill");
const roastBox = $("roastBox");
const expenseList = $("expenseList");
const amount = $("amount");
const category = $("category");
const dateInput = $("date");
const note = $("note");
const btnAdd = $("btnAdd");

const authMsg = $("authMsg");
const appMsg = $("appMsg");

// Quick sanity log if IDs mismatch
const required = {
  authCard, appCard, email, password, roastSelect, rememberMe,
  btnSignIn, btnSignUp, btnGoogle, btnApple, btnSignOut,
  userPill, roastBox, expenseList, amount, category, dateInput, note, btnAdd,
  authMsg, appMsg
};

const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error("❌ Missing elements in HTML:", missing);
  alert("Your index.html is missing these IDs: " + missing.join(", "));
}

// ---------- Helpers ----------
function setAuthError(err) {
  console.error(err);
  authMsg.textContent = err?.message || String(err);
}
function setAppError(err) {
  console.error(err);
  appMsg.textContent = err?.message || String(err);
}
function clearMsgs() {
  authMsg.textContent = "";
  appMsg.textContent = "";
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
dateInput.value = todayISO();

function roast(level) {
  const lines = {
    nice: ["Nice choice.", "You're being intentional."],
    balanced: ["We're watching this.", "Careful now."],
    savage: ["You didn’t need that.", "Your budget just flinched."]
  };
  const arr = lines[level] || lines.balanced;
  return arr[Math.floor(Math.random() * arr.length)];
}

async function applyPersistence() {
  const mode = rememberMe.checked ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, mode);
}

// ---------- Handle redirect results (Apple/Google redirect) ----------
getRedirectResult(auth).catch((err) => {
  // This will show if Apple/Google redirect fails
  if (err) setAuthError(err);
});

// ---------- Auth actions (with UI errors) ----------
btnSignUp.addEventListener("click", async () => {
  clearMsgs();
  try {
    await applyPersistence();
    await createUserWithEmailAndPassword(auth, email.value.trim(), password.value);
  } catch (err) {
    setAuthError(err);
  }
});

btnSignIn.addEventListener("click", async () => {
  clearMsgs();
  try {
    await applyPersistence();
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
  } catch (err) {
    setAuthError(err);
  }
});

btnGoogle.addEventListener("click", async () => {
  clearMsgs();
  try {
    await applyPersistence();
    const provider = new GoogleAuthProvider();

    // Popup first (desktop). If blocked, fallback to redirect.
    try {
      await signInWithPopup(auth, provider);
    } catch (popupErr) {
      console.warn("Popup failed, trying redirect:", popupErr?.message || popupErr);
      await signInWithRedirect(auth, provider);
    }
  } catch (err) {
    setAuthError(err);
  }
});

btnApple.addEventListener("click", async () => {
  clearMsgs();
  try {
    await applyPersistence();
    const provider = new OAuthProvider("apple.com");
    // Apple works best with redirect
    await signInWithRedirect(auth, provider);
  } catch (err) {
    setAuthError(err);
  }
});

btnSignOut.addEventListener("click", async () => {
  clearMsgs();
  try {
    await signOut(auth);
  } catch (err) {
    setAuthError(err);
  }
});

// ---------- Firestore profile (roast level saved per user) ----------
async function upsertProfile(uid, emailAddr, roastLevel) {
  await setDoc(
    doc(db, "users", uid),
    { email: emailAddr || "", roastLevel: roastLevel || "balanced", updatedAt: serverTimestamp() },
    { merge: true }
  );
}

async function getProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : { roastLevel: "balanced" };
}

// ---------- Expenses ----------
async function loadExpenses(uid) {
  expenseList.innerHTML = "";
  try {
    const qy = query(collection(db, "users", uid, "expenses"), orderBy("date", "desc"));
    const snap = await getDocs(qy);

    snap.forEach((d) => {
      const e = d.data();
      const div = document.createElement("div");
      div.className = "expense";
      div.textContent = `$${Number(e.amount || 0).toFixed(2)} — ${e.category} (${e.date})`;
      expenseList.appendChild(div);
    });
  } catch (err) {
    setAppError(err);
  }
}

btnAdd.addEventListener("click", async () => {
  clearMsgs();
  const user = auth.currentUser;
  if (!user) return setAppError("You must be signed in.");

  const amt = Number(amount.value);
  if (!Number.isFinite(amt) || amt <= 0) return setAppError("Enter a valid amount.");

  try {
    await addDoc(collection(db, "users", user.uid, "expenses"), {
      amount: amt,
      category: category.value,
      date: dateInput.value || todayISO(),
      note: note.value || "",
      createdAt: serverTimestamp()
    });

    amount.value = "";
    note.value = "";

    const prof = await getProfile(user.uid);
    roastBox.textContent = roast(prof.roastLevel);

    await loadExpenses(user.uid);
  } catch (err) {
    setAppError(err);
  }
});

// ---------- Auth state ----------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    authCard.classList.add("hidden");
    appCard.classList.remove("hidden");

    // Make signout always visible when logged in
    btnSignOut.style.display = "inline-block";

    userPill.textContent = user.email || "Signed in";

    try {
      // Save roast level chosen on login screen
      await upsertProfile(user.uid, user.email, roastSelect.value);

      const prof = await getProfile(user.uid);
      roastBox.textContent = `Roast level: ${prof.roastLevel}. ${roast(prof.roastLevel)}`;

      await loadExpenses(user.uid);
    } catch (err) {
      setAppError(err);
    }
  } else {
    authCard.classList.remove("hidden");
    appCard.classList.add("hidden");
    btnSignOut.style.display = "none";
    userPill.textContent = "";
    expenseList.innerHTML = "";
  }
});


