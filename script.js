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

  // ★順序修正：メニューを先に読み込み、終わってから休日・日付を処理する
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

// ★分を「約◯時間◯分」に変換
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
  // ★重要：数値を確実にするため Number() を使用
  const total = menus.map(m => Number(MENU_DATA[m]) || 0).reduce((a, b) => a + b, 0);
  
  let displayElement = document.getElementById("durationDisplay");
  if (!displayElement) {
    displayElement = document.createElement("span");
    displayElement.id = "durationDisplay";
    displayElement.style.marginRight = "10px";
    displayElement.style.fontSize = "14px";
    displayElement.style.color = "#666";
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
  data.forEach(m => { MENU_DATA[m.name] = Number(m.duration); }); // ★数値を保証

  const categories = {
    "組み合わせ": ["＋", "+"],
    "カット": ["カット"],
    "カラー": ["カラー", "ヘナ"],
    "パーマ": ["パーマ"],
    "ストレート": ["ストレート"],
    "トリートメント": ["トリートメント"],
    "メニュー未定": ["相談"]
  };

  const firstSelect = document.querySelector(".menu-select");
  renderMenuOptions(firstSelect, data, categories);
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

function renderMenuOptions(selectElement, data, categories) {
  selectElement.innerHTML = '<option value="">メニューを選択</option>';
  Object.keys(categories).forEach(catName => {
    const group = document.createElement("optgroup");
    group.label = catName;
    const filtered = data.filter(m => {
      const hasPlus = m.name.includes("＋") || m.name.includes("+");
      const hasKeyword = categories[catName].some(k => m.name.includes(k));
      if (catName === "組み合わせ") return hasPlus;
      else return hasKeyword && !hasPlus;
    });
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
    let dayClass = "";
    if (dowNum === 6) dayClass = "sat";
    if (dowNum === 0 || isCustomHoliday) dayClass = "sun";
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

// ===== 時間表示ロジック（★判定強化版） =====
async function updateTimeOptions() {
  const date = document.getElementById("date").value;
  const timeSelect = document.getElementById("time");
  const gridContainer = document.getElementById("timeGrid");
  if (!timeSelect || !gridContainer || !date) return;
  
  gridContainer.innerHTML = ""; 
  timeSelect.innerHTML = '<option value="">選択</option>';

  const menus = Array.from(document.querySelectorAll(".menu-select")).map(s => s.value).filter(v => v !== "");
  const required = menus.map(m => Number(MENU_DATA[m]) || 0).reduce((a, b) => a + b, 0);

  // ★重要：キャッシュを避けるために header を追加
  const { data } = await supabaseClient.from("reservations")
    .select("time,end_time")
    .eq("date", date)
    .setHeader("Cache-Control", "no-cache");

  const reserved = (data || []).map(r => ({ 
    start: (r.time || "").trim(), 
    end: (r.end_time || "").trim() 
  })).filter(r => r.start !== "" && r.end !== "");

  const slots = ["10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00"];

  slots.forEach(start => {
    const toMin = t => { const [h,m] = t.split(":").map(Number); return h*60+m; };
    const startMin = toMin(start);
    const endMin = startMin + required;
    
    let isDisabled = (endMin > 1140); // 19:00以降
    if (OFF_TIMES.some(o => o.date === date && o.time === start)) isDisabled = true;

    // ★重複判定ロジックの厳密化
    for (const r of reserved) {
      const rStart = toMin(r.start);
      const rEnd = toMin(r.end);
      if (startMin < rEnd && rStart < endMin) { isDisabled = true; break; }
    }

    const op = document.createElement("option");
    op.value = start;
    op.textContent = start;
    op.disabled = isDisabled;
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

// ===== 予約送信 =====
document.getElementById("reserveForm").onsubmit = async e => {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const dateValue = document.getElementById("date").value;
  const time = document.getElementById("time").value;
  const menus = Array.from(document.querySelectorAll(".menu-select")).map(s => s.value).filter(v => v !== "");
  if (!name || !dateValue || !time || menus.length === 0) { alert("入力不足です"); return; }
  
  const footer = document.querySelector(".sticky-footer");
  if (footer) footer.style.display = "none";
  const required = menus.map(m => Number(MENU_DATA[m]) || 0).reduce((a, b) => a + b, 0);
  const prettyDuration = formatDurationText(required); 
  const formattedDate = dateValue.replace(/-/g, "/");

  document.querySelector(".greeting").style.display = "none";
  document.getElementById("confirm-text").innerHTML = `<b>お名前</b>：${name}<br><b>メニュー</b>：${menus.join(", ")}<br><b>日時</b>：${formattedDate} ${time}<br><b>${prettyDuration}</b>`;
  document.getElementById("reserveForm").style.display = "none";
  document.getElementById("confirm-screen").style.display = "block";

  document.getElementById("okBtn").onclick = async () => {
    const btn = document.getElementById("okBtn");
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      const [sh, sm] = time.split(":").map(Number);
      const endD = new Date(2000, 0, 1, sh, sm + required);
      const end_time = `${String(endD.getHours()).padStart(2, "0")}:${String(endD.getMinutes()).padStart(2, "0")}`;
      const { error } = await supabaseClient.from("reservations").insert([{ 
        name, menus: menus.join(", "), date: dateValue, time, end_time, customer_user_id: customerUserId 
      }]);
      if (error) throw error;
      await fetch("https://bcahztzetpfuklipjmxx.functions.supabase.co/dynamic-service", {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "reserve", name, menus: menus.join(", "), date: dateValue, time, customerUserId })
      });
      showCompleteScreen();
    } catch (e) { alert("失敗しました"); btn.disabled = false; }
  };
};

// ===== バナー・キャンセル処理（★キャッシュ対策強化） =====
async function checkExistingReservation() {
  if (!customerUserId) return;
  const today = new Date().toISOString().split('T')[0];
  // ★ヘッダー追加で最新情報を取得
  const { data, error } = await supabaseClient.from("reservations")
    .select("id, date, time")
    .eq("customer_user_id", customerUserId)
    .gte("date", today)
    .order("date", { ascending: true })
    .setHeader("Cache-Control", "no-cache"); 

  const oldNotice = document.querySelector(".sticky-reservation-notice-top");
  if (oldNotice) oldNotice.remove();
  document.body.style.paddingTop = "0px";

  if (data && data.length > 0) {
    const res = data[0];
    const formattedDate = res.date.replace(/-/g, "/");
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

window.addEventListener("load", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'cancel') {
    document.getElementById("reserveForm").style.display = "none";
    document.getElementById("cancel-screen").style.display = "block";
    await miniappReady;
    const { data } = await supabaseClient.from("reservations")
      .select("*").eq("customer_user_id", customerUserId).order("date", { ascending: true }).limit(1);

    if (data && data.length > 0) {
      const res = data[0];
      document.getElementById("cancel-info").innerHTML = `${res.date} ${res.time}`;
      document.getElementById("executeCancelBtn").onclick = async () => {
        if (!confirm("キャンセルしますか？")) return;
        const { error } = await supabaseClient.from("reservations").delete().eq("id", res.id);
        if (!error) {
          await checkExistingReservation(); // ★即座にバナー情報を再取得して更新
          alert("キャンセルしました");
          liff.closeWindow();
        }
      };
    }
  }
});

function showCompleteScreen() {
  // 完了画面表示（省略せず保持）
  document.querySelector(".container").innerHTML = `<h2>予約完了</h2><button onclick="liff.closeWindow()">閉じる</button>`;
}
