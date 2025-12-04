// ==============================
// Candoll 管理画面 admin.js（完全統合版）
// ==============================

const API_URL =
  "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

const loginBox = document.getElementById("login-box");
const daysWrapper = document.getElementById("days-wrapper");
const loginError = document.getElementById("login-error");

const menuLogout = document.getElementById("m-logout");
const menuAdd = document.getElementById("m-add");
const menuDel = document.getElementById("m-del");

const navPrev = document.getElementById("nav-prev");
const navNext = document.getElementById("nav-next");
const navCurrent = document.getElementById("nav-current");
const dayNavi = document.getElementById("day-navi");

const popupBg = document.getElementById("popup-bg");
const popupBox = document.getElementById("popup-box");

const TIMES = [];
for (let h = 10; h <= 18; h++) {
  TIMES.push(`${String(h).padStart(2, "0")}:00`);
  TIMES.push(`${String(h).padStart(2, "0")}:30`);
}
TIMES.push("19:00");

// ------------------------------
// ログイン
// ------------------------------
document.getElementById("login-btn").onclick = async () => {
  const pass = document.getElementById("admin-pass").value.trim();
  if (!pass) return;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "list", password: pass }),
  });

  const json = await res.json();
  if (!json.ok) return (loginError.style.display = "block");

  loginError.style.display = "none";
  loginBox.style.display = "none";

  localStorage.setItem("candoll_admin_pass", pass);

  loadAll();
};

if (localStorage.getItem("candoll_admin_pass")) {
  loginBox.style.display = "none";
  loadAll();
}

// ------------------------------
// 共通
// ------------------------------
async function fetchAll() {
  const pass = localStorage.getItem("candoll_admin_pass");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "list", password: pass }),
  });
  return await res.json();
}

