// ===== Supabase 初期化 =====
const supabaseUrl = "https://bcahztzetpfuklipjmxx.supabase.co";
const supabaseKey = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ===== メニュー所要時間（Supabaseから読み込む） =====
let MENU_DATA = {};

// ★ Supabase menus から duration を取得
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
}

// ページ読み込み後にメニュー取得
loadMenus().then(() => {
  updateTimeOptions();
});

const greeting = document.getElementById("greeting");

// ===== メニュー追加 =====
const menuContainer = document.getElementById("menuContainer");
const addMenuButton = document.getElementById("addMenu");

function attachMenuUpdate() {
  const selects = menuContainer.querySelectorAll(".menu-select");
  selects.forEach(sel => {
    sel.addEventListener("change", updateTimeOptions);
  });
}
attachMenuUpdate();

addMenuButton.addEventListener("click", function () {
  const selects = menuContainer.querySelectorAll(".menu-select");
  if (selects.length < 4) {
    const newSelect = selects[0].cloneNode(true);
    newSelect.value = "";
    menuContainer.appendChild(newSelect);
    attachMenuUpdate();
  }
});

// ===== 所要時間計算 =====
function calcTotalMinutes(selectedMenus) {
  return selectedMenus
    .map(m => MENU_DATA[m] || 0)
    .reduce((a, b) => a + b, 0);
}

// ===== 時刻処理 =====
function addMinutesToTime(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const start = new Date(2000, 0, 1, h, m);
  const end = new Date(start.getTime() + minutes * 60000);
  return `${String(end.getHours()).padStart(2, "0")}:${String(
    end.getMinutes()
  ).padStart(2, "0")}`;
}

function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isOverlap(startA, endA, startB, endB) {
  return toMinutes(startA) < toMinutes(endB) &&
         toMinutes(startB) < toMinutes(endA);
}

// ===== 重複チェック =====
async function checkDuplicateFull(date, start, end) {
  const { data, error } = await supabaseClient
    .from("reservations")
    .select("time,end_time")
    .eq("date", date);

  if (error) return true;

  return data.some(r =>
    isOverlap(start, end, r.time.trim(), r.end_time.trim())
  );
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

  const menus = Array.from(menuContainer.querySelectorAll(".menu-select"))
    .map(s => s.value)
    .filter(v => v !== "");

  const required = calcTotalMinutes(menus);
  const closeTime = "19:00";

  const { data } = await supabaseClient
    .from("reservations")
    .select("time,end_time")
    .eq("date", date);

  const reserved = (data || []).map(r => ({
    start: r.time.trim(),
    end: r.end_time.trim(),
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

    if (reserved.some(r => isOverlap(start, end, r.start, r.end))) {
      o.disabled = true;
      o.style.color = "#aaa";
    }
  });
}

// ===== フォーム送信（確認画面） =====
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

  if (greeting) greeting.style.display = "none";

  confirmText.innerHTML =
    `お名前：${name}<br>
     メニュー：${menus.join(", ")}<br>
     日付：${date}<br>
     時間：${time} 〜 ${end_time}`;

  form.style.display = "none";
  confirmScreen.style.display = "block";
});

// ===== 戻る =====
cancelBtn.onclick = () => {
  confirmScreen.style.display = "none";
  form.style.display = "block";
  if (greeting) greeting.style.display = "block";
};

// ===== 確定（保存＋通知） =====
okBtn.onclick = async () => {
  const name = document.getElementById("name").value;
  const menus = Array.from(menuContainer.querySelectorAll(".menu-select"))
    .map(s => s.value)
    .filter(v => v !== "");
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;

  const required = calcTotalMinutes(menus);
  const end_time = addMinutesToTime(time, required);

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
      style="padding:15px 25px;font-size:18px;border-radius:8px;
             background:#000;color:#fff;border:none;">
      閉じる
    </button>
  `;
  document.querySelector(".container").appendChild(div);

  document.getElementById("closeBtn").onclick = () => {
    if (window.liff?.closeWindow) {
      try { liff.closeWindow(); return; } catch {}
    }
    history.length > 1 ? history.back() :
      location.href =
        "https://candoll0430tsuyoshi-afk.github.io/candoll-reserve/";
  };
}
