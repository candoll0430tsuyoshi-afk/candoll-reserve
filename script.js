// ===== Supabase 初期化 =====
const supabaseUrl = "https://bcahztzetpfuklipjmxx.supabase.co";
const supabaseKey = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ===== customerUserId を保持（追加）=====
let customerUserId = null;

// ===== 追加：LIFF 初期化 + LINE Login（これだけ）=====
async function initLiffAndLogin() {
  if (!window.liff) return;

  try {
    await liff.init({
      liffId: "2008611644-EZd5nkl0"
    });

    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: location.href });
      return;
    }

    const profile = await liff.getProfile();
    customerUserId = profile.userId;
    console.log("LINE profile:", profile);

  } catch (e) {
    console.error("LIFF error:", e);
  }
}

// ★ 既存処理には触らず、読み込み時に1回だけ実行
document.addEventListener("DOMContentLoaded", () => {
  initLiffAndLogin();
});

// ===== 以下、元の script.js（変更なし）=====

// ===== 休日データ =====
let HOLIDAYS = [];

function normalizeDate(value) {
  if (!value) return "";
  value = String(value);
  return value.replace(/\//g, "-").split("T")[0];
}

// ===== メニュー所要時間 =====
let MENU_DATA = {};

async function loadMenus() {
  const { data, error } = await supabaseClient
    .from("menus")
    .select("name, duration");

  if (error) return;

  MENU_DATA = {};
  data.forEach(m => {
    MENU_DATA[m.name] = m.duration;
  });

  updateTimeOptions();
}
loadMenus();

// ===== 休日読み込み =====
async function loadHolidays() {
  try {
    const res = await fetch(
      "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "publicList" })
      }
    );
    const json = await res.json();
    HOLIDAYS = (json.holidays || []).map(h => h.date);
  } catch {}
}
loadHolidays().then(updateDateOptions);

// ===== DOM =====
const greeting = document.getElementById("greeting");
const menuContainer = document.getElementById("menuContainer");
const addMenuButton = document.getElementById("addMenu");
const form = document.getElementById("reserveForm");
const confirmScreen = document.getElementById("confirm-screen");
const confirmText = document.getElementById("confirm-text");
const cancelBtn = document.getElementById("cancelBtn");
const okBtn = document.getElementById("okBtn");

// ===== メニュー操作 =====
function attachMenuUpdate() {
  menuContainer.querySelectorAll(".menu-select").forEach(sel => {
    sel.addEventListener("change", () => {
      resetTimeSelect();
      updateTimeOptions();
    });
  });
}
attachMenuUpdate();

addMenuButton.addEventListener("click", () => {
  const selects = menuContainer.querySelectorAll(".menu-select");
  if (selects.length < 4) {
    const newSelect = selects[0].cloneNode(true);
    newSelect.value = "";
    menuContainer.appendChild(newSelect);
    attachMenuUpdate();
  }
});

// ===== 時間計算（元のまま）=====
function calcTotalMinutes(menus) {
  return menus.map(m => MENU_DATA[m] || 0).reduce((a, b) => a + b, 0);
}

function addMinutesToTime(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m + minutes);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isOverlap(aStart, aEnd, bStart, bEnd) {
  return toMinutes(aStart) < toMinutes(bEnd) &&
         toMinutes(bStart) < toMinutes(aEnd);
}

// ===== 時間リセット =====
function resetTimeSelect() {
  const timeSelect = document.getElementById("time");
  if (!timeSelect) return;
  timeSelect.value = "";
  Array.from(timeSelect.options).forEach(o => {
    if (!o.value) return;
    o.disabled = true;
    o.style.color = "#aaa";
  });
}

// ===== 重複チェック =====
async function checkDuplicateFull(date, start, end) {
  const { data } = await supabaseClient
    .from("reservations")
    .select("time,end_time")
    .eq("date", normalizeDate(date));

  for (const r of data || []) {
    if (isOverlap(start, end, r.time.trim(), r.end_time.trim())) {
      return true;
    }
  }
  return false;
}

// ===== 日付変更 =====
document.getElementById("date").addEventListener("change", () => {
  resetTimeSelect();
  updateTimeOptions();
});

// ===== 日付生成 =====
function updateDateOptions() {
  const dateSelect = document.getElementById("date");
  dateSelect.innerHTML = '<option value="">日付を選択</option>';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i < 90; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const y = d.getFullYear();
    const m = ("0" + (d.getMonth() + 1)).slice(-2);
    const day = ("0" + d.getDate()).slice(-2);
    const value = `${y}-${m}-${day}`;

    if (HOLIDAYS.includes(value)) continue;
    if (d.getDay() === 1) continue;

    const week = ["日", "月", "火", "水", "木", "金", "土"];
    const op = document.createElement("option");
    op.value = value;
    op.textContent = `${y}/${m}/${day}(${week[d.getDay()]})`;
    dateSelect.appendChild(op);
  }
}

// ===== 時刻生成 =====
async function updateTimeOptions() {
  const date = document.getElementById("date").value;
  if (!date) return;

  const menus = Array.from(menuContainer.querySelectorAll(".menu-select"))
    .map(s => s.value)
    .filter(Boolean);

  const required = calcTotalMinutes(menus);
  const closeTime = "19:00";

  const { data } = await supabaseClient
    .from("reservations")
    .select("time,end_time")
    .eq("date", normalizeDate(date));

  const reserved = (data || []).map(r => ({
    start: r.time.trim(),
    end: r.end_time.trim()
  }));

  const timeSelect = document.getElementById("time");
  Array.from(timeSelect.options).forEach(o => {
    if (!o.value) return;
    const start = o.value;
    const end = addMinutesToTime(start, required);
    if (end > closeTime || reserved.some(r => isOverlap(start, end, r.start, r.end))) {
      o.disabled = true;
      o.style.color = "#aaa";
    }
  });
}

// ===== 予約送信 =====
okBtn.onclick = async () => {
  const name = document.getElementById("name").value;
  const menus = Array.from(menuContainer.querySelectorAll(".menu-select"))
    .map(s => s.value)
    .filter(Boolean);
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;

  const end_time = addMinutesToTime(time, calcTotalMinutes(menus));
  if (await checkDuplicateFull(date, time, end_time)) {
    alert("この時間はすでに予約があります");
    return;
  }

  const { error } = await supabaseClient
    .from("reservations")
    .insert([{ name, menus: menus.join(", "), date, time, end_time }]);

  if (error) {
    alert("予約保存エラー");
    return;
  }

  await fetch(
    "https://bcahztzetpfuklipjmxx.functions.supabase.co/dynamic-service",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        menus: menus.join(", "),
        date,
        time,
        customerUserId
      })
    }
  );

  confirmScreen.style.display = "none";
  showCompleteScreen();
};
