// === script.js 最終版 ===
// ※ index.html 側で「日付の一覧」は作っているので、ここでは日付は触らない

// ===== メニュー追加（「＋ メニューを追加する」を押したときだけ増える） =====
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

// ===== 確認画面＆完了画面切り替え用 =====
const form = document.getElementById('reserveForm');
const confirmScreen = document.getElementById('confirm-screen');
const confirmText = document.getElementById('confirm-text');
const okBtn = document.getElementById('okBtn');
const cancelBtn = document.getElementById('cancelBtn');
const greeting = document.querySelector('.greeting');

let isConfirmMode = true; // true: 確認画面 / false: 完了画面

// フォーム送信 → ご予約内容の確認画面へ
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

    // ご予約内容を表示
    confirmText.innerHTML = `
        お名前：${name}<br>
        メニュー：${menus.join(', ')}<br>
        日付：${date}<br>
        時間：${time}
    `;

    // 見た目の調整
    const heading = confirmScreen.querySelector('h2');
    if (heading) heading.textContent = 'ご予約内容';
    okBtn.textContent = 'OK';
    cancelBtn.style.display = 'inline-block';

    // あいさつ文を隠す
    if (greeting) greeting.style.display = 'none';

    isConfirmMode = true;
    form.style.display = "none";
    confirmScreen.style.display = "block";
});

// キャンセル → フォームに戻る
cancelBtn.addEventListener('click', function () {
    confirmScreen.style.display = "none";
    form.style.display = "block";
    // あいさつ文を戻す
    if (greeting) greeting.style.display = 'block';
});

// OK ボタン
okBtn.addEventListener('click', function () {
    const heading = confirmScreen.querySelector('h2');

    if (isConfirmMode) {
        // ① ご予約内容 → ② 予約完了画面に切り替え

        // 見出しの「ご予約内容」を消す
        if (heading) heading.textContent = '';

        // メッセージを「予約完了」に変更
        confirmText.innerHTML = `
            予約を受付ました。<br>
            ありがとうございます。
        `;

        // ボタンは「閉じる」1つにする
        okBtn.textContent = '閉じる';
        cancelBtn.style.display = 'none';

        isConfirmMode = false;
    } else {
        // 完了画面で「閉じる」を押したとき → 画面を閉じる

        // LIFF 内ならウィンドウを閉じる
        try {
            if (window.liff) {
                liff.closeWindow();
                return;
            }
        } catch (e) {
            // liff が無い場合は無視
        }

        // 通常ブラウザ：前の画面に戻る（history が無ければタブを閉じる動きに近い）
        if (window.history.length > 1) {
            window.history.back();
        } else {
            // history がない場合はトップに飛ばすなどお好みで
            window.location.href = 'about:blank';
        }
    }
});
