// ============================================================
//  Money Manager - app logic
//  Plain ES-module JS using Firebase v10 modular SDK (CDN).
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updatePassword, verifyBeforeUpdateEmail,
  EmailAuthProvider, reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, updateDoc,
  deleteDoc, onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { firebaseConfig, CURRENCY, LOCALE } from "./firebase-config.js";

// ---------- Init ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const fmt = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY, maximumFractionDigits: 2 });
const money = (n) => fmt.format(Number(n) || 0);
const todayStr = () => new Date().toISOString().slice(0, 10);

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

// ---------- App state ----------
let uid = null;
let transactions = [];
let tags = [];
let methods = [];
let shared = [];
let unsub = []; // firestore listener unsubscribers

// Collection path helpers (per-user isolation)
const col = (name) => collection(db, "users", uid, name);
const docRef = (name, id) => doc(db, "users", uid, name, id);

// ============================================================
//  AUTH
// ============================================================
function authError(msg) {
  const el = $("#authError");
  if (!msg) { hide(el); return; }
  el.textContent = msg;
  show(el);
}

$("#googleSignInBtn").addEventListener("click", async () => {
  authError("");
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) { authError(prettyAuthError(e)); }
});

$("#emailAuthForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  authError("");
  const email = $("#emailInput").value.trim();
  const pass = $("#passwordInput").value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) { authError(prettyAuthError(e)); }
});

$("#signupBtn").addEventListener("click", async () => {
  authError("");
  const email = $("#emailInput").value.trim();
  const pass = $("#passwordInput").value;
  if (pass.length < 6) { authError("Password must be at least 6 characters."); return; }
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
  } catch (e) { authError(prettyAuthError(e)); }
});

$("#logoutBtn").addEventListener("click", () => { closeDrawer(); signOut(auth); });

// ---------- Side drawer ----------
const drawer = $("#drawer");
const drawerOverlay = $("#drawerOverlay");
function openDrawer() { drawer.classList.add("open"); show(drawerOverlay); }
function closeDrawer() { drawer.classList.remove("open"); hide(drawerOverlay); }
$("#menuBtn").addEventListener("click", openDrawer);
$("#drawerClose").addEventListener("click", closeDrawer);
drawerOverlay.addEventListener("click", closeDrawer);

function setMsg(el, text, kind) {
  if (!text) { el.className = "msg hidden"; el.textContent = ""; return; }
  el.textContent = text;
  el.className = "msg " + (kind === "ok" ? "ok" : "err");
}

function populateProfile(user) {
  const email = user.email || "—";
  const name = user.displayName || (user.email ? user.email.split("@")[0] : "User");
  $("#profileName").textContent = name;
  $("#profileEmail").textContent = email;
  $("#profileAvatar").textContent = (name.trim()[0] || "?").toUpperCase();
  const providers = (user.providerData || []).map((p) => p.providerId);
  const isPassword = providers.includes("password");
  const isGoogle = providers.includes("google.com");
  $("#profileProvider").textContent =
    isPassword ? "Email / password account" : (isGoogle ? "Signed in with Google" : "");
  // Only email/password accounts can change email & password here.
  if (isPassword) { show($("#passwordAuthArea")); hide($("#googleAuthNote")); }
  else { hide($("#passwordAuthArea")); show($("#googleAuthNote")); }
}

// Update email (sends a verification link to the new address)
$("#emailUpdateForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#emailUpdateMsg");
  setMsg(msg, "");
  const newEmail = $("#newEmailInput").value.trim();
  const curPass = $("#emailCurPass").value;
  try {
    const user = auth.currentUser;
    const cred = EmailAuthProvider.credential(user.email, curPass);
    await reauthenticateWithCredential(user, cred);
    await verifyBeforeUpdateEmail(user, newEmail);
    setMsg(msg, `Verification link sent to ${newEmail}. Open it to confirm, then log in again.`, "ok");
    $("#emailUpdateForm").reset();
  } catch (err) { setMsg(msg, prettyAuthError(err), "err"); }
});

