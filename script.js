// ===== グローバル（必須）=====
let supabaseClient = null;
let runtime = "web"; 
let customerUserId = null;
let isLiffInitialized = false;
let MENU_DATA = {};
let HOLIDAYS = [];

// ===== LINE LIFF 初期化 =====
const miniappReady = (async () => {
  try {
    await liff.init({ liffId: "2008611644-EZd5nkl0" }); 
    isLiffInitialized = true;
    if (liff.isInClient()) {
      runtime = "miniapp";
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      const profile = await liff.getProfile();
      customerUserId = profile.userId;
    }
  } catch (e) {
    console.error("LIFF初期化エラー:", e);
  }
})();

// ===== 初期化処理 =====
document.addEventListener("DOMContentLoaded", () => {
  // Supabase 初期化
  const supabaseUrl = "https://bcahztzetpfuklipjmxx.supabase.co";
  const supabaseKey = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";
  supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

  // メニュー取得
  loadMenus();

  // 休日取得
  loadHolidays().then(updateDateOptions);

  // メニュー追加ボタン
  const addMenuBtn = document.getElementById("addMenu");
  const menuContainer = document.getElementById("menuContainer");
  if (addMenuBtn && menuContainer) {
    addMenuBtn.onclick = () => {
      const firstSelect = menuContainer.querySelector(".menu-select");
      if (firstSelect) {
        const newSelect = firstSelect.cloneNode(true);
        newSelect.value = "";
        menuContainer.appendChild(newSelect);
        newSelect.addEventListener("change", updateTimeOptions);
      }
    };
  }
});

// ===== メニュー読み込み =====
async function loadMenus() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("menus")
    .select("name, duration");

  if (error) return;

  MENU_DATA = {};
  const menuSelect = document.getElementById("menuSelect");
  menuSelect.innerHTML = '<option value="">メニューを選択してください</option>';

  data.forEach(m => {
    MENU_DATA[m.name] = m.duration; // 所要時間はデータとして保持

    const op = document.createElement("option");
    op.value = m.name;
    op.textContent = m.name; // 「分」は表示しない
    menuSelect.appendChild(op);
  });

  // プルダウンが変更された時の動き
  menuSelect.onchange = () => {
    updateMenuSelectsFromDropdown(menuSelect.value);
    updateTimeOptions(); // 空き時間の再計算
  };
}

// 補助関数：プルダウンの値を裏側のシステムに同期
function updateMenuSelectsFromDropdown(selectedName) {
  const menuContainer = document.getElementById("menuContainer");
  menuContainer.innerHTML = ""; 
  if (!selectedName) return;

  const sel = document.createElement("select");
  sel.className = "menu-select";
  const opt = document.createElement("option");
  opt.value = selectedName;
  opt.selected = true;
  sel.appendChild(opt);
  menuContainer.appendChild(sel);
}

// ===== 休日読み込み =====
async function loadHolidays() {
  try {
    const res = await fetch("https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "publicList" })
    });
    const json = await res.json();
    HOLIDAYS = (json.holidays || []).map(h => h.date);
  } catch (e) { console.error(e); }
}

