// ==============================
// Candoll 管理画面 admin.js
// 【基準版】右上メニュー安定／ログイン保持
// ==============================

const API_URL = "https://bcahztzetpfuklipjmxx.functions.supabase.co/admin-service";

// ------------------------------
// DOM
// ------------------------------
const loginBox   = document.getElementById("login-box");
const loginBtn   = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const passInput  = document.getElementById("admin-pass");

const menuBtn = document.getElementById("menu-btn");
const menuBox = document.getElementById("menu-box");
const mLogout = document.getElementById("m-logout");

const dayNavi     = document.getElementById("day-navi");
const navPrev     = document.getElementById("nav-prev");
const navNext     = document.getElementById("nav-next");
const navCurrent  = document.getElementById("nav-current");

const daysWrapper = document.getElementById("days-wrapper");

const popupBg  = document.getElementById("popup-bg");
const popupBox = document.getElementById("popup-box");

// ------------------------------
// State
// ------------------------------
let ADMIN_PASS = localStorage.getItem("candoll_admin_pass") || "";
let BASE_DATE  = new Date();

// ------------------------------
// Utility
// ------------------------------
function ymd(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function addDay(d,n){
  const x = new Date(d);
  x.setDate(x.getDate()+n);
  return x;
}

// ------------------------------
// API
// ------------------------------
async function callAPI(body){
  const res = await fetch(API_URL,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify(body)
  });
  return await res.json();
}

// ------------------------------
// Login
// ------------------------------
async function tryLogin(pass){
  const r = await callAPI({ mode:"list", password:pass });
  if(r.error){
    loginError.style.display="block";
    return;
  }
  ADMIN_PASS = pass;
  localStorage.setItem("candoll_admin_pass", pass);
  showAdmin();
}

loginBtn.onclick = ()=>{
  tryLogin(passInput.value.trim());
};

if(ADMIN_PASS){
  tryLogin(ADMIN_PASS);
}

// ------------------------------
// Show Admin
// ------------------------------
function showAdmin(){
  loginBox.style.display="none";
  loginError.style.display="none";
  dayNavi.style.display="flex";
  render();
}

// ------------------------------
// Render
// ------------------------------
async function render(){
  const res = await callAPI({ mode:"list", password:ADMIN_PASS });
  if(res.error) return;

  daysWrapper.innerHTML = "";

  for(let i=0;i<3;i++){
    const d = addDay(BASE_DATE,i);
    const date = ymd(d);

    const col = document.createElement("div");
    col.className = "day-column";

    const title = document.createElement("div");
    title.className = "date-title";
    title.textContent = date;
    col.appendChild(title);

    daysWrapper.appendChild(col);
  }
}

// ------------------------------
// Day Navi
// ------------------------------
navPrev.onclick = ()=>{
  BASE_DATE = addDay(BASE_DATE,-1);
  render();
};
navNext.onclick = ()=>{
  BASE_DATE = addDay(BASE_DATE,1);
  render();
};

// ------------------------------
// ✅ 右上三角メニュー（唯一・確定版）
// ------------------------------
if(menuBtn && menuBox){

  menuBtn.addEventListener("click",(e)=>{
    e.stopPropagation();
    menuBox.style.display =
      menuBox.style.display === "block" ? "none" : "block";
  });

  menuBox.addEventListener("click",(e)=>{
    e.stopPropagation();
  });

  document.addEventListener("click",()=>{
    menuBox.style.display="none";
  });
}

// ------------------------------
// Logout
// ------------------------------
mLogout.onclick = ()=>{
  localStorage.removeItem("candoll_admin_pass");
  location.reload();
};
