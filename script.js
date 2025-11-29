// ===== Supabase 初期化 =====
const supabaseUrl = "https://bcahztzetpfuklipjmxx.supabase.co";
const supabaseKey = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ===== メニュー所要時間（単品＋セット） =====
const MENU_DATA = {
  "カット": 49,
  "カット（大学生・専門学生）": 49,
  "カット（中学生以下）": 49,
  "前髪カット": 19,

  "カラー": 70,
  "リタッチカラー": 70,
  "ダブルカラー": 119,
  "アクセントカラー": 119,
  "ヘナ": 70,

  "モイストパーマ": 70,
  "ポイントパーマ": 70,

  "ストレートパーマ": 150,
  "ポイントストレートパーマ": 120,

  "トリートメント": 29,

  "来店時に相談（２時間枠）": 119,
  "来店時に相談（３時間枠）": 179,
  "来店時に相談（4時間枠）": 239,

  // ===== セットメニュー =====
  "カット＋カラー": 119,
  "カット＋リタッチカラー": 119,
  "カット＋パーマ": 134,
  "カット＋ストレート": 209
};

// greeting
const greeting = document.getElementById("greeting");

// ===== メニュー追加 =====
const menuContainer = document.getElementById('menuContainer');
const addMenuButton = document.getElementById('addMenu');

addMenuButton.addEventListener('click', function () {
  const selects = menuContainer.querySelectorAll('.menu-select');
  if (selects.length < 4) {
    const newSelect = selects[0].cloneNode(true);
    newSelect.value = "";
    menuContainer.appendChild(newSelect);
  }
});

// ===== 所要時間計算 =====
function calcTotalMinutes(selectedMenus) {
  return selectedMenus
    .map(name => MENU_DATA[name] || 0)
    .reduce((a, b) => a + b, 0);
}

// ===== 終了時刻を計算（1分単位で正確） =====
function addMinutesToTime(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const start = new Date(2000, 0, 1, h, m);
  const end = new Date(start.getTime() + minutes * 60000);
  return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
}

// ===== 時間帯がかぶるか =====
function isOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

// ===== 重複チェック（開始〜終了で判定） =====
async function checkDuplicateFull(date, start, end) {
  const { data, error } = await supabaseClient
    .from("reservations")
    .select("time, end_time")
    .eq("date", date);

  if (error) return true;

  for (const r of data) {
    if (isOverlap(start, end, r.time, r.end_time)) {
      return true;
    }
  }
  return false;
}

// ===== 時間グレーアウト =====
document.getElementById("date").addEventListener("change", updateTimeOptions);

async function updateTimeOptions() {
  const date = document.getElementById("date").value;
  const timeSelect = document.getElementById("time");

  Array.from(timeSelect.options).forEach(o => {
    o.disabled = false;
    o.style.color = "#000";
  });

  if (!date) return;

  const { data } = await supabaseClient
    .from("reservations")
    .select("time, end_time")
    .eq("date", date);

  const reservedRanges = data.map(r => ({
    start: r.time,
    end: r.end_time
  }));

  // ★ 30分枠で重なり判定
  Array.from(timeSelect.options).forEach(o => {
    const optionStart = o.value;
    const optionEnd = addMinutesToTime(o.value, 30);

    reservedRanges.forEach(r => {
      if (isOverlap(optionStart, optionEnd, r.start, r.end)) {
        o.disabled = true;
        o.style.color = "#aaa";
      }
    });
  });
}

// ===== 確認画面 =====
const form = document.getElementById('reserveForm');
const confirmScreen = document.getElementById('confirm-screen');
const confirmText = document.getElementById('confirm-text');
const cancelBtn = document.getElementById('cancelBtn');
const okBtn = document.getElementById('okBtn');

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const name = document.getElementById('name').value;
  const menus = Array.from(menuContainer.querySelectorAll('.menu-select'))
    .map(s => s.value)
    .filter(v => v !== "");
  const date = document.getElementById('date').value;
  const time = document.getElementById('time').value;

  if (!name || menus.length === 0 || !date || !time) {
    alert("未入力があります");
    return;
  }

  const duration = calcTotalMinutes(menus);
  const end_time = addMinutesToTime(time, duration);

  const dup = await checkDuplicateFull(date, time, end_time);
  if (dup) {
    alert("この時間帯は予約があります");
    return;
  }

  if (greeting) greeting.style.display = "none";

  confirmText.innerHTML =
    `お名前：${name}<br>
     メニュー：${menus.join(', ')}<br>
     日付：${date}<br>
     時間：${time} 〜 ${end_time}`;

  form.style.display = "none";
  confirmScreen.style.display = "block";
});

// ===== 戻る =====
cancelBtn.addEventListener('click', function () {
  confirmScreen.style.display = "none";
  form.style.display = "block";
  if (greeting) greeting.style.display = "block";
});

// ===== 確定（登録＋通知） =====
okBtn.addEventListener('click', async function () {
  const name = document.getElementById('name').value;
  const menus = Array.from(menuContainer.querySelectorAll('.menu-select'))
    .map(s => s.value)
    .filter(v => v !== "");
  const date = document.getElementById('date').value;
  const time = document.getElementById('time').value;

  const duration = calcTotalMinutes(menus);
  const end_time = addMinutesToTime(time, duration);

  const { error } = await supabaseClient
    .from("reservations")
    .insert([{ name, menus: menus.join(', '), date, time, end_time }]);

  if (error) {
    alert("予約保存エラー");
    return;
  }

  // ===== LINE通知 =====
  try {
    await fetch("https://bcahztzetpfuklipjmxx.functions.supabase.co/dynamic-service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, menus: menus.join(', '), date, time })
    });
  } catch (e) {
    console.error("LINE通知エラー:", e);
  }

  confirmScreen.style.display = "none";
  showCompleteScreen();
});

// ===== 完了画面 =====
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
          style="padding:15px 25px;font-size:18px;border-radius:8px;background:#000;color:#fff;border:none;">
          閉じる
      </button>
  `;

  document.querySelector(".container").appendChild(div);

  document.getElementById("closeBtn").addEventListener("click", function () {
    if (window.liff) {
      try { liff.closeWindow(); return; } catch (e) { }
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);

    if (isIOS) {
      window.location.href = "about:blank";
      setTimeout(() => window.close(), 50);
      return;
    }

    window.open("about:blank", "_self");
    window.close();
  });
}
