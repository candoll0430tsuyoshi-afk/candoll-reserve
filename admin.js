// ==============================
// Candoll 管理画面 admin.js（最終安定版）
// ==============================

const API_URL =
  "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

// ---- DOM ----
const loginBox = document.getElementById("login-box");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");

const dayNavi = document.getElementById("day-navi");
const navPrev = document.getElementById("nav-prev");
const navNext = document.getElementById("nav-next");
const navCurrent = document.getElementById("nav-current");

const daysWrapper = document.getElementById("days-wrapper");
const menuBtn = document.getElementById("menu-btn");
const logoutBtn = document.getElementById("m-logout");
const addHolidayBtn = document.getElementById("m-add");
const delHolidayBtn = document.getElementById("m-del");

const popupBg = document.getElementById("popup-bg");
const popupBox = document.getElementById("popup-box");

// ---- state ----
let BASE_DATE = new Date();
let RESERVATIONS = [];
let MENUS = [];
let HOLIDAYS = [];

// ---- 初期表示（ログイン前は完全に隠す）----
dayNavi.style.display = "none";
menuBtn.style.display = "none";

// ==============================
// utils
// ==============================
function weekJP(d) {
  return ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function formatDate(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}（${weekJP(
    d
  )}）`;
}

function toMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function addMin(time, min) {
  const base = new Date(2000, 0, 1, ...time.split(":"));
  const end = new Date(base.getTime() + min * 60000);
  return `${String(end.getHours()).padStart(2, "0")}:${String(
    end.getMinutes()
  ).padStart(2, "0")}`;
}

function isOverlap(aS, aE, bS, bE) {
  return toMin(aS) < toMin(bE) && toMin(bS) < toMin(aE);
}

// ==============================
// API
// ==============================
async function callAPI(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await res.json();
}

// ==============================
// ログイン
// ==============================
loginBtn.onclick = async () => {
  const pass = document.getElementById("admin-pass").value.trim();
  const res = await callAPI({ mode: "list", password: pass });

  if (res.error) {
    loginError.style.display = "block";
    return;
  }

  loginError.style.display = "none";
  localStorage.setItem("adminPass", pass);
  localStorage.setItem("adminLogin", "yes");

  MENUS = res.menus;
  HOLIDAYS = res.holidays;
  RESERVATIONS = res.reservations;

  loginBox.style.display = "none";
  menuBtn.style.display = "block";
  dayNavi.style.display = "flex";

  render3Days();
};

// ==============================
// 再読込してもログイン維持
// ==============================
window.addEventListener("load", async () => {
  if (localStorage.getItem("adminLogin") === "yes") {
    loginBox.style.display = "none";
    menuBtn.style.display = "block";
    dayNavi.style.display = "flex";

    const pass = localStorage.getItem("adminPass");
    const res = await callAPI({ mode: "list", password: pass });
    MENUS = res.menus;
    HOLIDAYS = res.holidays;
    RESERVATIONS = res.reservations;
    render3Days();
  }
});

// ==============================
// ログアウト
// ==============================
logoutBtn.onclick = () => {
  localStorage.removeItem("adminLogin");
  localStorage.removeItem("adminPass");
  location.reload(); // ← ページ更新として扱う
};

// ==============================
// 日付操作
// ==============================
navPrev.onclick = () => {
  BASE_DATE.setDate(BASE_DATE.getDate() - 1);
  render3Days();
};
navNext.onclick = () => {
  BASE_DATE.setDate(BASE_DATE.getDate() + 1);
  render3Days();
};

// ==============================
// メイン描画
// ==============================
function render3Days() {
  daysWrapper.innerHTML = "";
  navCurrent.textContent = formatDate(BASE_DATE);

  for (let i = 0; i < 3; i++) {
    const d = new Date(BASE_DATE);
    d.setDate(d.getDate() + i);
    renderDayColumn(d);
  }
}

function renderDayColumn(dateObj) {
  const dateStr = ymd(dateObj);
  const col = document.createElement("div");
  col.className = "day-column";

  const title = document.createElement("div");
  title.className = "date-title";
  title.textContent = formatDate(dateObj);
  col.appendChild(title);

  const TIMES = [];
  for (let h = 10; h <= 18; h++) {
    TIMES.push(`${String(h).padStart(2, "0")}:00`);
    TIMES.push(`${String(h).padStart(2, "0")}:30`);
  }
  TIMES.push("19:00");

  TIMES.forEach((t) => {
    const slot = document.createElement("div");
    slot.style.padding = "8px";
    slot.style.marginBottom = "4px";
    slot.style.borderRadius = "6px";
    slot.style.cursor = "pointer";

    const hit = RESERVATIONS.find(
      (r) => r.date === dateStr && r.time === t
    );

    if (hit) {
      slot.style.background = "#ffdddd";
      slot.textContent = `${t} ${hit.name}`;
      slot.onclick = () => openEdit(hit);
    } else {
      slot.style.background = "#ddffdd";
      slot.textContent = `${t} 空き`;
      slot.onclick = () => openAdd(dateStr, t);
    }

    col.appendChild(slot);
  });

  daysWrapper.appendChild(col);
}

// ==============================
// 予約追加ポップアップ（空きクリック）
// ==============================
function openAdd(date, time) {
  popupBox.innerHTML = `
    <h3>予約追加</h3>
    <input id="p-name" placeholder="名前">
    <select id="p-menu">
      ${MENUS.map(
        (m) => `<option value="${m.name}">${m.name}</option>`
      ).join("")}
    </select>
    <button id="p-save">保存</button>
    <button id="p-close">閉じる</button>
  `;
  popupBg.style.display = "flex";

  document.getElementById("p-close").onclick = () =>
    (popupBg.style.display = "none");

  document.getElementById("p-save").onclick = async () => {
    const name = document.getElementById("p-name").value.trim();
    const menu = document.getElementById("p-menu").value;
    const duration =
      MENUS.find((m) => m.name === menu)?.duration || 30;
    const end = addMin(time, duration);

    // 重複チェック
    for (const r of RESERVATIONS) {
      if (
        r.date === date &&
        isOverlap(time, end, r.time, r.end_time)
      ) {
        alert("この時間帯は予約があります");
        return;
      }
    }

    await callAPI({
      mode: "add",
      password: localStorage.getItem("adminPass"),
      name,
      menu,
      date,
      time,
      end_time: end,
    });

    popupBg.style.display = "none";
    window.location.reload();
  };
}

// ==============================
// 予約編集/削除
// ==============================
function openEdit(r) {
  popupBox.innerHTML = `
    <h3>予約変更</h3>
    <input id="e-name" value="${r.name}">
    <button id="e-save">変更</button>
    <button id="e-del">削除</button>
    <button id="e-close">閉じる</button>
  `;
  popupBg.style.display = "flex";

  document.getElementById("e-close").onclick = () =>
    (popupBg.style.display = "none");

  document.getElementById("e-del").onclick = async () => {
    await callAPI({
      mode: "delete",
      password: localStorage.getItem("adminPass"),
      id: r.id,
    });
    window.location.reload();
  };

  document.getElementById("e-save").onclick = async () => {
    const name = document.getElementById("e-name").value;

    await callAPI({
      mode: "edit",
      password: localStorage.getItem("adminPass"),
      id: r.id,
      name,
      menu: r.menu,
      date: r.date,
      time: r.time,
    });
    window.location.reload();
  };
}
