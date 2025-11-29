// ===== Supabase 初期化 =====
const supabaseUrl = "https://bcahztzetpfuklipjmxx.supabase.co";
const supabaseKey = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ===== メニュー所要時間（単品＋セット） =====
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

const greeting = document.getElementById("greeting");

// ===== メニュー追加 =====
const menuContainer = document.getElementById("menuContainer");
const addMenuButton = document.getElementById("addMenu");

addMenuButton.addEventListener("click", function () {
  const selects = menuContainer.querySelectorAll(".menu-select");
  if (selects.length < 4) {
    const newSelect = selects[0].cloneNode(true);
    newSelect.value = "";
    menuContainer.appendChild(newSelect);
  }
});

// ===== 所要時間計算 =====
function calcTotalMinutes(selectedMenus) {
  return selectedMenus.map(m => MENU_DATA[m] || 0).reduce((a,b)=>a+b,0);
}

// ===== 時間処理 =====
function addMinutesToTime(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const start = new Date(2000,0,1,h,m);
  const end = new Date(start.getTime() + minutes*60000);
  return `${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`;
}

function isOverlap(startA,endA,startB,endB){
  return startA < endB && startB < endA;
}

// ===== 重複チェック =====
async function checkDuplicateFull(date, start, end){
  const {data, error} = await supabaseClient
    .from("reservations")
    .select("time,end_time")
    .eq("date",date);

  if(error) return true;

  for(const r of data){
    if(isOverlap(start,end,r.time,r.end_time)) return true;
  }
  return false;
}

// ===== 時間グレーアウト =====
document.getElementById("date").addEventListener("change", updateTimeOptions);

async function updateTimeOptions(){
  const date = document.getElementById("date").value;
  const timeSelect = document.getElementById("time");

  Array.from(timeSelect.options).forEach(o=>{
    o.disabled = false;
    o.style.color = "#000";
  });

  if(!date) return;

  const menus = Array.from(menuContainer.querySelectorAll(".menu-select"))
    .map(s=>s.value)
    .filter(v=>v!=="");
  const required = calcTotalMinutes(menus);

  const {data} = await supabaseClient
    .from("reservations")
    .select("time,end_time")
    .eq("date",date);

  const reserved = data.map(r=>({start:r.time,end:r.end_time}));

  const closeTime = "19:00";

  Array.from(timeSelect.options).forEach(o=>{
    if(!o.value) return;

    const optionStart = o.value;
    const optionEnd = addMinutesToTime(o.value, required);

    // ★ 営業終了チェック
    if(optionEnd > closeTime){
      o.disabled = true;
      o.style.color = "#aaa";
      return;
    }

    // ★ 30分重複チェック
    const halfEnd = addMinutesToTime(o.value,30);
    reserved.forEach(r=>{
      if(isOverlap(optionStart,halfEnd,r.start,r.end)){
        o.disabled = true;
        o.style.color = "#aaa";
      }
    });
  });
}

// ===== フォーム送信（確認画面へ） =====
const form = document.getElementById("reserveForm");
const confirmScreen = document.getElementById("confirm-screen");
const confirmText = document.getElementById("confirm-text");
const cancelBtn = document.getElementById("cancelBtn");
const okBtn = document.getElementById("okBtn");

form.addEventListener("submit", async function(e){
  e.preventDefault();

  const name = document.getElementById("name").value;
  const menus = Array.from(menuContainer.querySelectorAll(".menu-select"))
    .map(s=>s.value)
    .filter(v=>v!=="");
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;

  if(!name || menus.length===0 || !date || !time){
    alert("未入力があります");
    return;
  }

  const required = calcTotalMinutes(menus);
  const end_time = addMinutesToTime(time, required);

  const dup = await checkDuplicateFull(date,time,end_time);
  if(dup){
    alert("この時間帯は予約があります");
    return;
  }

  if(greeting) greeting.style.display = "none";

  confirmText.innerHTML =
    `お名前：${name}<br>メニュー：${menus.join(", ")}<br>日付：${date}<br>時間：${time} 〜 ${end_time}`;

  form.style.display = "none";
  confirmScreen.style.display = "block";
});

// ===== 戻る =====
cancelBtn.addEventListener("click",function(){
  confirmScreen.style.display = "none";
  form.style.display = "block";
  if(greeting) greeting.style.display = "block";
});

// ===== 確定（DB保存＋LINE通知） =====
okBtn.addEventListener("click", async function(){

  const name = document.getElementById("name").value;
  const menus = Array.from(menuContainer.querySelectorAll(".menu-select"))
    .map(s=>s.value)
    .filter(v=>v!=="");
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;

  const required = calcTotalMinutes(menus);
  const end_time = addMinutesToTime(time, required);

  const {error} = await supabaseClient.from("reservations")
    .insert([{name,menus:menus.join(", "),date,time,end_time}]);

  if(error){
    alert("予約保存エラー");
    return;
  }

  // ========= LINE 通知 =========
  try{
    await fetch("https://bcahztzetpfuklipjmxx.functions.supabase.co/dynamic-service",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name,menus:menus.join(", "),date,time})
    });
  }catch(e){
    console.error("LINE通知エラー:", e);
  }

  confirmScreen.style.display = "none";
  showCompleteScreen();
});

// ===== 完了画面 =====
function showCompleteScreen(){
  const old = document.getElementById("complete-screen");
  if(old) old.remove();

  if(greeting) greeting.style.display = "none";

  const div = document.createElement("div");
  div.id = "complete-screen";
  div.style.padding = "20px";
  div.innerHTML=`
    <h2>予約を受付ました。</h2>
    <p>ありがとうございます。</p>
    <button id="closeBtn"
      style="padding:15px 25px;font-size:18px;border-radius:8px;background:#000;color:#fff;border:none;">
      閉じる
    </button>
  `;
  document.querySelector(".container").appendChild(div);

  // ★ 完全安定版「閉じる」
  document.getElementById("closeBtn").addEventListener("click", function(){

    // LINE(LIFF)
    if(window.liff && typeof liff.closeWindow === "function"){
      try{
        liff.closeWindow();
        return;
      }catch(_){}
    }

    // 戻れる履歴がある
    if(window.history.length > 1){
      window.history.back();
      return;
    }

    // 戻れない → トップへ
    window.location.href =
      "https://candoll0430tsuyoshi-afk.github.io/candoll-reserve/";
  });
}
