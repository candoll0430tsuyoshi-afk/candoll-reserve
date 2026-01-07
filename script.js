// ===== グローバル設定 =====
let supabaseClient = null;
let runtime = "web"; 
let customerUserId = null;
let MENU_DATA = {};
let HOLIDAYS = [];

// LINE LIFF 初期化
const miniappReady = (async () => {
  try {
    await liff.init({ liffId: "2008611644-EZd5nkl0" }); 
    if (liff.isInClient()) {
      runtime = "miniapp";
      if (!liff.isLoggedIn()) { liff.login(); return; }
      const profile = await liff.getProfile();
      customerUserId = profile.userId;
    }
  } catch (e) { console.error("LIFFエラー:", e); }
})();

// ===== 初期化処理 =====
document.addEventListener("DOMContentLoaded", () => {
  const supabaseUrl = "https://bcahztzetpfuklipjmxx.supabase.co";
  const supabaseKey = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";
  supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

  loadMenus();
  loadHolidays().then(updateDateOptions);

  // メニュー追加ボタンの動作
  document.getElementById("addMenu").onclick = () => {
    const container = document.getElementById("menuContainer");
    const firstWrapper = container.querySelector(".select-wrapper");
    if (firstWrapper) {
      const newWrapper = firstWrapper.cloneNode(true);
      const newSelect = newWrapper.querySelector("select");
      newSelect.value = ""; 
      newSelect.onchange = updateTimeOptions;
      container.appendChild(newWrapper);
    }
  };
});

// ===== メニュー読み込み（カテゴリー分け対応） =====
async function loadMenus() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.from("menus").select("name, duration");
  if (error) return;

  MENU_DATA = {};
  data.forEach(m => { MENU_DATA[m.name] = m.duration; });

  const categories = {
    "組み合わせ": ["＋"],
    "カット": ["カット"],
    "カラー": ["カラー", "ヘナ"],
    "パーマ": ["パーマ"],
    "ストレート": ["ストレート"],
    "トリートメント": ["トリートメント"],
    "メニュー未定": ["相談"]
  };

  const firstSelect = document.querySelector(".menu-select");
  renderMenuOptions(firstSelect, data, categories);
}

function renderMenuOptions(selectElement, data, categories) {
  selectElement.innerHTML = '<option value="">メニューを選択してください</option>';
  Object.keys(categories).forEach(catName => {
    const group = document.createElement("optgroup");
    group.label = catName;
    const filtered = data.filter(m => categories[catName].some(k => m.name.includes(k)));
    if (filtered.length > 0) {
      filtered.forEach(m => {
        const op = document.createElement("option");
        op.value = m.name;
        op.textContent = m.name;
        group.appendChild(op);
      });
      selectElement.appendChild(group);
    }
  });
  selectElement.onchange = updateTimeOptions;
}

// ===== 休日・日付・時刻ロジック =====
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

function updateDateOptions() {
  const dateSelect = document.getElementById("date");
  const chipContainer = document.getElementById("dateChips");
  if (!dateSelect || !chipContainer) return;
  dateSelect.innerHTML = '<option value="">日付を選択</option>';
  chipContainer.innerHTML = ""; 
  const today = new Date();
  today.setHours(0,0,0,0);
  for (let i = 1; i < 90; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const y = d.getFullYear();
    const m = ("0" + (d.getMonth() + 1)).slice(-2);
    const day = ("0" + d.getDate()).slice(-2);
    const value = `${y}-${m}-${day}`;
    if (HOLIDAYS.includes(value) || d.getDay() === 1) continue;
    if (d.getDay() === 2 && (d.getDate() <= 7 || (d.getDate() >= 15 && d.getDate() <= 21))) continue;
    const week = ["日","月","火","水","木","金","土"];
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
      updateTimeOptions();
    };
    chipContainer.appendChild(chip);
  }
}

