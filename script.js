「// ===== グローバル設定 ===
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
      if (!liff.isLoggedIn()) { 
        liff.login(); 
        return; 
      }
      const profile = await liff.getProfile();
      customerUserId = profile.userId;
      if (window.updateSupabaseHeader) window.updateSupabaseHeader(customerUserId);
    }
  } catch (e) { 
    console.error("LIFFエラー:", e); 
  }
})();

// ===== 初期化処理 =====
document.addEventListener("DOMContentLoaded", () => {
  const supabaseUrl = "https://bcahztzetpfuklipjmxx.supabase.co";
  const supabaseKey = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";

  window.updateSupabaseHeader = (userId) => {
    supabaseClient = supabase.createClient(supabaseUrl, supabaseKey, {
      global: { headers: { 'x-customer-id': userId } }
    });
    loadMenus();
    loadHolidays().then(updateDateOptions);
    checkExistingReservation(); 
  };
  
  // ★ブラウザでも動くように初期化
  supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
  loadMenus();
  loadHolidays().then(updateDateOptions);
  
  miniappReady.then(() => {
    if (customerUserId) {
      checkExistingReservation();
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
      updateTotalDurationDisplay();
    }
  };
});

// ★分を「約◯時間◯分」に変換（15分単位切り上げ）
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

// ★目安時間の表示更新
function updateTotalDurationDisplay() {
  const menus = Array.from(document.querySelectorAll(".menu-select")).map(s => s.value).filter(v => v !== "");
  const total = menus.map(m => MENU_DATA[m] || 0).reduce((a, b) => a + b, 0);
  const dateChips = document.querySelectorAll(".date-chip:not(.holiday)");
  if (total > 0) {
    dateChips.forEach(chip => chip.classList.remove("menu-not-selected"));
  } else {
    dateChips.forEach(chip => chip.classList.add("menu-not-selected"));
  }
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

// ===== メニュー読み込み =====
async function loadMenus() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.from("menus").select("name, duration");
  if (error) {
    console.error("メニュー読み込みエラー:", error);
    return;
  }

  MENU_DATA = {};
  data.forEach(m => { MENU_DATA[m.name] = m.duration; });

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

      if (catName === "組み合わせ") {
        return hasPlus;
      } else {
        return hasKeyword && !hasPlus;
      }
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

// ===== 休日・日付ロジック =====
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
    const d = new Date(today.getTime());
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

    if (!isHoliday) chip.classList.add("menu-not-selected");
    
    chip.innerHTML = `
      <span class="month-label">${parseInt(m)}月</span>
      <span class="date-number">${parseInt(day)}</span>
      <span class="dow-label">(${dow})</span>
      ${isHoliday ? '<span class="status-text">定休日</span>' : ''}
    `;

    if (!isHoliday) {
      chip.onclick = () => {
        const selectedMenus = Array.from(document.querySelectorAll(".menu-select"))
                                   .map(s => s.value)
                                   .filter(v => v !== "");

        if (selectedMenus.length === 0) {
          alert("先にメニューを選択してください。");
          return;
        }

        dateSelect.value = value;
        document.querySelectorAll(".date-chip").forEach(c => c.classList.remove("selected"));
        chip.classList.add("selected");
        updateTimeOptions();
      };
    }
    chipContainer.appendChild(chip);
  }
}

