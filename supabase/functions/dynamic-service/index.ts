import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log("LINE通知 function 起動（カスタムメッセージ対応版）");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // "x-customer-id" を追加して、ブラウザからの通信を許可する
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-customer-id", 
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("受信データ(payload):", payload);

    const {
      mode,           // キャンセル判定用
      name,
      menus,
      date,
      time,
      customerUserId,
      customMessage   // ← script.js から送られてくる新しい文章
    } = payload;

    const LINE_USER_ID = Deno.env.get("LINE_USER_ID");
    const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");

    if (!LINE_CHANNEL_ACCESS_TOKEN) {
      return new Response("Env error", { status: 500, headers: corsHeaders });
    }

    // 曜日計算
    const week = ["日", "月", "火", "水", "木", "金", "土"];
    const d = new Date(date.replace(/-/g, "/")); // Safari/Deno対策
    const youbi = week[d.getDay()];

// ======================================
    // 1. 管理者（あなた）への通知
    // ======================================
    if (LINE_USER_ID) {
      const adminText = (mode === "cancel") 
        ? `【予約キャンセル】\n\nお名前：${name}様\n日付：${date}（${youbi}）\n時間：${time}\nメニュー：${menus}`
        : `【予約通知】\n\nお名前：${name}様\nメニュー：${menus}\n日付：${date}（${youbi}）\n時間：${time}`;

      await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          to: LINE_USER_ID,
          messages: [{ type: "text", text: adminText }],
          // ここを追加：通知を「プッシュ通知」として強調する
          notificationDisabled: false 
        }),
      });
    }

    // ======================================
    // 2. お客様への通知
    // ======================================
// 2. お客様への通知
    if (customerUserId) {
      let finalMessage = "";

      if (mode === "cancel") {
        // キャンセル時はこの文章だけを送る
        finalMessage = `キャンセルを承りました。\nまたのご予約をお待ちしております。`;
      } else {
        // 予約時は script.js から送られてきた customMessage を使う
        finalMessage = customMessage;
      }

      if (finalMessage) {
        await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
          },
          body: JSON.stringify({
            to: customerUserId,
            messages: [{ type: "text", text: finalMessage }],
          }),
        });
      }
    }

    return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("全体エラー:", error);
    return new Response("Internal Server Error", { status: 500, headers: corsHeaders });
  }
});