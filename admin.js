// ==============================
// Candoll 管理画面 admin.js（完全版）
// 予約一覧 + 休日 + メニュー + 予約追加モーダル対応
// ==============================

const API_URL = "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

let reservations = [];
let holidays = [];
let menus = [];

let currentDate = new Date();
let ADMIN_PASS = "";

// ------------------------------
// ログイン
// ------------------------------
document.getElementById("login-btn").onclick = async () => {
    const pass = document.getElementById("admin-pass").value;
    ADMIN_PASS = pass;

    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "list", password: pass })
    });

    const json = await res.json();

    if (json.error) {
        document.getElementById("login-error").style.display = "block";
        return;
    }

    reservations = json.reservations || [];
    holidays = json.holidays || [];
    menus = json.menus || [];

    document.getElementById("login-box").style.display = "none";
    document.getElementById("date-nav").style.display = "block";

    loadData();
};

// ------------------------------
// 日付ナビ
// ------------------------------
document.getElementById("prevDay").onclick = () => {
    currentDate.setDate(currentDate.getDate() - 1);
    loadData();
};

document.getElementById("nextDay").onclick = () => {
    currentDate.setDate(currentDate.getDate() + 1);
    loadData();
};

// ------------------------------
// 予約表示（3日分）
// ------------------------------
function loadData() {
    const daysContainer = document.getElementById("days-container");
    daysContainer.innerHTML = "";

    const base = new Date(currentDate);
    document.getElementById("currentDay").textContent = formatYMD(base);

    for (let i = 0; i < 3; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        const ymd = formatYMD(d);

        const col = document.createElement("div");
        col.className = "day-column";

        const dateTitle = document.createElement("div");
        dateTitle.className = "date-title";

        dateTitle.innerHTML = `
            ${ymd}
            <button class="add-btn" data-date="${ymd}">＋</button>
        `;

        col.appendChild(dateTitle);

        const list = reservations.filter(r => r.date === ymd);

        list.forEach(r => {
            const item = document.createElement("div");
            item.className = "reserve-item";
            item.innerHTML = `
                <div class="time">${r.time}</div>
                <div class="menu">${r.menu}</div>
                <div class="name">${r.name}</div>
            `;
            col.appendChild(item);
        });

        daysContainer.appendChild(col);
    }

    bindAddButtons();
}

// ------------------------------
// ＋ボタン（予約追加）
// ------------------------------
function bindAddButtons() {
    document.querySelectorAll(".add-btn").forEach(btn => {
        btn.onclick = () => {
            const date = btn.dataset.date;
            window.selectedDateForAdd = date;

            // モーダル初期化
            document.getElementById("modal-name").value = "";
            setMenuOptions();
            setTimeOptions();

            document.getElementById("addModal").style.display = "flex";
        };
    });
}

// ------------------------------
// モーダル：メニューセット
// ------------------------------
function setMenuOptions() {
    const menuSelect = document.getElementById("modal-menu");
    menuSelect.innerHTML = "";

    menus.forEach(m => {
        const op = document.createElement("option");
        op.value = m.id;
        op.textContent = m.name;
        menuSelect.appendChild(op);
    });
}

// ------------------------------
// モーダル：時間セット
// ------------------------------
function setTimeOptions() {
    const timeSelect = document.getElementById("modal-time");
    timeSelect.innerHTML = "";

    const times = [];
    for (let h = 10; h <= 19; h++) {
        times.push(`${String(h).padStart(2, "0")}:00`);
        if (h !== 19) times.push(`${String(h).padStart(2, "0")}:30`);
    }

    times.forEach(t => {
        const op = document.createElement("option");
        op.value = t;
        op.textContent = t;
        timeSelect.appendChild(op);
    });
}

// ------------------------------
// モーダル：キャンセル
// ------------------------------
document.getElementById("modal-cancel").onclick = () => {
    document.getElementById("addModal").style.display = "none";
};

// ------------------------------
// モーダル：保存（予約追加）
// ------------------------------
document.getElementById("modal-save").onclick = async () => {
    const name = document.getElementById("modal-name").value;
    const menuId = Number(document.getElementById("modal-menu").value);
    const time = document.getElementById("modal-time").value;

    const menuObj = menus.find(m => m.id === menuId);

    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            mode: "add",
            password: ADMIN_PASS,
            name,
            menu: menuObj.name,
            date: window.selectedDateForAdd,
            time
        })
    });

    document.getElementById("addModal").style.display = "none";

    // 追加後データ更新
    const reload = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            mode: "list",
            password: ADMIN_PASS
        })
    });

    const json = await reload.json();
    reservations = json.reservations;
    holidays = json.holidays;
    menus = json.menus;

    loadData();
};

// ------------------------------
// 日付フォーマット
// ------------------------------
function formatYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const w = ["日","月","火","水","木","金","土"][date.getDay()];
    return `${y}-${m}-${d} (${w})`;
}
