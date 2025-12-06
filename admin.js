// ==============================
// Candoll 管理画面 admin.js
// （完全版 + ログイン保持 + ナビ非表示修正）
// ==============================

const API_URL = "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

const loginBox = document.getElementById("login-box");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const dayNavi = document.getElementById("day-navi");
const navPrev = document.getElementById("nav-prev");
const navNext = document.getElementById("nav-next");
const navCurrent = document.getElementById("nav-current");
const daysWrapper = document.getElementById("days-wrapper");

const logoutBtn = document.getElementById("m-logout");
const addHolidayBtn = document.getElementById("m-add");
const delHolidayBtn = document.getElementById("m-del");

let MENUS = [];
let ALL_RES = [];
let HOLIDAYS = [];

let baseDate = new Date();

// ★ 初期状態（ログイン前）はナビを非表示
dayNavi.style.display = "none";

// ==============================
// ▼ ログイン保持チェック
// ==============================
window.onload = async () => {
    const logged = localStorage.getItem("loggedIn");
    if (logged === "yes") {
        loginBox.style.display = "none";
        dayNavi.style.display = "flex";

        // データ再取得（パスワード保存を避けるため専用APIを後で作る案もある）
        const pass = localStorage.getItem("adminPass") || "";
        if (pass) {
            const result = await callAPI({ mode: "list", password: pass });

            if (!result.error) {
                ALL_RES = result.reservations || [];
                HOLIDAYS = result.holidays || [];
                MENUS = result.menus || [];
                render3Days();
            }
        }
    }
};

// ==============================
// ▼ 日付フォーマット（2025-12-05（金））
// ==============================
function formatDateFull(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const youbi = ["日","月","火","水","木","金","土"][d.getDay()];
    return `${y}-${m}-${day}（${youbi}）`;
}

function formatDate(d) {
    return d.toISOString().split("T")[0];
}

// ==============================
// ▼ API 共通
// ==============================
async function callAPI(body) {
    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        return await res.json();
    } catch (e) {
        return { error: true };
    }
}

// ==============================
// ▼ ログイン
// ==============================
loginBtn.onclick = async () => {
    const pass = document.getElementById("admin-pass").value.trim();
    if (!pass) return;

    const result = await callAPI({ mode: "list", password: pass });

    if (result.error) {
        loginError.style.display = "block";
        return;
    }

    loginError.style.display = "none";

    // データ格納
    ALL_RES = result.reservations || [];
    HOLIDAYS = result.holidays || [];
    MENUS = result.menus || [];

    // ログイン画面非表示 & ナビ表示
    loginBox.style.display = "none";
    dayNavi.style.display = "flex";

    // ★ ログイン状態を保存
    localStorage.setItem("loggedIn", "yes");
    localStorage.setItem("adminPass", pass);

    render3Days();
};

// ==============================
// ▼ ログアウト
// ==============================
logoutBtn.onclick = () => {
    dayNavi.style.display = "none";
    daysWrapper.innerHTML = "";
    loginBox.style.display = "block";

    // ★ ログイン情報削除
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("adminPass");
};

// ==============================
// ▼ 3日表示
// ==============================
function render3Days() {
    daysWrapper.innerHTML = "";

    navCurrent.textContent = formatDateFull(baseDate);

    const days = [
        new Date(baseDate),
        new Date(baseDate.getTime() + 86400000),
        new Date(baseDate.getTime() + 86400000 * 2)
    ];

    days.forEach(dateObj => {
        const dayStr = formatDate(dateObj);

        const col = document.createElement("div");
        col.className = "day-column";

        const title = document.createElement("div");
        title.className = "date-title";
        title.innerHTML = formatDateFull(dateObj);

        const plus = document.createElement("div");
        plus.className = "plus-btn";
        plus.textContent = "＋";
        plus.onclick = () => openAddPopup(dayStr);
        title.appendChild(plus);
        col.appendChild(title);

        const takenTimes = ALL_RES.filter(r => r.date === dayStr).map(r => r.time);

        ALL_RES.filter(r => r.date === dayStr).forEach(r => {
            const box = document.createElement("div");
            box.style.border = "1px solid #ccc";
            box.style.padding = "10px";
            box.style.marginBottom = "8px";
            box.style.borderRadius = "6px";
            box.style.background = "#fff";

            if (takenTimes.length >= 10) {
                box.style.background = "#ffeaea";
                box.style.border = "1px solid #ff5050";
            }

            box.innerHTML = `
                <div><b>${r.time}</b></div>
                <div>${r.name}</div>
                <div style="font-size:14px; color:#555;">${r.menu}</div>
            `;
            col.appendChild(box);
        });

        daysWrapper.appendChild(col);
    });
}

