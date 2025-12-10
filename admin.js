/* ==============================
   Candoll 管理画面 admin.js
   ★ 基準コード + 右上メニュー修正のみ
   ============================== */

const API_URL = "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

/* ---------- DOM ---------- */
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

/* ---------- STATE ---------- */
let ADMIN_PASS = localStorage.getItem("candoll_admin_pass") || "";
let BASE_DATE = new Date();

let RESERVATIONS = [];
let HOLIDAYS = [];
let MENUS = [];

/* ---------- 初期表示 ---------- */
dayNavi.style.display = "none";
menuBtn.style.display = "none";

/* ---------- 時間枠 ---------- */
const TIMES = [];
for (let h = 10; h <= 18; h++) {
  TIMES.push(`${String(h).padStart(2,"0")}:00`);
  TIMES.push(`${String(h).padStart(2,"0")}:30`);
}
TIMES.push("19:00");

/* ---------- util ---------- */
const WEEK = ["日","月","火","水","木","金","土"];
const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const fmtLabel = d => `${fmtDate(d)}（${WEEK[d.getDay()]}）`;
const toMin = t => { const [h,m]=t.split(":").map(Number); return h*60+m; };
const addMin = (t,m) => { const d=new Date(2000,0,1,...t.split(":")); d.setMinutes(d.getMinutes()+m); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
const menuDuration = menu => (MENUS.find(m=>m.name===menu)?.duration||0);

function hasConflict({date,start,end,ignoreId}){
  return RESERVATIONS.some(r=>{
    if(r.date!==date) return false;
    if(ignoreId && r.id===ignoreId) return false;
    if(!r.end_time) return false;
    return toMin(start)<toMin(r.end_time) && toMin(r.time)<toMin(end);
  });
}

/* ---------- API ---------- */
async function callAPI(body){
  const r = await fetch(API_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({...body,password:ADMIN_PASS})
  });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ---------- LOGIN ---------- */
loginBtn.onclick = async ()=>{
  ADMIN_PASS = passInput.value.trim();
  loginError.style.display="none";
  try{
    const res = await callAPI({mode:"list"});
    localStorage.setItem("candoll_admin_pass",ADMIN_PASS);
    RESERVATIONS=res.reservations||[];
    HOLIDAYS=res.holidays||[];
    MENUS=res.menus||[];
    loginBox.style.display="none";
    dayNavi.style.display="flex";
    menuBtn.style.display="block";
    render();
  }catch{
    loginError.style.display="block";
  }
};

window.addEventListener("DOMContentLoaded", async ()=>{
  if(!ADMIN_PASS) return;
  try{
    const res = await callAPI({mode:"list"});
    RESERVATIONS=res.reservations||[];
    HOLIDAYS=res.holidays||[];
    MENUS=res.menus||[];
    loginBox.style.display="none";
    dayNavi.style.display="flex";
    menuBtn.style.display="block";
    render();
  }catch{
    localStorage.removeItem("candoll_admin_pass");
  }

  // ✅ 右上メニュー（三角）【ここだけ修正】
  menuBtn.onclick = (e)=>{
    e.stopPropagation();
    menuBox.style.display =
      menuBox.style.display === "block" ? "none" : "block";
  };

  menuBox.onclick = (e)=>{
    e.stopPropagation();
  };

  document.onclick = ()=>{
    menuBox.style.display="none";
  };

  mLogout.onclick = ()=>{
    localStorage.removeItem("candoll_admin_pass");
    location.reload();
  };
});

/* ---------- DATE NAV ---------- */
navPrev.onclick=()=>{BASE_DATE.setDate(BASE_DATE.getDate()-1);render();};
navNext.onclick=()=>{BASE_DATE.setDate(BASE_DATE.getDate()+1);render();};

/* ---------- RENDER ---------- */
async function render(){
  navCurrent.textContent = fmtLabel(BASE_DATE);
  daysWrap.innerHTML="";
  const res = await callAPI({mode:"list"});
  RESERVATIONS=res.reservations||[];
  HOLIDAYS=res.holidays||[];
  MENUS=res.menus||[];
  for(let i=0;i<3;i++){
    const d=new Date(BASE_DATE); d.setDate(d.getDate()+i);
    renderDay(d);
  }
}

function renderDay(d){
  const date=fmtDate(d);
  const col=document.createElement("div");
  col.className="day-column";
  col.innerHTML=`<div class="date-title">${fmtLabel(d)}</div>`;

  TIMES.slice(0,-1).forEach(t=>{
    const r=RESERVATIONS.find(x=>
      x.date===date &&
      x.end_time &&
      toMin(t)>=toMin(x.time)&&toMin(t)<toMin(x.end_time)
    );

    const div=document.createElement("div");
    div.style.padding="12px";
    div.style.minHeight="56px";
    div.style.borderBottom="1px solid #ddd";
    div.style.cursor="pointer";

    if(r){
      div.style.background="#fdd";
      if(t===r.time){
        div.innerHTML = `<strong>${t}</strong><br>${r.name}<br>${r.menus || r.menu || ""}`;
      }else{
        div.textContent=t;
      }
      div.onclick=()=>openEdit(r);
    }else{
      div.style.background="#dfd";
      div.textContent=t;
      div.onclick=()=>openAdd({date,time:t});
    }
    col.appendChild(div);
  });

  daysWrap.appendChild(col);
}

/* ---------- ADD ---------- */
function openAdd({date,time}){
  popupBox.innerHTML=`
    <h3>予約追加</h3>
    <p>${date}</p>
    <input id="a-name">
    <select id="a-time">${TIMES.map(t=>`<option ${t===time?"selected":""}>${t}</option>`).join("")}</select>
    <select id="a-menu">${MENUS.map(m=>`<option>${m.name}</option>`).join("")}</select>
    <button id="a-save">追加</button>
    <button id="a-cancel">キャンセル</button>
  `;
  popupBg.style.display="flex";

  const aName=document.getElementById("a-name");
  const aTime=document.getElementById("a-time");
  const aMenu=document.getElementById("a-menu");

  document.getElementById("a-cancel").onclick=()=>popupBg.style.display="none";
  document.getElementById("a-save").onclick=async()=>{
    const name=aName.value.trim();
    const t=aTime.value;
    const m=aMenu.value;
    const end=addMin(t,menuDuration(m));
    if(!name||!m) return alert("未入力");
    if(hasConflict({date,start:t,end})) return alert("重複");
    await callAPI({mode:"add",name,menus:m,date,time:t,end_time:end});
    popupBg.style.display="none"; render();
  };
}

/* ---------- EDIT ---------- */
function openEdit(r){
  popupBox.innerHTML=`
    <h3>予約変更</h3>
    <input id="e-name" value="${r.name}">
    <select id="e-time">${TIMES.map(t=>`<option ${t===r.time?"selected":""}>${t}</option>`).join("")}</select>
    <select id="e-menu">${MENUS.map(m=>`<option ${m.name===(r.menus||r.menu)?"selected":""}>${m.name}</option>`).join("")}</select>
    <button id="e-save">変更</button>
    <button id="e-del">削除</button>
    <button id="e-close">閉じる</button>
  `;
  popupBg.style.display="flex";

  document.getElementById("e-close").onclick=()=>popupBg.style.display="none";
  document.getElementById("e-save").onclick=async()=>{
    const name=document.getElementById("e-name").value;
    const t=document.getElementById("e-time").value;
    const m=document.getElementById("e-menu").value;
    const end=addMin(t,menuDuration(m));
    if(hasConflict({date:r.date,start:t,end,ignoreId:r.id})) return alert("重複");
    await callAPI({mode:"edit",id:r.id,name,menus:m,date:r.date,time:t,end_time:end});
    popupBg.style.display="none"; render();
  };
  document.getElementById("e-del").onclick=async()=>{
    if(!confirm("キャンセルしますか？")) return;
    await callAPI({mode:"delete",id:r.id});
    popupBg.style.display="none"; render();
  };
}
