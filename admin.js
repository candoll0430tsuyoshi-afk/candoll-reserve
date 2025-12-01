// ===============================
// admin.js（現行コードベース + 追加機能版）
// ===============================

// 管理API
const API_URL =
  "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

// DOM
const loginBox = document.getElementById("login-box");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const passInput = document.getElementById("admin-pass");

const dateNav = document.getElementById("date-nav");
const currentDayLabel = document.getElementById("currentDay");
const prevBtn = document.getElementById("prevDay");
const nextBtn = document.getElementById("nextDay");
const daysContainer = document.getElementById("days-container");

// 日付基準
let baseDate = new Date();

// 所要時間データ（現行コードそのまま）
const MENU_DATA = {
    "カット": 49,
    "カット（大学生・専門学生）": 49,
    "カット（中学生以下）": 49,
    "前髪カット": 19,
    "カラー": 70,
    "リタッチカラー": 70,
    "ダブルカラー": 119,
    "アクセントカラー": 119,
    "ヘナ": 70,
    "モイストパーマ": 70,
    "ポイントパーマ": 70,
    "ストレートパーマ": 150,
    "ポイントストレートパーマ": 120,
    "トリートメント": 29,
    "来店時に相談（２時間枠）": 119,
    "来店時に相談（３時間枠）": 179,
    "来店時に相談（4時間枠）": 239,
    "カット＋カラー": 119,
    "カット＋リタッチカラー": 119,
    "カット＋パーマ": 134,
    "カット＋ストレート": 209
};

// 時間帯（表示固定）
const TIME_LIST = [
  "10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30",
  "14:00","14:30","15:00","15:30",
  "16:00","16:30","17:00","17:30",
  "18:00"
];

//-------------------------------------
// 日付 → YYYY-MM-DD
//-------------------------------------
function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

//-------------------------------------
// 日付 → 2025/01/30（木）
//-------------------------------------
function formatJp(date) {
  const w = ["日","月","火","水","木","金","土"];
  return `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}（${w[date.getDay()]}）`;
}

//-------------------------------------
// Supabaseから予約取得
//-------------------------------------
async function fetchReservations(pass) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "list", password: pass })
  });

  if (!res.ok) return null;
  const json = await res.json();
  return json.ok ? json.data : null;
}

//-------------------------------------
// ログイン処理（現行コードのまま）
//-------------------------------------
loginBtn.addEventListener("click", async () => {
  const pass = passInput.value.trim();
  if (!pass) return;

  const ok = await fetchReservations(pass);
  if (!ok) {
    loginError.style.display = "block";
    return;
  }

  loginError.style.display = "none";
  localStorage.setItem("candoll_admin_pass", pass);

  loginBox.style.display = "none";
  dateNav.style.display = "block";

  renderAllDays();
});

//-------------------------------------
// 自動ログイン（現行コードのまま）
//-------------------------------------
const savedPass = localStorage.getItem("candoll_admin_pass");
if (savedPass) {
  loginBox.style.display = "none";
  dateNav.style.display = "block";
  renderAllDays();
}

//-------------------------------------
// 3日分の表示
//-------------------------------------
async function renderAllDays() {
  const pass = localStorage.getItem("candoll_admin_pass");
  const all = await fetchReservations(pass);
  if (!all) return;

  daysContainer.innerHTML = "";

  const before = new Date(baseDate);
  before.setDate(baseDate.getDate() - 1);

  const after = new Date(baseDate);
  after.setDate(baseDate.getDate() + 1);

  const three = [
    { date: before },
    { date: baseDate },
    { date: after }
  ];

  currentDayLabel.textContent = formatJp(baseDate);

  three.forEach(info => {
    const ymd = toYMD(info.date);
    const dayData = all.filter(r => r.date === ymd);

    const box = document.createElement("div");
    box.style.marginBottom = "30px";

    box.innerHTML = `
      <div class="date-title">${formatJp(info.date)}</div>
      <div id="list-${ymd}"></div>
    `;

    daysContainer.appendChild(box);
    renderOneDay(ymd, dayData, document.getElementById(`list-${ymd}`));
  });
}

//-------------------------------------
// 1日の時間割表示（予約あり/空き）
//-------------------------------------
function renderOneDay(dateYmd, reservations, container) {
  container.innerHTML = "";

  TIME_LIST.forEach(time => {
    const found = reservations.find(r => r.time === time);

    const div = document.createElement("div");
    div.className = "reserve-item";

    if (found) {
      div.style.background = "#ffeaea";
      div.innerHTML = `
        <div class="time">${time}〜${found.end_time}</div>
        <div class="menu">${found.menus}</div>
        <div class="name">👤 ${found.name}</div>
      `;
    } else {
      div.style.background = "#e8ffe8";
      div.innerHTML = `
        <div class="time">${time}（空き）</div>
      `;
    }

    container.appendChild(div);
  });
}

//-------------------------------------
// 日付移動
//-------------------------------------
prevBtn.addEventListener("click", () => {
  baseDate.setDate(baseDate.getDate() - 1);
  renderAllDays();
});

nextBtn.addEventListener("click", () => {
  baseDate.setDate(baseDate.getDate() + 1);
  renderAllDays();
});
