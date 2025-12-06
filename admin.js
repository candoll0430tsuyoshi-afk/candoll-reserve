// ==============================
// Candoll 管理画面 admin.js
// 3日表示 / 30分枠
// 追加・変更・削除
// 重複防止 / ログイン保持
// menus.duration 使用
// ==============================

const API_URL =
  "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

// ----- DOM -----
const loginBox   = document.getElementById("login-box");
const reserveBox = document.getElementById("days-wrapper");
const dayNavi    = document.getElementById("day-navi");
const navPrev    = document.getElementById("nav-prev");
const navNext    = document.getElementById("nav-next");
const navCurrent = document.getElementById("nav-current");
const menuBtn    = document.getElementById("menu-btn");
const popupBg    = document.getElementById("popup-bg");
const popupBox   = document.getElementById("popup-box");

// ----- 状態 -----
let ADMIN_PASS = "";
let baseDate = new Date();
let MENU_LIST = [];
let CURRENT_RESERVATIONS = [];

// 初期表示
dayNavi.style.display = "none";
menuBtn.style.display = "none";

// ----- 30分枠 -----
const TIMES = [];
for (let h = 10; h <= 18; h++) {
  TIMES.push(`${String(h).padStart(2,"0")}:00`);
  TIMES.push(`${String(h).padStart(2,"0")}:30`);
}
TIMES.push("18:30");

// ===== Utils =====
const WEEK = ["日","月","火","水","木","金","土"];

