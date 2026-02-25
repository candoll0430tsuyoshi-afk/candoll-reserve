// ===== デバッグ用コンソールログ =====
console.log("🚀 script_stepwise.js が読み込まれました");

// ===== グローバル設定 ===
let supabaseClient = null;
let runtime = "web"; 
let customerUserId = null;
let MENU_DATA = {};
let HOLIDAYS = [];
let OFF_TIMES = [];
let SPECIAL_OPENS = [];

// ===== 段階的入力の状態管理 =====
const stepState = {
    name: false,
    menu: false,
    date: false,
    time: false
};

console.log("✅ グローバル変数初期化完了");

// LINE LIFF 初期化
const miniappReady = (async () => {
  try {
    console.log("📱 LIFF初期化開始");
    await liff.init({ liffId: "2008611644-EZd5nkl0" }); 
    if (liff.isInClient()) {
      runtime = "miniapp";
      if (!liff.isLoggedIn()) { 
        liff.login(); 
        return; 
      }
      const profile = await liff.getProfile();
      customerUserId = profile.userId;
      console.log("✅ LINEユーザーID取得:", customerUserId);
      if (window.updateSupabaseHeader) window.updateSupabaseHeader(customerUserId);
    } else {
      console.log("💻 Webブラウザモード");
    }
  } catch (e) { 
    console.error("❌ LIFFエラー:", e); 
  }
})();

// ===== 初期化処理 =====
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🎯 DOMContentLoaded イベント発火");
  
  const supabaseUrl = "https://bcahztzetpfuklipjmxx.supabase.co";
  const supabaseKey = "sb_publishable_rPyAIzNttEK3P8nsnBllYA_FTF-kxJQ";

  console.log("⏳ miniappReady を待機中...");
  await miniappReady;
  console.log("✅ miniappReady 完了");

  console.log("🔌 Supabaseクライアント作成中...");
  supabaseClient = supabase.createClient(supabaseUrl, supabaseKey, {
    global: { 
      headers: { 'x-customer-id': customerUserId || "web-user" } 
    }
  });
  console.log("✅ Supabaseクライアント作成完了");

  // データを読み込む
  try {
    console.log("📥 データ読み込み開始...");
    console.log("  - loadMenus() 実行中...");
    console.log("  - loadHolidays() 実行中...");
    
    // この行でエラーが出る可能性が高い
    alert("データ読み込み開始！コンソールを確認してください");
    
  } catch (err) {
    console.error("❌ データ取得エラー:", err);
    alert("エラー発生: " + err.message);
  }
});

console.log("🏁 script_stepwise.js の読み込み完了（DOMContentLoaded待機中）");
