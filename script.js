// === script.js 完全修正版 ===
// ※ index.html 側で日付生成しているため、ここでは日付を触らない！
//   （上書きすると選択がリセットされるため）

// ===== メニュー追加（追加ボタンでのみ増える） =====
const menuContainer = document.getElementById('menuContainer');
const addMenuButton = document.getElementById('addMenu');

addMenuButton.addEventListener('click', function () {
    const selects = menuContainer.querySelectorAll('.menu-select');
    if (selects.length < 4) {
        const newSelect = selects[0].cloneNode(true);
        newSelect.value = "";
        menuContainer.appendChild(newSelect);
    }
});

// ===== 確認画面（OK / キャンセル） =====
const form = document.getElementById('reserveForm');
const confirmScreen = document.getElementById('confirm-screen');
const confirmText = document.getElementById('confirm-text');
const okBtn = document.getElementById('okBtn');
const cancelBtn = document.getElementById('cancelBtn');

form.addEventListener('submit', function (e) {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const menus = Array.from(menuContainer.querySelectorAll('.menu-select'))
        .map(s => s.value)
        .filter(v => v !== "");

    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;

    // 入力チェック
    if (!name || menus.length === 0 || !date || !time) {
        // ▼ OK（→ 完了画面に進む）
confirmScreen.style.display = "none";
showCompleteScreen();
        return;
    }

    // 確認画面テキスト生成
    confirmText.innerHTML = `
        お名前：${name}<br>
        メニュー：${menus.join(', ')}<br>
        日付：${date}<br>
        時間：${time}
    `;

    // 確認画面を表示
    form.style.display = "none";
    confirmScreen.style.display = "block";
});

cancelBtn.addEventListener('click', function () {
    confirmScreen.style.display = "none";
    form.style.display = "block";
});

okBtn.addEventListener('click', function () {
    alert("予約を受付ました。
ありがとうございます。");
});

// === 完了画面生成（PC/iPhone 両対応） ===
function showCompleteScreen() {
    // 既存 complete-screen があれば削除
    const old = document.getElementById("complete-screen");
    if (old) old.remove();

    const div = document.createElement("div");
    div.id = "complete-screen";
    div.style.padding = "20px";

    // 完了メッセージ（ご予約内容は消す）
    div.innerHTML = `
        <h2>予約を受付ました。</h2>
        <p>ありがとうございます。</p>
        <button id="closeBtn" style="padding:15px 25px; font-size:18px; border-radius:8px; background:#000; color:#fff; border:none;">閉じる</button>
    `;

    document.querySelector('.container').appendChild(div);

    // ▼ 閉じる＝画面を閉じる（PC/iPhone 対応）
    document.getElementById("closeBtn").addEventListener('click', function(){
        if (window.liff) {
            // LIFF ならアプリ内ブラウザを閉じる
            try { liff.closeWindow(); return; } catch(e){}
        }
        // 通常ブラウザなら前の画面へ
        window.history.back();
    });
}

