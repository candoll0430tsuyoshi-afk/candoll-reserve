// ===== グローバル設定 =====
let supabaseClient = null;
let runtime = "web"; 
let customerUserId = null;
let MENU_DATA = {};
let HOLIDAYS = [];
let OFF_TIMES = [];
let SPECIAL_OPENS = [];

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

  loadMenus().then(() => {
    loadHolidays().then(() => {
      updateDateOptions();
    });
  });

  miniappReady.then(async () => {
    if (customerUserId) {
      await checkExistingReservation();
    }
  });
  
  document.getElementById("addMenu").onclick = () => {
    const container = document.getElementById("menuContainer");
    const firstWrapper = container.querySelector(".select-wrapper");
    if (firstWrapper) {
      const newWrapper = firstWrapper.cloneNode(true);
      const newSelect = newWrapper.querySelector("select");
      newSelect.value = ""; 
      newSelect.classList.remove("selected-color");
      newSelect.classList.add("placeholder-color");
      setupSelectColorChange(newSelect);
      container.appendChild(newWrapper);
    }
  };
});

function formatDurationText(totalMin) {
  if (totalMin === 0) return "";
  const roundedMin = Math.ceil(totalMin / 15) * 15; 
  const h = Math.floor(roundedMin / 60);
  const m = roundedMin % 60;
  let text = "施術時間：約";
  if (h > 0) text += `${h}時間`;
  if (m > 0) text += `${m}分`;
  return text;
}

function updateTotalDurationDisplay() {
  const menus = Array.from(document.querySelectorAll(".menu-select")).map(s => s.value).filter(v => v !== "");
  const total = menus.map(m => Number(MENU_DATA[m]) || 0).reduce((a, b) => a + b, 0);
  let displayElement = document.getElementById("durationDisplay");
  if (!displayElement) {
    displayElement = document.createElement("span");
    displayElement.id = "durationDisplay";
    const addBtn = document.getElementById("addMenu");
    if (addBtn) addBtn.parentNode.insertBefore(displayElement, addBtn);
  }
  if (total > 0) {
    displayElement.innerHTML = `<b>${formatDurationText(total)}</b>`;
    displayElement.style.display = "inline";
  } else {
    displayElement.style.display = "none";
  }
}

async function loadMenus() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.from("menus").select("name, duration");
  if (error) return;
  MENU_DATA = {};
  data.forEach(m => { MENU_DATA[m.name] = Number(m.duration); });
  const firstSelect = document.querySelector(".menu-select");
  setupSelectColorChange(firstSelect);
}

function setupSelectColorChange(selectElement) {
  selectElement.addEventListener("change", () => {
    if (selectElement.value === "") {
      selectElement.classList.add("placeholder-color");
      selectElement.classList.remove("selected-color");
    } else {
      selectElement.classList.remove("placeholder-color");
      selectElement.classList.add("selected-color");
    }
    updateTotalDurationDisplay(); 
    updateTimeOptions();
  });
}

async function loadHolidays() {
  const [resHolidays, resOff, resSpec] = await Promise.all([
    supabaseClient.from("holidays").select("date"),
    supabaseClient.from("off_times").select("date, time"),
    supabaseClient.from("special_open").select("date")
  ]);
  HOLIDAYS = resHolidays.data ? resHolidays.data.map(h => h.date) : [];
  OFF_TIMES = resOff.data || [];
  SPECIAL_OPENS = resSpec.data || [];
}

function updateDateOptions() {
  const dateSelect = document.getElementById("date");
  const chipContainer = document.getElementById("dateChips");
  if (!dateSelect || !chipContainer) return;
  dateSelect.innerHTML = '<option value="">日付を選択</option>';
  chipContainer.innerHTML = "";
  const today = new Date();
  today.setHours(0,0,0,0);

  for (let i = 1; i < 31; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const y = d.getFullYear();
    const m = ("0" + (d.getMonth() + 1)).slice(-2);
    const day = ("0" + d.getDate()).slice(-2);
    const value = `${y}-${m}-${day}`;
    const week = ["日","月","火","水","木","金","土"];
    const dowNum = d.getDay();
    const dow = week[dowNum];
    const isFixedHoliday = (dowNum === 1 || (dowNum === 2 && (d.getDate() <= 7 || (d.getDate() >= 15 && d.getDate() <= 21))));
    const isCustomHoliday = HOLIDAYS.includes(value);
    const isSpecialOpen = SPECIAL_OPENS.some(s => s.date === value);
    let isHoliday = (isFixedHoliday || isCustomHoliday) && !isSpecialOpen;
    let dayClass = (dowNum === 6) ? "sat" : (dowNum === 0 || isCustomHoliday) ? "sun" : "";
    if (isHoliday) dayClass += " holiday";

    if (!isHoliday) {
      const op = document.createElement("option");
      op.value = value;
      op.textContent = `${y}/${m}/${day}(${dow})`;
      dateSelect.appendChild(op);
    }
    const chip = document.createElement("div");
    chip.className = `date-chip ${dayClass}`;
    chip.innerHTML = `<span class="month-label">${parseInt(m)}月</span><span class="date-number">${parseInt(day)}</span><span class="dow-label">(${dow})</span>${isHoliday ? '<span class="status-text">定休日</span>' : ''}`;
    if (!isHoliday) {
      chip.onclick = () => {
        dateSelect.value = value;
        document.querySelectorAll(".date-chip").forEach(c => c.classList.remove("selected"));
        chip.classList.add("selected");
        updateTimeOptions();
      };
    }
    chipContainer.appendChild(chip);
  }
}

