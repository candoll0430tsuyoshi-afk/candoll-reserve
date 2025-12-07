// ==============================
// Candoll 管理画面 admin.js
// 安定版（構文エラー修正済み）
// ==============================

const API_URL =
  "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

// ---------- DOM ----------
const loginBox   = document.getElementById("login-box");
const daysWrap   = document.getElementById("days-wrapper");
const dayNavi    = document.getElementById("day-navi");
const navPrev    = document.getElementById("nav-prev");
const navNext    = document.getElementById("nav-next");
const navCurrent = document.getElementById("nav-current");
const menuBtn    = document.getElementById("menu-btn");
const popupBg    = document.getElementById("popup-bg");
const popupBox   = document.getElementById("popup-box");

// ---------- 状態 ----------
let ADMIN_PASS = "";
let baseDate = new Date();
let MENUS = [];
let RESERVES = [];

// ---------- 初期UI（ログイン前） ----------
dayNavi.style.display = "none";
menuBtn.style.display = "none";

// ---------- 30分枠 ----------
const TIMES = [];
for (let h = 10; h <= 18; h++) {
  TIMES.push(`${String(h).padStart(2,"0")}:00`);
  TIMES.push(`${String(h).padStart(2,"0")}:30`);
}
TIMES.push("18:30");

// ---------- util ----------
const WEEK = ["日","月","火","水","木","金","土"];

const fmtDate = d =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

const fmtLabel = d =>
  `${fmtDate(d)}（${WEEK[d.getDay()]}）`;

const toMin = t => {
  const [h,m]=t.split(":").map(Number);
  return h*60+m;
};

const isOverlap = (s1,e1,s2,e2) =>
  toMin(s1) < toMin(e2) && toMin(s2) < toMin(e1);

const addMin = (t,m) => {
  const [h,mm]=t.split(":").map(Number);
  const d=new Date(2000,0,1,h,mm);
  d.setMinutes(d.getMinutes()+m);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};

const menuDuration = name =>
  Number(MENUS.find(m => m.name === name)?.duration || 30);

const hasConflict = ({date,start,end,ignoreId=null}) =>
  RESERVES.filter(r=>r.date===date)
    .some(r=>{
      if(ignoreId && r.id===ignoreId) return false;
      if(!r.end_time) return false;
      return isOverlap(start,end,r.time,r.end_time);
    });

// ---------- API ----------
async function callAPI(body){
  const res = await fetch(API_URL,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ password:ADMIN_PASS, ...body })
  });
  if(!res.ok) throw new Error("API error");
  return res.json();
}

// ---------- Login ----------
document.getElementById("login-btn").onclick = async ()=>{
  ADMIN_PASS = document.getElementById("admin-pass").value;
  try{
    await callAPI({mode:"list"});
    localStorage.setItem("candoll_admin","1");
    localStorage.setItem("candoll_pass",ADMIN_PASS);

    loginBox.style.display="none";
    dayNavi.style.display="flex";
    menuBtn.style.display="block";
    render();
  }catch{
    document.getElementById("login-error").style.display="block";
  }
};

// ---------- Logout ----------
document.getElementById("m-logout").onclick = ()=>{
  localStorage.clear();
  ADMIN_PASS="";
  loginBox.style.display="block";
  dayNavi.style.display="none";
  menuBtn.style.display="none";
  daysWrap.innerHTML="";
};

// ---------- 自動ログイン ----------
window.addEventListener("load",()=>{
  const ok   = localStorage.getItem("candoll_admin");
  const pass = localStorage.getItem("candoll_pass");

  if(ok && pass){
    ADMIN_PASS = pass;
    loginBox.style.display="none";
    dayNavi.style.display="flex";
    menuBtn.style.display="block";
    render();
  }
});

// ---------- ナビ ----------
navPrev.onclick = () => { baseDate.setDate(baseDate.getDate()-1); render(); };
navNext.onclick = () => { baseDate.setDate(baseDate.getDate()+1); render(); };

