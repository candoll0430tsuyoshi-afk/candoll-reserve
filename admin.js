// ==============================
// Candoll 管理画面 admin.js
// 基準安定版 + 予約追加/編集対応
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
// 時間枠（30分）
// ------------------------------
const TIMES = [];
for (let h = 10; h <= 18; h++) {
  TIMES.push(`${String(h).padStart(2,"0")}:00`);
  TIMES.push(`${String(h).padStart(2,"0")}:30`);
}
TIMES.push("19:00");

// ------------------------------
// util
// ------------------------------
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function toMin(t){
  const [h,m] = t.split(":").map(Number);
  return h*60+m;
}

function addMin(time,min){
  const d = new Date(2000,0,1,...time.split(":").map(Number));
  d.setMinutes(d.getMinutes()+min);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function menuDuration(menu){
  const m = MENUS.find(x=>x.name===menu);
  return m ? Number(m.duration||0) : 0;
}

function hasConflict({date,start,end,ignoreId}){
  return RESERVATIONS.some(r=>{
    if(r.date!==date) return false;
    if(ignoreId && r.id===ignoreId) return false;
    return toMin(start) < toMin(r.end_time) && toMin(r.time) < toMin(end);
  });
}

// ------------------------------
// API
// ------------------------------
async function callAPI(body){
  const res = await fetch(API_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ ...body, password: ADMIN_PASS })
  });
  return res.json();
}

// ------------------------------
// Login
// ------------------------------
loginBtn.onclick = async ()=>{
  ADMIN_PASS = passInput.value.trim();
  loginError.style.display="none";

  const res = await callAPI({ mode:"list" });
  if(res.error){
    loginError.style.display="block";
    return;
  }

  RESERVATIONS = res.reservations || [];
  MENUS = res.menus || [];

  loginBox.style.display="none";
  dayNavi.style.display="flex";
  menuBtn.style.display="block";

  render();
};

// ------------------------------
// Menu
// ------------------------------
menuBtn.onclick = (e)=>{
  e.stopPropagation();
  menuBox.style.display = menuBox.style.display==="block"?"none":"block";
};

document.addEventListener("click",()=>{
  menuBox.style.display="none";
});

mLogout.onclick = ()=>{
  location.reload();
};

// ------------------------------
// Navi
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
  daysWrap.innerHTML="";
  navCurrent.textContent = fmtDate(baseDate);

  const res = await callAPI({ mode:"list" });
  RESERVATIONS = res.reservations || [];

  for(let i=0;i<3;i++){
    const d = new Date(baseDate);
    d.setDate(d.getDate()+i);
    renderDay(d);
  }
}

function renderDay(dateObj){
  const date = fmtDate(dateObj);
  const col = document.createElement("div");
  col.className="day-column";

  col.innerHTML = `
    <div class="date-title">${date}</div>
  `;

  TIMES.slice(0,-1).forEach(t=>{
    const r = RESERVATIONS.find(x=>x.date===date && x.time===t);
    const div = document.createElement("div");
    div.style.padding="6px";
    div.style.borderBottom="1px solid #ddd";
    div.style.cursor="pointer";

    if(r){
      div.style.background="#fdd";
      div.textContent = `${t} ${r.name} ${r.menu}`;
      div.onclick=()=>openEdit(r);
    }else{
      div.style.background="#dfd";
      div.textContent=`${t} 空き`;
      div.onclick=()=>openAdd({date,time:t});
    }

    col.appendChild(div);
  });

  daysWrap.appendChild(col);
}

// ------------------------------
// Add
// ------------------------------
function openAdd({date,time}){
  popupBox.innerHTML=`
    <h3>予約追加</h3>
    <p>${date}</p>
    <input id="a-name" placeholder="お名前">
    <select id="a-time">
      ${TIMES.map(t=>`<option ${t===time?"selected":""}>${t}</option>`).join("")}
    </select>
    <select id="a-menu">
      <option value="">メニュー</option>
      ${MENUS.map(m=>`<option>${m.name}</option>`).join("")}
    </select>
    <button id="a-save">追加</button>
    <button id="a-cancel" style="background:#aaa">キャンセル</button>
  `;
  popupBg.style.display="flex";

  document.getElementById("a-cancel").onclick=()=>popupBg.style.display="none";

  document.getElementById("a-save").onclick=async()=>{
    const name=document.getElementById("a-name").value.trim();
    const t=document.getElementById("a-time").value;
    const m=document.getElementById("a-menu").value;
    if(!name||!m) return alert("未入力");

    const end=addMin(t,menuDuration(m));
    if(hasConflict({date,start:t,end})) return alert("重複");

    await callAPI({mode:"add",name,menu:m,date,time:t,end_time:end});
    popupBg.style.display="none";
    render();
  };
}

// ------------------------------
// Edit
// ------------------------------
function openEdit(r){
  popupBox.innerHTML=`
    <h3>予約変更</h3>
    <p>${r.date}</p>
    <input id="e-name" value="${r.name}">
    <select id="e-time">
      ${TIMES.map(t=>`<option ${t===r.time?"selected":""}>${t}</option>`).join("")}
    </select>
    <select id="e-menu">
      ${MENUS.map(m=>`<option ${m.name===r.menu?"selected":""}>${m.name}</option>`).join("")}
    </select>
    <button id="e-save">変更</button>
    <button id="e-del" style="background:#c00">削除</button>
    <button id="e-close" style="background:#aaa">閉じる</button>
  `;
  popupBg.style.display="flex";

  document.getElementById("e-close").onclick=()=>popupBg.style.display="none";

  document.getElementById("e-save").onclick=async()=>{
    const name=document.getElementById("e-name").value.trim();
    const t=document.getElementById("e-time").value;
    const m=document.getElementById("e-menu").value;

    const end=addMin(t,menuDuration(m));
    if(hasConflict({date:r.date,start:t,end,ignoreId:r.id})) return alert("重複");

    await callAPI({mode:"edit",id:r.id,name,menu:m,date:r.date,time:t,end_time:end});
    popupBg.style.display="none";
    render();
  };

  document.getElementById("e-del").onclick=async()=>{
    if(!confirm("削除しますか"))return;
    await callAPI({mode:"delete",id:r.id});
    popupBg.style.display="none";
    render();
  };
}
