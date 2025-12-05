// ==============================
// Candoll 管理画面 admin.js 完全復旧版（ログイン前は日付ナビ非表示）
// ==============================

// ------ 設定 ------
const API_URL = "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

// ------ DOM 取得 ------
const loginBox = document.getElementById("login-box");
const dayNavi = document.getElementById("day-navi");
const navPrev = document.getElementById("nav-prev");
const navNext = document.getElementById("nav-next");
const navCurrent = document.getElementById("nav-current");
const daysWrapper = document.getElementById("days-wrapper");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");

// メニュー・休日のキャッシュ
let MENUS = [];
let HOLIDAYS = [];
let ALL_RES = [];

// 現在表示している日付
let baseDate = new Date();

// ===============
// 1. ログイン処理
// ===============
loginBtn.onclick = async () => {
    const pass = document.getElementById("admin-pass").value.trim();
    if (!pass) return;

    const res = await callAPI({ mode: "list", password: pass });

    if (res.error) {
        loginError.style.display = "block";
        return;
    }

    loginError.style.display = "none";

    // データ保持
    ALL_RES = res.reservations || [];
    HOLIDAYS = res.holidays || [];
    MENUS = res.menus || [];

    // UI 切り替え
    loginBox.style.display = "none";

    // ★ ログイン後にだけ日付ナビを表示（ここが今回の重要ポイント）
    dayNavi.style.display = "flex";

    render3Days();
};


// ===============
// 2. API 呼び出し
// ===============
async function callAPI(body) {
    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        return res.json();
    } catch (e) {
        console.error("API Error:", e);
        return { error: true };
    }
}


// ===============
// 3. 日付表示用
// ===============
function formatDate(d) {
    return d.toISOString().split("T")[0];
}

function getYoubi(d) {
    return ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
}


// ===============
// 4. 3日分のカラム表示
// ===============
function render3Days() {
    daysWrapper.innerHTML = "";

    const d0 = new Date(baseDate);
    const d1 = new Date(baseDate.getTime() + 86400000);
    const d2 = new Date(baseDate.getTime() + 86400000 * 2);

    navCurrent.textContent = `${formatDate(baseDate)} (${getYoubi(baseDate)})`;

    [d0, d1, d2].forEach(dateObj => {
        const dayStr = formatDate(dateObj);
        const youbi = getYoubi(dateObj);

        const col = document.createElement("div");
        col.className = "day-column";

        // 日付タイトル
        const title = document.createElement("div");
        title.className = "date-title";
        title.textContent = `${dayStr} (${youbi})`;
        col.appendChild(title);

        // ＋（予約追加）
        const plus = document.createElement("div");
        plus.textContent = "＋";
        plus.style.background = "#fff";
        plus.style.color = "#000";
        plus.style.fontSize = "26px";
        plus.style.width = "50px";
        plus.style.height = "50px";
        plus.style.borderRadius = "6px";
        plus.style.display = "flex";
        plus.style.alignItems = "center";
        plus.style.justifyContent = "center";
        plus.style.cursor = "pointer";
        plus.style.margin = "0 auto 15px";

        plus.onclick = () => openAddPopup(dayStr);
        col.appendChild(plus);

        // 予約一覧
        const list = ALL_RES.filter(r => r.date === dayStr);
        list.forEach(r => {
            const box = document.createElement("div");
            box.style.border = "1px solid #ccc";
            box.style.borderRadius = "6px";
            box.style.padding = "10px";
            box.style.marginBottom = "10px";
            box.style.cursor = "pointer";
            box.style.background = "#fff";

            box.innerHTML = `
                <div><b>${r.time}</b> 〜</div>
                <div>${r.name}</div>
                <div style="font-size:14px;color:#555;">${r.menu}</div>
            `;

            box.onclick = () => openEditPopup(r);
            col.appendChild(box);
        });

        daysWrapper.appendChild(col);
    });
}


// ===============
// 5. 日付移動
// ===============
navPrev.onclick = () => {
    baseDate = new Date(baseDate.getTime() - 86400000);
    render3Days();
};

navNext.onclick = () => {
    baseDate = new Date(baseDate.getTime() + 86400000);
    render3Days();
};


// =========================
// 6. 予約追加モーダル
// =========================
function openAddPopup(dateStr) {
    const popupBg = document.getElementById("popup-bg");
    const box = document.getElementById("popup-box");

    box.innerHTML = `
        <h3>予約追加</h3>
        <input id="p-name" placeholder="名前">
        <select id="p-menu"></select>
        <select id="p-time"></select>

        <button id="p-save">追加する</button>
        <button id="p-close">閉じる</button>
    `;

    fillMenus();
    fillTimes();

    popupBg.style.display = "flex";

    document.getElementById("p-close").onclick = () => {
        popupBg.style.display = "none";
    };

    document.getElementById("p-save").onclick = async () => {
        const name = document.getElementById("p-name").value.trim();
        const menu = document.getElementById("p-menu").value;
        const time = document.getElementById("p-time").value;

        await callAPI({
            mode: "add",
            password: document.getElementById("admin-pass").value,
            name, menu, date: dateStr, time,
            end_time: null
        });

        popupBg.style.display = "none";
        location.reload();
    };
}


// =========================
// 7. 予約編集モーダル
// =========================
function openEditPopup(r) {
    const popupBg = document.getElementById("popup-bg");
    const box = document.getElementById("popup-box");

    box.innerHTML = `
        <h3>予約変更</h3>
        <input id="p-name" value="${r.name}">
        <select id="p-menu"></select>
        <select id="p-time"></select>

        <button id="p-save">変更する</button>
        <button id="p-close">閉じる</button>
    `;

    fillMenus(r.menu);
    fillTimes(r.time);

    popupBg.style.display = "flex";

    document.getElementById("p-close").onclick = () => {
        popupBg.style.display = "none";
    };

    document.getElementById("p-save").onclick = async () => {
        const name = document.getElementById("p-name").value.trim();
        const menu = document.getElementById("p-menu").value;
        const time = document.getElementById("p-time").value;

        await callAPI({
            mode: "edit",
            password: document.getElementById("admin-pass").value,
            id: r.id, name, menu, date: r.date, time,
            end_time: null
        });

        popupBg.style.display = "none";
        location.reload();
    };
}


// =========================
// 8. メニュー一覧セット
// =========================
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


// =========================
// 9. 時間セット
// =========================
function fillTimes(selected = "") {
    const TIMES = [];
    for (let h = 10; h <= 18; h++) {
        TIMES.push(`${String(h).padStart(2,"0")}:00`);
        TIMES.push(`${String(h).padStart(2,"0")}:30`);
    }
    TIMES.push("19:00");

    const sel = document.getElementById("p-time");
    sel.innerHTML = "";

    TIMES.forEach(t => {
        const op = document.createElement("option");
        op.value = t;
        op.textContent = t;
        if (t === selected) op.selected = true;
        sel.appendChild(op);
    });
}