let baseDate = new Date();

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function jp(d) {
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${w}）`;
}

function shiftDate(d, n) {
  const t = new Date(d);
  t.setDate(t.getDate() + n);
  return t;
}

// ------------------------------
// メイン描画
// ------------------------------
async function loadAll() {
  const all = await fetchAll();
  const reservations = all.data;
  const holidays = all.holidays.map((h) => h.date);

  daysWrapper.innerHTML = "";

  dayNavi.style.display = "flex";
  navCurrent.textContent = jp(baseDate);

  [0, 1, 2].forEach((n) => {
    const d = shiftDate(baseDate, n);
    const dStr = ymd(d);

    const col = document.createElement("div");
    col.className = "day-column";

    const title = document.createElement("div");
    title.className = "date-title";
    title.textContent = jp(d);
    col.appendChild(title);

    renderDayBlocks(
      col,
      dStr,
      reservations.filter((r) => r.date === dStr),
      holidays.includes(dStr)
    );

    daysWrapper.appendChild(col);
  });
}

// ------------------------------
// 1日分描画（追加・編集クリック対応）
// ------------------------------
function renderDayBlocks(col, date, list, isHoliday) {
  TIMES.forEach((time) => {
    const b = document.createElement("div");
    b.style.margin = "6px 0";
    b.style.padding = "14px";
    b.style.fontSize = "18px";
    b.style.borderRadius = "8px";

    if (isHoliday) {
      b.style.background = "#ffb3b3";
      b.textContent = `${time} 休業日`;
      col.appendChild(b);
      return;
    }

    const r = overlap(list, time);

    if (r) {
      b.style.background = "#ffd4d4";
      b.style.textAlign = "left";
      b.innerHTML = `
        <div style="font-weight:bold;">${r.time}〜${r.end_time}</div>
        <div>${r.name}</div>
        <div>${r.menus}</div>
      `;

      b.onclick = () => openEditPopup(r);

    } else {
      b.style.background = "#d8ffe0";
      b.textContent = `${time}（空き）`;

      b.onclick = () => openAddPopup(date, time);
    }

    col.appendChild(b);
  });
}

function overlap(list, start) {
  const toMin = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const s = toMin(start);

  for (const r of list) {
    const rs = toMin(r.time);
    const re = toMin(r.end_time);
    if (s >= rs && s < re) return r;
  }
  return null;
}

// ------------------------------
// 予約編集ポップアップ
// ------------------------------
function openEditPopup(r) {
  popupBox.innerHTML = `
    <h3>予約編集</h3>

    <label>名前</label>
    <input id="edit-name" value="${r.name}">

    <label>開始時間</label>
    <input id="edit-time" value="${r.time}">

    <label>終了時間</label>
    <input id="edit-end" value="${r.end_time}">

    <label>メニュー</label>
    <input id="edit-menus" value="${r.menus}">

    <button id="save-edit">更新</button>
    <button id="close-popup" style="margin-top:10px;background:#888;">閉じる</button>
  `;

  popupBg.style.display = "flex";

  document.getElementById("save-edit").onclick = async () => {
    const pass = localStorage.getItem("candoll_admin_pass");

    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "edit",
        password: pass,
        id: r.id,
        name: document.getElementById("edit-name").value,
        time: document.getElementById("edit-time").value,
        end_time: document.getElementById("edit-end").value,
        menus: document.getElementById("edit-menus").value,
      }),
    });

    popupBg.style.display = "none";
    loadAll();
  };

  document.getElementById("close-popup").onclick = () => {
    popupBg.style.display = "none";
  };
}

// ------------------------------
// 予約追加ポップアップ
// ------------------------------
function openAddPopup(date, time) {
  popupBox.innerHTML = `
    <h3>予約追加</h3>

    <label>名前</label>
    <input id="add-name">

    <label>メニュー</label>
    <input id="add-menus">

    <label>開始時間</label>
    <input id="add-time" value="${time}">

    <label>終了時間</label>
    <input id="add-end" value="${time}">

    <button id="save-add">追加</button>
    <button id="close-popup" style="margin-top:10px;background:#888;">閉じる</button>
  `;

  popupBg.style.display = "flex";

  document.getElementById("save-add").onclick = async () => {
    const pass = localStorage.getItem("candoll_admin_pass");

    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "add",
        password: pass,
        date: date,
        name: document.getElementById("add-name").value,
        menus: document.getElementById("add-menus").value,
        time: document.getElementById("add-time").value,
        end_time: document.getElementById("add-end").value,
      }),
    });

    popupBg.style.display = "none";
    loadAll();
  };

  document.getElementById("close-popup").onclick = () => {
    popupBg.style.display = "none";
  };
}

// ------------------------------
// 休日管理（月日・曜日表示）
// ------------------------------
function jpDateString(dStr) {
  const d = new Date(dStr);
  const w = ["日","月","火","水","木","金","土"][d.getDay()];
  return `${d.getMonth()+1}/${d.getDate()}（${w}）`;
}

menuAdd.onclick = () => {
  const d = prompt("休日にする日付（例：2025-12-05）");
  if (!d) return;

  if (!confirm(`${jpDateString(d)} を“休日”にしますか？`)) return;

  const pass = localStorage.getItem("candoll_admin_pass");
  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "holiday_add",
      password: pass,
      date: d,
      reason: "休業日",
    }),
  }).then(loadAll);
};

menuDel.onclick = () => {
  const d = prompt("解除する休日の日付（例：2025-12-05）");
  if (!d) return;

  if (!confirm(`${jpDateString(d)} の休日設定を解除しますか？`)) return;

  const pass = localStorage.getItem("candoll_admin_pass");
  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "holiday_delete",
      password: pass,
      date: d,
    }),
  }).then(loadAll);
};

// ------------------------------
// 日付ナビ
// ------------------------------
navPrev.onclick = () => {
  baseDate = shiftDate(baseDate, -1);
  loadAll();
};

navNext.onclick = () => {
  baseDate = shiftDate(baseDate, 1);
  loadAll();
};

// ------------------------------
// ログアウト
// ------------------------------
menuLogout.onclick = () => {
  localStorage.removeItem("candoll_admin_pass");
  loginBox.style.display = "block";
  daysWrapper.innerHTML = "";
  dayNavi.style.display = "none";
  document.getElementById("admin-pass").value = "";
};
