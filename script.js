// 日付自動生成（曜日付き）
const dateSelect = document.getElementById("date");
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

// メニュー複製（最大4つまで、選択必須なし）
const menuContainer = document.getElementById('menuContainer');
menuContainer.addEventListener('change', function(e){
    if(e.target.classList.contains('menu-select') && e.target.value !== ''){
        const selects = menuContainer.querySelectorAll('.menu-select');
        if(selects.length < 4){
            const newSelect = e.target.cloneNode(true);
            newSelect.value = '';
            newSelect.required = false;
            newSelect.classList.add('menu-select');
            menuContainer.appendChild(newSelect);
        }
    }
});

// フォーム送信
document.getElementById('reserveForm').addEventListener('submit', function(e){
    e.preventDefault();
    const menus = Array.from(menuContainer.querySelectorAll('.menu-select'))
                       .map(s => s.value)
                       .filter(v => v !== '');
    const date = dateSelect.value;
    const time = document.getElementById('time').value;
    alert(`予約内容:\nメニュー: ${menus.join(', ')}\n日付: ${date}\n時間: ${time}`);
});
