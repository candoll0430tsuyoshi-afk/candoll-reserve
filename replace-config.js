import fs from "fs";

// タイムスタンプ（キャッシュバスター）
const ts = Date.now();

// public/admin.html を読み込む
let html = fs.readFileSync("public/admin.html", "utf8");

// 置換処理
html = html
  .replace(/__SUPABASE_URL__/g, process.env.SUPABASE_URL || "")
  .replace(/__SUPABASE_KEY__/g, process.env.SUPABASE_KEY || "")
  .replace(/admin\.js/g, `admin.js?v=${ts}`);

// 書き戻し
fs.writeFileSync("public/admin.html", html);