// ===== 日付・時刻の補助関数 =====
function normalizeDate(value) {
  if (!value) return "";
  return String(value).replace(/\//g, "-").split("T")[0];
}

function calcTotalMinutes(menus) {
  return menus.map(m => MENU_DATA[m] || 0).reduce((a, b) => a + b, 0);
}

function addMinutesToTime(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const start = new Date(2000, 0, 1, h, m);
  const end = new Date(start.getTime() + minutes * 60000);
  return `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
}

function isOverlap(aStart, aEnd, bStart, bEnd) {
  const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  return toMin(aStart) < toMin(bEnd) && toMin(bStart) < toMin(aEnd);
}

// ===== 日付一覧生成（Apple風チップ対応） =====
function updateDateOptions() {
  const dateSelect = document.getElementById("date");
  const chipContainer = document.getElementById("dateChips");
  if (!dateSelect || !chipContainer) return;

  dateSelect.innerHTML = '<option value="">日付を選択</option>';
  chipContainer.innerHTML = ""; 

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
    const dow = week[d.getDay()];

    const op = document.createElement("option");
    op.value = value;
    op.textContent = `${y}/${m}/${day}(${dow})`;
    dateSelect.appendChild(op);

    const chip = document.createElement("div");
    chip.className = "date-chip";
    chip.innerHTML = `<span style="font-size:10px;">${m}月</span><span style="font-size:18px;font-weight:bold;">${day}</span><span style="font-size:10px;">(${dow})</span>`;
    chip.onclick = () => {
      dateSelect.value = value;
      document.querySelectorAll(".date-chip").forEach(c => c.classList.remove("selected"));
      chip.classList.add("selected");
      dateSelect.dispatchEvent(new Event("change"));
    };
    chipContainer.appendChild(chip);
  }
}

// ===== 時刻一覧生成（Apple風タイル対応） =====
async function updateTimeOptions() {
  const date = document.getElementById("date").value;
  const timeSelect = document.getElementById("time");
  const gridContainer = document.getElementById("timeGrid");
  if (!timeSelect || !gridContainer) return;

  gridContainer.innerHTML = ""; 
  if (!date) return;

  const normalizedDate = normalizeDate(date);
  const menus = Array.from(document.querySelectorAll(".menu-select")).map(s => s.value).filter(v => v !== "");
  const required = calcTotalMinutes(menus);
  const closeTime = "19:00";

  const { data } = await supabaseClient.from("reservations").select("time,end_time").eq("date", normalizedDate);
  const reserved = (data || []).map(r => ({ start: r.time.trim(), end: r.end_time.trim() }));

  Array.from(timeSelect.options).forEach(o => {
    if (!o.value) return;
    const start = o.value.trim();
    const end = addMinutesToTime(start, required);
    let isDisabled = (end > closeTime);

    for (const r of reserved) {
      if (isOverlap(start, end, r.start, r.end)) { isDisabled = true; break; }
    }

    o.disabled = isDisabled;
    const slot = document.createElement("div");
    slot.className = "time-slot" + (isDisabled ? " disabled" : "");
    slot.textContent = start;
    slot.onclick = () => {
      if (isDisabled) return;
      timeSelect.value = start;
      document.querySelectorAll(".time-slot").forEach(s => s.classList.remove("selected"));
      slot.classList.add("selected");
    };
    gridContainer.appendChild(slot);
  });
}

// 日付が変わったら時間を更新
document.getElementById("date").addEventListener("change", updateTimeOptions);

// ===== 予約登録処理 =====
const form = document.getElementById("reserveForm");
if (form) {
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const name = document.getElementById("name").value;
    const date = document.getElementById("date").value;
    const time = document.getElementById("time").value;
    const selectedMenus = Array.from(document.querySelectorAll(".menu-select")).filter(s => s.value !== "");

    if (!name || !date || !time || selectedMenus.length === 0) {
      alert("未入力の項目があります");
      return;
    }

    const menus = selectedMenus.map(s => s.value);
    const required = calcTotalMinutes(menus);
    const end_time = addMinutesToTime(time, required);

    const week = ["日", "月", "火", "水", "木", "金", "土"];
    const youbi = week[new Date(date).getDay()];

    document.getElementById("confirm-text").innerHTML = `お名前：${name}<br>メニュー：${menus.join(", ")}<br>日付：${date}(${youbi})<br>時間：${time}`;
    form.style.display = "none";
    document.getElementById("confirm-screen").style.display = "block";
    if(document.getElementById("greeting")) document.getElementById("greeting").style.display = "none";
  });
}

document.getElementById("cancelBtn").onclick = () => {
  document.getElementById("confirm-screen").style.display = "none";
  form.style.display = "block";
  if(document.getElementById("greeting")) document.getElementById("greeting").style.display = "block";
};

document.getElementById("okBtn").onclick = async () => {
  if (runtime === "miniapp") await miniappReady;
  const name = document.getElementById("name").value;
  const menus = Array.from(document.querySelectorAll(".menu-select")).map(s => s.value).filter(v => v !== "");
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;
  const end_time = addMinutesToTime(time, calcTotalMinutes(menus));

  await supabaseClient.from("reservations").insert([{ name, menus: menus.join(", "), date, time, end_time }]);
  
  await fetch("https://bcahztzetpfuklipjmxx.functions.supabase.co/dynamic-service", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, menus: menus.join(", "), date, time, customerUserId })
  });

  showCompleteScreen();
};

function showCompleteScreen() {
  const container = document.querySelector(".container");
  container.innerHTML = `
    <div class="complete-animation" style="padding: 60px 20px;">
      <div class="success-checkmark">
        <div class="check-icon">
          <span class="icon-line line-tip"></span>
          <span class="icon-line line-long"></span>
          <div class="icon-circle"></div>
          <div class="icon-fix"></div>
        </div>
      </div>
      <h2 style="font-size:22px; margin-top:30px;">ご予約を承りました</h2>
      <p style="color:#86868b; margin-bottom:40px;">当日のお越しを心よりお待ちしております。</p>
      <button id="closeBtn" style="padding:15px 40px; font-size:16px; border-radius:12px; background:#000; color:#fff; border:none; cursor:pointer; width:100%;">
        閉じる
      </button>
    </div>
  `;
  
  // アニメーション用のCSS（本来はstyleに追加ですが、ここでも動くようscriptから挿入）
  const style = document.createElement('style');
  style.innerHTML = `
    .success-checkmark { width: 80px; height: 115px; margin: 0 auto; }
    .check-icon { width: 80px; height: 80px; position: relative; border-radius: 50%; box-sizing: content-box; border: 4px solid #4CAF50; }
    .icon-line { height: 5px; background-color: #4CAF50; display: block; border-radius: 2px; position: absolute; z-index: 10; }
    .line-tip { width: 25px; left: 14px; top: 46px; transform: rotate(45deg); }
    .line-long { width: 47px; right: 8px; top: 38px; transform: rotate(-45deg); }
    .icon-circle { width: 80px; height: 80px; border-radius: 50%; position: absolute; left: -4px; top: -4px; z-index: 10; border: 4px solid rgba(76, 175, 80, 0.2); }
  `;
  document.head.appendChild(style);

  document.getElementById("closeBtn").onclick = () => {
    if (window.liff && liff.isInClient()) liff.closeWindow();
    else window.location.href = "https://candoll0430tsuyoshi-afk.github.io/candoll-reserve/";
  };
}
