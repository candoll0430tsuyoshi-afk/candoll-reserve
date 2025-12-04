// ==============================
// Candoll 管理画面 admin.js（3カラム／高さ揃え対応）
// ==============================

const API_URL = "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

const loginBox = document.getElementById("login-box");
const daysWrapper = document.getElementById("days-wrapper");
const loginError = document.getElementById("login-error");

// ▼ プルダウン
const menuLogout = document.getElementById("m-logout");
const menuAdd = document.getElementById("m-add");
const menuDel = document.getElementById("m-del");

// ▼ 日付ナビ
const navPrev = document.getElementById("nav-prev");
const navNext = document.getElementById("nav-next");
const navCurrent = document.getElementById("nav-current");
const dayNavi = document.getElementById("day-navi");

const TIMES = [];
for (let h = 10; h <= 18; h++) {
  TIMES.push(`${String(h).padStart(2, "0")}:00`);
  TIMES.push(`${String(h).padStart(2, "0")}:30`);
}
TIMES.push("19:00");

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
  const reservations = all.data;
  const holidays = all.holidays.map((h) => h.date);

  daysWrapper.innerHTML = "";

  dayNavi.style.display = "block";
  navCurrent.textContent = jp(baseDate);

  [0, 1, 2].forEach((n) => {
    const d = shiftDate(baseDate, n);
    const dStr = ymd(d);

    const col = document.createElement("div");
    col.className = "day-column";

    const title = document.createElement("div");
    title.className = "date-title";
    title.textContent = jp(d);
    title.style.cursor = "pointer";
    title.onclick = () => {
      baseDate = d;
      loadAll();
    };

    col.appendChild(title);

    renderDayBlocks(col, dStr, reservations.filter((r) => r.date === dStr), holidays.includes(dStr));

    daysWrapper.appendChild(col);
  });
}

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
    } else {
      b.style.background = "#d8ffe0";
      b.textContent = `${time}（空き）`;
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

menuAdd.onclick = () => {
  const pass = localStorage.getItem("candoll_admin_pass");
  const d = prompt("追加する休日（YYYY-MM-DD）");
  if (!d) return;
  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "holiday_add", password: pass, date: d, reason: "休業日" }),
  }).then(() => loadAll());
};

menuDel.onclick = () => {
  const pass = localStorage.getItem("candoll_admin_pass");
  const d = prompt("解除する休日（YYYY-MM-DD）");
  if (!d) return;
  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "holiday_delete", password: pass, date: d }),
  }).then(() => loadAll());
};

navPrev.onclick = () => {
  baseDate = shiftDate(baseDate, -1);
  loadAll();
};
navNext.onclick = () => {
  baseDate = shiftDate(baseDate, 1);
  loadAll();
};

menuLogout.onclick = () => {
  localStorage.removeItem("candoll_admin_pass");
  loginBox.style.display = "block";
  daysWrapper.innerHTML = "";
  dayNavi.style.display = "none";
  document.getElementById("admin-pass").value = "";
};
