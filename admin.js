// ===== 設定 =====
const ADMIN_API_URL = "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";
const SUPABASE_URL = "https://bcahztzetpfuklipjmxx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";

// 予約の所要時間（script.js と同じ）
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

  "カット＋カラー": 119,
  "カット＋リタッチカラー": 119,
  "カット＋パーマ": 134,
  "カット＋ストレート": 209
};

// ===== DOM =====
const loginBox = document.getElementById("login-box");
const loginInput = document.getElementById("admin-pass");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const reserveList = document.getElementById("reserve-list");
const container = document.querySelector(".container");

let currentPassword = "";
let reservations = [];
let modalOverlay = null;
let modalMode = "add"; // "add" or "edit"
let editingReservation = null;

// ===== 共通関数 =====
function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function addMinutesToTime(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const start = new Date(2000, 0, 1, h, m);
  const end = new Date(start.getTime() + minutes * 60000);
  const hh = String(end.getHours()).padStart(2, "0");
  const mm = String(end.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function calcTotalMinutesFromMenus(menus) {
  return menus.map(m => MENU_DATA[m] || 0).reduce((a, b) => a + b, 0);
}

function formatDateLabel(dateStr) {
  // "YYYY-MM-DD" → "YYYY/MM/DD (曜)"
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const days = ["日","月","火","水","木","金","土"];
  return `${y}/${String(m).padStart(2,"0")}/${String(d).padStart(2,"0")} (${days[dt.getDay()]})`;
}

// ===== ログイン処理 =====
loginBtn.addEventListener("click", async () => {
  const pw = loginInput.value.trim();
  if (!pw) {
    loginError.style.display = "block";
    loginError.textContent = "パスワードを入力してください";
    return;
  }

  currentPassword = pw;

  try {
    const res = await fetch(ADMIN_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: currentPassword })
    });

    if (!res.ok) {
      loginError.style.display = "block";
      loginError.textContent = "パスワードが違います";
      return;
    }

    const json = await res.json();
    if (!json.ok) {
      loginError.style.display = "block";
      loginError.textContent = "パスワードが違います";
      return;
    }

    reservations = json.data || [];
    loginBox.style.display = "none";
    setupAdminUI();
    renderReservations();

  } catch (e) {
    console.error(e);
    loginError.style.display = "block";
    loginError.textContent = "通信エラーが発生しました";
  }
});

// ===== 管理UI 初期化 =====
function setupAdminUI() {
  // すでにボタンがあれば作らない
  if (!document.getElementById("add-resv-btn")) {
    const btn = document.createElement("button");
    btn.id = "add-resv-btn";
    btn.textContent = "＋ 新規予約を追加";
    btn.style.marginTop = "25px";
    btn.style.marginBottom = "10px";
    btn.style.width = "100%";
    btn.style.maxWidth = "300px";
    btn.style.fontSize = "18px";
    btn.style.borderRadius = "8px";
    btn.style.border = "none";
    btn.style.background = "#000";
    btn.style.color = "#fff";
    btn.style.cursor = "pointer";
    container.appendChild(btn);

    btn.addEventListener("click", () => {
      openModal("add", null);
    });
  }

  // モーダル未作成なら作る
  if (!modalOverlay) {
    createModal();
  }

  reserveList.style.display = "block";
}

