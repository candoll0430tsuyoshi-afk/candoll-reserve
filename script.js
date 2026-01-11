// ===== グローバル設定 =====
let supabaseClient = null;
let runtime = "web"; 
let customerUserId = null;
let MENU_DATA = {};
let HOLIDAYS = [];
let OFF_TIMES = [];
let SPECIAL_OPENS = [];

// LINE LIFF 初期化
const miniappReady = (async () => {
  try {
    await liff.init({ liffId: "2008611644-EZd5nkl0" }); 
    if (liff.isInClient()) {
      runtime = "miniapp";
      if (!liff.isLoggedIn()) { liff.login(); return; }
      const profile = await liff.getProfile();
      customerUserId = profile.userId;
    }
  } catch (e) { console.error("LIFFエラー:", e); }
})();

// ===== 初期化処理 =====
document.addEventListener("DOMContentLoaded", () => {
  const supabaseUrl = "https://bcahztzetpfuklipjmxx.supabase.co";
  const supabaseKey = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";
  supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

  loadMenus();
  loadHolidays().then(updateDateOptions);

  // メニュー追加ボタン (あなたのスタイル設定を完全復元)
  document.getElementById("addMenu").onclick = () => {
    const container = document.getElementById("menuContainer");
    const firstWrapper = container.querySelector(".select-wrapper");
    if (firstWrapper) {
      const newWrapper = firstWrapper.cloneNode(true);
      const newSelect = newWrapper.querySelector("select");
      newSelect.value = ""; 
      newWrapper.style.animation = "fadeIn 0.3s ease"; // あなたのコード
      container.appendChild(newWrapper);
    }
  };

  // 予約フォーム送信
  document.getElementById("reserveForm").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.innerHTML = '<span class="loading"></span> 送信中...'; // あなたのコード
    btn.disabled = true;

    const name = document.getElementById("name").value;
    const date = document.getElementById("date").value;
    const time = document.getElementById("time").value;
    const selects = document.querySelectorAll(".select-wrapper select");
    const selectedMenus = Array.from(selects).map(s => s.value).filter(v => v);

    if (selectedMenus.length === 0) {
      alert("メニューを選択してください");
      btn.innerHTML = "予約を確定する";
      btn.disabled = false;
      return;
    }

    const { error } = await supabaseClient.from("reservations").insert([{
      name, date, time, 
      menu: selectedMenus.join(", "),
      customer_user_id: customerUserId
    }]);

    if (!error) {
      const msg = `【新規予約】\n${name}様\n日時：${date.replace(/-/g, "/")} ${time}\nメニュー：${selectedMenus.join(", ")}`;
      await fetch("https://bcahztzetpfuklipjmxx.functions.supabase.co/dynamic-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "reserve", name, date, time, customerUserId, customMessage: msg })
      });
      showSuccessScreen();
    } else {
      alert("予約に失敗しました");
      btn.innerHTML = "予約を確定する";
      btn.disabled = false;
    }
  };
});

// メニュー読み込み
async function loadMenus() {
  const { data, error } = await supabaseClient.from("menus").select("*");
  if (!error && data) {
    const selects = document.querySelectorAll(".select-wrapper select");
    selects.forEach(select => {
      select.innerHTML = '<option value="" disabled selected>メニューを選択してください</option>';
      data.forEach(m => {
        MENU_DATA[m.name] = m.duration || 30;
        const opt = document.createElement("option");
        opt.value = m.name;
        opt.textContent = `${m.name} (${m.price ? m.price.toLocaleString() : 0}円)`;
        select.appendChild(opt);
      });
    });
  }
}

// 休日読み込み
async function loadHolidays() {
  const [h, o, s] = await Promise.all([
    supabaseClient.from("holidays").select("date"),
    supabaseClient.from("off_times").select("date, time"),
    supabaseClient.from("special_open").select("date")
  ]);
  HOLIDAYS = (h.data || []).map(i => i.date);
  OFF_TIMES = o.data || [];
  SPECIAL_OPENS = (s.data || []).map(i => i.date);
}

// 日付選択肢 (月火定休ロジック)
function updateDateOptions() {
  const select = document.getElementById("date");
  if(!select) return;
  select.innerHTML = '<option value="" disabled selected>日付を選択してください</option>';
  const now = new Date();
  for (let i = 1; i <= 30; i++) {
    const d = new Date();
    d.setDate(now.getDate() + i);
    const ymd = d.toLocaleDateString('sv-SE');
    const dayIdx = d.getDay();
    const isRegularHoliday = (dayIdx === 1 || dayIdx === 2);
    const isSpecialOpen = SPECIAL_OPENS.includes(ymd);
    const isHoliday = HOLIDAYS.includes(ymd);

    if ((isRegularHoliday && !isSpecialOpen) || isHoliday) continue;

    const opt = document.createElement("option");
    opt.value = ymd;
    opt.textContent = d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });
    select.appendChild(opt);
  }
  select.onchange = updateTimeOptions;
}