async function updateTimeOptions() {
  const date = document.getElementById("date").value;
  const timeSelect = document.getElementById("time");
  const gridContainer = document.getElementById("timeGrid");
  if (!timeSelect || !gridContainer || !date) return;
  gridContainer.innerHTML = ""; 
  timeSelect.innerHTML = '<option value="">選択</option>';

  const menus = Array.from(document.querySelectorAll(".menu-select")).map(s => s.value).filter(v => v !== "");
  const required = menus.map(m => Number(MENU_DATA[m]) || 0).reduce((a, b) => a + b, 0);

  const { data } = await supabaseClient.from("reservations").select("time,end_time").eq("date", date).setHeader("Cache-Control", "no-cache");
  const reserved = (data || []).map(r => ({ start: (r.time || "").trim(), end: (r.end_time || "").trim() })).filter(r => r.start !== "" && r.end !== "");
  const slots = ["10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00"];

  slots.forEach(start => {
    const toMin = t => { const [h,m] = t.split(":").map(Number); return h*60+m; };
    const startMin = toMin(start);
    const endMin = startMin + required;
    let isDisabled = (endMin > 1140);
    if (OFF_TIMES.some(o => o.date === date && o.time === start)) isDisabled = true;
    for (const r of reserved) {
      if (startMin < toMin(r.end) && toMin(r.start) < endMin) { isDisabled = true; break; }
    }
    const op = document.createElement("option");
    op.value = start; op.textContent = start; op.disabled = isDisabled;
    timeSelect.appendChild(op);
    const slot = document.createElement("div");
    slot.className = "time-slot" + (isDisabled ? " disabled" : "");
    slot.textContent = start;
    if (!isDisabled) {
      slot.onclick = () => {
        timeSelect.value = start;
        document.querySelectorAll(".time-slot").forEach(s => s.classList.remove("selected"));
        slot.classList.add("selected");
      };
    }
    gridContainer.appendChild(slot);
  });
}

// ===== 予約送信（確認画面とアニメーション復活） =====
document.getElementById("reserveForm").onsubmit = async e => {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const dateValue = document.getElementById("date").value;
  const time = document.getElementById("time").value;
  const menus = Array.from(document.querySelectorAll(".menu-select")).map(s => s.value).filter(v => v !== "");
  if (!name || !dateValue || !time || menus.length === 0) { alert("すべて選択してください"); return; }
  
  const footer = document.querySelector(".sticky-footer");
  if (footer) footer.style.display = "none";
  const required = menus.map(m => Number(MENU_DATA[m]) || 0).reduce((a, b) => a + b, 0);
  const prettyDuration = formatDurationText(required); 
  const week = ["日", "月", "火", "水", "木", "金", "土"];
  const d = new Date(dateValue.replace(/-/g, "/"));
  const formattedDate = `${dateValue.replace(/-/g, "/")} (${week[d.getDay()]})`;

  document.querySelector(".greeting").style.display = "none";
  document.getElementById("confirm-text").innerHTML = `<b>お名前</b>：${name}<br><b>メニュー</b>：${menus.join(", ")}<br><b>日時</b>：${formattedDate} ${time}<br><b>${prettyDuration}</b>`;
  document.getElementById("reserveForm").style.display = "none";
  document.getElementById("confirm-screen").style.display = "block";

  document.getElementById("okBtn").onclick = async () => {
    const btn = document.getElementById("okBtn");
    if (btn.disabled) return;
    btn.disabled = true;
    btn.innerText = "送信中...";
    try {
      const [sh, sm] = time.split(":").map(Number);
      const endD = new Date(2000, 0, 1, sh, sm + required);
      const end_time = `${String(endD.getHours()).padStart(2, "0")}:${String(endD.getMinutes()).padStart(2, "0")}`;
      const { error } = await supabaseClient.from("reservations").insert([{ 
        name, menus: menus.join(", "), date: dateValue, time, end_time, customer_user_id: customerUserId 
      }]);
      if (error) throw error;
      await fetch("https://bcahztzetpfuklipjmxx.functions.supabase.co/dynamic-service", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "reserve", name, menus: menus.join(", "), date: dateValue, time, customerUserId })
      });
      showCompleteScreen();
    } catch (e) { alert("失敗しました"); btn.disabled = false; btn.innerText = "OK"; }
  };
};

