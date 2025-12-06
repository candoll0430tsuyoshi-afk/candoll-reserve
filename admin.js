// ==============================
// Candoll 管理画面 admin.js
// 3日表示 / 30分枠（緑=空き / 赤=予約）
// ==============================

const API_URL =
  "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

const loginBox = document.getElementById("login-box");
const reserveList = document.getElementById("days-wrapper");
const dayNavi = document.getElementById("day-navi");
const navPrev = document.getElementById("nav-prev");
const navNext = document.getElementById("nav-next");
const navCurrent = document.getElementById("nav-current");

let ADMIN_PASS = "";
let baseDate = new Date();

// ✅ ログイン前は日付ナビを隠す
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

function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  const w = WEEK[d.getDay()];
  return `${y}-${m}-${day}（${w}）`;
}

function fmtDate(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function toMin(t) {
  const [h,m] = t.split(":").map(Number);
  return h*60+m;
}
function inRange(t,s,e){
  return toMin(s) <= toMin(t) && toMin(t) < toMin(e);
}

// ===== API =====
async function callAPI(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: ADMIN_PASS, ...body })
  });
  if (!res.ok) throw new Error("API error");
  return res.json();
}

// ===== Login =====
document.getElementById("login-btn").onclick = async () => {
  ADMIN_PASS = document.getElementById("admin-pass").value;

  try {
    await callAPI({ mode: "list" });
    loginBox.style.display = "none";
    dayNavi.style.display = "flex";
    render();
  } catch {
    document.getElementById("login-error").style.display = "block";
  }
};

// ===== Logout =====
document.getElementById("m-logout").onclick = () => {
  ADMIN_PASS = "";
  loginBox.style.display = "block";
  dayNavi.style.display = "none";
  reserveList.innerHTML = "";
};

// ===== Nav =====
navPrev.onclick = () => {
  baseDate.setDate(baseDate.getDate() - 1);
  render();
};
navNext.onclick = () => {
  baseDate.setDate(baseDate.getDate() + 1);
  render();
};

// ===== Render =====
async function render() {
  const d1 = new Date(baseDate);
  const d2 = new Date(baseDate); d2.setDate(d2.getDate()+1);
  const d3 = new Date(baseDate); d3.setDate(d3.getDate()+2);
  const days = [d1,d2,d3];

  navCurrent.textContent = fmt(d1);

  const { reservations, holidays } = await callAPI({ mode: "list" });
  reserveList.innerHTML = "";

  days.forEach(day => {
    const dateStr = fmtDate(day);
    const isHoliday = holidays.some(h => h.date === dateStr);

    const col = document.createElement("div");
    col.className = "day-column";

    // ✅ 日付 + 曜日
    const title = document.createElement("div");
    title.className = "date-title";
    title.textContent = fmt(day);
    col.appendChild(title);

    TIMES.forEach(t => {
      const slot = document.createElement("div");
      slot.style.padding = "6px";
      slot.style.marginBottom = "6px";
      slot.style.borderRadius = "6px";
      slot.style.fontSize = "13px";
      slot.style.cursor = "default";

      if (isHoliday) {
        slot.style.background = "#ccc";
        slot.textContent = `${t} 休`;
        col.appendChild(slot);
        return;
      }

      const rs = reservations.filter(r => r.date === dateStr);

      const startHit = rs.find(r => r.time === t);
      if (startHit) {
        slot.style.background = "#f55";
        slot.style.color = "#fff";
        slot.innerHTML = `<b>${t}</b><br>${startHit.name}<br>${startHit.menu || startHit.menus || ""}`;
        col.appendChild(slot);
        return;
      }

      const midHit = rs.find(r => inRange(t, r.time, r.end_time));
      if (midHit) {
        slot.style.background = "#f99";
        slot.textContent = t;
        col.appendChild(slot);
        return;
      }

      // ✅ 空き枠（クリックで追加）
      slot.style.background = "#8fda8f";
      slot.textContent = `${t} 空き`;
      slot.style.cursor = "pointer";
      slot.onclick = () => {
        alert(`${dateStr} ${t} の予約を追加`);
        // ← 次はここに管理者予約追加ポップアップ
      };

      col.appendChild(slot);
    });

    reserveList.appendChild(col);
  });
}