// Update password (requires current password to re-authenticate)
$("#passwordUpdateForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#passwordUpdateMsg");
  setMsg(msg, "");
  const cur = $("#curPassInput").value;
  const next = $("#newPassInput").value;
  if (next.length < 6) { setMsg(msg, "New password must be at least 6 characters.", "err"); return; }
  try {
    const user = auth.currentUser;
    const cred = EmailAuthProvider.credential(user.email, cur);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, next);
    setMsg(msg, "Password updated successfully.", "ok");
    $("#passwordUpdateForm").reset();
  } catch (err) { setMsg(msg, prettyAuthError(err), "err"); }
});

function prettyAuthError(e) {
  const c = (e && e.code) || "";
  const map = {
    "auth/invalid-credential": "Wrong email or password.",
    "auth/invalid-email": "That email address looks invalid.",
    "auth/user-not-found": "No account with that email. Try Sign up.",
    "auth/wrong-password": "Wrong password.",
    "auth/email-already-in-use": "That email already has an account. Try Log in.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/popup-closed-by-user": "Sign-in popup was closed.",
    "auth/operation-not-allowed": "This sign-in method isn't enabled in Firebase console.",
    "auth/requires-recent-login": "Please re-enter your current password and try again.",
    "auth/missing-password": "Please enter your current password.",
    "auth/too-many-requests": "Too many attempts. Wait a bit and try again.",
  };
  return map[c] || (e && e.message) || "Something went wrong.";
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    uid = user.uid;
    populateProfile(user);
    hide($("#loginView")); hide($("#loadingView")); show($("#appView"));
    startListeners();
  } else {
    uid = null;
    closeDrawer();
    stopListeners();
    hide($("#loadingView")); hide($("#appView")); show($("#loginView"));
  }
});

// ============================================================
//  FIRESTORE LISTENERS (real-time)
// ============================================================
function startListeners() {
  stopListeners();
  unsub.push(onSnapshot(query(col("transactions"), orderBy("date", "desc")), (snap) => {
    transactions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTransactions(); renderSummary();
  }));
  unsub.push(onSnapshot(query(col("tags"), orderBy("name")), (snap) => {
    tags = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTags(); renderTagFilter(); renderTagPicker();
  }));
  unsub.push(onSnapshot(query(col("methods"), orderBy("name")), (snap) => {
    methods = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderMethods(); renderMethodSelect();
  }));
  unsub.push(onSnapshot(query(col("shared"), orderBy("date", "desc")), (snap) => {
    shared = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderShared(); renderSummary();
  }));
}
function stopListeners() {
  unsub.forEach((fn) => { try { fn(); } catch (_) {} });
  unsub = [];
  transactions = []; tags = []; methods = []; shared = [];
}

// ============================================================
//  SUMMARY
// ============================================================
function renderSummary() {
  let debit = 0;
  for (const t of transactions) {
    debit += Number(t.amount) || 0;
  }
  let owed = 0;
  for (const s of shared) {
    for (const p of (s.participants || [])) {
      if (!p.isMe && !p.returned) owed += Number(p.share) || 0;
    }
  }
  $("#totalDebit").textContent = money(debit);
  $("#totalOwed").textContent = money(owed);
}

// ============================================================
//  TABS
// ============================================================
$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach((t) => t.classList.remove("active"));
    $$(".tab-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    $("#tab-" + tab.dataset.tab).classList.add("active");
  });
});

// ============================================================
//  TAGS (settings)
// ============================================================
$("#tagForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#tagInput").value.trim();
  if (!name) return;
  if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) { $("#tagInput").value = ""; return; }
  await addDoc(col("tags"), { name });
  $("#tagInput").value = "";
});

function renderTags() {
  const box = $("#tagChips");
  box.innerHTML = "";
  if (!tags.length) { box.innerHTML = '<span class="muted small">No tags yet.</span>'; return; }
  for (const t of tags) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `<span>${escapeHtml(t.name)}</span><span class="x" title="Delete">×</span>`;
    chip.querySelector(".x").addEventListener("click", () => deleteDoc(docRef("tags", t.id)));
    box.appendChild(chip);
  }
}

