// Supabase initialize
const supabaseUrl = 'https://bcahztzetpfuklipjmxx.supabase.co';
const supabaseKey = 'your-anon-key';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

let selectedMenus = [];

// メニュー追加
document.getElementById("addMenuBtn").addEventListener("click", function () {
  const newMenu = document.createElement("select");
  newMenu.classList.add("menu");
  newMenu.innerHTML = document.getElementById("menu").innerHTML;
  document.getElementById("menuArea").appendChild(newMenu);
});

// 日付選択時、予約済み時間をグレーアウト
document.getElementById("date").addEventListener("change", async function () {
  const date = this.value;
  const timeSelect = document.getElementById("time");
  timeSelect.disabled = false;
  const { data: reservations } = await supabase
    .from("reservations")
    .select("time")
    .eq("date", date);

  const reservedTimes = reservations.map(r => r.time);
  for (let option of timeSelect.options) {
    if (reservedTimes.includes(option.value)) {
      option.disabled = true;
      option.style.color = "#ccc";
    } else {
      option.disabled = false;
      option.style.color = "#000";
    }
  }
});

// 予約内容確認
document.getElementById("checkBtn").addEventListener("click", function () {
  const name = document.getElementById("name").value.trim();
  const menuEls = document.querySelectorAll(".menu");
  const menus = [...menuEls].map(menu => menu.value);
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;

  if (!name || menus.length === 0 || !date || !time) {
    alert("未入力の項目があります。");
    return;
  }

  selectedMenus = menus;

  document.getElementById("confirmName").textContent = name;
  document.getElementById("confirmMenus").textContent = menus.join(", ");
  document.getElementById("confirmDate").textContent = date;
  document.getElementById("confirmTime").textContent = time;

  document.getElementById("formArea").style.display = "none";
  document.getElementById("confirmArea").style.display = "block";
});

// 戻るボタン
document.getElementById("backBtn").addEventListener("click", function () {
  document.getElementById("formArea").style.display = "block";
  document.getElementById("confirmArea").style.display = "none";
});

// 予約する
document.getElementById("okBtn").addEventListener("click", async function () {
  const name = document.getElementById("name").value.trim();
  const menus = selectedMenus;
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;

  const { error } = await supabase.from("reservations").insert([
    {
      name,
      menus: menus.join(", "),
      date,
      time,
    },
  ]);

  if (error) {
    console.error(error);
    alert("予約登録に失敗しました。");
    return;
  }

  // 完了画面
  document.getElementById("confirmArea").style.display = "none";
  document.getElementById("doneArea").style.display = "block";
});

// 閉じるボタン
document.getElementById("closeBtn").addEventListener("click", function () {
  if (window.liff) {
    liff.closeWindow();
  } else {
    window.close();
  }
});