// ===== 予約一覧を描画 =====
function renderReservations() {
  reserveList.innerHTML = "";

  if (!reservations.length) {
    reserveList.textContent = "予約はまだありません。";
    return;
  }

  // 日付ごとにグループ
  const byDate = {};
  reservations.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  });

  const dates = Object.keys(byDate).sort(); // 昇順

  dates.forEach(dateStr => {
    const title = document.createElement("div");
    title.className = "date-title";
    title.textContent = formatDateLabel(dateStr);
    reserveList.appendChild(title);

    // time 昇順
    const list = byDate[dateStr].slice().sort((a,b) => (a.time > b.time ? 1 : -1));

    list.forEach(r => {
      const item = document.createElement("div");
      item.className = "reserve-item";

      const topRow = document.createElement("div");
      topRow.style.display = "flex";
      topRow.style.justifyContent = "space-between";
      topRow.style.alignItems = "center";

      const timeEl = document.createElement("div");
      timeEl.className = "time";
      timeEl.textContent = `${r.time} 〜 ${r.end_time || ""}`;

      const btnBox = document.createElement("div");

      const editBtn = document.createElement("button");
      editBtn.textContent = "✏️";
      editBtn.style.marginRight = "8px";
      editBtn.style.border = "none";
      editBtn.style.background = "transparent";
      editBtn.style.cursor = "pointer";
      editBtn.style.fontSize = "18px";

      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑️";
      delBtn.style.border = "none";
      delBtn.style.background = "transparent";
      delBtn.style.cursor = "pointer";
      delBtn.style.fontSize = "18px";

      btnBox.appendChild(editBtn);
      btnBox.appendChild(delBtn);

      topRow.appendChild(timeEl);
      topRow.appendChild(btnBox);

      const menuEl = document.createElement("div");
      menuEl.className = "menu";
      menuEl.textContent = `メニュー：${r.menus || ""}`;

      const nameEl = document.createElement("div");
      nameEl.className = "name";
      nameEl.textContent = `お名前：${r.name || ""}`;

      item.appendChild(topRow);
      item.appendChild(menuEl);
      item.appendChild(nameEl);

      reserveList.appendChild(item);

      editBtn.addEventListener("click", () => {
        openModal("edit", r);
      });

      delBtn.addEventListener("click", async () => {
        const ok = window.confirm("この予約を削除しますか？");
        if (!ok) return;
        await deleteReservation(r.id);
        await reloadReservations();
      });
    });
  });
}

// ===== Supabase REST で削除 =====
async function deleteReservation(id) {
  const url = `${SUPABASE_URL}/rest/v1/reservations?id=eq.${id}`;
  await fetch(url, {
    method: "DELETE",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
}

// ===== 予約一覧を再取得 =====
async function reloadReservations() {
  try {
    const res = await fetch(ADMIN_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: currentPassword })
    });
    if (!res.ok) return;
    const json = await res.json();
    if (!json.ok) return;
    reservations = json.data || [];
    renderReservations();
  } catch (e) {
    console.error(e);
  }
}

