{\rtf1\ansi\ansicpg932\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx566\tx1133\tx1700\tx2267\tx2834\tx3401\tx3968\tx4535\tx5102\tx5669\tx6236\tx6803\pardirnatural\partightenfactor0

\f0\fs24 \cf0 // LIFF \uc0\u21021 \u26399 \u21270 \
window.onload = function () \{\
  liff.init(\{ liffId: "2008442624-YB13z2B1" \})\
    .then(() => \{\
      if (liff.isLoggedIn()) \{\
        getProfile();\
      \} else \{\
        liff.login();\
      \}\
    \});\
\};\
\
function getProfile() \{\
  liff.getProfile().then(profile => \{\
    document.getElementById("name").value = profile.displayName || "";\
  \});\
\}\
\
// \uc0\u12513 \u12491 \u12517 \u12540 \u27083 \u36896 \
const menus = \{\
  "\uc0\u32068 \u12415 \u21512 \u12431 \u12379 ": ["\u12459 \u12483 \u12488 \u65291 \u12459 \u12521 \u12540 ", "\u12459 \u12483 \u12488 \u65291 \u12522 \u12479 \u12483 \u12481 \u12459 \u12521 \u12540 ", "\u12459 \u12483 \u12488 \u65291 \u12497 \u12540 \u12510 ", "\u12459 \u12483 \u12488 \u65291 \u12473 \u12488 \u12524 \u12540 \u12488 "],\
  "\uc0\u12459 \u12483 \u12488 ": ["\u12459 \u12483 \u12488 ", "\u12459 \u12483 \u12488 \u65288 \u22823 \u23398 \u29983 \u12539 \u23554 \u38272 \u23398 \u29983 \u65289 ", "\u12459 \u12483 \u12488 \u65288 \u20013 \u23398 \u29983 \u20197 \u19979 \u65289 ", "\u21069 \u39658 \u12459 \u12483 \u12488 "],\
  "\uc0\u12459 \u12521 \u12540 ": ["\u12459 \u12521 \u12540 ", "\u12522 \u12479 \u12483 \u12481 \u12459 \u12521 \u12540 ", "\u12480 \u12502 \u12523 \u12459 \u12521 \u12540 ", "\u12450 \u12463 \u12475 \u12531 \u12488 \u12459 \u12521 \u12540 ", "\u12504 \u12490 "],\
  "\uc0\u12497 \u12540 \u12510 ": ["\u12514 \u12452 \u12473 \u12488 \u12497 \u12540 \u12510 ", "\u12509 \u12452 \u12531 \u12488 \u12497 \u12540 \u12510 "],\
  "\uc0\u12473 \u12488 \u12524 \u12540 \u12488 ": ["\u12473 \u12488 \u12524 \u12540 \u12488 \u12497 \u12540 \u12510 ", "\u12509 \u12452 \u12531 \u12488 \u12473 \u12488 \u12524 \u12540 \u12488 \u12497 \u12540 \u12510 "],\
  "\uc0\u12488 \u12522 \u12540 \u12488 \u12513 \u12531 \u12488 ": ["\u12488 \u12522 \u12540 \u12488 \u12513 \u12531 \u12488 "],\
  "\uc0\u12513 \u12491 \u12517 \u12540 \u26410 \u23450 ": ["\u26469 \u24215 \u26178 \u12395 \u30456 \u35527 \u65288 2\u26178 \u38291 \u26528 \u65289 ", "\u26469 \u24215 \u26178 \u12395 \u30456 \u35527 \u65288 3\u26178 \u38291 \u26528 \u65289 "]\
\};\
\
// \uc0\u22823 \u12459 \u12486 \u12468 \u12522 \u36984 \u25246 \u12391 \u12469 \u12502 \u12513 \u12491 \u12517 \u12540 \u26356 \u26032 \
document.getElementById("category").addEventListener("change", function () \{\
  const sub = document.getElementById("submenu");\
  sub.innerHTML = "<option value=''>\uc0\u23567 \u12459 \u12486 \u12468 \u12522 \u12434 \u36984 \u25246 </option>";\
  if (menus[this.value]) \{\
    menus[this.value].forEach(item => \{\
      const opt = document.createElement("option");\
      opt.value = item;\
      opt.textContent = item;\
      sub.appendChild(opt);\
    \});\
  \}\
\});\
\
// \uc0\u12501 \u12457 \u12540 \u12512 \u36865 \u20449 \
document.getElementById("reserveForm").addEventListener("submit", function (e) \{\
  e.preventDefault();\
\
  const name = document.getElementById("name").value;\
  const cat = document.getElementById("category").value;\
  const sub = document.getElementById("submenu").value;\
  const time = document.getElementById("datetime").value;\
  const note = document.getElementById("note").value;\
\
  if (!name || !cat || !sub || !time) \{\
    alert("\uc0\u12377 \u12409 \u12390 \u12398 \u24517 \u38920 \u38917 \u30446 \u12434 \u20837 \u21147 \u12375 \u12390 \u12367 \u12384 \u12373 \u12356 \u12290 ");\
    return;\
  \}\
\
  const msg = `\
\uc0\u12372 \u20104 \u32004 \u25215 \u12426 \u12414 \u12375 \u12383 \u12290 \
------------------\
\uc0\u12362 \u21517 \u21069 \u65306 $\{name\}\
\uc0\u12513 \u12491 \u12517 \u12540 \u65306 $\{cat\} - $\{sub\}\
\uc0\u26085 \u26178 \u65306 $\{time\}\
\uc0\u20633 \u32771 \u65306 $\{note\}\
------------------\
`;\
\
  document.getElementById("message").textContent = msg;\
\
  // LINE\uc0\u12488 \u12540 \u12463 \u30011 \u38754 \u12408 \u36865 \u20449 \u65288 \u20206 \u12539 \u24460 \u12391 \u31649 \u29702 \u32773 \u36890 \u30693 \u27231 \u33021 \u36861 \u21152 \u21487 \u65289 \
  if (liff.isInClient()) \{\
    liff.sendMessages([\{ type: "text", text: msg \}]).then(() => \{\
      liff.closeWindow();\
    \});\
  \}\
\});\
}