document.getElementById("cancelBtn").onclick = () => {
  const footer = document.querySelector(".sticky-footer");
  if (footer) footer.style.display = "block";
  document.querySelector(".greeting").style.display = "block";
  document.getElementById("confirm-screen").style.display = "none";
  document.getElementById("reserveForm").style.display = "block";
};

// ===== バナー表示（曜日追加） =====
async function checkExistingReservation() {
  if (!customerUserId) return;
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabaseClient.from("reservations").select("id, date, time").eq("customer_user_id", customerUserId).gte("date", today).order("date", { ascending: true }).setHeader("Cache-Control", "no-cache"); 
  const oldNotice = document.querySelector(".sticky-reservation-notice-top");
  if (oldNotice) oldNotice.remove();
  document.body.style.paddingTop = "0px";
  if (data && data.length > 0) {
    const res = data[0];
    const d = new Date(res.date.replace(/-/g, "/"));
    const week = ["日", "月", "火", "水", "木", "金", "土"];
    const formattedDate = `${res.date.replace(/-/g, "/")} (${week[d.getDay()]})`;
    const notice = document.createElement("div");
    notice.className = "sticky-reservation-notice-top";
    notice.innerHTML = `<div class="notice-content"><span class="notice-title">次回の予約情報</span><span class="notice-datetime">${formattedDate} ${res.time}</span></div><button onclick="goToCancelLink()" class="notice-cancel-btn-red">キャンセル</button>`;
    document.body.appendChild(notice);
    document.body.style.paddingTop = "60px";
  }
}

function goToCancelLink() {
  window.location.href = "https://liff.line.me/2008611644-EZd5nkl0?action=cancel";
}

// ===== キャンセル処理（挨拶非表示・曜日追加） =====
window.addEventListener("load", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'cancel') {
    document.getElementById("reserveForm").style.display = "none";
    document.querySelector(".greeting").style.display = "none";
    document.getElementById("cancel-screen").style.display = "block";
    await miniappReady;
    const { data } = await supabaseClient.from("reservations").select("*").eq("customer_user_id", customerUserId).order("date", { ascending: true }).limit(1);
    if (data && data.length > 0) {
      const res = data[0];
      const d = new Date(res.date.replace(/-/g, "/"));
      const week = ["日", "月", "火", "水", "木", "金", "土"];
      const formattedDate = `${res.date.replace(/-/g, "/")} (${week[d.getDay()]})`;
      document.getElementById("cancel-info").innerHTML = `<b>お名前</b>：${res.name}<br><b>日時</b>：${formattedDate} ${res.time}`;
      document.getElementById("executeCancelBtn").onclick = async () => {
        if (!confirm("本当にキャンセルしてもよろしいですか？")) return;
        const { error } = await supabaseClient.from("reservations").delete().eq("id", res.id);
        if (!error) {
          const topNotice = document.querySelector(".sticky-reservation-notice-top");
          if (topNotice) { topNotice.remove(); document.body.style.paddingTop = "0px"; }
          alert("キャンセルしました");
          liff.closeWindow();
        }
      };
    }
  }
});

function showCompleteScreen() {
  const container = document.querySelector(".container");
  container.innerHTML = `<div style="padding: 60px 20px; text-align: center;"><div class="checkmark-wrapper"><svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52"><circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/><path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/></svg></div><h2 style="font-size:22px; margin-top:25px; font-weight:600;">予約を承りました</h2><p style="color:#86868b; font-size:15px; line-height:1.6;">ご来店お待ちしております。</p><button id="closeBtn" style="margin-top:40px; padding:16px; width:100%; border-radius:14px; background:#000; color:#fff; border:none; font-size:17px; font-weight:600;">閉じる</button></div><style>.checkmark-wrapper{display:flex;justify-content:center}.checkmark{width:80px;height:80px;border-radius:50%;stroke-width:2;stroke:#fff;animation:fill .4s ease-in-out .4s forwards,scale .3s ease-in-out .9s both}.checkmark__circle{stroke-dasharray:166;stroke-dashoffset:166;stroke-width:2;stroke:#4caf50;fill:none;animation:stroke .6s forwards}.checkmark__check{transform-origin:50% 50%;stroke-dasharray:48;stroke-dashoffset:48;animation:stroke .3s forwards .8s}@keyframes stroke{100%{stroke-dashoffset:0}}@keyframes scale{0%,100%{transform:none}50%{transform:scale3d(1.1,1.1,1)}}@keyframes fill{100%{box-shadow:inset 0px 0px 0px 40px #4caf50}}</style>`;
  document.getElementById("closeBtn").onclick = () => liff.closeWindow();
}