// ===== モーダル生成 =====
function createModal() {
  modalOverlay = document.createElement("div");
  modalOverlay.id = "modal-overlay";
  modalOverlay.style.position = "fixed";
  modalOverlay.style.inset = "0";
  modalOverlay.style.background = "rgba(0,0,0,0.45)";
  modalOverlay.style.display = "none";
  modalOverlay.style.alignItems = "center";
  modalOverlay.style.justifyContent = "center";
  modalOverlay.style.zIndex = "9999";

  const modal = document.createElement("div");
  modal.id = "modal-card";
  modal.style.background = "#fff";
  modal.style.borderRadius = "12px";
  modal.style.boxShadow = "0 8px 20px rgba(0,0,0,0.25)";
  modal.style.maxWidth = "520px";
  modal.style.width = "90%";
  modal.style.maxHeight = "80vh";
  modal.style.overflowY = "auto";
  modal.style.padding = "20px 20px 25px";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.marginBottom = "10px";

  const title = document.createElement("h2");
  title.id = "modal-title";
  title.textContent = "新規予約の追加";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.style.border = "none";
  closeBtn.style.background = "transparent";
  closeBtn.style.fontSize = "20px";
  closeBtn.style.cursor = "pointer";

  header.appendChild(title);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // 内容
  const body = document.createElement("div");
  body.innerHTML = `
    <div style="margin-top:10px;">
      <label>お名前</label>
      <input type="text" id="modal-name" style="width:100%;padding:10px;margin-top:5px;border:1px solid #ccc;border-radius:6px;">
    </div>

    <div style="margin-top:15px;">
      <label>メニュー</label>
      <div id="modal-menu-container"></div>
      <button id="modal-add-menu" type="button"
        style="margin-top:8px;border:none;background:transparent;color:#007bff;cursor:pointer;">
        ＋ メニューを追加
      </button>
    </div>

    <div style="margin-top:15px;">
      <label>日付</label>
      <input type="date" id="modal-date"
        style="width:100%;padding:10px;margin-top:5px;border:1px solid #ccc;border-radius:6px;">
    </div>

    <div style="margin-top:15px;">
      <label>時間</label>
      <input type="time" id="modal-time" step="1800"
        style="width:100%;padding:10px;margin-top:5px;border:1px solid #ccc;border-radius:6px;">
    </div>

    <div style="margin-top:15px;font-size:14px;color:#555;">
      <div>所要時間：<span id="modal-required">0</span> 分</div>
      <div>終了予定：<span id="modal-endtime">--:--</span></div>
    </div>

    <div style="margin-top:20px;display:flex;gap:10px;">
      <button id="modal-save"
        style="flex:1;padding:12px;font-size:18px;border:none;border-radius:8px;background:#000;color:#fff;cursor:pointer;">
        保存する
      </button>
      <button id="modal-cancel"
        style="flex:1;padding:12px;font-size:18px;border:none;border-radius:8px;background:#ccc;color:#000;cursor:pointer;">
        キャンセル
      </button>
    </div>
  `;
  modal.appendChild(body);
  modalOverlay.appendChild(modal);
  document.body.appendChild(modalOverlay);

  // イベント
  closeBtn.addEventListener("click", closeModal);
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-save").addEventListener("click", handleModalSave);
  document.getElementById("modal-add-menu").addEventListener("click", () => {
    addModalMenuSelect();
    updateModalSummary();
  });

  const nameInput = document.getElementById("modal-name");
  const dateInput = document.getElementById("modal-date");
  const timeInput = document.getElementById("modal-time");
  nameInput.addEventListener("input", updateModalSummary);
  dateInput.addEventListener("change", updateModalSummary);
  timeInput.addEventListener("change", updateModalSummary);
}

// ===== モーダル開閉 =====
function openModal(mode, reservation) {
  modalMode = mode;
  editingReservation = reservation || null;

  const title = document.getElementById("modal-title");
  const saveBtn = document.getElementById("modal-save");
  const nameInput = document.getElementById("modal-name");
  const dateInput = document.getElementById("modal-date");
  const timeInput = document.getElementById("modal-time");
  const menuContainer = document.getElementById("modal-menu-container");

  // メニュー欄初期化
  menuContainer.innerHTML = "";
  addModalMenuSelect(); // 最低1個

  if (mode === "add") {
    title.textContent = "新規予約の追加";
    saveBtn.textContent = "保存する";
    nameInput.value = "";
    dateInput.value = "";
    timeInput.value = "";
  } else {
    title.textContent = "予約の編集";
    saveBtn.textContent = "更新する";
    if (reservation) {
      nameInput.value = reservation.name || "";
      dateInput.value = reservation.date || "";
      timeInput.value = reservation.time || "";

      // メニューを反映
      if (reservation.menus) {
        const arr = reservation.menus.split(",").map(s => s.trim()).filter(v => v);
        menuContainer.innerHTML = "";
        if (arr.length === 0) {
          addModalMenuSelect();
        } else {
          arr.forEach((m, idx) => {
            const select = addModalMenuSelect();
            select.value = m;
          });
        }
      }
    }
  }

  updateModalSummary();
  modalOverlay.style.display = "flex";
}

function closeModal() {
  if (modalOverlay) {
    modalOverlay.style.display = "none";
  }
}