// ===== 時間表示ロジック =====
async function updateTimeOptions() {
  const date = document.getElementById("date").value;
  const timeSelect = document.getElementById("time");
  const gridContainer = document.getElementById("timeGrid");
  if (!timeSelect || !gridContainer) return;
  
  gridContainer.innerHTML = ""; 
  timeSelect.innerHTML = '<option value="">選択</option>';
  if (!date) return;

  const menus = Array.from(document.querySelectorAll(".menu-select")).map(s => s.value).filter(v => v !== "");
  const required = menus.map(m => MENU_DATA[m] || 0).reduce((a, b) => a + b, 0);

  const { data } = await supabaseClient.from("reservations").select("time,end_time").eq("date", date);
  const reserved = (data || []).map(r => ({ 
    start: (r.time || "").trim(), 
    end: (r.end_time || "").trim() 
  })).filter(r => r.start !== "" && r.end !== "");

  const slots = ["10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00"];

  slots.forEach(start => {
    const [sh, sm] = start.split(":").map(Number);
    const endD = new Date(2000,0,1,sh,sm + required);
    const end = `${String(endD.getHours()).padStart(2,"0")}:${String(endD.getMinutes()).padStart(2,"0")}`;
    
    let isDisabled = (end > "19:00");
    const isOffTime = OFF_TIMES.some(o => o.date === date && o.time === start);
    if (isOffTime) isDisabled = true;

    for (const r of reserved) {
      const toMin = t => { const [h,m] = t.split(":").map(Number); return h*60+m; };
      if (toMin(start) < toMin(r.end) && toMin(r.start) < toMin(end)) { isDisabled = true; break; }
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

  if (!name || !dateValue || !time || menus.length === 0) {
    alert("お名前、メニュー、日時をすべて選択してください。");
    return;
  }
  
  const footer = document.querySelector(".sticky-footer");
  if (footer) footer.style.display = "none";

  const required = menus.map(m => MENU_DATA[m] || 0).reduce((a, b) => a + b, 0);
  const prettyDuration = formatDurationText(required); 
  
  const week = ["日", "月", "火", "水", "木", "金", "土"];
  const d = new Date(dateValue.replace(/-/g, "/"));
  const dow = week[d.getDay()];
  const formattedDate = dateValue.replace(/-/g, "/");

  document.querySelector(".greeting").style.display = "none";
  document.getElementById("confirm-text").innerHTML = `<b>お名前</b>：${name}<br><b>メニュー</b>：${menus.join(", ")}<br><b>日時</b>：${formattedDate} (${dow}) ${time}<br><b>${prettyDuration}</b>`;
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

      const messageText = `【ご予約内容】\n名前：${name} 様\n日時：${formattedDate} (${dow}) ${time}\n${prettyDuration}\nメニュー：${menus.join(", ")}\n\nご予約のキャンセルはこちらから\nhttps://liff.line.me/2008611644-EZd5nkl0?action=cancel`;

      const { error } = await supabaseClient.from("reservations").insert([{ 
        name, 
        menus: menus.join(", "), 
        date: dateValue, 
        time, 
        end_time,
        customer_user_id: customerUserId 
      }]);

if (error) throw error;

      // 通知の送信が終わるまで待機 (await)
      try {
        await fetch("https://bcahztzetpfuklipjmxx.functions.supabase.co/dynamic-service", {
          method: "POST", 
          headers: { 
            "Content-Type": "application/json",
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjYWh6dHpldHBmdWtsaXBqbXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0NTQ3ODUsImV4cCI6MjA1MTAzMDc4NX0.DGPTLz5FDHZm9C9ljZdFuXnJaXYGz8mWU_vFBHm9aGI",
            "x-customer-id": customerUserId || "web-user"
          },
          body: JSON.stringify({ 
            mode: "reserve",
            name: name, 
            menus: menus.join(", "),
            date: dateValue, 
            time: time, 
            customerUserId: customerUserId || "web-user",
            customMessage: messageText 
          })
        });
        console.log("通知送信完了");
      } catch (e) {
        console.error("通知送信エラー:", e);
      }

      // すべて終わってから完了画面を表示
      showCompleteScreen();

    } catch (e) {
      console.error("予約エラー:", e);
      alert("予約に失敗しました。");
      btn.disabled = false;
      btn.innerText = "OK";
    }
  };
};

document.getElementById("cancelBtn").onclick = () => {
  const footer = document.querySelector(".sticky-footer");
  if (footer) footer.style.display = "block";

  document.querySelector(".greeting").style.display = "block";
  document.getElementById("confirm-screen").style.display = "none";
  document.getElementById("reserveForm").style.display = "block";
};

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
      <p style="color:#86868b; font-size:15px; line-height:1.6;">ご来店お待ちしております。</p>
      <button id="closeBtn" style="margin-top:40px; padding:16px; width:100%; border-radius:14px; background:#000; color:#fff; border:none; font-size:17px; font-weight:600; cursor:pointer;">閉じる</button>
    </div>
    <style>
      .checkmark-wrapper { display: flex; justify-content: center; }
      .checkmark { width: 80px; height: 80px; border-radius: 50%; stroke-width: 2; stroke: #fff; animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both; }
      .checkmark__circle { stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 2; stroke: #4caf50; fill: none; animation: stroke 0.6s forwards; }
      .checkmark__check { transform-origin: 50% 50%; stroke-dasharray: 48; stroke-dashoffset: 48; animation: stroke 0.3s forwards 0.8s; }
      @keyframes stroke { 100% { stroke-dashoffset: 0; } }
      @keyframes scale { 0%, 100% { transform: none; } 50% { transform: scale3d(1.1, 1.1, 1); } }
      @keyframes fill { 100% { box-shadow: inset 0px 0px 0px 40px #4caf50; } }
    </style>
  `;
  document.getElementById("closeBtn").onclick = () => {
    if (window.liff && liff.isInClient()) liff.closeWindow();
    else window.location.href = "https://candoll.vercel.app/";
  };
}

async function checkExistingReservation() {
  if (!customerUserId) return;

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabaseClient
    .from("reservations")
    .select("id, date, time")
    .eq("customer_user_id", customerUserId)
    .gte("date", today)
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(1);

  if (data && data.length > 0) {
    const res = data[0];
    const dateObj = new Date(res.date.replace(/-/g, "/"));
    const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][dateObj.getDay()];
    const formattedDate = res.date.replace(/-/g, "/");

    const oldNotice = document.querySelector(".sticky-reservation-notice-top");
    if (oldNotice) oldNotice.remove();

    const notice = document.createElement("div");
    notice.className = "sticky-reservation-notice-top";
    notice.innerHTML = `
      <div class="notice-content">
        <span class="notice-title">次回の予約情報</span>
        <span class="notice-datetime">${formattedDate}(${dayOfWeek}) ${res.time}</span>
      </div>
      <button onclick="goToCancelLink()" class="notice-cancel-btn-red">キャンセル</button>
    `;
    
    document.body.appendChild(notice);
    document.body.style.paddingTop = "60px";
  }
}

function goToCancelLink() {
  const cancelUrl = "https://liff.line.me/2008611644-EZd5nkl0?action=cancel";
  window.location.href = cancelUrl;
}

// ===== キャンセル処理 =====
window.addEventListener("load", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjYWh6dHpldHBmdWtsaXBqbXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0NTQ3ODUsImV4cCI6MjA1MTAzMDc4NX0.DGPTLz5FDHZm9C9ljZdFuXnJaXYGz8mWU_vFBHm9aGI";

  if (urlParams.get('action') === 'cancel') {
    document.getElementById("reserveForm").style.display = "none";
    if(document.querySelector(".greeting")) document.querySelector(".greeting").style.display = "none";
    document.getElementById("cancel-screen").style.display = "block";

    await miniappReady; 
    if (!customerUserId) return;

    const { data } = await supabaseClient.from("reservations")
      .select("*")
      .eq("customer_user_id", customerUserId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const res = data[0];
      const dCancel = new Date(res.date.replace(/-/g, "/"));
      const dowCancel = ["日", "月", "火", "水", "木", "金", "土"][dCancel.getDay()];
      document.getElementById("cancel-info").innerHTML = `<b>お名前</b>：${res.name}<br><b>日時</b>：${res.date.replace(/-/g, "/")} (${dowCancel}) ${res.time}`;     

      document.getElementById("executeCancelBtn").onclick = async () => {
        if (!confirm("本当にキャンセルしてもよろしいですか?")) return;

        const btn = document.getElementById("executeCancelBtn");
        btn.disabled = true;
        btn.innerText = "キャンセル処理中...";

        const { error } = await supabaseClient.from("reservations").delete().eq("id", res.id).eq("customer_user_id", customerUserId);
        
        if (!error) {
          const topNotice = document.querySelector(".sticky-reservation-notice-top");
          if (topNotice) {
            topNotice.remove();
            document.body.style.paddingTop = "0px";
          }

          // 通知送信（必ず実行）
          try {
            const dForCancelMsg = new Date(res.date.replace(/-/g, "/"));
            const dowForCancelMsg = ["日", "月", "火", "水", "木", "金", "土"][dForCancelMsg.getDay()];
            const cancelMessage = `【予約キャンセル】\n${res.name} 様の予約がキャンセルされました。\n日時：${res.date.replace(/-/g, "/")} (${dowForCancelMsg}) ${res.time}`;

            const response = await fetch("https://bcahztzetpfuklipjmxx.functions.supabase.co/dynamic-service", {
              method: "POST", 
              headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`,
                "x-customer-id": customerUserId || "web-user"
              },
              body: JSON.stringify({ 
                mode: "cancel", 
                name: res.name, 
                menus: res.menus, 
                date: res.date, 
                time: res.time, 
                customerUserId: customerUserId || "web-user", 
                customMessage: cancelMessage 
              })
            });
            
            console.log("キャンセル通知送信ステータス:", response.status);
            const responseData = await response.json();
            console.log("キャンセル通知送信成功:", responseData);
          } catch (e) {
            console.error("通知エラー:", e);
          }

          const container = document.querySelector(".container");
          container.innerHTML = `
            <div style="padding: 60px 20px; text-align: center;">
              <div class="checkmark-wrapper">
                <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                  <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" style="stroke: #ff3b30;"/>
                  <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" style="stroke: #fff;"/>
                </svg>
              </div>
              <h2 style="font-size:22px; margin-top:25px; font-weight:600;">キャンセルを完了しました</h2>
              <p style="color:#86868b; font-size:15px; line-height:1.6;">またのご利用をお待ちしております。</p>
              <button id="finalCloseBtn" style="margin-top:40px; padding:16px; width:100%; border-radius:14px; background:#000; color:#fff; border:none; font-size:17px; font-weight:600; cursor:pointer;">閉じる</button>
            </div>
            <style>
              .checkmark-wrapper { display: flex; justify-content: center; }
              .checkmark { width: 80px; height: 80px; border-radius: 50%; stroke-width: 2; stroke: #fff; animation: fill-red .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both; }
              .checkmark__circle { stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 2; stroke: #ff3b30; fill: none; animation: stroke 0.6s forwards; }
              .checkmark__check { transform-origin: 50% 50%; stroke-dasharray: 48; stroke-dashoffset: 48; animation: stroke 0.3s forwards 0.8s; }
              @keyframes stroke { 100% { stroke-dashoffset: 0; } }
              @keyframes scale { 0%, 100% { transform: none; } 50% { transform: scale3d(1.1, 1.1, 1); } }
              @keyframes fill-red { 100% { box-shadow: inset 0px 0px 0px 40px #ff3b30; } }
            </style>
          `;

          document.getElementById("finalCloseBtn").onclick = () => {
            window.location.href = "https://candoll.vercel.app/?rev=" + Date.now();
          };

        } else {
          alert("キャンセルに失敗しました。");
          btn.disabled = false;
          btn.innerText = "予約をキャンセルする";
        }
      };
    } else {
      document.getElementById("cancel-info").innerText = "有効な予約が見つかりませんでした。";
      document.getElementById("executeCancelBtn").style.display = "none";
    }
  }
});
