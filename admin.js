// ==============================
// Candoll 管理画面 admin.js（完全復元 + 修正5点反映版）
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

let MENUS = [];
let ALL_RES = [];
let HOLIDAYS = [];

let baseDate = new Date();

// ▼ 日付を「2025-12-05（金）」形式に統一（あなたの指定）
function formatDateFull(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const youbi = ["日","月","火","水","木","金","土"][d.getDay()];
    return `${y}-${m}-${day}（${youbi}）`;
}

// ▼ YYYY-MM-DD
function formatDate(d) {
    return d.toISOString().split("T")[0];
}

// ▼ API 共通
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

    ALL_RES = result.reservations || [];
    HOLIDAYS = result.holidays || [];
    MENUS = result.menus || [];

    loginBox.style.display = "none";
    dayNavi.style.display = "flex";

    render3Days();
};

// ==============================
// ▼ ログアウト（ログイン画面に戻す）
// ==============================
logoutBtn.onclick = () => {
    dayNavi.style.display = "none";
    daysWrapper.innerHTML = "";
    loginBox.style.display = "block";
};


// ==============================
// ▼ 3日分を表示
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

        // ▼ 日付タイトル（＋ボタン右側配置）
        const title = document.createElement("div");
        title.className = "date-title";
        title.innerHTML = formatDateFull(dateObj);

        const plus = document.createElement("div");
        plus.className = "plus-btn";
        plus.textContent = "＋";
        plus.onclick = () => openAddPopup(dayStr);

        title.appendChild(plus); // ← 横に配置
        col.appendChild(title);

        // ▼ 予約一覧（元コードのまま復元）
        ALL_RES.filter(r => r.date === dayStr).forEach(r => {
            const box = document.createElement("div");
            box.style.border = "1px solid #ccc";
            box.style.padding = "10px";
            box.style.marginBottom = "8px";
            box.style.borderRadius = "6px";
            box.style.background = "#fff";
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
// ▼ 日付移動（左右ボタン）
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
// ▼ 予約追加ポップアップ（完全復元）
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
    fillTimes();

    bg.style.display = "flex";

    document.getElementById("p-close").onclick = () =>
        bg.style.display = "none";

    document.getElementById("p-save").onclick = async () => {
        const name = document.getElementById("p-name").value.trim();
        const menu = document.getElementById("p-menu").value;
        const time = document.getElementById("p-time").value;

        await callAPI({
            mode: "add",
            password: document.getElementById("admin-pass").value.trim(),
            name,
            menu,
            date: dateStr,
            time
        });

        // ▼ ★重要：reload を使わない（ログアウト問題修正）
        const res = await callAPI({
            mode: "list",
            password: document.getElementById("admin-pass").value.trim()
        });
        ALL_RES = res.reservations;

        bg.style.display = "none";
        render3Days();
    };
}


// ==============================
// ▼ メニュー一覧（完全復元）
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
// ▼ 時間一覧（元コードのまま復元）
// ==============================
function fillTimes(selected = "") {
    const sel = document.getElementById("p-time");
    sel.innerHTML = "";

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
        if (selected === t) op.selected = true;
        sel.appendChild(op);
    });
}