function renderTagFilter() {
  const sel = $("#filterTag");
  const cur = sel.value;
  sel.innerHTML = '<option value="all">All tags</option>';
  for (const t of tags) {
    const o = document.createElement("option");
    o.value = t.name; o.textContent = t.name;
    sel.appendChild(o);
  }
  sel.value = tags.some((t) => t.name === cur) ? cur : "all";
}

// ============================================================
//  PAYMENT METHODS (settings)
// ============================================================
$("#methodForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#methodInput").value.trim();
  if (!name) return;
  if (methods.some((m) => m.name.toLowerCase() === name.toLowerCase())) { $("#methodInput").value = ""; return; }
  await addDoc(col("methods"), { name });
  $("#methodInput").value = "";
});

function renderMethods() {
  const box = $("#methodChips");
  box.innerHTML = "";
  if (!methods.length) { box.innerHTML = '<span class="muted small">No payment methods yet.</span>'; return; }
  for (const m of methods) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `<span>${escapeHtml(m.name)}</span><span class="x" title="Delete">×</span>`;
    chip.querySelector(".x").addEventListener("click", () => deleteDoc(docRef("methods", m.id)));
    box.appendChild(chip);
  }
}

function renderMethodSelect() {
  const sel = $("#txnMethod");
  const cur = sel.value;
  sel.innerHTML = "";
  if (!methods.length) {
    sel.innerHTML = '<option value="">(add methods in Settings)</option>';
    return;
  }
  for (const m of methods) {
    const o = document.createElement("option");
    o.value = m.name; o.textContent = m.name;
    sel.appendChild(o);
  }
  if (methods.some((m) => m.name === cur)) sel.value = cur;
}

// ============================================================
//  TRANSACTIONS
// ============================================================
const txnModal = $("#txnModal");

$("#addTxnBtn").addEventListener("click", () => openTxnModal());
$("#filterBtn").addEventListener("click", () => $("#txnFilters").classList.toggle("hidden"));

// ---- Filters: tag + date range, applied only on "Apply" ----
let appliedFilters = { tag: "all", from: "", to: "" };

function updateFilterActive() {
  const on = appliedFilters.tag !== "all" || !!appliedFilters.from || !!appliedFilters.to;
  $("#filterBtn").classList.toggle("active", on);
}

$("#applyFiltersBtn").addEventListener("click", () => {
  appliedFilters = {
    tag: $("#filterTag").value,
    from: $("#dateFrom").value,
    to: $("#dateTo").value,
  };
  updateFilterActive();
  renderTransactions();
});
$("#clearFiltersBtn").addEventListener("click", () => {
  $("#filterTag").value = "all";
  $("#dateFrom").value = "";
  $("#dateTo").value = "";
  appliedFilters = { tag: "all", from: "", to: "" };
  updateFilterActive();
  renderTransactions();
});

let selectedTxnTags = new Set();

function renderTagPicker() {
  const box = $("#txnTagPicker");
  box.innerHTML = "";
  if (!tags.length) { box.innerHTML = '<span class="muted small">Add tags in Settings first.</span>'; return; }
  for (const t of tags) {
    const chip = document.createElement("span");
    chip.className = "chip" + (selectedTxnTags.has(t.name) ? " selected" : "");
    chip.textContent = t.name;
    chip.addEventListener("click", () => {
      if (selectedTxnTags.has(t.name)) selectedTxnTags.delete(t.name);
      else selectedTxnTags.add(t.name);
      chip.classList.toggle("selected");
    });
    box.appendChild(chip);
  }
}

function openTxnModal(txn = null) {
  $("#txnForm").reset();
  selectedTxnTags = new Set(txn && txn.tags ? txn.tags : []);
  $("#txnId").value = txn ? txn.id : "";
  $("#txnModalTitle").textContent = txn ? "Edit Transaction" : "Add Transaction";
  $("#txnAmount").value = txn ? txn.amount : "";
  $("#txnNote").value = txn ? (txn.note || "") : "";
  $("#txnDate").value = txn ? txn.date : todayStr();
  renderMethodSelect();
  if (txn && txn.method) $("#txnMethod").value = txn.method;
  renderTagPicker();
  show(txnModal);
}

