// ===== グローバル（必須）=====
let supabaseClient = null;
let runtime = "web"; 
let customerUserId = null;
// 初期化完了を管理するためのフラグ
let isLiffInitialized = false;

// ===== LINE LIFF 初期化とユーザーID取得 =====
// Promiseを定義して、初期化が終わるまで予約ボタンを待たせるようにします
const miniappReady = (async () => {
  try {
    // 1. LIFFの初期化
    await liff.init({ liffId: "2008611644-EZd5nkl0" }); 
    isLiffInitialized = true;

    // 2. LINEアプリ内かどうかの判定
    if (liff.isInClient()) {
      runtime = "miniapp";
      // LINE内ならログインは必須なので、プロフィールを直接取得
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      const profile = await liff.getProfile();
      customerUserId = profile.userId;
      console.log("LINE内実行: ID取得成功", customerUserId);
    } else {
      // 3. PCブラウザなどの場合
      runtime = "web";
      console.log("ブラウザ実行: ID取得スキップ");
    }
  } catch (e) {
    console.error("LIFF初期化エラー:", e);
    runtime = "web";
  }
})();
// ===== メニュー追加ボタンの動作（二重登録防止版） =====
document.addEventListener("DOMContentLoaded", () => {
  const addMenuBtn = document.getElementById("addMenu");
  const menuContainer = document.getElementById("menuContainer");

  if (addMenuBtn && menuContainer) {
    // 一旦既存のクリックイベントをクリア（nullにする）してから新しく登録
    addMenuBtn.onclick = null; 

    addMenuBtn.onclick = () => {
      // 現在のセレクトボックスの数を確認（念のため）
      console.log("メニュー追加ボタンが押されました");

      const firstSelect = menuContainer.querySelector(".menu-select");
      if (firstSelect) {
        const newSelect = firstSelect.cloneNode(true);
        newSelect.value = ""; // 選択状態をリセット
        menuContainer.appendChild(newSelect);
        
        // 新しく増えたセレクトボックスにも時間を再計算する命令を付ける
        newSelect.addEventListener("change", updateTimeOptions);
      }
    };
  }
});
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
if (dateInput) {
  dateInput.addEventListener("change", (e) => {
    const normalized = normalizeDate(e.target.value);
    if (HOLIDAYS.includes(normalized)) {
      alert("この日は休業日のため、ご予約いただけません。");
      e.target.value = "";
      resetTimeSelect();
    }
  });
}

// ===== 日付一覧生成 ＋ Apple風チップ表示 =====
function updateDateOptions() {
  const dateSelect = document.getElementById("date");
  const chipContainer = document.getElementById("dateChips"); // 追加した箱
  if (!dateSelect || !chipContainer) return;

  dateSelect.innerHTML = '<option value="">日付を選択</option>';
  chipContainer.innerHTML = ""; // チップの箱を一度空にする

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 90日分の日付をループ
  for (let i = 1; i < 90; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    const y = d.getFullYear();
    const m = ("0" + (d.getMonth() + 1)).slice(-2);
    const day = ("0" + d.getDate()).slice(-2);
    const value = `${y}-${m}-${day}`;

    // 定休日などの除外ロジック（今の設定を維持）
    if (HOLIDAYS.includes(value)) continue;
    if (d.getDay() === 1) continue;
    if (d.getDay() === 2 && d.getDate() <= 7) continue;
    if (d.getDay() === 2 && d.getDate() >= 15 && d.getDate() <= 21) continue;

    const week = ["日", "月", "火", "水", "木", "金", "土"];
    const dow = week[d.getDay()];

    // 1. 裏側のセレクトボックスにoptionを追加
    const op = document.createElement("option");
    op.value = value;
    op.textContent = `${y}/${m}/${day}(${dow})`;
    dateSelect.appendChild(op);

    // 2. 表側のApple風チップを作成
    const chip = document.createElement("div");
    chip.className = "date-chip";
    chip.innerHTML = `
      <span style="font-size: 10px; margin-bottom: 4px;">${m}月</span>
      <span style="font-size: 18px; font-weight: bold;">${day}</span>
      <span style="font-size: 10px; margin-top: 4px;">(${dow})</span>
    `;

    // チップをクリックした時の動作
    chip.onclick = () => {
      dateSelect.value = value; // 隠れたセレクトボックスに値をセット
      
      // 全チップから selected を外して、クリックしたものだけに付ける
      document.querySelectorAll(".date-chip").forEach(c => c.classList.remove("selected"));
      chip.classList.add("selected");

      // 日付が変わったことをプログラムに知らせる（時間の再計算を動かす）
      dateSelect.dispatchEvent(new Event("change"));
    };

    chipContainer.appendChild(chip);
  }
}