async function updateTimeOptions() {
  const date = document.getElementById("date").value;
  const timeSelect = document.getElementById("time");
  const gridContainer = document.getElementById("timeGrid");
  if (!timeSelect || !gridContainer) return;
  gridContainer.innerHTML = ""; 
  if (!date) return;
  const menus = Array.from(document.querySelectorAll(".menu-select")).map(s => s.value).filter(v => v !== "");
  const required = menus.map(m => MENU_DATA[m] || 0).reduce((a, b) => a + b, 0);
  const { data } = await supabaseClient.from("reservations").select("time,end_time").eq("date", date);
  const reserved = (data || []).map(r => ({ start: r.time.trim(), end: r.end_time.trim() }));
  Array.from(timeSelect.options).forEach(o => {
    if (!o.value) return;
    const start = o.value.trim();
    const [sh, sm] = start.split(":").map(Number);
    const endD = new Date(2000,0,1,sh,sm + required);
    const end = `${String(endD.getHours()).padStart(2,"0")}:${String(endD.getMinutes()).padStart(2,"0")}`;
    let isDisabled = (end > "19:00");
    for (const r of reserved) {
      const toMin = t => { const [h,m] = t.split(":").map(Number); return h*60+m; };
      if (toMin(start) < toMin(r.end) && toMin(r.start) < toMin(end)) { isDisabled = true; break; }
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

// ===== 予約登録 =====
document.getElementById("reserveForm").onsubmit = async e => {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;
  const menus = Array.from(document.querySelectorAll(".menu-select")).map(s => s.value).filter(v => v !== "");
  if (!name || !date || !time || menus.length === 0) { alert("未入力があります"); return; }
  
  document.getElementById("confirm-text").innerHTML = `お名前：${name}<br>メニュー：${menus.join(", ")}<br>日時：${date} ${time}`;
  document.getElementById("reserveForm").style.display = "none";
  document.getElementById("confirm-screen").style.display = "block";

  document.getElementById("okBtn").onclick = async () => {
    const required = menus.map(m => MENU_DATA[m] || 0).reduce((a, b) => a + b, 0);
    const [sh, sm] = time.split(":").map(Number);
    const endD = new Date(2000,0,1,sh,sm + required);
    const end_time = `${String(endD.getHours()).padStart(2,"0")}:${String(endD.getMinutes()).padStart(2,"0")}`;

    await supabaseClient.from("reservations").insert([{ name, menus: menus.join(", "), date, time, end_time }]);
    await fetch("https://bcahztzetpfuklipjmxx.functions.supabase.co/dynamic-service", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, menus: menus.join(", "), date, time, customerUserId })
    });
    showCompleteScreen();
  };
};

document.getElementById("cancelBtn").onclick = () => {
  document.getElementById("confirm-screen").style.display = "none";
  document.getElementById("reserveForm").style.display = "block";
};

// ===== 完了アニメーション演出 =====
function showCompleteScreen() {
  const container = document.querySelector(".container");
  container.innerHTML = `
    <div style="padding: 60px 20px; text-align: center;">
      <div class="checkmark-wrapper">
        <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
        </svg>
      </div>
      <h2 style="font-size:22px; margin-top:25px; font-weight:600;">予約を承りました</h2>
      <p style="color:#86868b; font-size:15px; line-height:1.6;">当日のお越しをお待ちしております。</p>
      <button id="closeBtn" style="margin-top:40px; padding:16px; width:100%; border-radius:14px; background:#000; color:#fff; border:none; font-size:17px; font-weight:600; cursor:pointer;">閉じる</button>
    </div>
    <style>
      .checkmark-wrapper { display: flex; justify-content: center; }
      .checkmark { width: 80px; height: 80px; border-radius: 50%; stroke-width: 2; stroke: #fff; stroke-miterlimit: 10; box-shadow: inset 0px 0px 0px #4caf50; animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both; }
      .checkmark__circle { stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 2; stroke-miterlimit: 10; stroke: #4caf50; fill: none; animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards; }
      .checkmark__check { transform-origin: 50% 50%; stroke-dasharray: 48; stroke-dashoffset: 48; animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards; }
      @keyframes stroke { 100% { stroke-dashoffset: 0; } }
      @keyframes scale { 0%, 100% { transform: none; } 50% { transform: scale3d(1.1, 1.1, 1); } }
      @keyframes fill { 100% { box-shadow: inset 0px 0px 0px 40px #4caf50; } }
    </style>
  `;
  document.getElementById("closeBtn").onclick = () => {
    if (window.liff && liff.isInClient()) liff.closeWindow();
    else window.location.href = "https://candoll0430tsuyoshi-afk.github.io/candoll-reserve/";
  };
}
