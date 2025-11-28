// ===== Supabase 初期化 =====
const supabaseUrl = "https://bcahztezptfuklipjmxx.supabase.co";
const supabaseKey = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ"; // supabase → Project settings → API → anon public
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

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

// ===== 予約重複チェック =====
async function checkDuplicate(date, time) {
    const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('date', date)
        .eq('time', time);

    if (error) {
        console.error('Supabase エラー:', error);
        return true; // エラー時は予約不可扱い
    }

    return data.length > 0;
}

// ===== 確認画面 =====
const form = document.getElementById('reserveForm');
const confirmScreen = document.getElementById('confirm-screen');
const confirmText = document.getElementById('confirm-text');
const okBtn = document.getElementById('okBtn');
const cancelBtn = document.getElementById('cancelBtn');

form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const menus = Array.from(menuContainer.querySelectorAll('.menu-select'))
        .map(s => s.value)
        .filter(v => v !== "");

    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;

    // --- 入力チェック ---
    if (!name || menus.length === 0 || !date || !time) {
        alert("未入力の項目があります。");
        return;
    }

    // --- 予約重複チェック ---
    const duplicated = await checkDuplicate(date, time);
    if (duplicated) {
        alert("⚠ この時間はすでに予約があります。\n別の時間を選んでください。");
        return;
    }

    // --- 確認画面に表示 ---
    confirmText.innerHTML = `
        お名前：${name}<br>
        メニュー：${menus.join(', ')}<br>
        日付：${date}<br>
        時間：${time}
    `;

    form.style.display = "none";
    confirmScreen.style.display = "block";
});

// キャンセルボタン → フォームに戻る
cancelBtn.addEventListener('click', function () {
    confirmScreen.style.display = "none";
    form.style.display = "block";
});

// ===== OKボタン（予約確定） =====
okBtn.addEventListener('click', async function () {
    const name = document.getElementById('name').value;
    const menus = Array.from(menuContainer.querySelectorAll('.menu-select'))
        .map(s => s.value)
        .filter(v => v !== "");
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;

    // --- ① Supabase に予約保存 ---
    const { data, error } = await supabase
        .from('reservations')
        .insert([{ name, menus: menus.join(', '), date, time }]);

    if (error) {
        console.error("Supabase 保存エラー:", error);
        alert("予約の保存に失敗しました。\n時間をおいて再度お試しください。");
        return;
    }

    // --- ② LINE通知（Edge Function 呼び出し） ---
    try {
        await fetch("https://bcahztezptfuklipjmxx.supabase.co/functions/v1/send_line_notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name,
                menus: menus.join(', '),
                date,
                time
            })
        });
    } catch (e) {
        console.error("LINE通知エラー:", e);
        // 通知失敗しても予約自体は成功しているので続行
    }

    // --- ③ 完了画面へ ---
    confirmScreen.style.display = "none";
    showCompleteScreen();
});

// ===== 完了画面 =====
function showCompleteScreen() {
    const old = document.getElementById("complete-screen");
    if (old) old.remove();

    const div = document.createElement("div");
    div.id = "complete-screen";
    div.style.padding = "20px";

    div.innerHTML = `
        <h2>予約を受付ました。</h2>
        <p>ありがとうございます。</p>
        <button id="closeBtn" style="padding:15px 25px; font-size:18px; border-radius:8px; background:#000; color:#fff; border:none;">閉じる</button>
    `;

    document.querySelector('.container').appendChild(div);

    document.getElementById("closeBtn").addEventListener('click', function(){
        if (window.liff) {
            try {
                liff.closeWindow();
                return;
            } catch(e){}
        }

        if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
            window.location.href = "about:blank";
            return;
        }

        window.history.back();
    });
}