$("#txnForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#txnId").value;
  const data = {
    amount: Number($("#txnAmount").value) || 0,
    method: $("#txnMethod").value || "",
    tags: Array.from(selectedTxnTags),
    note: $("#txnNote").value.trim(),
    date: $("#txnDate").value || todayStr(),
    updatedAt: serverTimestamp(),
  };
  if (id) {
    await updateDoc(docRef("transactions", id), data);
  } else {
    data.createdAt = serverTimestamp();
    await addDoc(col("transactions"), data);
  }
  hide(txnModal);
});

function renderTransactions() {
  const list = $("#txnList");
  list.innerHTML = "";
  const rows = transactions.filter((t) => {
    if (appliedFilters.tag !== "all" && !(t.tags || []).includes(appliedFilters.tag)) return false;
    if (appliedFilters.from && (t.date || "") < appliedFilters.from) return false;
    if (appliedFilters.to && (t.date || "") > appliedFilters.to) return false;
    return true;
  });
  $("#txnEmpty").classList.toggle("hidden", rows.length > 0);
  $("#txnCount").textContent = transactions.length
    ? `Showing ${rows.length} of ${transactions.length} transactions`
    : "";
  for (const t of rows) {
    const li = document.createElement("li");
    li.className = "item";
    const tagPills = (t.tags || []).map((x) => `<span class="tag-pill">${escapeHtml(x)}</span>`).join("");
    const methodPill = t.method ? `<span class="method-pill">${escapeHtml(t.method)}</span>` : "";
    const actions = t.fromShared
      ? `<div class="item-actions"><span class="muted small">From a shared expense — edit it in the Shared tab.</span></div>`
      : `<div class="item-actions">
          <button class="btn btn-ghost small" data-edit>Edit</button>
          <button class="btn btn-ghost small" data-del>Delete</button>
        </div>`;
    li.innerHTML = `
      <div class="item-row">
        <div class="item-main">
          <span class="item-title">${escapeHtml(t.note || "Expense")}</span>
          <span class="item-sub">${methodPill}${tagPills}<span>${escapeHtml(t.date || "")}</span></span>
        </div>
        <span class="amount debit">${money(t.amount)}</span>
      </div>
      ${actions}`;
    if (!t.fromShared) {
      li.querySelector("[data-edit]").addEventListener("click", () => openTxnModal(t));
      li.querySelector("[data-del]").addEventListener("click", () => {
        if (confirm("Delete this transaction?")) deleteDoc(docRef("transactions", t.id));
      });
    }
    list.appendChild(li);
  }
}

// ============================================================
//  SHARED EXPENSES
// ============================================================
const sharedModal = $("#sharedModal");

$("#addSharedBtn").addEventListener("click", () => openSharedModal());
$("#addParticipantBtn").addEventListener("click", () => addParticipantRow());

function addParticipantRow(p = null, isMe = false) {
  const wrap = $("#participantRows");
  const row = document.createElement("div");
  row.className = "participant-row";
  row.innerHTML = `
    <input type="text" class="p-name" placeholder="${isMe ? "You" : "Name"}" value="${p ? escapeHtml(p.name) : (isMe ? "You" : "")}" ${isMe ? "readonly" : ""} />
    <input type="number" class="p-share" step="0.01" min="0" placeholder="Share" value="${p ? (p.share ?? "") : ""}" />
    ${isMe ? '<span class="del" style="visibility:hidden">×</span>' : '<span class="del" title="Remove">×</span>'}`;
  row.dataset.isMe = isMe ? "1" : "0";
  if (p && p.returned) row.dataset.returned = "1";
  const del = row.querySelector(".del");
  if (!isMe) del.addEventListener("click", () => { row.remove(); });
  wrap.appendChild(row);
}

