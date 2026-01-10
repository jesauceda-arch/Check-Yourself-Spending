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

/* Firebase config */
const firebaseConfig = {
  apiKey: "AIzaSyAcjejaIXVB9RQpL-5RWlyezYugNCMN0NQ",
  authDomain: "check-yourself-spending.firebaseapp.com",
  projectId: "check-yourself-spending",
  storageBucket: "check-yourself-spending.firebasestorage.app",
  messagingSenderId: "464693115714",
  appId: "1:464693115714:web:f57fe7d28167e41df3a6db"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* DOM */
const authCard = document.getElementById("authCard");
const appCard = document.getElementById("appCard");

const email = document.getElementById("authEmail");
const password = document.getElementById("authPassword");
const roastSelect = document.getElementById("roastLevelAuth");
const rememberMe = document.getElementById("rememberMe");

const btnSignIn = document.getElementById("btnSignIn");
const btnSignUp = document.getElementById("btnSignUp");
const btnGoogle = document.getElementById("btnGoogle");
const btnApple = document.getElementById("btnApple");
const btnSignOut = document.getElementById("btnSignOutTop");

const userPill = document.getElementById("userPill");
const roastBox = document.getElementById("roastBox");
const expenseList = document.getElementById("expenseList");
const amount = document.getElementById("amount");
const category = document.getElementById("category");
const dateInput = document.getElementById("date");
const note = document.getElementById("note");
const btnAdd = document.getElementById("btnAdd");
const authMsg = document.getElementById("authMsg");
const appMsg = document.getElementById("appMsg");

/* Helpers */
const today = () => new Date().toISOString().slice(0,10);
dateInput.value = today();

function roast(level) {
  const lines = {
    nice: ["Nice choice.", "You're being intentional."],
    balanced: ["We're watching this.", "Careful now."],
    savage: ["You didn't need that.", "Your budget flinched."]
  };
  return lines[level][Math.floor(Math.random()*lines[level].length)];
}

/* Persistence */
async function applyPersistence() {
  await setPersistence(
    auth,
    rememberMe.checked ? browserLocalPersistence : browserSessionPersistence
  );
}

/* Auth */
btnSignUp.onclick = async () => {
  await applyPersistence();
  await createUserWithEmailAndPassword(auth, email.value, password.value);
};

btnSignIn.onclick = async () => {
  await applyPersistence();
  await signInWithEmailAndPassword(auth, email.value, password.value);
};

btnGoogle.onclick = async () => {
  await applyPersistence();
  await signInWithPopup(auth, new GoogleAuthProvider());
};

btnApple.onclick = async () => {
  await applyPersistence();
  await signInWithRedirect(auth, new OAuthProvider("apple.com"));
};

btnSignOut.onclick = async () => {
  await signOut(auth);
};

/* Auth state */
onAuthStateChanged(auth, async user => {
  if (user) {
    authCard.classList.add("hidden");
    appCard.classList.remove("hidden");
    btnSignOut.style.display = "inline-block";
    userPill.textContent = user.email;

    await setDoc(doc(db,"users",user.uid),{
      roastLevel: roastSelect.value,
      updatedAt: serverTimestamp()
    },{merge:true});

    roastBox.textContent = roast(roastSelect.value);
    loadExpenses(user.uid);
  } else {
    authCard.classList.remove("hidden");
    appCard.classList.add("hidden");
    btnSignOut.style.display = "none";
  }
});

/* Expenses */
btnAdd.onclick = async () => {
  const user = auth.currentUser;
  if (!user) return;

  await addDoc(collection(db,"users",user.uid,"expenses"),{
    amount:Number(amount.value),
    category:category.value,
    date:dateInput.value,
    note:note.value,
    createdAt: serverTimestamp()
  });

  amount.value="";
  note.value="";
  roastBox.textContent = roast(roastSelect.value);
  loadExpenses(user.uid);
};

async function loadExpenses(uid){
  expenseList.innerHTML="";
  const q = query(collection(db,"users",uid,"expenses"),orderBy("date","desc"));
  const snap = await getDocs(q);
  snap.forEach(d=>{
    const e=d.data();
    const div=document.createElement("div");
    div.textContent=`$${e.amount} — ${e.category} (${e.date})`;
    expenseList.appendChild(div);
  });
}



