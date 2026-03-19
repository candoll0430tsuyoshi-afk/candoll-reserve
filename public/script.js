// ===== グローバル設定 ===
let supabaseClient = null;
let runtime = "web"; 
let customerUserId = null;
let MENU_DATA = {};
let HOLIDAYS = [];
let OFF_TIMES = [];
let SPECIAL_OPENS = [];

// ===== 段階的入力の状態管理 =====
const stepState = {
    name: false,
    menu: false,
    date: false,
    time: false
};

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
document.addEventListener("DOMContentLoaded", async () => {
  const supabaseUrl = "https://bcahztzetpfuklipjmxx.supabase.co";
  const supabaseKey = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";

  // LINEログイン(miniappReady)が終わるまで待機
  await miniappReady;

  // 1. クライアント作成はここで「1回だけ」行う
  // customerUserId があればそれを、なければ PC用ID(web-user) を使用
  supabaseClient = supabase.createClient(supabaseUrl, supabaseKey, {
    global: { 
      headers: { 'x-customer-id': customerUserId || "web-user" } 
    }
  });

  // 2. データを読み込む
  try {
    await Promise.all([
      loadMenus(),
      loadHolidays().then(updateDateOptions)
    ]);
    
    // 3. LINEユーザーのみバナーを表示
    if (customerUserId && customerUserId !== "web-user") {
      checkExistingReservation();
    }
  } catch (err) {
    console.error("データ取得エラー:", err);
  }

  // ===== 段階的入力UIの初期化 =====
  initializeStepwiseUI();
  
  // ★ updateDateOptionsを拡張して、日付チップ再生成時にリスナーを再設定
  const originalUpdateDateOptions = window.updateDateOptions;
  window.updateDateOptions = function() {
    if (originalUpdateDateOptions) originalUpdateDateOptions();
    // 日付が再生成されたら、メニューが選択済みならリスナーを再設定
    if (stepState.menu) {
      setTimeout(() => {
        attachDateChipListeners();
      }, 100);
    }
  };
  
  // 名前入力欄を光らせる（初回のみ、5秒間）
  const nameInput = document.getElementById('name');
  if (nameInput) {
    nameInput.style.animation = 'glow 7s ease-in-out';
    setTimeout(() => nameInput.style.animation = '', 7000);
    
    // 名前入力欄をラッパーで囲む
    if (!nameInput.parentElement.classList.contains('hint-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'hint-wrapper';
      nameInput.parentNode.insertBefore(wrapper, nameInput);
      wrapper.appendChild(nameInput);
    }
    
    // ★ 吹き出しヒントを右上に表示（5秒で消える）- 重複削除
    const existingHint = document.getElementById('name-hint');
    if (existingHint) existingHint.remove();
    
    const hint = document.createElement('div');
    hint.id = 'name-hint';
    hint.className = 'hint-bubble hint-bubble-top-right';
    hint.innerHTML = 'お名前をフルネームで入力';
    nameInput.parentElement.appendChild(hint);
    setTimeout(() => hint.remove(), 7000);
  }

  // モーダル閉じる（共通）
  document.querySelectorAll(".close-btn").forEach(btn => {
    btn.onclick = () => {
      document.getElementById("reservationModal").style.display = "none";
      document.getElementById("cancelModal").style.display = "none";
    };
  });
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

// --- メニュー追加ボタンの処理 ---
const addMenu = document.getElementById("addMenu");
if (addMenu) {
  addMenu.onclick = () => {
    const container = document.getElementById("menuContainer");
    if (!container) return; // エラー防止の安全策

    const currentSelects = container.querySelectorAll(".menu-select");
    
    // 1. 最大3つまでの制限
    if (currentSelects.length >= 3) {
      alert("メニューは最大3つまで選択可能です。");
      return;
    }

    // 2. 既存の1つ目をコピーして初期化
    const newSelect = currentSelects[0].cloneNode(true);
    newSelect.value = "";
    newSelect.classList.remove("selected-color");
    newSelect.classList.add("placeholder-color");

    // 3. 行間（余白）を10pxで完全に統一
    const applyUniformStyle = (el) => {
      el.style.marginTop = "0px";
      el.style.marginBottom = "10px"; // 1.2.3個目すべて同じ余白
      el.style.display = "block";    // 縦に並ぶよう明示
      el.style.width = "100%";       // 横幅を揃える
    };

    // 既存のものも含めてすべてに適用（これでガタつきが消えます）
    currentSelects.forEach(applyUniformStyle);
    applyUniformStyle(newSelect);

    // 4. イベントリスナーを設定
    // script.js内の既存関数を呼び出し、合計時間の更新を有効にします
    setupSelectColorChange(newSelect);

    // コンテナに追加
    container.appendChild(newSelect);

    // 5. 追加した瞬間に表示を最新の状態にする
    updateTotalDurationDisplay();
    if (typeof updateTimeOptions === 'function') {
      updateTimeOptions();
    }
  };
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

    // 時間を数値（分）に変換する関数
    const toMin = t => {
      if (!t) return 0;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    const slotStart = toMin(start);
    const slotEnd = toMin(end);

    // 1. 管理画面の「予約不可(OFF_TIMES)」との重なりをチェック
    const isOffTimeOverlap = OFF_TIMES.some(o => {
      if (o.date !== date) return false;
      const offStart = toMin(o.time);
      const offEnd = offStart + 30; // 30分枠として扱う
      return (slotStart < offEnd && offStart < slotEnd);
    });
    if (isOffTimeOverlap) isDisabled = true;

    // 2. 既存の予約(reserved)との重なりをチェック
    if (!isDisabled) {
      for (const r of reserved) {
        const resStart = toMin(r.start);
        const resEnd = toMin(r.end);
        if (slotStart < resEnd && resStart < slotEnd) {
          isDisabled = true;
          break;
        }
      }
    }

    // ドロップダウンへの追加
    const op = document.createElement("option");
    op.value = start;
    op.textContent = start;
    op.disabled = isDisabled;
    timeSelect.appendChild(op);

    // グリッドボタンの作成
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
  }); // slots.forEach の閉じ
} // updateTimeOptions の閉じ
// 最新の予約状況（全日休み・個別休み・重複予約）をすべて確認する関数
async function checkFinalAvailability(date, time) {
  try {
    // 1. 全日休みの確認
    const { data: holiday } = await supabaseClient
      .from("holidays")
      .select("id")
      .eq("date", date)
      .maybeSingle();
    
    if (holiday) {
      console.log("Check: Holiday found");
      return false;
    }

    // 2. 個別休みの確認 (判定条件を修正)
    const { data: offTime } = await supabaseClient
      .from("off_times")
      .select("id")
      .eq("date", date)
      .eq("time", time)
      .maybeSingle();
    
    if (offTime) { // maybeSingleの場合、データがあればオブジェクト(true相当)が入る
      console.log("Check: Off-time found");
      return false;
    }

    // 3. 他の予約との重複確認
    const { data: reservation } = await supabaseClient
      .from("reservations")
      .select("id")
      .eq("date", date)
      .eq("time", time)
      .maybeSingle();
    
    if (reservation) {
      console.log("Check: Existing reservation found");
      return false;
    }

    return true; // すべて問題なければOK
  } catch (err) {
    console.error("Check Error:", err);
    return false; // エラー時は安全のため予約不可とする
  }
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
  
  // --- 【追加】確認画面に進む前の空き状況ダブルチェック ---
  const isAvailable = await checkFinalAvailability(dateValue, time);
  if (!isAvailable) {
    alert("申し訳ございません。別の日時を選択してください。");
    location.reload();
    return;
  }
  // --------------------------------------------------

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

  // OKボタンを押した時の処理
  document.getElementById("okBtn").onclick = async () => {
    const btn = document.getElementById("okBtn");
    if (btn.disabled) return;
    btn.disabled = true;
    btn.innerText = "送信中...";

    try {
      // --- 【追加】送信直前の最終トリプルチェック ---
      const finalCheck = await checkFinalAvailability(dateValue, time);
      if (!finalCheck) {
        alert("申し訳ございません。タッチの差で予約が埋まってしまいました。");
        location.reload();
        return;
      }
      // --------------------------------------------

      // 2. 終了時間の計算
      const [sh, sm] = time.split(":").map(Number);
      const endD = new Date(2000, 0, 1, sh, sm + required);
      const end_time = `${String(endD.getHours()).padStart(2, "0")}:${String(endD.getMinutes()).padStart(2, "0")}`;

      // 3. 予約データを保存
      const { data, error } = await supabaseClient.from("reservations").insert([{ 
        name, 
        menus: menus.join(", "), 
        date: dateValue, 
        time, 
        end_time,
        customer_user_id: customerUserId,
        remind: true
      }]).select();

      if (error) throw error;
      
      // 予約IDを保存（完了画面でremind更新に使う）
      if (data && data[0]) window._lastReservationId = data[0].id;

      // 4. LINE通知を飛ばす
      const messageText = `【ご予約内容】\n名前：${name} 様\n日時：${formattedDate} (${dow}) ${time}\n${prettyDuration}\nメニュー：${menus.join(", ")}\n\nご予約のキャンセルはこちらから\nhttps://liff.line.me/2008611644-EZd5nkl0?action=cancel`;

      try {
        await fetch("https://bcahztzetpfuklipjmxx.functions.supabase.co/dynamic-service", {
          method: "POST", 
          headers: { 
            "Content-Type": "application/json",
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
      } catch (e) {
        console.error("通知送信エラー:", e);
      }

      // 5. 完了画面へ
      showCompleteScreen();

    } catch (e) {
      console.error("予約エラー:", e);
      alert("通信エラーが発生しました。");
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
  const reservationId = window._lastReservationId;
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
      ${customerUserId ? `
      <div style="margin: 20px auto; max-width: 280px; background:#f5f5f7; border-radius:14px; padding:16px; text-align:left;">
        <label style="display:flex; align-items:center; gap:12px; cursor:pointer; font-size:15px; color:#333;">
          <input type="checkbox" id="remindCheck" checked style="width:20px; height:20px; accent-color:#000; cursor:pointer; flex-shrink:0;">
          「予約日のお知らせ」を前日にLINEで受け取る
        </label>
      </div>` : ''}
      <button id="closeBtn" style="margin-top:20px; padding:16px; width:100%; border-radius:14px; background:#000; color:#fff; border:none; font-size:17px; font-weight:600; cursor:pointer;">閉じる</button>
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

  // チェックボックスの変更をDBに保存（LINEユーザーのみ）
  if (customerUserId) {
    document.getElementById("remindCheck")?.addEventListener("change", async (e) => {
      if (!reservationId) return;
      await supabaseClient
        .from("reservations")
        .update({ remind: e.target.checked })
        .eq("id", reservationId);
    });
  }

  document.getElementById("closeBtn").onclick = async () => {
    // 閉じる前にチェック状態を保存
    const remindVal = document.getElementById("remindCheck")?.checked ?? true;
    if (reservationId) {
      await supabaseClient
        .from("reservations")
        .update({ remind: remindVal })
        .eq("id", reservationId);
    }
    if (window.liff && liff.isInClient()) liff.closeWindow();
    else window.location.href = "https://candoll.vercel.app/";
  };
}

async function checkExistingReservation() {
  // ★重要：LINEのユーザーIDがない（PCブラウザなど）場合は、バナーを出さずに終了する
  if (!customerUserId || customerUserId === "web-user" || customerUserId === "anonymous") {
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabaseClient
    .from("reservations")
    .select("id, date, time")
    .eq("customer_user_id", customerUserId) // 自分のLINE IDだけで検索
    .gte("date", today)
    .order("date", { ascending: true })
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
      <div style="display:flex; gap:6px;">
        <button onclick="goToChangeLink()" style="background:#007aff; color:#fff; border:none; border-radius:8px; padding:6px 10px; font-size:12px; font-weight:bold; cursor:pointer;">変更</button>
        <button onclick="goToCancelLink()" class="notice-cancel-btn-red">キャンセル</button>
      </div>
    `;
    
    document.body.appendChild(notice);
    document.body.style.paddingTop = "60px";
  }
}

function goToCancelLink() {
  const cancelUrl = "https://liff.line.me/2008611644-EZd5nkl0?action=cancel";
  window.location.href = cancelUrl;
}

function goToChangeLink() {
  const changeUrl = "https://liff.line.me/2008611644-EZd5nkl0?action=change";
  window.location.href = changeUrl;
}

// ===== 予約変更画面 =====
function showChangeScreen(res) {
  const container = document.querySelector(".container");
  const dow = ["日", "月", "火", "水", "木", "金", "土"][new Date(res.date.replace(/-/g, "/")).getDay()];
  
  container.innerHTML = `
    <div style="padding: 30px 20px;">
      <h2 style="font-size:20px; font-weight:600; margin-bottom:6px;">予約を変更する</h2>
      <p style="color:#86868b; font-size:14px; margin-bottom:20px;">現在の予約：${res.date.replace(/-/g, "/")}(${dow}) ${res.time}</p>

      <div style="margin-bottom:20px;">
        <label style="font-size:14px; font-weight:bold; color:#666; display:block; margin-bottom:8px;">メニュー</label>
        <select id="change-menu" style="width:100%; padding:12px; font-size:16px; border:1px solid #ddd; border-radius:10px; background:#fff; box-sizing:border-box;">
          ${Object.keys(MENU_DATA).map(m => `<option value="${m}" ${res.menus === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
      </div>

      <div style="margin-bottom:20px;">
        <label style="font-size:14px; font-weight:bold; color:#666; display:block; margin-bottom:8px;">日付</label>
        <div id="change-date-chips" style="display:flex; gap:8px; overflow-x:auto; padding-bottom:8px;"></div>
        <input type="hidden" id="change-date" value="${res.date}">
      </div>

      <div style="margin-bottom:30px;">
        <label style="font-size:14px; font-weight:bold; color:#666; display:block; margin-bottom:8px;">時間</label>
        <div id="change-time-grid" style="display:grid; grid-template-columns: repeat(4,1fr); gap:8px;"></div>
        <input type="hidden" id="change-time" value="${res.time}">
      </div>

      <button id="change-confirm-btn" style="width:100%; padding:16px; border-radius:14px; background:#000; color:#fff; border:none; font-size:17px; font-weight:600; cursor:pointer; margin-bottom:12px;">変更内容を確認する</button>
      <button onclick="window.location.href='https://liff.line.me/2008611644-EZd5nkl0?action=cancel'" style="width:100%; padding:14px; border-radius:14px; background:none; color:#86868b; border:1px solid #ddd; font-size:15px; cursor:pointer;">戻る</button>
    </div>
  `;

  // 日付チップ生成
  const chipContainer = document.getElementById("change-date-chips");
  const today = new Date();
  today.setHours(0,0,0,0);
  for (let i = 1; i < 31; i++) {
    const d = new Date(today.getTime());
    d.setDate(today.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    const value = `${y}-${m}-${day}`;
    const dowNum = d.getDay();
    const dowLabel = ["日","月","火","水","木","金","土"][dowNum];
    const isHoliday = (HOLIDAYS.includes(value) || dowNum === 1 || (dowNum === 2 && (d.getDate() <= 7 || (d.getDate() >= 15 && d.getDate() <= 21)))) && !SPECIAL_OPENS.some(s => s.date === value);
    if (isHoliday) return;

    const chip = document.createElement("div");
    chip.style.cssText = `flex-shrink:0; width:56px; text-align:center; padding:8px 4px; border-radius:10px; border:2px solid ${value === res.date ? '#000' : '#ddd'}; background:${value === res.date ? '#000' : '#fff'}; color:${value === res.date ? '#fff' : '#333'}; cursor:pointer; font-size:13px;`;
    chip.innerHTML = `<div>${parseInt(m)}/${parseInt(day)}</div><div>(${dowLabel})</div>`;
    chip.onclick = () => {
      document.getElementById("change-date").value = value;
      document.querySelectorAll("#change-date-chips > div").forEach(c => {
        c.style.border = "2px solid #ddd";
        c.style.background = "#fff";
        c.style.color = "#333";
      });
      chip.style.border = "2px solid #000";
      chip.style.background = "#000";
      chip.style.color = "#fff";
      renderChangeTimeGrid(value, res);
    };
    chipContainer.appendChild(chip);
  }

  renderChangeTimeGrid(res.date, res);

  document.getElementById("change-confirm-btn").onclick = () => {
    const newDate = document.getElementById("change-date").value;
    const newTime = document.getElementById("change-time").value;
    const newMenu = document.getElementById("change-menu").value;
    if (!newTime) { alert("時間を選択してください"); return; }
    showChangeConfirm(res, newDate, newTime, newMenu);
  };
}

async function renderChangeTimeGrid(date, res) {
  const grid = document.getElementById("change-time-grid");
  if (!grid) return;
  grid.innerHTML = "<div style='color:#999; font-size:14px;'>読み込み中...</div>";

  const menu = document.getElementById("change-menu").value;
  const required = MENU_DATA[menu] || 60;

  const { data } = await supabaseClient.from("reservations").select("time,end_time").eq("date", date);
  const reserved = (data || [])
    .filter(r => r.id !== res.id) // 自分の予約は除外
    .map(r => ({ start: r.time.trim(), end: r.end_time.trim() }));

  const slots = ["10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00"];
  const toMin = t => { const [h,m] = t.split(":").map(Number); return h*60+m; };

  grid.innerHTML = "";
  slots.forEach(start => {
    const [sh, sm] = start.split(":").map(Number);
    const endD = new Date(2000,0,1,sh,sm+required);
    const end = `${String(endD.getHours()).padStart(2,"0")}:${String(endD.getMinutes()).padStart(2,"0")}`;
    let isDisabled = end > "19:00";

    if (!isDisabled) {
      const slotStart = toMin(start), slotEnd = toMin(end);
      isDisabled = reserved.some(r => slotStart < toMin(r.end) && toMin(r.start) < slotEnd);
    }
    if (!isDisabled) {
      isDisabled = OFF_TIMES.some(o => o.date === date && o.time === start);
    }

    const btn = document.createElement("div");
    btn.style.cssText = `padding:10px; text-align:center; border-radius:10px; border:2px solid ${start === res.time && date === res.date ? '#000' : '#ddd'}; background:${isDisabled ? '#f2f2f7' : (start === res.time && date === res.date ? '#000' : '#fff')}; color:${isDisabled ? '#bbb' : (start === res.time && date === res.date ? '#fff' : '#333')}; font-size:14px; ${isDisabled ? '' : 'cursor:pointer;'}`;
    btn.textContent = start;
    if (!isDisabled) {
      btn.onclick = () => {
        document.getElementById("change-time").value = start;
        document.querySelectorAll("#change-time-grid > div").forEach(b => {
          b.style.border = "2px solid #ddd";
          b.style.background = "#fff";
          b.style.color = "#333";
        });
        btn.style.border = "2px solid #000";
        btn.style.background = "#000";
        btn.style.color = "#fff";
      };
    }
    grid.appendChild(btn);
  });
}

function showChangeConfirm(res, newDate, newTime, newMenu) {
  const container = document.querySelector(".container");
  const dow = ["日","月","火","水","木","金","土"][new Date(newDate.replace(/-/g,"/")).getDay()];
  container.innerHTML = `
    <div style="padding:30px 20px;">
      <h2 style="font-size:20px; font-weight:600; margin-bottom:20px;">変更内容の確認</h2>
      <div style="background:#f5f5f7; border-radius:14px; padding:20px; margin-bottom:24px; font-size:15px; line-height:2;">
        <b>メニュー</b>：${newMenu}<br>
        <b>日時</b>：${newDate.replace(/-/g,"/")}(${dow}) ${newTime}
      </div>
      <button id="change-execute-btn" style="width:100%; padding:16px; border-radius:14px; background:#000; color:#fff; border:none; font-size:17px; font-weight:600; cursor:pointer; margin-bottom:12px;">この内容で変更する</button>
      <button onclick="showChangeScreen(${JSON.stringify(res).replace(/"/g,'&quot;')})" style="width:100%; padding:14px; border-radius:14px; background:none; color:#86868b; border:1px solid #ddd; font-size:15px; cursor:pointer;">戻る</button>
    </div>
  `;

  document.getElementById("change-execute-btn").onclick = async () => {
    const btn = document.getElementById("change-execute-btn");
    btn.disabled = true;
    btn.innerText = "変更中...";

    const required = MENU_DATA[newMenu] || 60;
    const [sh, sm] = newTime.split(":").map(Number);
    const endD = new Date(2000,0,1,sh,sm+required);
    const end_time = `${String(endD.getHours()).padStart(2,"0")}:${String(endD.getMinutes()).padStart(2,"0")}`;

    const { error } = await supabaseClient.from("reservations")
      .update({ menus: newMenu, date: newDate, time: newTime, end_time })
      .eq("id", res.id)
      .eq("customer_user_id", customerUserId);

    if (error) {
      alert("変更に失敗しました。");
      btn.disabled = false;
      btn.innerText = "この内容で変更する";
      return;
    }

    // オーナーへ通知
    try {
      const dow2 = ["日","月","火","水","木","金","土"][new Date(newDate.replace(/-/g,"/")).getDay()];
      await fetch("https://bcahztzetpfuklipjmxx.functions.supabase.co/dynamic-service", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-customer-id": customerUserId },
        body: JSON.stringify({
          mode: "reserve",
          name: res.name,
          menus: newMenu,
          date: newDate,
          time: newTime,
          customerUserId,
          customMessage: `【予約変更】\n${res.name} 様が予約を変更しました。\n\n変更後：${newDate.replace(/-/g,"/")}(${dow2}) ${newTime}\nメニュー：${newMenu}`
        })
      });
    } catch(e) { console.error("通知エラー:", e); }

    // 完了画面
    container.innerHTML = `
      <div style="padding:60px 20px; text-align:center;">
        <div class="checkmark-wrapper">
          <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
            <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
        </div>
        <h2 style="font-size:22px; margin-top:25px; font-weight:600;">変更が完了しました</h2>
        <p style="color:#86868b; font-size:15px; line-height:1.6;">ご来店お待ちしております。</p>
        <button id="change-close-btn" style="margin-top:40px; padding:16px; width:100%; border-radius:14px; background:#000; color:#fff; border:none; font-size:17px; font-weight:600; cursor:pointer;">閉じる</button>
      </div>
      <style>
        .checkmark-wrapper { display:flex; justify-content:center; }
        .checkmark { width:80px; height:80px; border-radius:50%; stroke-width:2; stroke:#fff; animation:fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both; }
        .checkmark__circle { stroke-dasharray:166; stroke-dashoffset:166; stroke-width:2; stroke:#4caf50; fill:none; animation:stroke 0.6s forwards; }
        .checkmark__check { transform-origin:50% 50%; stroke-dasharray:48; stroke-dashoffset:48; animation:stroke 0.3s forwards 0.8s; }
        @keyframes stroke { 100% { stroke-dashoffset:0; } }
        @keyframes scale { 0%,100% { transform:none; } 50% { transform:scale3d(1.1,1.1,1); } }
        @keyframes fill { 100% { box-shadow:inset 0px 0px 0px 40px #4caf50; } }
      </style>
    `;
    document.getElementById("change-close-btn").onclick = () => {
      if (window.liff && liff.isInClient()) liff.closeWindow();
      else window.location.href = "https://candoll.vercel.app/";
    };
  };
}


window.addEventListener("load", async () => {
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get('action') === 'change') {
    document.getElementById("reserveForm").style.display = "none";
    if(document.querySelector(".greeting")) document.querySelector(".greeting").style.display = "none";

    await miniappReady;
    if (!customerUserId) return;

    const today = new Date();
    today.setHours(0,0,0,0);
    const todayStr = today.toISOString().split('T')[0];

    const { data } = await supabaseClient.from("reservations")
      .select("*")
      .eq("customer_user_id", customerUserId)
      .gte("date", todayStr)
      .order("date", { ascending: true })
      .limit(1);

    if (data && data.length > 0) {
      showChangeScreen(data[0]);
    } else {
      const container = document.querySelector(".container");
      container.innerHTML = `<div style="padding:60px 20px; text-align:center; color:#86868b;">変更できる予約が見つかりませんでした。</div>`;
    }
  }

  if (urlParams.get('action') === 'cancel') {
    document.getElementById("reserveForm").style.display = "none";
    if(document.querySelector(".greeting")) document.querySelector(".greeting").style.display = "none";
    document.getElementById("cancel-screen").style.display = "block";

    await miniappReady; 
    if (!customerUserId) return;

    // 今日の日付を取得（時刻は00:00:00）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const { data } = await supabaseClient.from("reservations")
      .select("*")
      .eq("customer_user_id", customerUserId)
      .gte("date", todayStr)  // 今日以降の予約のみ取得
      .order("date", { ascending: true })  // 日付の近い順に並べる
      .limit(1);

    if (data && data.length > 0) {
      const res = data[0];
      const dCancel = new Date(res.date.replace(/-/g, "/"));
      const dowCancel = ["日", "月", "火", "水", "木", "金", "土"][dCancel.getDay()];
      document.getElementById("cancel-info").innerHTML = `<b>お名前</b>：${res.name}<br><b>日時</b>：${res.date.replace(/-/g, "/")} (${dowCancel}) ${res.time}`;     

      // ★変更ボタン
      const changeBtn = document.createElement("button");
      changeBtn.innerText = "予約を変更する";
      changeBtn.style.cssText = "width:100%; padding:16px; border-radius:14px; background:#007aff; color:#fff; border:none; font-size:17px; font-weight:600; cursor:pointer; margin-bottom:12px;";
      changeBtn.onclick = () => showChangeScreen(res);
      document.getElementById("executeCancelBtn").parentNode.insertBefore(changeBtn, document.getElementById("executeCancelBtn"));     

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
      document.getElementById("cancel-info").innerText = "キャンセル可能な予約が見つかりませんでした。";
      document.getElementById("executeCancelBtn").style.display = "none";
    }
  }
});

// ===== 段階的入力UI の実装 =====

function initializeStepwiseUI() {
  // 初期状態：メニュー・日付・時間を無効化
  disableMenuSelects();
  disableDateSelection();
  disableTimeSelection();
  
  // 名前入力リスナー（blurイベント = フォーカスが外れたとき）
  const nameInput = document.getElementById('name');
  if (nameInput) {
    nameInput.addEventListener('blur', handleNameBlur);  // inputからblurに変更
  }
}

function handleNameBlur(e) {
  const value = e.target.value.trim();
  if (value.length > 0 && !stepState.name) {
    stepState.name = true;
    enableMenuSelects();
  } else if (value.length === 0) {
    // ★ 名前が空の場合は完全リセット
    if (stepState.name || stepState.menu || stepState.date || stepState.time) {
      stepState.name = false;
      stepState.menu = false;
      stepState.date = false;
      stepState.time = false;
      
      // 全てのヒントを削除
      const hints = ['menu-hint', 'date-hint', 'date-slide-hint', 'time-hint'];
      hints.forEach(id => {
        const hint = document.getElementById(id);
        if (hint) hint.remove();
      });
      
      // メニュー・日付・時間を無効化
      disableMenuSelects();
      disableDateSelection();
      disableTimeSelection();
    }
  }
}

function disableMenuSelects() {
  document.querySelectorAll('.menu-select').forEach(select => {
    select.disabled = true;
    select.style.opacity = '0.3';  // より薄いグレーに
    select.style.pointerEvents = 'none';
  });
  const addBtn = document.getElementById('addMenu');
  if (addBtn) {
    addBtn.style.opacity = '0.3';  // より薄いグレーに
    addBtn.style.pointerEvents = 'none';
  }
}

function enableMenuSelects() {
  const menuContainer = document.getElementById('menuContainer');
  
  // メニューコンテナをラッパーで囲む（重複チェック）
  if (menuContainer && !menuContainer.parentElement.classList.contains('hint-wrapper')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'hint-wrapper';
    menuContainer.parentNode.insertBefore(wrapper, menuContainer);
    wrapper.appendChild(menuContainer);
  }
  
  document.querySelectorAll('.menu-select').forEach(select => {
    select.disabled = false;
    select.style.opacity = '1';
    select.style.pointerEvents = 'auto';
    select.style.animation = 'glow 7s ease-in-out';
    setTimeout(() => select.style.animation = '', 7000);
  });
  
  const addBtn = document.getElementById('addMenu');
  if (addBtn) {
    addBtn.style.opacity = '1';
    addBtn.style.pointerEvents = 'auto';
  }
  
  // 吹き出しヒントを右上に表示（5秒で消える）- 重複削除
  if (menuContainer) {
    const existingHint = document.getElementById('menu-hint');
    if (existingHint) existingHint.remove();
    
    const hint = document.createElement('div');
    hint.id = 'menu-hint';
    hint.className = 'hint-bubble hint-bubble-top-right';
    hint.innerHTML = 'メニューを選択';
    menuContainer.parentElement.appendChild(hint);
    setTimeout(() => hint.remove(), 7000);
  }
  
  // ★ 全てのメニュー選択にリスナーを設定（重複回避）
  attachMenuListeners();
  
  // ★ メニュー追加ボタンにもリスナーを設定
  if (addBtn && !addBtn.dataset.stepwiseListener) {
    addBtn.dataset.stepwiseListener = 'true';
    addBtn.addEventListener('click', () => {
      setTimeout(() => {
        attachMenuListeners(); // 新しく追加されたメニューにもリスナーを設定
      }, 100);
    });
  }
}

// ★ メニューリスナーを安全に追加する関数
function attachMenuListeners() {
  document.querySelectorAll('.menu-select').forEach(select => {
    if (!select.dataset.stepwiseListener) {
      select.dataset.stepwiseListener = 'true';
      select.addEventListener('change', checkMenuSelection);
    }
  });
}

function checkMenuSelection() {
  const menus = Array.from(document.querySelectorAll('.menu-select'))
    .map(s => s.value)
    .filter(v => v !== "");
  
  if (menus.length > 0 && !stepState.menu) {
    stepState.menu = true;
    enableDateSelection();
  } else if (menus.length === 0 && stepState.menu) {
    stepState.menu = false;
    stepState.date = false;
    stepState.time = false;
    disableDateSelection();
    disableTimeSelection();
  }
}

function disableDateSelection() {
  const dateChips = document.getElementById('dateChips');
  if (dateChips) {
    dateChips.style.opacity = '0.4';
    dateChips.style.pointerEvents = 'none';
  }
  const hint = document.getElementById('date-slide-hint');
  if (hint) hint.remove();
}

function enableDateSelection() {
  const dateChips = document.getElementById('dateChips');
  
  if (dateChips) {
    // 日付チップをラッパーで囲む（重複チェック）
    if (!dateChips.parentElement.classList.contains('hint-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'hint-wrapper';
      dateChips.parentNode.insertBefore(wrapper, dateChips);
      wrapper.appendChild(dateChips);
    }
    
    dateChips.style.opacity = '1';
    dateChips.style.pointerEvents = 'auto';
    dateChips.style.animation = 'glow 7s ease-in-out';
    setTimeout(() => dateChips.style.animation = '', 7000);
    
    // 吹き出しヒント1: 右上に「日付を選択」（5秒で消える）- 重複削除
    const existingDateHint = document.getElementById('date-hint');
    if (existingDateHint) existingDateHint.remove();
    
    const hint = document.createElement('div');
    hint.id = 'date-hint';
    hint.className = 'hint-bubble hint-bubble-top-right';
    hint.innerHTML = '日付を選択';
    dateChips.parentElement.appendChild(hint);
    setTimeout(() => hint.remove(), 7000);
    
    // 吹き出しヒント2: 中央下に「スライドできます」（5秒で消える）- 重複削除
    const existingSlideHint = document.getElementById('date-slide-hint');
    if (existingSlideHint) existingSlideHint.remove();
    
    const slideHint = document.createElement('div');
    slideHint.id = 'date-slide-hint';
    slideHint.className = 'hint-bubble hint-bubble-center hint-bubble-slide';
    slideHint.innerHTML = '← 左右にスライドできます →';
    slideHint.style.cssText = 'margin: -15px auto 20px; text-align:center; display:block;';
    dateChips.parentNode.insertBefore(slideHint, dateChips.nextSibling);
    setTimeout(() => slideHint.remove(), 7000);
  }
  
  // ★ 日付チップクリックリスナーを設定（再生成対応）
  attachDateChipListeners();
}

// ★ 日付チップのリスナーを安全に追加する関数
function attachDateChipListeners() {
  document.querySelectorAll('.date-chip:not(.holiday)').forEach(chip => {
    if (!chip.dataset.stepwiseListener) {
      chip.dataset.stepwiseListener = 'true';
      chip.addEventListener('click', function() {
        if (!stepState.date && stepState.menu) {  // メニューが選択済みの時のみ
          stepState.date = true;
          enableTimeSelection();
        }
      });
    }
  });
}

function disableTimeSelection() {
  const timeGrid = document.getElementById('timeGrid');
  if (timeGrid) {
    timeGrid.style.opacity = '0.4';
    timeGrid.style.pointerEvents = 'none';
  }
}

function enableTimeSelection() {
  const timeGrid = document.getElementById('timeGrid');
  
  if (timeGrid) {
    // タイムグリッドをラッパーで囲む（重複チェック）
    if (!timeGrid.parentElement.classList.contains('hint-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'hint-wrapper';
      timeGrid.parentNode.insertBefore(wrapper, timeGrid);
      wrapper.appendChild(timeGrid);
    }
    
    timeGrid.style.opacity = '1';
    timeGrid.style.pointerEvents = 'auto';
    timeGrid.style.animation = 'glow 7s ease-in-out';
    setTimeout(() => timeGrid.style.animation = '', 7000);
    
    // 吹き出しヒントを右上に表示（5秒で消える）- 重複削除
    const existingHint = document.getElementById('time-hint');
    if (existingHint) existingHint.remove();
    
    const hint = document.createElement('div');
    hint.id = 'time-hint';
    hint.className = 'hint-bubble hint-bubble-top-right';
    hint.innerHTML = '時間をお選びください';
    timeGrid.parentElement.appendChild(hint);
    setTimeout(() => hint.remove(), 7000);
  }
}