function openSharedModal(exp = null) {
  $("#sharedForm").reset();
  setMsg($("#sharedMsg"), "");
  $("#participantRows").innerHTML = "";
  $("#sharedId").value = exp ? exp.id : "";
  $("#sharedModalTitle").textContent = exp ? "Edit Shared Expense" : "Add Shared Expense";
  $("#sharedDesc").value = exp ? exp.description : "";
  $("#sharedTotal").value = exp ? exp.total : "";
  $("#sharedDate").value = exp ? exp.date : todayStr();

  if (exp && exp.participants && exp.participants.length) {
    for (const p of exp.participants) addParticipantRow(p, !!p.isMe);
  } else {
    addParticipantRow(null, true);   // You
    addParticipantRow();             // one blank friend
  }
  show(sharedModal);
}

// Auto-split helper: when total changes and shares are empty, suggest equal split on save.
$("#sharedForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#sharedId").value;
  const total = Number($("#sharedTotal").value) || 0;
  const rows = $$("#participantRows .participant-row");

  // Gather participants
  let participants = rows.map((r) => {
    const isMe = r.dataset.isMe === "1";
    const name = r.querySelector(".p-name").value.trim() || (isMe ? "You" : "Friend");
    const shareRaw = r.querySelector(".p-share").value;
    return {
      name,
      isMe,
      share: shareRaw === "" ? null : (Number(shareRaw) || 0),
      returned: isMe ? true : (r.dataset.returned === "1"),
    };
  }).filter((p) => p.name);

  if (!participants.length) { alert("Add at least one person."); return; }

  // Equal split for any blank shares (last blank absorbs rounding remainder)
  const blanks = participants.filter((p) => p.share === null);
  if (blanks.length) {
    const assigned = participants.reduce((s, p) => s + (p.share || 0), 0);
    const per = Math.round(((total - assigned) / blanks.length) * 100) / 100;
    blanks.forEach((p) => { p.share = per > 0 ? per : 0; });
    // correct rounding so shares sum exactly to the total
    const sumNow = participants.reduce((s, p) => s + (Number(p.share) || 0), 0);
    const drift = Math.round((total - sumNow) * 100) / 100;
    if (drift !== 0) {
      const lastBlank = blanks[blanks.length - 1];
      lastBlank.share = Math.round(((lastBlank.share || 0) + drift) * 100) / 100;
    }
  }

  // Validate: everyone's shares must add up to the total paid.
  const sumShares = Math.round(participants.reduce((s, p) => s + (Number(p.share) || 0), 0) * 100) / 100;
  if (Math.abs(sumShares - total) > 0.01) {
    setMsg($("#sharedMsg"),
      `Shares add up to ${money(sumShares)}, but the total is ${money(total)}. Please make them match.`, "err");
    return;
  }
  setMsg($("#sharedMsg"), "");

  const data = {
    description: $("#sharedDesc").value.trim(),
    total,
    date: $("#sharedDate").value || todayStr(),
    participants,
    updatedAt: serverTimestamp(),
  };

  // Model A: your own share is a real expense.
  const mine = participants.find((p) => p.isMe);
  const myShare = mine ? (Number(mine.share) || 0) : 0;

  if (id) {
    await updateDoc(docRef("shared", id), data);
    const existing = shared.find((s) => s.id === id);
    await syncShareTxn(id, existing && existing.linkedTxnId, myShare, data.description, data.date);
  } else {
    data.createdAt = serverTimestamp();
    const sharedRef = await addDoc(col("shared"), data);
    await syncShareTxn(sharedRef.id, null, myShare, data.description, data.date);
  }
  hide(sharedModal);
});

// Keep the linked "your share" expense transaction in sync with a shared expense.
function shareTxnPayload(sharedId, myShare, description, date) {
  return {
    amount: myShare,
    method: "",
    tags: ["Shared"],
    note: "Shared: " + (description || "expense"),
    date: date || todayStr(),
    fromShared: true,
    sharedId,
    updatedAt: serverTimestamp(),
  };
}

