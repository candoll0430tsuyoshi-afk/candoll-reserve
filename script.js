// ===== グローバル（必須）=====
let supabaseClient = null;
let runtime = "web"; 
let customerUserId = null;
let miniappReady = Promise.resolve();

// ===== LINE LIFF 初期化とユーザーID取得 =====
// window.miniapp ではなく window.liff をチェックします
if (true) { // 常に初期化を試みる設定にします
  runtime = "miniapp";

  miniappReady = (async () => {
    try {
      // あなたのLIFF IDを入れてください（LINE Developersコンソールで確認）
      await liff.init({ liffId: "YOUR_LIFF_ID_HERE" }); 

      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile();
        customerUserId = profile.userId;
        console.log("LINEユーザーID取得成功:", customerUserId);
      } else {
        // ログインしていなければログイン画面へ
        liff.login();
      }
    } catch (e) {
      console.warn("LIFF初期化失敗:", e);
    }
  })();
}

let MENU_DATA = {};
let HOLIDAYS = [];
async function loadMenus() {
  if (!supabaseClient) return;

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

// ===== 日付正規化 =====
function normalizeDate(value) {
  if (!value) return "";
  return String(value).replace(/\//g, "-").split("T")[0];
}

document.addEventListener("DOMContentLoaded", () => {
  // ===== Supabase 初期化 =====
  const supabaseUrl = "https://bcahztzetpfuklipjmxx.supabase.co";
  const supabaseKey = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";
  supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);



  // ===== メニュー所要時間（Supabaseから取得） =====
  loadMenus(); // ← ここで呼ぶ（下の関数を使う）
});


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
  } catch (e) {
    console.error("休日取得エラー:", e);
  }
}
loadHolidays().then(updateDateOptions);

// ===== greeting =====
const greeting = document.getElementById("greeting");

// ===== メニュー追加 =====
const menuContainer = document.getElementById("menuContainer");
const addMenuButton = document.getElementById("addMenu");

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
  const normalizedDate = normalizeDate(date);
  const { data, error } = await supabaseClient
    .from("reservations")
    .select("time,end_time")
    .eq("date", normalizedDate);

  if (error) return true;

  for (const r of data) {
    if (isOverlap(start, end, r.time.trim(), r.end_time.trim())) {
      return true;
    }
  }
  return false;
}

// ===== 日付変更イベント =====
document.getElementById("date").addEventListener("change", () => {
  resetTimeSelect();
  updateTimeOptions();
});

// ===== 日付変更 → 休日チェック =====
const dateInput = document.getElementById("date");
dateInput.addEventListener("change", (e) => {
  const normalized = normalizeDate(e.target.value);
  if (HOLIDAYS.includes(normalizeDate(normalized))) {
    alert("この日は休業日のため、ご予約いただけません。");
    e.target.value = "";
    resetTimeSelect();
  }
});

// ===== 日付一覧生成 =====
function updateDateOptions() {
  const dateSelect = document.getElementById("date");
  if (!dateSelect) return;

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
    if (d.getDay() === 2 && d.getDate() <= 7) continue;
    if (d.getDay() === 2 && d.getDate() >= 15 && d.getDate() <= 21) continue;

    const week = ["日", "月", "火", "水", "木", "金", "土"];
    const op = document.createElement("option");
    op.value = value;
    op.textContent = `${y}/${m}/${day}(${week[d.getDay()]})`;
    dateSelect.appendChild(op);
  }
  dateSelect.value = "";
}

// ===== 時刻オプション生成 =====
async function updateTimeOptions() {
  const date = document.getElementById("date").value;
  if (!date) return;

  const normalizedDate = normalizeDate(date);
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
console.log("DB予約 raw:", data);
  const reserved = (data || []).map(r => ({
    start: r.time.trim(),
    end: r.end_time.trim()
  }));
  
console.log("DB予約 整形後:", reserved);
  
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

// ===== 予約登録処理 =====
const form = document.getElementById("reserveForm");
const confirmScreen = document.getElementById("confirm-screen");
const confirmText = document.getElementById("confirm-text");
const cancelBtn = document.getElementById("cancelBtn");
const okBtn = document.getElementById("okBtn");

form.addEventListener("submit", async e => {
  e.preventDefault();

  const errorBox = document.getElementById("errorBox");
  errorBox.style.display = "none";
  errorBox.innerHTML = "";

  const nameInput = document.getElementById("name");
  const dateSelect = document.getElementById("date");
  const timeSelect = document.getElementById("time");
  const menuSelects = document.querySelectorAll(".menu-select");

  [nameInput, dateSelect, timeSelect, ...menuSelects].forEach(el => {
    if (el) el.classList.remove("input-error");
  });

  const errors = [];

  if (!nameInput.value.trim()) {
    errors.push("お名前を入力してください。");
    nameInput.classList.add("input-error");
  }

  const selectedMenus = Array.from(menuSelects).filter(s => s.value !== "");
  if (selectedMenus.length === 0) {
    errors.push("メニューを選択してください。");
    menuSelects[0].classList.add("input-error");
  }

  if (!dateSelect.value) {
    errors.push("日付を選択してください。");
    dateSelect.classList.add("input-error");
  }

  if (!timeSelect.value) {
    errors.push("時間を選択してください。");
    timeSelect.classList.add("input-error");
  }

  if (errors.length > 0) {
    errorBox.innerHTML = errors.map(e => `・${e}`).join("<br>");
    errorBox.style.display = "block";
    return;
  }

  // ===== 以下は元の既存処理（alert行は残るが到達しない） =====
  const name = nameInput.value;
  const menus = Array.from(menuContainer.querySelectorAll(".menu-select"))
    .map(s => s.value)
    .filter(v => v !== "");
  const date = dateSelect.value;
  const time = timeSelect.value;

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
    if (runtime === "miniapp") {
    await miniappReady;
  }
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


// ★ここは必ず通す（条件分岐しない）
console.log("dynamic-service 呼び出し直前");

await fetch(
  "https://bcahztzetpfuklipjmxx.functions.supabase.co/dynamic-service",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      menus: menus.join(", "),
      date,
      time,
      customerUserId // nullでもOK
    })
  }
);

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
      style="padding:15px 25px; font-size:18px; border-radius:8px;
             background:#000; color:#fff; border:none;">
      閉じる
    </button>
  `;
  document.querySelector(".container").appendChild(div);

  document.getElementById("closeBtn").onclick = () => {
  if (runtime === "miniapp" && window.miniapp) {
    try {
      miniapp.closeWindow();
      return;
    } catch (e) {}
  }

    history.length > 1
      ? history.back()
      : window.location.href =
        "https://candoll0430tsuyoshi-afk.github.io/candoll-reserve/";
  };
}
// ===== 追加：入力し直したら errorBox を自動で消す =====
function clearErrorOnInput() {
  const errorBox = document.getElementById("errorBox");
  if (!errorBox) return;

  errorBox.style.display = "none";
  errorBox.innerHTML = "";
  this.classList.remove("input-error");
}

// 名前
const nameInput = document.getElementById("name");
if (nameInput) {
  nameInput.addEventListener("input", clearErrorOnInput);
}

// 日付
const dateSelectForClear = document.getElementById("date");
if (dateSelectForClear) {
  dateSelectForClear.addEventListener("change", clearErrorOnInput);
}

// 時間
const timeSelectForClear = document.getElementById("time");
if (timeSelectForClear) {
  timeSelectForClear.addEventListener("change", clearErrorOnInput);
}

// メニュー（複数あるので forEach）
document.querySelectorAll(".menu-select").forEach(sel => {
  sel.addEventListener("change", clearErrorOnInput);
});