// 時間選択肢
async function updateTimeOptions() {
  const date = document.getElementById("date").value;
  const select = document.getElementById("time");
  select.innerHTML = '<option value="" disabled selected>時間を選択してください</option>';
  
  const { data: resData } = await supabaseClient.from("reservations").select("time, menu").eq("date", date);
  
  for (let h = 10; h <= 18; h++) {
    for (let m of ["00", "30"]) {
      const t = `${String(h).padStart(2, '0')}:${m}`;
      const isOff = OFF_TIMES.some(ot => ot.date === date && ot.time === t);
      const isBooked = resData?.some(r => r.time === t);
      if (isOff || isBooked) continue;
      
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      select.appendChild(opt);
    }
  }
}

// 成功画面 (あなたのアニメーションCSSを完全復元)
function showSuccessScreen() {
  document.body.innerHTML = `
    <div style="text-align:center; padding:50px 20px;">
      <div class="success-animation">
        <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
        </svg>
      </div>
      <h2 style="color:#333;">予約が完了しました！</h2>
      <p style="color:#666;">公式LINEより通知をお送りしました。</p>
      <button id="closeBtn" style="margin-top:30px; padding:12px 30px; background:#4caf50; color:white; border:none; border-radius:25px;">閉じる</button>
    </div>
    <style>
      .checkmark__circle { stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 2; stroke-miterlimit: 10; stroke: #7ac142; fill: none; animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards; }
      .checkmark { width: 56px; height: 56px; border-radius: 50%; display: block; stroke-width: 2; stroke: #fff; stroke-miterlimit: 10; margin: 10% auto; box-shadow: inset 0px 0px 0px #7ac142; animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both; }
      .checkmark__check { transform-origin: 50% 50%; stroke-dasharray: 48; stroke-dashoffset: 48; animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards; }
      @keyframes stroke { 100% { stroke-dashoffset: 0; } }
      @keyframes scale { 0%, 100% { transform: none; } 50% { transform: scale3d(1.1, 1.1, 1); } }
      @keyframes fill { 100% { box-shadow: inset 0px 0px 0px 30px #7ac142; } }
    </style>
  `;
  document.getElementById("closeBtn").onclick = () => {
    if (window.liff && liff.isInClient()) liff.closeWindow();
    else window.location.href = "https://candoll.vercel.app/";
  };
}

// ===== キャンセル処理フロー (あなたのロジック + LINE通知の合体) =====
window.addEventListener("load", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'cancel') {
    document.getElementById("reserveForm").style.display = "none";
    document.querySelector(".greeting").style.display = "none";
    document.getElementById("cancel-screen").style.display = "block";

    await miniappReady; 
    if (!customerUserId) return;

    const { data } = await supabaseClient.from("reservations")
      .select("*")
      .eq("customer_user_id", customerUserId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const res = data[0];
      document.getElementById("cancel-info").innerHTML = `<b>お名前</b>：${res.name}<br><b>日時</b>：${res.date.replace(/-/g, "/")} ${res.time}`;
      
      document.getElementById("executeCancelBtn").onclick = async () => {
        const cancelMessage = `【予約キャンセル】\n${res.name} 様の予約がキャンセルされました。\n日時：${res.date.replace(/-/g, "/")} ${res.time}`;

        // 1. データベースから予約を削除
        const { error } = await supabaseClient.from("reservations").delete().eq("id", res.id);
        
        if (!error) {
          try {
            // 2. 通知を送信 (ここを新しく追加しました)
            await fetch("https://bcahztzetpfuklipjmxx.functions.supabase.co/dynamic-service", {
              method: "POST", 
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                mode: "cancel", 
                name: res.name,
                date: res.date,
                time: res.time,
                customerUserId: customerUserId,
                customMessage: cancelMessage 
              })
            });
          } catch (e) { console.error("通知エラー:", e); }

          alert("予約をキャンセルしました。");
          liff.closeWindow();
        } else {
          alert("キャンセルに失敗しました。");
        }
      };
    } else {
      document.getElementById("cancel-info").innerText = "有効な予約が見つかりませんでした。";
      document.getElementById("executeCancelBtn").style.display = "none";
    }
  }
});