// ---------- 追加 ----------
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
    <button id="a-cancel" style="background:#aaa;margin-top:10px">キャンセル</button>
  `;
  popupBg.style.display="flex";

  document.getElementById("a-cancel").onclick = () => popupBg.style.display="none";

  document.getElementById("a-save").onclick = async () => {

  console.log("ADD BUTTON CLICKED"); // ← 追加

  const name = document.getElementById("a-name").value.trim();
    const t    = document.getElementById("a-time").value;
    const m    = document.getElementById("a-menu").value;
：
    if(!name || !m){ alert("未入力があります"); return; }

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

// ---------- 編集 ----------
function openEdit(r){
  const curMenu = r.menu || r.menus || "";

  popupBox.innerHTML = `
    <h3>予約変更</h3>
    <p>${r.date}</p>
    <input id="e-name" value="${r.name}">
    <select id="e-time">${TIMES.map(t=>`<option ${t===r.time?"selected":""}>${t}</option>`).join("")}</select>
    <select id="e-menu">${MENUS.map(m=>`<option ${m.name===curMenu?"selected":""}>${m.name}</option>`).join("")}</select>
    <button id="e-save">変更</button>
    <button id="e-del" style="background:#c00;margin-top:10px">削除</button>
    <button id="e-close" style="background:#aaa;margin-top:10px">閉じる</button>
  `;
  popupBg.style.display="flex";

  document.getElementById("e-close").onclick = () => popupBg.style.display="none";

  document.getElementById("e-save").onclick = async () => {
   console.log("EDIT BUTTON CLICKED");
    const name = document.getElementById("e-name").value.trim();
    const t    = document.getElementById("e-time").value;
    const m    = document.getElementById("e-menu").value;

    const end  = addMin(t, menuDuration(m));
    if(hasConflict({date:r.date,start:t,end,ignoreId:r.id})){
      alert("時間が重複します");
      return;
    }

    await callAPI({ mode:"edit", id:r.id, name, menu:m, date:r.date, time:t, end_time:end });
    popupBg.style.display="none";
    render();
  };

  document.getElementById("e-del").onclick = async () => {
    if(!confirm("削除しますか？")) return;
    await callAPI({ mode:"delete", id:r.id });
    popupBg.style.display="none";
    render();
  };
}

// ---------- 描画 ----------
async function render(){
  const days = [0,1,2].map(i=>{
    const d=new Date(baseDate);
    d.setDate(d.getDate()+i);
    return d;
  });

  navCurrent.textContent = fmtLabel(days[0]);

  const {reservations, menus} = await callAPI({mode:"list"});
  RESERVES = reservations || [];
  MENUS    = menus || [];

  daysWrap.innerHTML="";

  days.forEach(d=>{
    const date = fmtDate(d);
    const col  = document.createElement("div");
    col.className="day-column";

    const ttl  = document.createElement("div");
    ttl.className="date-title";
    ttl.textContent = fmtLabel(d);
    col.appendChild(ttl);

    TIMES.forEach(t=>{
      const slot = document.createElement("div");
      slot.style.padding="6px";
      slot.style.marginBottom="6px";
      slot.style.borderRadius="6px";

      const r = RESERVES.find(v=>v.date===date && v.time===t);
      if(r){
        slot.style.background="#f66";
        slot.style.color="#fff";
        slot.innerHTML = `${t}<br>${r.name}<br>${r.menu||r.menus||""}`;
        slot.onclick = ()=>openEdit(r);
        col.appendChild(slot);
        return;
      }

      const mid = RESERVES.find(v=>v.date===date && v.end_time && isOverlap(t,t,v.time,v.end_time));
      if(mid){
        slot.style.background="#fbb";
        slot.textContent=t;
        col.appendChild(slot);
        return;
      }

      slot.style.background="#9f9";
      slot.textContent = `${t} 空き`;
      slot.onclick = ()=>openAdd({date,time:t});
      col.appendChild(slot);
    });

    daysWrap.appendChild(col);
  });
}
