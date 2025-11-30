// ===============================
// 管理画面 admin.js（完全版）
// ===============================

// ==== 設定 ====
const API_URL = "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";
const ADMIN_PASSWORD = "candoll2025"; // ログイン確認用（フロント側だけ）


// ==== DOM ====
const loginBox = document.getElementById("login-box");
const reserveList = document.getElementById("reserve-list");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const passInput = document.getElementById("admin-pass");


// ===============================
// ログイン処理
// ===============================
loginBtn.addEventListener("click", async () => {
    const pass = passInput.value.trim();
    if (!pass) return;

    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "list", password: pass })
    });

    if (!res.ok) {
        loginError.style.display = "block";
        return;
    }

    // 成功 → パスワード保存してログイン
    localStorage.setItem("candoll_admin_pass", pass);

    loginBox.style.display = "none";
    reserveList.style.display = "block";

    loadReservations();
});


// 最初に localStorage のパスで自動ログイン
const savedPass = localStorage.getItem("candoll_admin_pass");
if (savedPass) {
    loginBox.style.display = "none";
    reserveList.style.display = "block";
    loadReservations();
}


// ===============================
// 所要時間データ（script.js と完全一致）
// ===============================
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


// ===== 合計所要時間 =====
function calcMinutes(menus) {
    return menus.reduce((sum, m) => sum + (MENU_DATA[m] || 0), 0);
}


