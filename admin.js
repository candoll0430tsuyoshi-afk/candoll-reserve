// ==============================
// Candoll 管理画面 admin.js 完全版
// （今日・明日・明後日表示 ＋ 休業反映）
// ==============================

// ====== API URL ======
const API_URL = "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

// ====== DOM 取得 ======
const loginBox = document.getElementById("login-box");
const reserveList = document.getElementById("reserve-list");
const loginError = document.getElementById("login-error");
const loginBtn = document.getElementById("login-btn");
const passInput = document.getElementById("admin-pass");

// ====== グローバル予約データ / 休業データ ======
let allReservations = [];
let allHolidays = [];

// ====== ログイン処理 ======
loginBtn.addEventListener("click", async () => {
  const pass = passInput.value;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "list",
      password: pass
    })
  });

  if (!res.ok) {
    loginError.style.display = "block";
    return;
  }

  const json = await res.json();
  if (!json.ok) {
    loginError.style.display = "block";
    return;
  }

  // ログイン成功
  loginError.style.display = "none";
  loginBox.style.display = "none";
  reserveList.style.display = "block";

  // 予約 & 休業データ保存
  allReservations = json.reservations || json.data || [];
  allHolidays = json.holidays || [];

  renderReservationTable();
});

// ==============================
// ★ 今日 / 明日 / 明後日 の 3日分を表示する
// baseDate は「左端の日」
// ==============================
let baseDate = new Date(); // 最初は今日

function renderReservationTable() {
  reserveList.innerHTML = "";

  const dates = [
    shiftDate(baseDate, 0), // baseDate
    shiftDate(baseDate, 1), // baseDate +1
    shiftDate(baseDate, 2)  // baseDate +2
  ];

  dates.forEach(date => {
    const dateStr = formatYMD(date);
    const dow = ["日","月","火","水","木","金","土"][date.getDay()];

    // タイトル（タップで中心切替）
    const title = document.createElement("div");
    title.className = "date-title";
    title.textContent = `${dateStr}（${dow}）`;
    title.style.cursor = "pointer";
    title.dataset.ymd = dateStr;
    title.onclick = () => {
      // タップした日を new baseDate にして再描画
      baseDate = new Date(dateStr + "T00:00:00");
      renderReservationTable();
    };
    reserveList.appendChild(title);

    // その日の予約
    const dayData = allReservations.filter(r => r.date === dateStr);

    // この日が定休日か？
    const isRegularOff = isRegularHoliday(date);
    // 臨時休業か？
    const isExtraOff = isExtraHoliday(dateStr, allHolidays);

    renderOneDayBlocks(date, dayData, isRegularOff, isExtraOff);
  });

  reserveList.style.marginBottom = "80px";
}

// ==============================
// 30分刻み枠生成（10:00〜19:00）
// ==============================
function renderOneDayBlocks(dateObj, reservations, isRegularOff, isExtraOff) {
  const container = document.createElement("div");

  const times = [];
  for (let h = 10; h <= 18; h++) {
    times.push(`${h.toString().padStart(2, "0")}:00`);
    times.push(`${h.toString().padStart(2, "0")}:30`);
  }
  times.push("19:00"); // 終了目安

  const ymd = formatYMD(dateObj);

  times.forEach(time => {
    const block = document.createElement("div");
    block.style.margin = "4px 0";
    block.style.padding = "10px 12px";
    block.style.borderRadius = "6px";
    block.style.display = "flex";
    block.style.alignItems = "center";
    block.style.fontSize = "16px";

    // 左側：時間
    const timeSpan = document.createElement("div");
    timeSpan.style.flex = "0 0 80px";
    timeSpan.style.textAlign = "left";
    timeSpan.textContent = time;

    // 右側：内容
    const contentSpan = document.createElement("div");
    contentSpan.style.flex = "1";
    contentSpan.style.textAlign = "left";

    // 定休日 or 臨時休業 優先
    if (isRegularOff || isExtraOff) {
      block.style.background = "#ffb3b3"; // 赤
      if (isRegularOff) {
        contentSpan.textContent = "定休日";
      } else if (isExtraOff) {
        contentSpan.textContent = "臨時休業";
      }
    } else {
      // 予約かぶり判定
      const rsv = findOverlapped(reservations, time);

      if (rsv) {
        block.style.background = "#ffd6d6"; // 予約あり（赤）

        const isStart = (time === rsv.time);
        const end = rsv.end_time || rsv.time;

        if (isStart) {
          // 開始時間の行だけ詳細を出す
          contentSpan.innerHTML = `
            <div style="font-weight:bold;">${rsv.time}〜${end}</div>
            <div>${rsv.menus}</div>
            <div style="margin-top:3px; font-size:13px;">👤 ${rsv.name}</div>
          `;
        } else {
          // 継続中の時間帯 → 時間だけ
          contentSpan.textContent = ""; // 右側は何も書かない（真っ赤）
        }
      } else {
        // 空き枠
        block.style.background = "#d8ffe0"; // 緑
        contentSpan.textContent = "（空き）";
      }
    }

    block.appendChild(timeSpan);
    block.appendChild(contentSpan);
    container.appendChild(block);
  });

  reserveList.appendChild(container);
}

// ==============================
// 予約とかぶっている時間帯を判定
// ==============================
function findOverlapped(list, startTime) {
  function toMinutes(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  const startMin = toMinutes(startTime);

  for (const r of list) {
    const rStart = toMinutes(r.time);
    const rEnd = toMinutes(r.end_time || r.time);

    if (startMin >= rStart && startMin < rEnd) {
      return r;
    }
  }
  return null;
}

// ==============================
// 定休日判定（毎週月曜 & 第1/第3火曜）
// ==============================
function isRegularHoliday(dateObj) {
  const d = dateObj;
  const day = d.getDay();      // 0:日〜6:土
  const date = d.getDate();    // 1〜31
  const week = Math.floor((date - 1) / 7) + 1; // 第何週か

  // 月曜
  if (day === 1) return true;

  // 火曜かつ第1 or 第3
  if (day === 2 && (week === 1 || week === 3)) return true;

  return false;
}

// ==============================
// 臨時休業（holidays テーブル）
// ==============================
// holidays: [{ date: "2025-12-01", memo: "臨時休業" }, ...]
function isExtraHoliday(ymd, holidays) {
  if (!holidays || !holidays.length) return false;
  return holidays.some(h => h.date === ymd);
}

// ==============================
// 日付ユーティリティ
// ==============================
function shiftDate(base, offset) {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return d;
}

function formatYMD(d) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}