async function syncShareTxn(sharedId, linkedTxnId, myShare, description, date) {
  // No share to record -> remove any existing linked transaction.
  if (!(myShare > 0)) {
    if (linkedTxnId) {
      try { await deleteDoc(docRef("transactions", linkedTxnId)); } catch (_) {}
      try { await updateDoc(docRef("shared", sharedId), { linkedTxnId: null }); } catch (_) {}
    }
    return;
  }
  const payload = shareTxnPayload(sharedId, myShare, description, date);
  if (linkedTxnId) {
    try {
      await updateDoc(docRef("transactions", linkedTxnId), payload);
      return;
    } catch (_) { /* linked txn was deleted; recreate below */ }
  }
  payload.createdAt = serverTimestamp();
  const ref = await addDoc(col("transactions"), payload);
  await updateDoc(docRef("shared", sharedId), { linkedTxnId: ref.id });
}

function renderShared() {
  const list = $("#sharedList");
  list.innerHTML = "";
  $("#sharedEmpty").classList.toggle("hidden", shared.length > 0);
  for (const s of shared) {
    const parts = s.participants || [];
    const others = parts.filter((p) => !p.isMe);
    const pending = others.filter((p) => !p.returned);
    const owedToYou = pending.reduce((sum, p) => sum + (Number(p.share) || 0), 0);

    const li = document.createElement("li");
    li.className = "item";
    const settleRows = parts.map((p, idx) => {
      if (p.isMe) {
        return `<div class="settle-row"><span class="settle-name done">${escapeHtml(p.name)} (you) · ${money(p.share)}</span><span class="badge paid">your share</span></div>`;
      }
      return `
        <div class="settle-row">
          <span class="settle-name ${p.returned ? "done" : ""}">${escapeHtml(p.name)} · ${money(p.share)}</span>
          <span style="display:flex;gap:8px;align-items:center">
            <span class="badge ${p.returned ? "paid" : "pending"}">${p.returned ? "settled" : "owes you"}</span>
            <button class="btn btn-ghost small" data-toggle="${idx}">${p.returned ? "Undo" : "Mark paid"}</button>
          </span>
        </div>`;
    }).join("");

    li.innerHTML = `
      <div class="item-row">
        <div class="item-main">
          <span class="item-title">${escapeHtml(s.description || "Shared expense")}</span>
          <span class="item-sub"><span>${escapeHtml(s.date || "")}</span><span>Total ${money(s.total)}</span></span>
        </div>
        <span class="amount ${owedToYou > 0 ? "debit" : "credit"}">${owedToYou > 0 ? money(owedToYou) + " owed" : "settled"}</span>
      </div>
      <div style="margin-top:10px">${settleRows}</div>
      <div class="item-actions">
        <button class="btn btn-ghost small" data-edit>Edit</button>
        <button class="btn btn-ghost small" data-del>Delete</button>
      </div>`;

    li.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const idx = Number(btn.dataset.toggle);
        const updated = parts.map((p, i) => i === idx ? { ...p, returned: !p.returned } : p);
        await updateDoc(docRef("shared", s.id), { participants: updated, updatedAt: serverTimestamp() });
      });
    });
    li.querySelector("[data-edit]").addEventListener("click", () => openSharedModal(s));
    li.querySelector("[data-del]").addEventListener("click", async () => {
      if (!confirm("Delete this shared expense? Your linked expense entry will be removed too.")) return;
      if (s.linkedTxnId) { try { await deleteDoc(docRef("transactions", s.linkedTxnId)); } catch (_) {} }
      await deleteDoc(docRef("shared", s.id));
    });
    list.appendChild(li);
  }
}

// ============================================================
//  MODAL close handlers
// ============================================================
$$("[data-close]").forEach((b) => b.addEventListener("click", () => {
  hide(txnModal); hide(sharedModal);
}));
[txnModal, sharedModal].forEach((m) => {
  m.addEventListener("click", (e) => { if (e.target === m) hide(m); });
});

// ============================================================
//  Utils
// ============================================================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Show login by default until auth resolves; loading spinner covers the gap.
show($("#loadingView"));
