// === script.js 完全修正版 ===
// ※ 日付は index.html 側で生成しているので、ここでは触らない

// ===== メニュー追加（追加ボタンでのみ増える）=====
const menuContainer = document.getElementById('menuContainer');
const addMenuButton = document.getElementById('addMenu');
const greeting = document.querySelector('.greeting');

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
        alert("入力されていない項目があります。");
        return;
    }

    // 確認画面テキスト生成
    confirmText.innerHTML = `
        お名前：${name}<br>
        メニュー：${menus.join(', ')}<br>
        日付：${date}<br>
        時間：${time}
    `;

    // 確認画面を表示（挨拶は消す）
    form.style.display = "none";
    if (greeting) greeting.style.display = "none";
    confirmScreen.style.display = "block";
});

cancelBtn.addEventListener('click', function () {
    // 確認画面を閉じてフォームに戻す（挨拶も戻す）
    confirmScreen.style.display = "none";
    form.style.display = "block";
    if (greeting) greeting.style.display = "block";
});

// 「閉じる」ボタン → 予約完了メッセージを表示してからウィンドウを閉じる
okBtn.addEventListener('click', function () {
    // 確認テキストを「受付完了」メッセージに変更
    confirmText.innerHTML = `予約を受付ました。<br>ありがとうございます。`;

    // ちょっとだけ見せてから閉じる（0.8秒くらい）
    setTimeout(() => {
        // LIFF 内なら LIFF を閉じる
        if (window.liff && typeof liff.closeWindow === 'function' && liff.isInClient()) {
            liff.closeWindow();
        } else {
            // 通常ブラウザの場合は window.close（効かない場合もある）
            window.close();
        }
    }, 800);
});
