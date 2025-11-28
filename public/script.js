// ===== Supabase 初期化 =====
const supabaseUrl = "https://bcahztzetpfuklipjmxx.supabase.co";
const supabaseKey = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// greeting（挨拶文）
const greeting = document.getElementById("greeting");

// ===== メニュー追加 =====
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

// ===== 重複チェック =====
async function checkDuplicate(date, time) {
    const { data, error } = await supabaseClient
        .from('reservations')
        .select('*')
        .eq('date', date)
        .eq('time', time);

    if (error) return true;
    return data.length > 0;
}

// ===== 時間グレーアウト =====
document.getElementById("date").addEventListener("change", updateTimeOptions);

async function updateTimeOptions() {
    const date = document.getElementById("date").value;
    const timeSelect = document.getElementById("time");

    Array.from(timeSelect.options).forEach(o => {
        o.disabled = false;
        o.style.color = "#000";
    });

    if (!date) return;

    const { data } = await supabaseClient
        .from('reservations')
        .select('time')
        .eq('date', date);

    const reserved = data.map(r => r.time);

    Array.from(timeSelect.options).forEach(o => {
        if (reserved.includes(o.value)) {
            o.disabled = true;
            o.style.color = "#aaa";
        }
    });
}

// ===== 確認画面 =====
const form = document.getElementById('reserveForm');
const confirmScreen = document.getElementById('confirm-screen');
const confirmText = document.getElementById('confirm-text');
const cancelBtn = document.getElementById('cancelBtn');
const okBtn = document.getElementById('okBtn');

form.addEventListener('submit', async function(e){
    e.preventDefault();

    const name = document.getElementById('name').value;
    const menus = Array.from(menuContainer.querySelectorAll('.menu-select'))
        .map(s => s.value).filter(v=>v!=="");
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;

    if(!name || menus.length===0 || !date || !time){
        alert("未入力があります");
        return;
    }

    const dup = await checkDuplicate(date,time);
    if(dup){
        alert("この時間は予約があります");
        return;
    }

    // ★ greeting を確実に消す（確認画面）
    if (greeting) greeting.style.display = "none";

    confirmText.innerHTML =
        `お名前：${name}<br>
         メニュー：${menus.join(', ')}<br>
         日付：${date}<br>
         時間：${time}`;

    form.style.display = "none";
    confirmScreen.style.display = "block";
});

// 戻るボタン
cancelBtn.addEventListener('click',function(){
    confirmScreen.style.display = "none";
    form.style.display = "block";

    // ★ greeting を復活
    if (greeting) greeting.style.display = "block";
});

// ===== OKボタン（予約確定） =====
okBtn.addEventListener('click', async function(){
    const name = document.getElementById('name').value;
    const menus = Array.from(menuContainer.querySelectorAll('.menu-select'))
        .map(s => s.value).filter(v=>v!=="");
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;

    const { error } = await supabaseClient
        .from('reservations')
        .insert([{ name, menus:menus.join(', '), date, time }]);

    if(error){
        alert("予約保存エラー");
        return;
    }

    try{
        await fetch("https://bcahztzetpfuklipjmxx.supabase.co/functions/v1/send_line_notify",{
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body:JSON.stringify({name,menus:menus.join(', '),date,time})
        });
    }catch(e){}

    confirmScreen.style.display = "none";
    showCompleteScreen();
});

// ===== 完了画面 =====
function showCompleteScreen(){
    const old = document.getElementById("complete-screen");
    if(old) old.remove();

    // ★ 完了画面でも greeting を確実に消す
    if (greeting) greeting.style.display = "none";

    const div = document.createElement("div");
    div.id = "complete-screen";
    div.style.padding = "20px";
    div.innerHTML = `
        <h2>予約を受付ました。</h2>
        <p>ありがとうございます。</p>
        <button id="closeBtn"
            style="padding:15px 25px;font-size:18px;border-radius:8px;background:#000;color:#fff;border:none;">
            閉じる
        </button>
    `;

    document.querySelector(".container").appendChild(div);

   document.getElementById("closeBtn").addEventListener("click", function(){

    // LIFF の場合は LIFF を閉じる（最優先）
    if (window.liff) {
        try { 
            liff.closeWindow(); 
            return; 
        } catch(e){}
    }

    // ★ iPhone Safari 対策（これが最も強力）
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);

    if (isIOS) {
        // iOSで確実に閉じるための強制パターン
        window.location.href = "about:blank";
        setTimeout(() => {
            window.close();
        }, 50);
        return;
    }

    // ★ Android & PC
    window.open("about:blank", "_self");
    window.close();
});
