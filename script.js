// ===== Supabase 初期化 =====
const supabaseUrl = "https://bcahztzetpfuklipjmxx.supabase.co";
const supabaseKey = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ===== メニュー所要時間 =====
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

// ★ A：メニュー変更のたびに updateTimeOptions() を動かす
function attachMenuUpdate() {
  const selects = menuContainer.querySelectorAll(".menu-select");
  selects.forEach(sel => {
    sel.addEventListener("change", () => {
      updateTimeOptions();
    });
  });
}

// 初期化
attachMenuUpdate();

addMenuButton.addEventListener("click", function () {
  const selects = menuContainer.querySelectorAll(".menu-select");
  if (selects.length < 4) {
    const newSelect = selects[0].cloneNode(true);
    newSelect.value = "";
    menuContainer.appendChild(newSelect);
    attachMenuUpdate(); // ★追加selectにも反映
  }
});

// ===== 所要時間計算 =====
function calcTotalMinutes(selectedMenus) {
  return selectedMenus.map(m => MENU_DATA[m] || 0).reduce((a,b)=>a+b,0);
}

// ===== 時刻変換 =====
function addMinutesToTime(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const start = new Date(2000,0,1,h,m);
  const end = new Date(start.getTime() + minutes*60000);
  return `${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`;
}

// ===== ★ B：絶対にズレない時刻比較 =====
function toMinutes(t){
  const [h,m] = t.split(":").map(Number);
  return h*60 + m;
}

function isOverlap(startA, endA, startB, endB) {
  const Astart = toMinutes(startA);
  const Aend   = toMinutes(endA);
  const Bstart = toMinutes(startB);
  const Bend   = toMinutes(endB);
  return Astart < Bend && Bstart < Aend;
}

// ===== 重複チェック =====
async function checkDuplicateFull(date, start, end){
  const {data, error} = await supabaseClient
    .from("reservations")
    .select("time,end_time")
    .eq("date",date);

  if(error) return true;

  for(const r of data){
    if(isOverlap(start,end,r.time,r.end_time)){
      return true;
    }
  }
  return false;
}

// ===== 時間グレーアウト（完全同期版） =====
document.getElementById("date").addEventListener("change", updateTimeOptions);

async function updateTimeOptions(){
  const date = document.getElementById("date").value;
  const timeSelect = document.getElementById("time");

  Array.from(timeSelect.options).forEach(o=>{
    o.disabled = false;
    o.style.color = "#000";
  });

  if(!date) return;

  // 現在のメニュー時間で再計算
  const menus = Array.from(menuContainer.querySelectorAll(".menu-select"))
    .map(s=>s.value)
    .filter(v=>v!=="");

  const required = calcTotalMinutes(menus);
  const closeTime = "19:00";

  const {data} = await supabaseClient
    .from("reservations")
    .select("time,end_time")
    .eq("date",date);

  const reserved = data.map(r=>({
    start: r.time.trim(),
    end:   r.end_time.trim()
  }));

  Array.from(timeSelect.options).forEach(o=>{
    if(!o.value) return;

    const start = o.value.trim();
    const end   = addMinutesToTime(start, required);

    // 営業終了チェック
    if(end > closeTime){
      o.disabled = true;
      o.style.color = "#aaa";
      return;
    }

    // 完全一致の重複判定
    for(const r of reserved){
      if(isOverlap(start,end,r.start,r.end)){
        o.disabled = true;
        o.style.color = "#aaa";
        return;
      }
    }
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

// ===== 確定（保存＋通知） =====
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

  // LINE通知
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
      style="padding:15px 25px;font-size:18px;border-radius:8px;background:#000;
             color:#fff;border:none;">
      閉じる
    </button>
  `;
  document.querySelector(".container").appendChild(div);

  document.getElementById("closeBtn").addEventListener("click", function(){

    if(window.liff && typeof liff.closeWindow === "function"){
      try{
        liff.closeWindow();
        return;
      }catch(_){}
    }

    if(window.history.length > 1){
      window.history.back();
      return;
    }

    window.location.href =
      "https://candoll0430tsuyoshi-afk.github.io/candoll-reserve/";
  });
}
