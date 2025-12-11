// ===== Supabase 初期化 =====
const supabaseUrl = "https://bcahztzetpfuklipjmxx.supabase.co";
const supabaseKey = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ===== 休日データ =====
let HOLIDAYS = [];

// ▼ 修正済 normalizeDate（"/" → "-" 変換）▼
function normalizeDate(value) {
  if (!value) return "";
  value = String(value);
  return value.replace(/\//g, "-").split("T")[0];
}

// ===== メニュー所要時間（Supabaseから取得） =====
let MENU_DATA = {};

async function loadMenus() {
  const { data, error } = await supabaseClient
    .from("menus")
    .select("name, duration");

  if (error) {
    console.error("メニュー取得エラー:", error);
    return;
  }

  MENU_DATA = {};
  data.forEach(m => {
    MENU_DATA[m.name] = m.duration;
  });

  updateTimeOptions();
}

loadMenus();

// ===== 休日読み込み（publicList 版）=====
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

    console.log("Loaded HOLIDAYS:", HOLIDAYS);

  } catch (e) {
    console.error("休日取得エラー:", e);
  }
}

// ★★★ 最重要：初回に日付一覧を生成するための追加 3 行（これだけ変更） ★★★
loadHolidays().then(() => {
  updateDateOptions();     // ← ★ これがないと休業日解除時に復活しない
});
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★


// ===== greeting =====
const greeting = document.getElementById("greeting");

// ===== メニュー追加 =====
const menuContainer = document.getElementById("menuContainer");
const addMenuButton = document.getElementById("addMenu");

