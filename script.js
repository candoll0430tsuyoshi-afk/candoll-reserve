// ===== 日付自動生成（曜日付き 修正版） =====
// ※ 空欄 option が最初に1つだけ必ず入るようにする
const dateSelect = document.getElementById("date");

// ★ index.html 側で日付生成しているので script.js では重複生成しない
// （日付が二重に書き換わり選択不可になるため）(option);
}

// ===== メニュー複製（追加ボタン対応） =====
const menuContainer = document.getElementById('menuContainer');
const addMenuButton = document.getElementById('addMenu');

addMenuButton.addEventListener('click', function(){
    const selects = menuContainer.querySelectorAll('.menu-select');
    if(selects.length < 4){
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

form.addEventListener('submit', function(e){
    e.preventDefault();

    const name = document.getElementById('name').value;
    const menus = Array.from(menuContainer.querySelectorAll('.menu-select'))
                        .map(s => s.value)
                        .filter(v => v !== '');

    const date = dateSelect.value;
    const time = document.getElementById('time').value;

    confirmText.innerHTML = `
        お名前：${name}<br>
        メニュー：${menus.join(', ')}<br>
        日付：${date}<br>
        時間：${time}
    `;

    form.style.display = "none";
    confirmScreen.style.display = "block";
});

cancelBtn.addEventListener('click', function(){
    confirmScreen.style.display = "none";
    form.style.display = "block";
});

okBtn.addEventListener('click', function(){
    alert("予約を受付ました。\nありがとうございます。");
    // 本番は LINE または Google Sheets に送信処理を書く
});
