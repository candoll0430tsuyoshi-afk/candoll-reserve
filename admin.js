// ==============================
// Candoll 管理画面 admin.js 最終完全版
// reservations + holidays 連動
// ==============================

const API_URL = "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

const loginBox = document.getElementById("login-box");
const reserveList = document.getElementById("reserve-list");
const loginError = document.getElementById("login-error");

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
    body: JSON.stringify({ mode: "listAll", password: pass }),
  });

  if (!res.ok) return (loginError.style.display = "block");

  const json = await res.json();
  if (!json.ok) return (loginError.style.display = "block");

  loginError.style.display = "none";
  loginBox.style.display = "none";
  reserveList.style.display = "block";

  localStorage.setItem("candoll_admin_pass", pass);
  loadAll();
};

// 自動ログイン
if (localStorage.getItem("candoll_admin_pass")) {
  loginBox.style.display = "none";
  reserveList.style.display = "block";
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
    body: JSON.stringify({ mode: "listAll", password: pass }),
  });

  if (!res.ok) return null;
  return await res.json();
}

// ------------------------------
// 表示（今日 / 明日 / 明後日）
// ------------------------------
let baseDate = new Date();

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
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

async function loadAll() {
  const all = await fetchAll();
  if (!all) return (reserveList.innerHTML = "読み込みエラー");

  const reservations = all.reservations;
  const holidays = all.holidays.map((h) => h.date);

  reserveList.innerHTML = "";

  [0, 1, 2].forEach((n) => {
    const d = shiftDate(baseDate, n);
    const dStr = ymd(d);

    // タイトル
    const title = document.createElement("div");
    title.className = "date-title";
    title.style.cursor = "pointer";
    title.textContent = jp(d);
    title.onclick = () => {
      baseDate = d;
      loadAll();
    };
    reserveList.appendChild(title);

    renderDayBlocks(dStr, reservations.filter((r) => r.date === dStr), holidays.includes(dStr));
  });

  renderHolidayControl();
}

// ------------------------------
// 1日分の表示
// ------------------------------
function renderDayBlocks(date, list, isHoliday) {
  const wrap = document.createElement("div");

  TIMES.forEach((time) => {
    const b = document.createElement("div");
    b.style.margin = "6px 0";
    b.style.padding = "14px";
    b.style.fontSize = "18px";
    b.style.borderRadius = "8px";

    if (isHoliday) {
      b.style.background = "#ffb3b3";
      b.textContent = `${time} 休業日`;
      wrap.appendChild(b);
      return;
    }

    const r = overlap(list, time);

    if (r) {
      // 予約
      b.style.background = "#ffd4d4";
      b.style.textAlign = "left";
      b.innerHTML = `
        <div style="font-weight:bold;">${r.time}〜${r.end_time}</div>
        <div>${r.name}</div>
        <div>${r.menus}</div>
      `;
    } else {
      b.style.background = "#d8ffe0";
      b.textContent = `${time}（空き）`;
    }

    wrap.appendChild(b);
  });

  reserveList.appendChild(wrap);
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
// 休業日 追加/削除
// ------------------------------
function renderHolidayControl() {
  const pass = localStorage.getItem("candoll_admin_pass");

  const box = document.createElement("div");
  box.style.marginTop = "30px";
  box.style.padding = "20px";
  box.style.borderTop = "2px solid #ccc";

  box.innerHTML = `
        <h3>休業日 管理</h3>

        <div>追加：</div>
        <input type="date" id="holiday_add">
        <button id="holiday_add_btn">追加</button>

        <div style="margin-top:20px;">解除：</div>
        <input type="date" id="holiday_del">
        <button id="holiday_del_btn">解除</button>
    `;
  reserveList.appendChild(box);

  document.getElementById("holiday_add_btn").onclick = async () => {
    const d = document.getElementById("holiday_add").value;
    if (!d) return;
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "holiday_add", password: pass, date: d, reason: "休業日" }),
    });
    loadAll();
  };

  document.getElementById("holiday_del_btn").onclick = async () => {
    const d = document.getElementById("holiday_del").value;
    if (!d) return;
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "holiday_delete", password: pass, date: d }),
    });
    loadAll();
  };
}
