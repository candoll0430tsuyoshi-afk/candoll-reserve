// ==============================
// Candoll 管理画面 admin.js
// 空き枠：追加 / 予約枠：変更・削除
// ==============================

const API_URL =
  "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

const loginBox = document.getElementById("login-box");
const reserveList = document.getElementById("days-wrapper");
const dayNavi = document.getElementById("day-navi");
const navPrev = document.getElementById("nav-prev");
const navNext = document.getElementById("nav-next");
const navCurrent = document.getElementById("nav-current");

const popupBg = document.getElementById("popup-bg");
const popupBox = document.getElementById("popup-box");

let ADMIN_PASS = "";
let baseDate = new Date();
let MENU_LIST = [];

dayNavi.style.display = "none";

// ===== 30分枠 =====
const TIMES = [];
for (let h = 10; h <= 18; h++) {
  TIMES.push(`${String(h).padStart(2, "0")}:00`);
  TIMES.push(`${String(h).padStart(2, "0")}:30`);
}
TIMES.push("18:30");

// ===== Utils =====
const WEEK = ["日","月","火","水","木","金","土"];
const fmt = d =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}（${WEEK[d.getDay()]}）`;
const fmtDate = d =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const toMin = t => {
  const [h,m]=t.split(":").map(Number); return h*60+m;
};
const inRange = (t,s,e)=>toMin(s)<=toMin(t)&&toMin(t)<toMin(e);

// ===== API =====
async function callAPI(body){
  const r = await fetch(API_URL,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ password:ADMIN_PASS, ...body })
  });
  if(!r.ok) throw new Error("API");
  return r.json();
}

// ===== Login =====
document.getElementById("login-btn").onclick = async ()=>{
  ADMIN_PASS = document.getElementById("admin-pass").value;
  try{
    await callAPI({ mode:"list" });
    loginBox.style.display="none";
    dayNavi.style.display="flex";
    render();
  }catch{
    document.getElementById("login-error").style.display="block";
  }
};

// ===== Logout =====
document.getElementById("m-logout").onclick = ()=>{
  ADMIN_PASS="";
  loginBox.style.display="block";
  dayNavi.style.display="none";
  reserveList.innerHTML="";
};

// ===== Nav =====
navPrev.onclick=()=>{ baseDate.setDate(baseDate.getDate()-1); render(); };
navNext.onclick=()=>{ baseDate.setDate(baseDate.getDate()+1); render(); };

// ===== Popup: 追加 =====
function openAddPopup({date,time}){
  const opts = MENU_LIST.map(m=>`<option value="${m.name}">${m.name}</option>`).join("");
  popupBox.innerHTML=`
    <h3>予約追加</h3>
    <p>${date} ${time}</p>
    <input id="p-name" placeholder="お名前">
    <select id="p-menu"><option value="">メニュー</option>${opts}</select>
    <button id="p-save">追加</button>
    <button id="p-cancel" style="background:#aaa;margin-top:10px">キャンセル</button>
  `;
  popupBg.style.display="flex";
  document.getElementById("p-cancel").onclick=()=>popupBg.style.display="none";
  document.getElementById("p-save").onclick=async()=>{
    const name=document.getElementById("p-name").value.trim();
    const menu=document.getElementById("p-menu").value;
    if(!name||!menu){ alert("未入力"); return; }
    await callAPI({ mode:"add", name, menu, date, time });
    popupBg.style.display="none";
    render();
  };
}

// ===== Popup: 変更 / 削除 =====
function openEditPopup(res){
  const opts = MENU_LIST.map(m =>
    `<option value="${m.name}" ${m.name===res.menu?'selected':''}>${m.name}</option>`
  ).join("");
  popupBox.innerHTML=`
    <h3>予約変更 / 削除</h3>
    <p>${res.date} ${res.time}</p>
    <input id="e-name" value="${res.name}">
    <select id="e-menu">${opts}</select>
    <button id="e-save">変更</button>
    <button id="e-del" style="background:#c00;margin-top:10px">削除</button>
    <button id="e-cancel" style="background:#aaa;margin-top:10px">閉じる</button>
  `;
  popupBg.style.display="flex";

  document.getElementById("e-cancel").onclick=()=>popupBg.style.display="none";

  document.getElementById("e-save").onclick=async()=>{
    const name=document.getElementById("e-name").value.trim();
    const menu=document.getElementById("e-menu").value;
    if(!name||!menu){ alert("未入力"); return; }
    await callAPI({ mode:"edit", id:res.id, name, menu, date:res.date, time:res.time });
    popupBg.style.display="none";
    render();
  };

  document.getElementById("e-del").onclick=async()=>{
    if(!confirm("削除しますか？")) return;
    await callAPI({ mode:"delete", id:res.id });
    popupBg.style.display="none";
    render();
  };
}

// ===== Render =====
async function render(){
  const days=[0,1,2].map(i=>{const d=new Date(baseDate); d.setDate(d.getDate()+i); return d;});
  navCurrent.textContent = fmt(days[0]);

  const { reservations, holidays, menus } = await callAPI({ mode:"list" });
  MENU_LIST = menus || [];
  reserveList.innerHTML="";

  days.forEach(day=>{
    const dateStr=fmtDate(day);
    const isHoliday=holidays.some(h=>h.date===dateStr);
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

      if(isHoliday){
        slot.style.background="#ccc";
        slot.textContent=`${t} 休`;
        col.appendChild(slot); return;
      }

      const rs=reservations.filter(r=>r.date===dateStr);
      const start=rs.find(r=>r.time===t);
      if(start){
        slot.style.background="#f55";
        slot.style.color="#fff";
        slot.innerHTML=`<b>${t}</b><br>${start.name}<br>${start.menu||start.menus||""}`;
        slot.style.cursor="pointer";
        slot.onclick=()=>openEditPopup(start);
        col.appendChild(slot); return;
      }

      const mid=rs.find(r=>inRange(t,r.time,r.end_time));
      if(mid){
        slot.style.background="#f99";
        slot.textContent=t;
        col.appendChild(slot); return;
      }

      slot.style.background="#8fda8f";
      slot.textContent=`${t} 空き`;
      slot.style.cursor="pointer";
      slot.onclick=()=>openAddPopup({ date:dateStr, time:t });
      col.appendChild(slot);
    });

    reserveList.appendChild(col);
  });
}
