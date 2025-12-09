// ==============================
// Candoll 管理画面 admin.js
// 基準版 + 予約追加/編集/削除 修正済
// ==============================

const API_URL =
  "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

// ------------------------------
// DOM
// ------------------------------
const loginBox   = document.getElementById("login-box");
const loginBtn   = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const passInput  = document.getElementById("admin-pass");

const dayNavi    = document.getElementById("day-navi");
const navPrev    = document.getElementById("nav-prev");
const navNext    = document.getElementById("nav-next");
const navCurrent = document.getElementById("nav-current");

const daysWrap   = document.getElementById("days-wrapper");

const menuBtn    = document.getElementById("menu-btn");
const menuBox    = document.getElementById("menu-box");
const mLogout    = document.getElementById("m-logout");

const popupBg    = document.getElementById("popup-bg");
const popupBox   = document.getElementById("popup-box");

// ------------------------------
// State
// ------------------------------
let ADMIN_PASS = "";
let baseDate = new Date();

let RESERVATIONS = [];
let MENUS = [];

// ------------------------------
// 初期非表示
// ------------------------------
dayNavi.style.display = "none";
menuBtn.style.display = "none";

// ------------------------------
// 時間枠（30分）
// ------------------------------
const TIMES = [];
for (let h = 10; h <= 18; h++) {
  TIMES.push(`${String(h).padStart(2, "0")}:00`);
  TIMES.push(`${String(h).padStart(2, "0")}:30`);
}
TIMES.push("19:00");

// ------------------------------
// util
// ------------------------------
const WEEK = ["日","月","火","水","木","金","土"];

