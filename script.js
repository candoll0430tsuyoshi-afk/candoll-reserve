// ===== 日付自動生成（曜日付き 修正版） =====
// ※ 空欄 option が最初に1つだけ必ず入るようにする
const dateSelect = document.getElementById("date");

dateSelect.innerHTML = '<option value="">日付を選択</option>';

const daysOfWeek = ['日','月','火','水','木','金','土'];
for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);

    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const dow = daysOfWeek[d.getDay()];

    const option = document.createElement('option');
    option.value = `${y}-${m}-${day}`;
    option.textContent = `${y}/${m}/${day} (${dow})`;
    dateSelect.appendChild(option);
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