// ===== 予約登録処理 =====
const form = document.getElementById("reserveForm");
const confirmScreen = document.getElementById("confirm-screen");
const confirmText = document.getElementById("confirm-text");
const cancelBtn = document.getElementById("cancelBtn");
const okBtn = document.getElementById("okBtn");

if (form) {
  form.addEventListener("submit", async e => {
    e.preventDefault();

    const errorBox = document.getElementById("errorBox");
    if (errorBox) {
      errorBox.style.display = "none";
      errorBox.innerHTML = "";
    }

    const nameInput = document.getElementById("name");
    const dateSelect = document.getElementById("date");
    const timeSelect = document.getElementById("time");
    const menuSelects = document.querySelectorAll(".menu-select");

    const errors = [];

    if (!nameInput.value.trim()) errors.push("お名前を入力してください。");
    const selectedMenus = Array.from(menuSelects).filter(s => s.value !== "");
    if (selectedMenus.length === 0) errors.push("メニューを選択してください。");
    if (!dateSelect.value) errors.push("日付を選択してください。");
    if (!timeSelect.value) errors.push("時間を選択してください。");

    if (errors.length > 0) {
      errorBox.innerHTML = errors.map(e => `・${e}`).join("<br>");
      errorBox.style.display = "block";
      return;
    }

    const name = nameInput.value;
    const menus = selectedMenus.map(s => s.value);
    const date = dateSelect.value;
    const time = timeSelect.value;

    const required = calcTotalMinutes(menus);
    const end_time = addMinutesToTime(time, required);

    if (await checkDuplicateFull(date, time, end_time)) {
      alert("この時間帯は既に予約があります");
      return;
    }

    const week = ["日", "月", "火", "水", "木", "金", "土"];
    const youbi = week[new Date(date).getDay()];

    const greeting = document.getElementById("greeting");
    if (greeting) greeting.style.display = "none";

    confirmText.innerHTML =
      `お名前：${name}<br>
       メニュー：${menus.join(", ")}<br>
       日付：${date}（${youbi}）<br>
       時間：${time}`;

    form.style.display = "none";
    confirmScreen.style.display = "block";
  });
}

if (cancelBtn) {
  cancelBtn.onclick = () => {
    confirmScreen.style.display = "none";
    form.style.display = "block";
    const greeting = document.getElementById("greeting");
    if (greeting) greeting.style.display = "block";
  };
}

if (okBtn) {
  okBtn.onclick = async () => {
    if (runtime === "miniapp") await miniappReady;
    
    const name = document.getElementById("name").value;
    const menus = Array.from(document.querySelectorAll(".menu-select"))
      .map(s => s.value)
      .filter(v => v !== "");
    const date = document.getElementById("date").value;
    const time = document.getElementById("time").value;

    const required = calcTotalMinutes(menus);
    const end_time = addMinutesToTime(time, required);

    const { error } = await supabaseClient
      .from("reservations")
      .insert([{ name, menus: menus.join(", "), date, time, end_time }]);

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
              customerUserId: customerUserId || null
          })
      }
    );

    confirmScreen.style.display = "none";
    showCompleteScreen();
  };
}

function showCompleteScreen() {
  const container = document.querySelector(".container");
  container.innerHTML = "";

  const div = document.createElement("div");
  div.style.padding = "40px 20px";
  div.innerHTML = `
    <h2 style="font-size:24px; margin-bottom:20px;">予約を受付ました。</h2>
    <p style="font-size:16px; margin-bottom:30px;">ありがとうございます。<br>当日のお越しをお待ちしております。</p>
    <button id="closeBtn"
      style="padding:15px 40px; font-size:18px; border-radius:8px;
             background:#000; color:#fff; border:none; cursor:pointer;">
      閉じる
    </button>
  `;
  container.appendChild(div);

  document.getElementById("closeBtn").onclick = () => {
    if (window.liff && liff.isInClient()) {
      liff.closeWindow();
    } else {
      window.location.href = "https://candoll0430tsuyoshi-afk.github.io/candoll-reserve/";
    }
  };
}

// 入力エラーのクリア処理
function clearErrorOnInput() {
  const errorBox = document.getElementById("errorBox");
  if (errorBox) {
    errorBox.style.display = "none";
    errorBox.innerHTML = "";
  }
}

document.addEventListener("input", (e) => {
  if (e.target.id === "name" || e.target.id === "date" || e.target.id === "time" || e.target.classList.contains("menu-select")) {
    clearErrorOnInput();
  }
});
