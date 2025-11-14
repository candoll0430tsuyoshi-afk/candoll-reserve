{
tf1\ansi\ansicpg932\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0

\f0\fs24 \cf0 // LIFF 初期化 
window.onload = function () {\
  liff.init({ liffId: "2008442624-YB13z2B1" })\
    .then(() => {\
      if (liff.isLoggedIn()) {\
        getProfile();\
      } else {\
        liff.login();\
      }\
    });\
};\
\
function getProfile() {\
  liff.getProfile().then(profile => {\
    document.getElementById("name").value = profile.displayName || "";\
  });\
}\
// メニュー定義 
const menus = {\
  "組み合わせ": ["カット＋カラー", "カット＋リタッチカラー", "カット＋パーマ", "カット＋ストレート"],\
  "カット": ["カット", "カット（大学生・専門学生）", "カット（中学生以下）", "前髪カット"],\
  "カラー": ["カラー", "リタッチカラー", "ダブルカラー", "アクセントカラー", "ヘナ"],\
  "パーマ": ["モイストパーマ", "ポイントパーマ"],\
  "ストレート": ["ストレートパーマ", "ポイントストレートパーマ"],\
  "トリートメント": ["トリートメント"],\
  "メニュー未定": ["来店時に相談（２時間枠）", "来店時に相談（３時間枠）"]\
};\
// サブメニュー生成
document.getElementById("category").addEventListener("change", function () {\
  const sub = document.getElementById("submenu");\
  sub.innerHTML = "<option value=''>サブメニューを選択</option>";\
  if (menus[this.value]) {\
    menus[this.value].forEach(item => {\
      const opt = document.createElement("option");\
      opt.value = item;\
      opt.textContent = item;\
      sub.appendChild(opt);\
    });\
  }\
});\
// フォーム送信
document.getElementById("reserveForm").addEventListener("submit", function (e) {\
  e.preventDefault();\
\
  const name = document.getElementById("name").value;\
  const cat = document.getElementById("category").value;\
  const sub = document.getElementById("submenu").value;\
  const time = document.getElementById("datetime").value;\
  const note = document.getElementById("note").value;\
\
  if (!name || !cat || !sub || !time) {\
    alert("すべての項目を入力してください。");\
    return;\
  }\
\
  const msg = `\
ご予約承りました。\
------------------\
お名前 ${name}\
メニュー ${cat} - ${sub}\
日時 ${time}\
ご要望 ${note}\
------------------\
`;\
\
  const messageDiv = document.getElementById("message");\
  messageDiv.innerHTML = `<div style='font-size:14pt;'>${msg}</div>`; // candoll-reserveより少し小さく表示\
  // メニュー・日付・時間を少し大きく
  messageDiv.querySelectorAll('p').forEach(p => p.style.fontSize='15pt');\
\
  // LINE送信
  if (liff.isInClient()) {\
    liff.sendMessages([{ type: "text", text: msg }]).then(() => {\
      liff.closeWindow();\
    });\
  }\
});\
// OKボタンスタイル
const okButton = document.querySelector('.submit-btn');\
okButton.style.background = '#000';\
okButton.style.color = '#fff';