const fmt = d =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}（${WEEK[d.getDay()]}）`;

const fmtDate = d =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

const toMin = t => {
  const [h,m]=t.split(":").map(Number);
  return h*60+m;
};

const isOverlap = (s1,e1,s2,e2) =>
  toMin(s1) < toMin(e2) && toMin(s2) < toMin(e1);

function addMinutes(time,min){
  const [h,m]=time.split(":").map(Number);
  const d=new Date(2000,0,1,h,m);
  d.setMinutes(d.getMinutes()+min);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function getMenuMinutes(menu){
  const m = MENU_LIST.find(x=>x.name===menu);
  return Number(m?.duration || 30);
}

function hasConflict({date,start,end,ignoreId=null}){
  return CURRENT_RESERVATIONS
    .filter(r=>r.date===date)
    .some(r=>{
      if(ignoreId && r.id===ignoreId) return false;
      if(!r.end_time) return false;
      return isOverlap(start,end,r.time,r.end_time);
    });
}

// ===== API =====
async function callAPI(body){
  const res = await fetch(API_URL,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ password:ADMIN_PASS,...body })
  });
  if(!res.ok) throw new Error("API error");
  return res.json();
}

// ===== Login =====
document.getElementById("login-btn").onclick = async ()=>{
  ADMIN_PASS = document.getElementById("admin-pass").value;
  try{
    await callAPI({mode:"list"});
    localStorage.setItem("candoll_admin_login","1");
    localStorage.setItem("candoll_admin_pass",ADMIN_PASS);
    loginBox.style.display="none";
    dayNavi.style.display="flex";
    menuBtn.style.display="block";
    render();
  }catch{
    document.getElementById("login-error").style.display="block";
  }
};

// ===== Logout =====
document.getElementById("m-logout").onclick = ()=>{
  localStorage.clear();
  ADMIN_PASS="";
  loginBox.style.display="block";
  dayNavi.style.display="none";
  menuBtn.style.display="none";
  reserveBox.innerHTML="";
};

// ===== 自動復帰 =====
window.addEventListener("load", async ()=>{
  const ok = localStorage.getItem("candoll_admin_login");
  const pass = localStorage.getItem("candoll_admin_pass");
  if(ok && pass){
    ADMIN_PASS = pass;
    loginBox.style.display="none";
    dayNavi.style.display="flex";
    menuBtn.style.display="block";
    await render();
  }
});

// ===== Nav =====
navPrev.onclick = ()=>{ baseDate.setDate(baseDate.getDate()-1); render(); };
navNext.onclick = ()=>{ baseDate.setDate(baseDate.getDate()+1); render(); };

// ===== Popup：追加 =====
function openAddPopup({date,time}){
  const timeOpts = TIMES.map(t=>`<option ${t===time?'selected':''}>${t}</option>`).join("");
  const menuOpts = MENU_LIST.map(m=>`<option>${m.name}</option>`).join("");

  popupBox.innerHTML = `
    <h3>予約追加</h3>
    <p>${date}</p>
    <input id="p-name" placeholder="お名前">
    <select id="p-time">${timeOpts}</select>
    <select id="p-menu"><option value="">メニュー</option>${menuOpts}</select>
    <button id="p-save">追加</button>
    <button id="p-cancel" style="background:#aaa;margin-top:10px">キャンセル</button>
  `;
  popupBg.style.display="flex";

  document.getElementById("p-cancel").onclick=()=>popupBg.style.display="none";

  document.getElementById("p-save").onclick=async()=>{
    const name=document.getElementById("p-name").value.trim();
    const t=document.getElementById("p-time").value;
    const menu=document.getElementById("p-menu").value;
    if(!name||!menu){alert("未入力");return;}

    const end=addMinutes(t,getMenuMinutes(menu));
    if(hasConflict({date,start:t,end})) {
      alert("この時間帯は予約があります");
      return;
    }

    await callAPI({mode:"add",name,menu,date,time:t,end_time:end});
    popupBg.style.display="none";
    render();
  };
}

// ===== Popup：変更 =====
function openEditPopup(r){
  const timeOpts = TIMES.map(t=>`<option ${t===r.time?'selected':''}>${t}</option>`).join("");
  const menuOpts = MENU_LIST.map(m=>`<option ${m.name===r.menu?'selected':''}>${m.name}</option>`).join("");

  popupBox.innerHTML = `
    <h3>予約変更 / 削除</h3>
    <p>${r.date}</p>
    <input id="e-name" value="${r.name}">
    <select id="e-time">${timeOpts}</select>
    <select id="e-menu">${menuOpts}</select>
    <button id="e-save">変更</button>
    <button id="e-del" style="background:#c00;margin-top:10px">削除</button>
    <button id="e-cancel" style="background:#aaa;margin-top:10px">閉じる</button>
  `;
  popupBg.style.display="flex";

  document.getElementById("e-cancel").onclick=()=>popupBg.style.display="none";

  document.getElementById("e-save").onclick=async()=>{
    const name=document.getElementById("e-name").value.trim();
    const t=document.getElementById("e-time").value;
    const menu=document.getElementById("e-menu").value;
    if(!name||!menu){alert("未入力");return;}

    const end=addMinutes(t,getMenuMinutes(menu));
    if(hasConflict({date:r.date,start:t,end,ignoreId:r.id})) {
      alert("この時間帯は予約があります");
      return;
    }

    await callAPI({mode:"edit",id:r.id,name,menu,date:r.date,time:t,end_time:end});
    popupBg.style.display="none";
    render();
  };

  document.getElementById("e-del").onclick=async()=>{
    if(!confirm("削除しますか？"))return;
    await callAPI({mode:"delete",id:r.id});
    popupBg.style.display="none";
    render();
  };
}

// ===== Render =====
async function render(){
  const days=[0,1,2].map(i=>{const d=new Date(baseDate);d.setDate(d.getDate()+i);return d;});
  navCurrent.textContent = fmt(days[0]);

  const { reservations, holidays, menus } = await callAPI({mode:"list"});
  CURRENT_RESERVATIONS = reservations || [];
  MENU_LIST = menus || [];
  reserveBox.innerHTML="";

  days.forEach(day=>{
    const dateStr = fmtDate(day);
    const isHoliday = holidays.some(h=>h.date===dateStr);

    const col=document.createElement("div");
    col.className="day-column";
    const title=document.createElement("div");
    title.className="date-title";
    title.textContent=fmt(day);
    col.appendChild(title);

    TIMES.forEach(t=>{
      const slot=document.createElement("div");
      slot.style.padding="6px";
      slot.style.marginBottom="6px";
      slot.style.borderRadius="6px";
      slot.style.fontSize="13px";

      if(isHoliday){
        slot.style.background="#ccc";
        slot.textContent=`${t} 休`;
        col.appendChild(slot);return;
      }

      const start=CURRENT_RESERVATIONS.find(r=>r.date===dateStr&&r.time===t);
      if(start){
        slot.style.background="#f55";
        slot.style.color="#fff";
        slot.style.cursor="pointer";
        slot.innerHTML=`<b>${t}</b><br>${start.name}<br>${start.menu}`;
        slot.onclick=()=>openEditPopup(start);
        col.appendChild(slot);return;
      }

      const mid=CURRENT_RESERVATIONS.find(r=>r.date===dateStr&&r.end_time&&isOverlap(t,t,r.time,r.end_time));
      if(mid){
        slot.style.background="#f99";
        slot.textContent=t;
        col.appendChild(slot);return;
      }

      slot.style.background="#8fda8f";
      slot.style.cursor="pointer";
      slot.textContent=`${t} 空き`;
      slot.onclick=()=>openAddPopup({date:dateStr,time:t});
      col.appendChild(slot);
    });
    reserveBox.appendChild(col);
  });
}

}
