// ==============================
// Candoll 管理画面 admin.js（menus対応＋予約追加モーダル対応）
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

// ▼ 新規予約モーダル
const addPopupBg = document.getElementById("add-popup-bg");
const addMenu = document.getElementById("add-menu");
const addTimeRequired = document.getElementById("add-time-required");
const addTimeSel = document.getElementById("add-time");
const addEndTime = document.getElementById("add-end-time");
const addName = document.getElementById("add-name");
const addSave = document.getElementById("add-save");
const addCancel = document.getElementById("add-cancel");

const popupBg = document.getElementById("popup-bg");
const popupBox = document.getElementById("popup-box");

let MENUS = []; // ← Supabase から取得するメニュー一覧

// ▼ 時間帯の基本リスト
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
  if (!json.reservations) return (loginError.style.display = "block");

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
// データ取得
// ------------------------------
async function fetchAll() {
  const pass = localStorage.getItem("candoll_admin_pass");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "list", password: pass }),
  });
  const json = await res.json();
  MENUS = json.menus || [];
  return json;
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
  const reservations = all.reservations || [];
  const holidays = all.holidays?.map((h) => h.date) || [];

  daysWrapper.innerHTML = "";

  dayNavi.style.display = "flex";
  navCurrent.textContent = jp(baseDate);

  [0, 1, 2].forEach((n) => {
    const d = shiftDate(baseDate, n);
    const dStr = ymd(d);

    const col = document.createElement("div");
    col.className = "day-column";

    // ▼ タイトル行（＋ボタン付）
    const title = document.createElement("div");
    title.className = "date-title";
    title.style.display = "flex";
    title.style.justifyContent = "space-between";
    title.style.alignItems = "center";

    const titleText = document.createElement("span");
    titleText.textContent = jp(d);

    const addBtn = document.createElement("button");
    addBtn.textContent = "＋";
    addBtn.style.cssText = `
        background:#fff;
        color:#000;
        border-radius:6px;
        padding:4px 10px;
        font-size:20px;
        border:1px solid #000;
        cursor:pointer;
    `;
    addBtn.onclick = () => openAddPopup(dStr); // ← この日の予約追加

    title.appendChild(titleText);
    title.appendChild(addBtn);
    col.appendChild(title);

    // ▼ 枠描画
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
// 枠描画
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
        <div>${r.menu}</div>
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
// ★ 予約追加モーダルを開く
// ------------------------------
function openAddPopup(date) {
  addPopupBg.style.display = "flex";

  // ▼ メニューのプルダウン生成
  addMenu.innerHTML = "";
  MENUS.forEach((m) => {
    const op = document.createElement("option");
    op.value = m.id;
    op.textContent = `${m.name}（${m.time}分）`;
    op.dataset.time = m.time;
    addMenu.appendChild(op);
  });

  // ▼ 所要時間セット
  const firstMenu = MENUS[0];
  addTimeRequired.value = `${firstMenu.time} 分`;

  // ▼ 開始時間プルダウン生成
  addTimeSel.innerHTML = "";
  TIMES.forEach((t) => {
    const op = document.createElement("option");
    op.value = t;
    op.textContent = t;
    addTimeSel.appendChild(op);
  });

  // ▼ 終了時間を自動計算
  calcEndTime();

  // ▼ メニュー変更で時間更新
  addMenu.onchange = () => {
    const t = MENUS.find((x) => x.id == addMenu.value).time;
    addTimeRequired.value = `${t} 分`;
    calcEndTime();
  };

  // ▼ 開始時間変更で終了時間再計算
  addTimeSel.onchange = calcEndTime;

  // ▼ 保存
  addSave.onclick = async () => {
    const pass = localStorage.getItem("candoll_admin_pass");

    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "add",
        password: pass,
        date,
        menu: addMenu.value,
        name: addName.value,
        time: addTimeSel.value,
        end_time: addEndTime.value,
      }),
    });

    addPopupBg.style.display = "none";
    loadAll();
  };

  addCancel.onclick = () => {
    addPopupBg.style.display = "none";
  };
}

// ------------------------------
// ★ 終了時間の自動計算
// ------------------------------
function calcEndTime() {
  const start = addTimeSel.value;
  const m = MENUS.find((x) => x.id == addMenu.value).time;

  const [h, mm] = start.split(":").map(Number);
  const startMin = h * 60 + mm;
  const endMin = startMin + m;

  const eh = String(Math.floor(endMin / 60)).padStart(2, "0");
  const em = String(endMin % 60).padStart(2, "0");

  addEndTime.value = `${eh}:${em}`;
}

// ------------------------------
// ★ 予約編集（既存機能維持）
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
    <input id="edit-menu" value="${r.menu}">

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
        menu: document.getElementById("edit-menu").value,
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
// 休日追加 / 解除（既存）
// ------------------------------
menuAdd.onclick = () => {
  const d = prompt("休日にする日付（例：2025-12-05）");
  if (!d) return;

  const w = ["日","月","火","水","木","金","土"][new Date(d).getDay()];
  if (!confirm(`${d}（${w}）を休業日にしますか？`)) return;

  const pass = localStorage.getItem("candoll_admin_pass");
  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "holiday_add",
      password: pass,
      date: d,
    }),
  }).then(loadAll);
};

menuDel.onclick = () => {
  const d = prompt("解除する休日の日付（例：2025-12-05）");
  if (!d) return;

  const w = ["日","月","火","水","木","金","土"][new Date(d).getDay()];
  if (!confirm(`${d}（${w}）の休日を解除しますか？`)) return;

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
