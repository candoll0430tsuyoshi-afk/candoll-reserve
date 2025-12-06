// ==============================
// Candoll 管理画面 admin.js
// 3日表示 / 30分枠（空き=緑、予約=赤）
// ==============================

const API_URL = "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

const loginBox = document.getElementById("login-box");
const reserveList = document.getElementById("days-wrapper");
const dayNavi = document.getElementById("day-navi");
const navPrev = document.getElementById("nav-prev");
const navNext = document.getElementById("nav-next");
const navCurrent = document.getElementById("nav-current");

let ADMIN_PASS = "";
let baseDate = new Date();

// ===== 30分枠（10:00–18:30）=====
const TIMES = [];
for (let h = 10; h <= 18; h++) {
  TIMES.push(`${String(h).padStart(2, "0")}:00`);
  TIMES.push(`${String(h).padStart(2, "0")}:30`);
}
TIMES.push("18:30");

// ===== Utils =====
function fmt(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function toMinutes(t){
  const [h,m]=t.split(":").map(Number);
  return h*60+m;
}
function inRange(t, s, e){
  return toMinutes(s) <= toMinutes(t) && toMinutes(t) < toMinutes(e);
}

// ===== API =====
async function callAPI(body){
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ password: ADMIN_PASS, ...body })
  });
  if(!res.ok) throw new Error("API error");
  return res.json();
}

// ===== Login =====
document.getElementById("login-btn")?.addEventListener("click", async ()=>{
  ADMIN_PASS = document.getElementById("admin-pass").value;
  try{
    await callAPI({ mode:"list" });
    loginBox.style.display = "none";
    dayNavi.style.display = "flex";
    render();
  }catch(e){
    document.getElementById("login-error").style.display="block";
  }
});

// ===== Nav =====
navPrev.onclick = ()=>{ baseDate.setDate(baseDate.getDate()-1); render(); };
navNext.onclick = ()=>{ baseDate.setDate(baseDate.getDate()+1); render(); };

// ===== Render =====
async function render(){
  const start = new Date(baseDate);
  const d1 = new Date(start);
  const d2 = new Date(start); d2.setDate(d2.getDate()+1);
  const d3 = new Date(start); d3.setDate(d3.getDate()+2);
  const days = [d1,d2,d3];

  navCurrent.textContent = fmt(d1);

  const { reservations, holidays } = await callAPI({ mode:"list" });

  reserveList.innerHTML = "";

  days.forEach(d=>{
    const dateStr = fmt(d);
    const isHoliday = (holidays||[]).some(h=>h.date===dateStr);

    const col = document.createElement("div");
    col.className = "day-column";

    const title = document.createElement("div");
    title.className = "date-title";
    title.textContent = dateStr;
    col.appendChild(title);

    TIMES.forEach(t=>{
      const slot = document.createElement("div");
      slot.style.padding = "8px";
      slot.style.marginBottom = "6px";
      slot.style.borderRadius = "6px";
      slot.style.fontSize = "14px";

      if(isHoliday){
        slot.style.background="#ddd";
        slot.textContent = `${t} 休`;
        col.appendChild(slot);
        return;
      }

      const rs = (reservations||[]).filter(r=>r.date===dateStr);

      // 開始枠
      const startHit = rs.find(r=>r.time===t);
      if(startHit){
        slot.style.background="#f55";
        slot.style.color="#fff";
        slot.innerHTML = `<b>${t}</b><br>${startHit.name}<br>${startHit.menu||startHit.menus||""}`;
        col.appendChild(slot);
        return;
      }

      // 途中枠
      const midHit = rs.find(r=>inRange(t, r.time, r.end_time));
      if(midHit){
        slot.style.background="#f99";
        col.appendChild(slot);
        return;
      }

      // 空き
      slot.style.background="#8fda8f";
      slot.textContent = `${t} 空き`;
      col.appendChild(slot);
    });

    reserveList.appendChild(col);
  });
}
