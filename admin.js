// ==============================
// Candoll 管理画面 admin.js 完全版
// （現行コードベースに追加処理を統合）
// ==============================

// ====== API URL ======
const API_URL = "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

// ====== DOM 取得 ======
const loginBox = document.getElementById("login-box");
const reserveList = document.getElementById("reserve-list");
const loginError = document.getElementById("login-error");

// ====== ログイン処理 ======
document.getElementById("login-btn").addEventListener("click", async () => {
    const pass = document.getElementById("admin-pass").value;

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
    loginBox.style.display = "none";
    reserveList.style.display = "block";

    renderReservationTable(json.data);
});


// ==============================
// 1日＋前後1日の予約一覧を表示する
// ==============================

// 今日を基準にする
let centerDate = new Date();

// 描画
function renderReservationTable(allData) {

    reserveList.innerHTML = "";

    // centerDate の前後 1日を作成
    const dates = [
        shiftDate(centerDate, -1),
        centerDate,
        shiftDate(centerDate, +1)
    ];

    dates.forEach(date => {
        const dateStr = formatYMD(date);

        // タイトル
        const dow = ["日","月","火","水","木","金","土"][date.getDay()];
        const title = document.createElement("div");
        title.className = "date-title";
        title.textContent = `${dateStr}（${dow}）`;
        reserveList.appendChild(title);

        // その日の予約だけ取り出す
        const dayData = allData.filter(r => r.date === dateStr);

        // ▶ ホットペッパー風 30分区切り枠を生成
        renderOneDayBlocks(dateStr, dayData);
    });

    // 全体を少し下げる
    reserveList.style.marginBottom = "80px";
}


// ==============================
// 30分刻み枠生成（10:00〜19:00）
// ==============================
function renderOneDayBlocks(dateStr, reservations) {

    const container = document.createElement("div");

    // 30分刻み生成
    const times = [];
    for (let h = 10; h <= 18; h++) {
        times.push(`${h.toString().padStart(2, "0")}:00`);
        times.push(`${h.toString().padStart(2, "0")}:30`);
    }

    // 終了時刻が19:00 を超えない枠だけ
    times.push("19:00");

    times.forEach(time => {

        const block = document.createElement("div");
        block.style.margin = "8px 0";
        block.style.padding = "12px";
        block.style.borderRadius = "6px";
        block.style.textAlign = "center";
        block.style.fontSize = "18px";

        // この枠が予約とかぶってるか判定
        const rsv = findOverlapped(reservations, time);

        if (rsv) {
            // ================================
            //      予約がある → 赤背景
            // ================================
            block.style.background = "#ffd6d6";

            const end = rsv.end_time || rsv.time;

            block.innerHTML = `
                <div style="font-weight:bold;">${rsv.time}〜${end}</div>
                <div>${rsv.menus}</div>
                <div style="margin-top:3px; font-size:15px;">👤 ${rsv.name}</div>
            `;

        } else {
            // ================================
            //      空き枠 → 緑背景
            // ================================
            block.style.background = "#d8ffe0";
            block.textContent = `${time}（空き）`;
        }

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
// 日付ユーティリティ
// ==============================
function shiftDate(base, offset) {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    return d;
}

function formatYMD(d) {
    const y = d.getFullYear();
    const m = (d.getMonth()+1).toString().padStart(2,"0");
    const day = d.getDate().toString().padStart(2,"0");
    return `${y}-${m}-${day}`;
}