// ===== 終了時刻 =====
function addMinutes(start, minutes) {
    const [h, m] = start.split(":").map(Number);
    const d = new Date(2000, 0, 1, h, m);
    const end = new Date(d.getTime() + minutes * 60000);
    return `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
}


// ===============================
// 予約一覧取得
// ===============================
async function loadReservations() {

    reserveList.innerHTML = `
        <button id="addBtn" style="
            width:100%;padding:15px;font-size:18px;
            background:#000;color:#fff;border:none;border-radius:6px;
            margin-bottom:20px;
        ">＋ 新規予約を追加</button>
    `;

    const pass = localStorage.getItem("candoll_admin_pass");

    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "list", password: pass })
    });

    if (!res.ok) {
        reserveList.innerHTML = "<p>読み込みエラー</p>";
        return;
    }

    const json = await res.json();
    const data = json.data;

    // 日付ごとにグループ化
    let currentDate = "";
    for (const r of data) {

        if (currentDate !== r.date) {
            currentDate = r.date;
            reserveList.innerHTML += `
                <div class="date-title">${formatDate(currentDate)}</div>
            `;
        }

        reserveList.innerHTML += `
            <div class="reserve-item">
                <div class="time">${r.time}〜${r.end_time}</div>
                <div class="menu">${r.menus}</div>
                <div class="name">👤 ${r.name}</div>

                <div style="text-align:right;margin-top:5px;">
                    <span class="editBtn" data-id="${r.id}" style="font-size:22px;cursor:pointer;margin-right:10px;">✏️</span>
                    <span class="delBtn" data-id="${r.id}" style="font-size:22px;cursor:pointer;">🗑️</span>
                </div>
            </div>
        `;
    }

    // イベント付与
    document.getElementById("addBtn").addEventListener("click", () => openPopup("add"));
    document.querySelectorAll(".editBtn").forEach(btn =>
        btn.addEventListener("click", () => openPopup("edit", btn.dataset.id))
    );
    document.querySelectorAll(".delBtn").forEach(btn =>
        btn.addEventListener("click", () => deleteReservation(btn.dataset.id))
    );
}


// ===============================
// 削除
// ===============================
async function deleteReservation(id) {
    if (!confirm("本当に削除しますか？")) return;

    const pass = localStorage.getItem("candoll_admin_pass");

    await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "delete", password: pass, id })
    });

    loadReservations();
}


// ===============================
// 日付表示 2025-01-30 → 2025/01/30（木）
// ===============================
function formatDate(d) {
    const date = new Date(d);
    const w = ["日","月","火","水","木","金","土"][date.getDay()];
    return `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,"0")}/${String(date.getDate()).padStart(2,"0")}（${w}）`;
}


// ===============================
// ポップアップ（追加・編集 共通）
// ===============================
function openPopup(mode, editId = null) {

    // 追加 or 編集で初期値変更
    let title = "新規予約を追加";
    let btnLabel = "保存する";
    let init = { name: "", menus: [""], date: "", time: "" };

    if (mode === "edit") {
        title = "予約内容を編集";
        btnLabel = "更新する";

        // 編集対象を取得
        const item = document.querySelector(`[data-id="${editId}"]`).closest(".reserve-item");
        init.name = item.querySelector(".name").innerText.replace("👤 ","");
        init.menus = item.querySelector(".menu").innerText.split("＋");
        init.date = item.previousElementSibling?.innerText;
        init.time = item.querySelector(".time").innerText.split("〜")[0];
    }

    // === ポップアップ生成 ===
    const bg = document.createElement("div");
    bg.style = `
        position:fixed;top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.45);
        display:flex;justify-content:center;align-items:center;
        z-index:9999;
    `;

    const box = document.createElement("div");
    box.style = `
        width:85%;max-width:450px;
        background:#fff;border-radius:12px;
        padding:25px;box-shadow:0 4px 20px rgba(0,0,0,0.25);
        position:relative;
    `;

    box.innerHTML = `
        <div style="font-size:22px;font-weight:600;margin-bottom:15px;">
            ${title}
            <span id="closePop" style="float:right;font-size:26px;cursor:pointer;">×</span>
        </div>

        <label>お名前</label>
        <input id="popName" value="${init.name}" style="width:100%;padding:10px;font-size:17px;margin-bottom:15px;">

        <label>メニュー</label>
        <div id="popMenus"></div>
        <button id="addMenu" style="
            margin-top:10px;background:#eee;border:none;
            padding:10px;border-radius:6px;cursor:pointer;
        ">＋ メニューを追加</button>

        <label style="margin-top:20px;">日付</label>
        <input id="popDate" type="date" value="" style="width:100%;padding:10px;font-size:17px;">

        <label style="margin-top:20px;">時間</label>
        <input id="popTime" type="time" value="${init.time}" style="width:100%;padding:10px;font-size:17px;">

        <button id="saveBtn" style="
            width:100%;padding:14px;margin-top:25px;font-size:18px;
            background:#000;color:#fff;border:none;border-radius:8px;
        ">${btnLabel}</button>
    `;

    bg.appendChild(box);
    document.body.appendChild(bg);

    // × ボタン
    document.getElementById("closePop").onclick = () => bg.remove();



    // ===== メニュー複数UI ====

    const popMenus = document.getElementById("popMenus");

    function addMenuSelect(value = "") {
        const sel = document.createElement("select");
        sel.className = "menuSel";
        sel.style = "width:100%;padding:10px;font-size:17px;margin-bottom:10px;border-radius:6px;border:1px solid #ccc;";

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

        sel.value = value;
        popMenus.appendChild(sel);
    }

    // 初期メニューセット
    init.menus.forEach(m => addMenuSelect(m));
    document.getElementById("addMenu").onclick = () => addMenuSelect();


    // ===== 保存・更新 =====
    document.getElementById("saveBtn").onclick = async () => {

        const name = document.getElementById("popName").value.trim();
        const date = document.getElementById("popDate").value;
        const time = document.getElementById("popTime").value;
        const menus = [...document.querySelectorAll(".menuSel")]
            .map(s => s.value)
            .filter(v => v);

        if (!name || !date || !time || menus.length === 0) {
            alert("未入力があります");
            return;
        }

        const minutes = calcMinutes(menus);
        const end_time = addMinutes(time, minutes);

        const pass = localStorage.getItem("candoll_admin_pass");

        const body = {
            mode: mode === "add" ? "add" : "update",
            password: pass,
            name,
            menus: menus.join("＋"),
            date,
            time,
            end_time
        };

        if (mode === "edit") body.id = editId;

        await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        bg.remove();
        loadReservations();
    };

}