function attachMenuUpdate() {
  menuContainer.querySelectorAll(".menu-select").forEach(sel => {
    sel.addEventListener("change", updateTimeOptions);
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

// ===== 所要時間計算 =====
function calcTotalMinutes(menus) {
  return menus.map(m => MENU_DATA[m] || 0).reduce((a, b) => a + b, 0);
}

// ===== 時刻処理 =====
function addMinutesToTime(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const start = new Date(2000, 0, 1, h, m);
  const end = new Date(start.getTime() + minutes * 60000);
  return `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
}

function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isOverlap(aStart, aEnd, bStart, bEnd) {
  return toMinutes(aStart) < toMinutes(bEnd) &&
         toMinutes(bStart) < toMinutes(aEnd);
}

// ===== 重複チェック =====
async function checkDuplicateFull(date, start, end) {
  const { data, error } = await supabaseClient
    .from("reservations")
    .select("time,end_time")
    .eq("date", date);

  if (error) return true;

  for (const r of data) {
    if (isOverlap(start, end, r.time.trim(), r.end_time.trim())) {
      return true;
    }
  }
  return false;
}

// ===== 日付変更イベント =====
document.getElementById("date").addEventListener("change", updateTimeOptions);

// ===== 日付変更 → 休日チェック =====
const dateInput = document.getElementById("date");
dateInput.addEventListener("change", (e) => {
  const normalized = normalizeDate(e.target.value);
  if (HOLIDAYS.includes(normalizeDate(normalized))) {
    alert("この日は休業日のため、ご予約いただけません。");
    e.target.value = "";
    const timeSelect = document.getElementById("time");
    Array.from(timeSelect.options).forEach(o => {
      if (!o.value) return;
      o.disabled = true;
      o.style.color = "#aaa";
    });
  }
});

// ===== 日付一覧生成（休業日は削除）=====
function updateDateOptions() {
  const dateSelect = document.getElementById("date");
  if (!dateSelect) return;

  dateSelect.innerHTML = "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 180; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    const y = d.getFullYear();
    const m = ("0" + (d.getMonth() + 1)).slice(-2);  // ★修正済み
    const day = ("0" + d.getDate()).slice(-2);       // ★修正済み

    const value = `${y}-${m}-${day}`;

    // ★休日はスキップ（正常動作のまま）
    if (HOLIDAYS.includes(value)) continue;

    // ★曜日の追加（label を1回だけ宣言）
    const week = ["日", "月", "火", "水", "木", "金", "土"];
    const youbi = week[d.getDay()];
    const label = `${y}/${m}/${day}(${youbi})`;

    const op = document.createElement("option");
    op.value = value;
    op.textContent = label;
    dateSelect.appendChild(op);
  }
}


// ===== 時刻オプション生成 =====
async function updateTimeOptions(){
  const date = document.getElementById("date").value;

  if (!date) return;

  const normalizedDate = normalizeDate(date);

  if (HOLIDAYS.includes(normalizeDate(normalizedDate))) {
    const timeSelect = document.getElementById("time");
    Array.from(timeSelect.options).forEach(o => {
      if (!o.value) return;
      o.disabled = true;
      o.style.color = "#aaa";
    });
    return;
  }

  if (Object.keys(MENU_DATA).length === 0) return;

  const timeSelect = document.getElementById("time");
  Array.from(timeSelect.options).forEach(o => {
    o.disabled = false;
    o.style.color = "#000";
  });

  const menus = Array.from(menuContainer.querySelectorAll(".menu-select"))
    .map(s => s.value)
    .filter(v => v !== "");

  const required = calcTotalMinutes(menus);
  const closeTime = "19:00";

  const { data } = await supabaseClient
    .from("reservations")
    .select("time,end_time")
    .eq("date", normalizedDate);

  const reserved = (data || []).map(r => ({
    start: r.time.trim(),
    end: r.end_time.trim()
  }));

  Array.from(timeSelect.options).forEach(o => {
    if (!o.value) return;

    const start = o.value.trim();
    const end = addMinutesToTime(start, required);

    if (end > closeTime) {
      o.disabled = true;
      o.style.color = "#aaa";
      return;
    }

    for (const r of reserved) {
      if (isOverlap(start, end, r.start, r.end)) {
        o.disabled = true;
        o.style.color = "#aaa";
        return;
      }
    }
  });
}

// ===== 以下、完全原文（予約登録処理部分） =====
const form = document.getElementById("reserveForm");
const confirmScreen = document.getElementById("confirm-screen");
const confirmText = document.getElementById("confirm-text");
const cancelBtn = document.getElementById("cancelBtn");
const okBtn = document.getElementById("okBtn");

form.addEventListener("submit", async e => {
  e.preventDefault();

  const name = document.getElementById("name").value;
  const menus = Array.from(menuContainer.querySelectorAll(".menu-select"))
    .map(s => s.value)
    .filter(v => v !== "");
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;

  if (!name || !menus.length || !date || !time) {
    alert("未入力があります");
    return;
  }

  const required = calcTotalMinutes(menus);
  const end_time = addMinutesToTime(time, required);

  if (await checkDuplicateFull(date, time, end_time)) {
    alert("この時間帯は予約があります");
    return;
  }

  const week = ["日", "月", "火", "水", "木", "金", "土"];
  const youbi = week[new Date(date).getDay()];

  if (greeting) greeting.style.display = "none";

  confirmText.innerHTML =
    `お名前：${name}<br>
     メニュー：${menus.join(", ")}<br>
     日付：${date}（${youbi}）<br>
     時間：${time}`;

  form.style.display = "none";
  confirmScreen.style.display = "block";
});

cancelBtn.onclick = () => {
  confirmScreen.style.display = "none";
  form.style.display = "block";
  if (greeting) greeting.style.display = "block";
};

okBtn.onclick = async () => {

  const name = document.getElementById("name").value;
  const menus = Array.from(menuContainer.querySelectorAll(".menu-select"))
    .map(s => s.value)
    .filter(v => v !== "");
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;

  const required = calcTotalMinutes(menus);
  const end_time = addMinutesToTime(time, required);

  if (await checkDuplicateFull(date, time, end_time)) {
    alert("この時間はすでに予約が入っています。");
    confirmScreen.style.display = "none";
    form.style.display = "block";
    return;
  }

  const { error } = await supabaseClient
    .from("reservations")
    .insert([{ name, menus: menus.join(", "), date, time, end_time }]);

  if (error) {
    alert("予約保存エラー");
    return;
  }

  try {
    await fetch(
      "https://bcahztzetpfuklipjmxx.functions.supabase.co/dynamic-service",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, menus: menus.join(", "), date, time }),
      }
    );
  } catch (e) {
    console.error("LINE通知エラー:", e);
  }

  confirmScreen.style.display = "none";
  showCompleteScreen();
};

function showCompleteScreen() {
  const old = document.getElementById("complete-screen");
  if (old) old.remove();
  if (greeting) greeting.style.display = "none";

  const div = document.createElement("div");
  div.id = "complete-screen";
  div.style.padding = "20px";
  div.innerHTML = `
    <h2>予約を受付ました。</h2>
    <p>ありがとうございます。</p>
    <button id="closeBtn"
      style="padding:15px 25px;font-size:18px;border-radius:8px;
             background:#000;color:#fff;border:none;">
      閉じる
    </button>
  `;
  document.querySelector(".container").appendChild(div);

  document.getElementById("closeBtn").onclick = () => {
    if (window.liff && typeof liff.closeWindow === "function") {
      try { liff.closeWindow(); return; } catch {}
    }
    history.length > 1
      ? history.back()
      : window.location.href =
        "https://candoll0430tsuyoshi-afk.github.io/candoll-reserve/";
  };
}