// ===== メニュー select 生成 =====
function createMenuSelectElement() {
  const sel = document.createElement("select");
  sel.className = "modal-menu-select";
  sel.style.width = "100%";
  sel.style.padding = "10px";
  sel.style.marginTop = "5px";
  sel.style.border = "1px solid #ccc";
  sel.style.borderRadius = "6px";

  sel.innerHTML = `
    <option value="">選択してください</option>
    <optgroup label="組み合わせ">
      <option value="カット＋カラー">カット＋カラー</option>
      <option value="カット＋リタッチカラー">カット＋リタッチカラー</option>
      <option value="カット＋パーマ">カット＋パーマ</option>
      <option value="カット＋ストレート">カット＋ストレート</option>
    </optgroup>
    <optgroup label="カット">
      <option value="カット">カット</option>
      <option value="カット（大学生・専門学生）">カット（大学生・専門学生）</option>
      <option value="カット（中学生以下）">カット（中学生以下）</option>
      <option value="前髪カット">前髪カット</option>
    </optgroup>
    <optgroup label="カラー">
      <option value="カラー">カラー</option>
      <option value="リタッチカラー">リタッチカラー</option>
      <option value="ダブルカラー">ダブルカラー</option>
      <option value="アクセントカラー">アクセントカラー</option>
      <option value="ヘナ">ヘナ</option>
    </optgroup>
    <optgroup label="パーマ">
      <option value="モイストパーマ">モイストパーマ</option>
      <option value="ポイントパーマ">ポイントパーマ</option>
    </optgroup>
    <optgroup label="ストレート">
      <option value="ストレートパーマ">ストレートパーマ</option>
      <option value="ポイントストレートパーマ">ポイントストレートパーマ</option>
    </optgroup>
    <optgroup label="トリートメント">
      <option value="トリートメント">トリートメント</option>
    </optgroup>
    <optgroup label="メニュー未定">
      <option value="来店時に相談（２時間枠）">来店時に相談（２時間枠）</option>
      <option value="来店時に相談（３時間枠）">来店時に相談（３時間枠）</option>
      <option value="来店時に相談（4時間枠）">来店時に相談（4時間枠）</option>
    </optgroup>
  `;

  sel.addEventListener("change", updateModalSummary);
  return sel;
}

function addModalMenuSelect() {
  const menuContainer = document.getElementById("modal-menu-container");
  const selects = menuContainer.querySelectorAll(".modal-menu-select");
  if (selects.length >= 4) return null;

  const sel = createMenuSelectElement();
  menuContainer.appendChild(sel);
  return sel;
}

// ===== モーダル内の所要時間／終了時刻表示更新 =====
function updateModalSummary() {
  const requiredSpan = document.getElementById("modal-required");
  const endSpan = document.getElementById("modal-endtime");
  const timeInput = document.getElementById("modal-time");

  const menuContainer = document.getElementById("modal-menu-container");
  const menus = Array.from(menuContainer.querySelectorAll(".modal-menu-select"))
    .map(s => s.value)
    .filter(v => v !== "");

  const total = calcTotalMinutesFromMenus(menus);
  requiredSpan.textContent = total;

  const startTime = timeInput.value;
  if (startTime && total > 0) {
    endSpan.textContent = addMinutesToTime(startTime, total);
  } else {
    endSpan.textContent = "--:--";
  }
}

// ===== 保存（追加 or 更新） =====
async function handleModalSave() {
  const nameInput = document.getElementById("modal-name");
  const dateInput = document.getElementById("modal-date");
  const timeInput = document.getElementById("modal-time");
  const menuContainer = document.getElementById("modal-menu-container");

  const name = nameInput.value.trim();
  const date = dateInput.value;
  const time = timeInput.value;

  const menus = Array.from(menuContainer.querySelectorAll(".modal-menu-select"))
    .map(s => s.value)
    .filter(v => v !== "");

  if (!name || !date || !time || menus.length === 0) {
    alert("未入力の項目があります");
    return;
  }

  const total = calcTotalMinutesFromMenus(menus);
  const end_time = addMinutesToTime(time, total);

  const payload = {
    name,
    menus: menus.join(", "),
    date,
    time,
    end_time
  };

  const baseUrl = `${SUPABASE_URL}/rest/v1/reservations`;
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
  };

  try {
    if (modalMode === "add") {
      await fetch(baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
    } else if (modalMode === "edit" && editingReservation) {
      const url = `${baseUrl}?id=eq.${editingReservation.id}`;
      await fetch(url, {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload)
      });
    }

    closeModal();
    await reloadReservations();

  } catch (e) {
    console.error(e);
    alert("保存に失敗しました");
  }
}