// ==============================
// ▼ 日付移動
// ==============================
navPrev.onclick = () => {
    baseDate = new Date(baseDate.getTime() - 86400000);
    render3Days();
};
navNext.onclick = () => {
    baseDate = new Date(baseDate.getTime() + 86400000);
    render3Days();
};

// ==============================
// ▼ 時間選択（過去時間は選べない）
// ==============================
function fillTimes(dateStr, selected = "") {
    const sel = document.getElementById("p-time");
    sel.innerHTML = "";

    const now = new Date();
    const target = new Date(dateStr);

    const TIMES = [];
    for (let h = 10; h <= 18; h++) {
        TIMES.push(`${String(h).padStart(2, "0")}:00`);
        TIMES.push(`${String(h).padStart(2, "0")}:30`);
    }
    TIMES.push("19:00");

    TIMES.forEach(t => {
        const op = document.createElement("option");
        op.value = t;
        op.textContent = t;

        if (target.toDateString() === now.toDateString()) {
            const hour = Number(t.split(":")[0]);
            const min = Number(t.split(":")[1]);
            const nowHM = now.getHours() * 60 + now.getMinutes();
            const tHM = hour * 60 + min;

            if (tHM <= nowHM) op.disabled = true;
        }

        if (selected === t) op.selected = true;

        sel.appendChild(op);
    });
}

// ==============================
// ▼ メニュー補完
// ==============================
function fillMenus(selected = "") {
    const sel = document.getElementById("p-menu");
    sel.innerHTML = "";

    MENUS.forEach(m => {
        const op = document.createElement("option");
        op.value = m.name;
        op.textContent = m.name;
        if (selected === m.name) op.selected = true;
        sel.appendChild(op);
    });
}

// ==============================
// ▼ 予約追加ポップアップ
// ==============================
function openAddPopup(dateStr) {
    const bg = document.getElementById("popup-bg");
    const box = document.getElementById("popup-box");

    box.innerHTML = `
        <h3>予約追加</h3>
        <input id="p-name" placeholder="名前">
        <select id="p-menu"></select>
        <select id="p-time"></select>
        <button id="p-save">追加</button>
        <button id="p-close">閉じる</button>
    `;

    fillMenus();
    fillTimes(dateStr);

    bg.style.display = "flex";

    document.getElementById("p-close").onclick = () =>
        bg.style.display = "none";

    document.getElementById("p-save").onclick = async () => {
        const name = document.getElementById("p-name").value.trim();
        const menu = document.getElementById("p-menu").value;
        const time = document.getElementById("p-time").value;

        await callAPI({
            mode: "add",
            password: localStorage.getItem("adminPass"),
            name,
            menu,
            date: dateStr,
            time
        });

        const res = await callAPI({
            mode: "list",
            password: localStorage.getItem("adminPass")
        });

        ALL_RES = res.reservations;
        bg.style.display = "none";
        render3Days();
    };
}

// ==============================
// ▼ 休日追加
// ==============================
addHolidayBtn.onclick = () => {
    const bg = document.getElementById("popup-bg");
    const box = document.getElementById("popup-box");

    box.innerHTML = `
        <h3>休日追加</h3>
        <input type="date" id="h-day">
        <button id="h-save">追加</button>
        <button id="h-close">閉じる</button>
    `;

    bg.style.display = "flex";

    document.getElementById("h-close").onclick = () =>
        bg.style.display = "none";

    document.getElementById("h-save").onclick = async () => {
        const d = document.getElementById("h-day").value;
        if (!d) return;

        await callAPI({
            mode: "addHoliday",
            password: localStorage.getItem("adminPass"),
            date: d
        });

        bg.style.display = "none";
    };
};

// ==============================
// ▼ 休日解除
// ==============================
delHolidayBtn.onclick = () => {
    const bg = document.getElementById("popup-bg");
    const box = document.getElementById("popup-box");

    box.innerHTML = `
        <h3>休日解除</h3>
        <input type="date" id="h-del-day">
        <button id="h-del">解除</button>
        <button id="h-close">閉じる</button>
    `;

    bg.style.display = "flex";

    document.getElementById("h-close").onclick = () =>
        bg.style.display = "none";

    document.getElementById("h-del").onclick = async () => {
        const d = document.getElementById("h-del-day").value;
        if (!d) return;

        await callAPI({
            mode: "delHoliday",
            password: localStorage.getItem("adminPass"),
            date: d
        });

        bg.style.display = "none";
    };
};