function fmtDate(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fmtLabel(d){
  return `${fmtDate(d)}（${WEEK[d.getDay()]}）`;
}
function toMin(t){
  const [h,m] = t.split(":").map(Number);
  return h*60+m;
}
function addMin(time, minutes){
  const [h,m] = time.split(":").map(Number);
  const d = new Date(2000,0,1,h,m);
  d.setMinutes(d.getMinutes()+minutes);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function menuDuration(menu){
  const m = MENUS.find(x => x.name === menu);
  return m ? Number(m.duration || 0) : 0;
}
function hasConflict({date,start,end,ignoreId}){
  return RESERVATIONS.some(r=>{
    if(r.date !== date) return false;
    if(ignoreId && r.id === ignoreId) return false;
    if(!r.end_time) return false;
    return toMin(start) < toMin(r.end_time) &&
           toMin(r.time)  < toMin(end);
  });
}

// ------------------------------
// API（★エラー可視化）
// ------------------------------
async function callAPI(body){
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      password: ADMIN_PASS
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    alert("API Error:\n" + txt);
    throw new Error(txt);
  }
  return res.json();
}

// ------------------------------
// Login
// ------------------------------
loginBtn.onclick = async () => {
  ADMIN_PASS = passInput.value.trim();
  loginError.style.display = "none";

  try {
    const res = await callAPI({ mode: "list" });
    RESERVATIONS = res.reservations || [];
    MENUS = res.menus || [];

    loginBox.style.display = "none";
    dayNavi.style.display = "flex";
    menuBtn.style.display = "block";

    render();
  } catch (e) {
    loginError.style.display = "block";
  }
};

// ------------------------------
// Menu
// ------------------------------
menuBtn.onclick = (e)=>{
  e.stopPropagation();
  menuBox.style.display =
    menuBox.style.display === "block" ? "none" : "block";
};
document.addEventListener("click",()=>{
  menuBox.style.display="none";
});
mLogout.onclick = ()=>{
  location.reload();
};

// ------------------------------
// Date nav
// ------------------------------
navPrev.onclick = ()=>{
  baseDate.setDate(baseDate.getDate()-1);
  render();
};
navNext.onclick = ()=>{
  baseDate.setDate(baseDate.getDate()+1);
  render();
};

// ------------------------------
// Render
// ------------------------------
async function render(){
  navCurrent.textContent = fmtLabel(baseDate);
  daysWrap.innerHTML = "";

  const res = await callAPI({ mode: "list" });
  RESERVATIONS = res.reservations || [];
  MENUS = res.menus || [];

  for(let i=0;i<3;i++){
    const d = new Date(baseDate);
    d.setDate(d.getDate()+i);
    renderDay(d);
  }
}

function renderDay(dateObj){
  const date = fmtDate(dateObj);

  const col = document.createElement("div");
  col.className = "day-column";

  const title = document.createElement("div");
  title.className = "date-title";
  title.textContent = fmtLabel(dateObj);
  col.appendChild(title);

  TIMES.slice(0,-1).forEach(t=>{
    const r = RESERVATIONS.find(x =>
      x.date === date && x.time === t
    );

    const div = document.createElement("div");
    div.style.padding = "6px";
    div.style.borderBottom = "1px solid #ddd";
    div.style.cursor = "pointer";

    if(r){
      const menuText = r.menu || r.menus || ""; // ★両対応
      div.style.background = "#fdd";
      div.textContent = `${t} ${r.name} ${menuText}`;
      div.onclick = ()=>openEdit(r);
    }else{
      div.style.background = "#dfd";
      div.textContent = `${t} 空き`;
      div.onclick = ()=>openAdd({date,time:t});
    }

    col.appendChild(div);
  });

  daysWrap.appendChild(col);
}

// ------------------------------
// Add
// ------------------------------
function openAdd({date,time}){
  popupBox.innerHTML = `
    <h3>予約追加</h3>
    <p>${date}</p>
    <input id="a-name" placeholder="お名前">
    <select id="a-time">${TIMES.map(t=>`<option ${t===time?"selected":""}>${t}</option>`).join("")}</select>
    <select id="a-menu">
      <option value="">メニュー</option>
      ${MENUS.map(m=>`<option>${m.name}</option>`).join("")}
    </select>
    <button id="a-save">追加</button>
    <button id="a-cancel" style="background:#aaa">キャンセル</button>
  `;
  popupBg.style.display = "flex";

  document.getElementById("a-cancel").onclick =
    ()=>popupBg.style.display="none";

  document.getElementById("a-save").onclick = async ()=>{
    const name = document.getElementById("a-name").value.trim();
    const t    = document.getElementById("a-time").value;
    const m    = document.getElementById("a-menu").value;

    if(!name || !m){
      alert("未入力があります");
      return;
    }

    const end = addMin(t, menuDuration(m));
    if(hasConflict({date,start:t,end})){
      alert("この時間帯は予約があります");
      return;
    }

    await callAPI({ mode:"add", name, menu:m, date, time:t, end_time:end });
    popupBg.style.display="none";
    render();
  };
}

// ------------------------------
// Edit
// ------------------------------
function openEdit(r){
  const curMenu = r.menu || r.menus || "";

  popupBox.innerHTML = `
    <h3>予約変更</h3>
    <p>${r.date}</p>
    <input id="e-name" value="${r.name}">
    <select id="e-time">${TIMES.map(t=>`<option ${t===r.time?"selected":""}>${t}</option>`).join("")}</select>
    <select id="e-menu">${MENUS.map(m=>`<option ${m.name===curMenu?"selected":""}>${m.name}</option>`).join("")}</select>
    <button id="e-save">変更</button>
    <button id="e-del" style="background:#c00">削除</button>
    <button id="e-close" style="background:#aaa">閉じる</button>
  `;
  popupBg.style.display = "flex";

  document.getElementById("e-close").onclick =
    ()=>popupBg.style.display="none";

  document.getElementById("e-save").onclick = async ()=>{
    const name = document.getElementById("e-name").value.trim();
    const t    = document.getElementById("e-time").value;
    const m    = document.getElementById("e-menu").value;

    const end = addMin(t, menuDuration(m));
    if(hasConflict({date:r.date,start:t,end,ignoreId:r.id})){
      alert("時間が重複します");
      return;
    }

    await callAPI({
      mode:"edit",
      id:r.id,
      name,
      menu:m,
      date:r.date,
      time:t,
      end_time:end
    });

    popupBg.style.display="none";
    render();
  };

  document.getElementById("e-del").onclick = async ()=>{
    if(!confirm("削除しますか？")) return;
    await callAPI({ mode:"delete", id:r.id });
    popupBg.style.display="none";
    render();
  };
}
