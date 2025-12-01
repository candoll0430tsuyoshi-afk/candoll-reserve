// ============================================================
// Candoll 管理画面 admin.js（holidays + 予約 + UI 完全集成版）
// ============================================================

const API_URL = "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

// DOM
const loginBox = document.getElementById("login-box");
const reserveList = document.getElementById("reserve-list");
const loginError = document.getElementById("login-error");

// ===== 受付時間（10:00〜19:00 30分刻み）=====
const TIMES = [];
for (let h = 10; h <= 18; h++) {
    TIMES.push(`${String(h).padStart(2, "0")}:00`);
    TIMES.push(`${String(h).padStart(2, "0")}:30`);
}
TIMES.push("19:00");

// ============================================================
// ログイン処理
// ============================================================
document.getElementById("login-btn").onclick = async () => {
    const pass = document.getElementById("admin-pass").value.trim();
    if (!pass) return;

    const res = await fetch(API_URL, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ mode:"list", password: pass })
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

    loginError.style.display = "none";
    loginBox.style.display = "none";
    reserveList.style.display = "block";

    // 保存し自動ログイン対応
    localStorage.setItem("candoll_admin_pass", pass);

    loadAll();
};

// 自動ログイン
const autoPass = localStorage.getItem("candoll_admin_pass");
if (autoPass) {
    loginBox.style.display = "none";
    reserveList.style.display = "block";
    loadAll();
}

// ============================================================
// 予約データ + 休業日データ を まとめて取得
// ============================================================
async function fetchAllData() {
    const pass = localStorage.getItem("candoll_admin_pass");

    const res = await fetch(API_URL, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ mode:"listAll", password: pass })
    });

    if (!res.ok) return null;

    return await res.json(); // { ok, reservations[], holidays[] }
}

// ============================================================
// 日付管理（今日 / 明日 / 明後日）
// ============================================================
let centerDate = new Date();

function shiftDate(base, offset) {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    return d;
}
function ymd(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function jp(d) {
    const w = ["日","月","火","水","木","金","土"][d.getDay()];
    return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}（${w}）`;
}

// ============================================================
// メイン描画
// ============================================================
async function loadAll() {
    const all = await fetchAllData();
    if (!all) {
        reserveList.innerHTML = "<p>読み込みエラー</p>";
        return;
    }

    const reservations = all.reservations;
    const holidays = all.holidays.map(h => h.date); // ["2025-02-01", ...]

    reserveList.innerHTML = "";

    const days = [
        shiftDate(centerDate, 0), // 今日
        shiftDate(centerDate, 1), // 明日
        shiftDate(centerDate, 2)  // 明後日
    ];

    days.forEach(date => {
        const dStr = ymd(date);
        const dow = jp(date);

        // ===== 日付タイトル =====
        const title = document.createElement("div");
        title.className = "date-title";
        title.style.cursor = "pointer";
        title.textContent = dow;

        // タップで中心変更
        title.onclick = () => {
            centerDate = new Date(date);
            loadAll();
        };

        reserveList.appendChild(title);

        // 休業日の場合 → 全枠 赤
        const isHoliday = holidays.includes(dStr);

        const daily = reservations.filter(r => r.date === dStr);

        renderDayBlocks(dStr, daily, isHoliday);
    });

    renderHolidayControl();
}

// ============================================================
// 1日分（30分区切り）の表示
// ============================================================
function renderDayBlocks(dateStr, reservations, isHoliday) {
    const wrap = document.createElement("div");

    TIMES.forEach(time => {
        const b = document.createElement("div");
        b.style.margin = "6px 0";
        b.style.padding = "14px";
        b.style.fontSize = "18px";
        b.style.borderRadius = "8px";

        // 休業日処理
        if (isHoliday) {
            b.style.background = "#ffb3b3";
            b.textContent = `${time} 休業日`;
            wrap.appendChild(b);
            return;
        }

        // 通常予約チェック
        const r = checkOverlap(reservations, time);

        if (r) {
            // ===== 予約あり（赤）=====
            b.style.background = "#ffd4d4";
            b.style.textAlign = "left";
            b.innerHTML = `
                <div style="font-weight:bold;">${r.time}〜${r.end_time}</div>
                <div>${r.name}</div>
                <div style="color:#444;">${r.menus}</div>
            `;
        } else {
            // ===== 空き（緑）=====
            b.style.background = "#d8ffe0";
            b.textContent = `${time}（空き）`;
        }

        wrap.appendChild(b);
    });

    reserveList.appendChild(wrap);
}

// ============================================================
// 時間帯が予約と重なるか判定
// ============================================================
function checkOverlap(list, start) {
    function toMin(t){
        const [h,m] = t.split(":").map(Number);
        return h*60+m;
    }
    const s = toMin(start);

    for (const r of list) {
        const rs = toMin(r.time);
        const re = toMin(r.end_time);

        if (s >= rs && s < re) return r;
    }
    return null;
}

// ============================================================
// 休業日追加・削除 UI
// ============================================================
function renderHolidayControl() {
    const pass = localStorage.getItem("candoll_admin_pass");

    const box = document.createElement("div");
    box.style.marginTop = "40px";
    box.style.padding = "20px";
    box.style.borderTop = "2px solid #ccc";

    box.innerHTML = `
        <h3>休業日 管理</h3>

        <label>休業日を追加：</label>
        <input type="date" id="addHolidayDate" style="padding:10px;margin:10px 0;">
        <button id="addHolidayBtn" style="padding:10px 20px;">追加</button>

        <br><br>

        <label>休業日を解除：</label>
        <input type="date" id="removeHolidayDate" style="padding:10px;margin:10px 0;">
        <button id="removeHolidayBtn" style="padding:10px 20px;">解除</button>
    `;

    reserveList.appendChild(box);

    // 追加処理
    document.getElementById("addHolidayBtn").onclick = async () => {
        const d = document.getElementById("addHolidayDate").value;
        if (!d) return alert("日付を選んでください");

        await fetch(API_URL, {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ mode:"addHoliday", password: pass, date: d })
        });

        loadAll();
    };

    // 削除処理
    document.getElementById("removeHolidayBtn").onclick = async () => {
        const d = document.getElementById("removeHolidayDate").value;
        if (!d) return alert("日付を選んでください");

        await fetch(API_URL, {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ mode:"removeHoliday", password: pass, date: d })
        });

        loadAll();
    };
}

