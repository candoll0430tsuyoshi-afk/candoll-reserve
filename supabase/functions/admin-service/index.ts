import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // CORS設定：ブラウザからのアクセスを許可
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // プリフライトリクエスト対応
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    // Secretsから鍵を取得
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const body = await req.json();
    const { mode, password } = body;

    // ============================================
    // 1. publicList：予約フォーム向け一般公開（認証不要）
    // ============================================
    if (mode === "publicList") {
      const supabase = createClient(SUPABASE_URL, ANON_KEY);
      const { data: holidays } = await supabase.from("holidays").select("*");
      const { data: special_open } = await supabase.from("special_open").select("*");

      return new Response(JSON.stringify({ holidays, special_open }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // ============================================
    // 2. 認証：これ以降の管理機能はパスワードが必須
    // ============================================
    if (password !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "AuthError" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // 管理者用の強力な権限（service_role）で操作を開始
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // list : 予約・メニュー・休日すべてのデータを取得
    if (mode === "list") {
      const { data: reservations } = await supabase.from("reservations").select("*").order("date", { ascending: true }).order("time", { ascending: true });
      const { data: holidays } = await supabase.from("holidays").select("*");
      const { data: special_open } = await supabase.from("special_open").select("*");
      const { data: menus } = await supabase.from("menus").select("*").order("sort", { ascending: true });

      return new Response(JSON.stringify({ reservations, holidays, special_open, menus }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // add : 予約追加
    if (mode === "add") {
      const { name, menus, date, time, end_time } = body;
      await supabase.from("reservations").insert([{ name, menus, date, time, end_time }]);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }

    // edit : 予約編集
    if (mode === "edit") {
      const { id, name, menus, date, time, end_time } = body;
      await supabase.from("reservations").update({ name, menus, date, time, end_time }).eq("id", id);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }

    // delete : 予約削除
    if (mode === "delete") {
      await supabase.from("reservations").delete().eq("id", body.id);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }

    // 休日設定（addHoliday / delHoliday）
    if (mode === "addHoliday") {
      await supabase.from("holidays").insert([{ date: body.date }]);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }
    if (mode === "delHoliday") {
      await supabase.from("holidays").delete().eq("date", body.date);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }

    // 特例営業日（addSpecialOpen / delSpecialOpen）
    if (mode === "addSpecialOpen") {
      await supabase.from("special_open").insert([{ date: body.date }]);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }
    if (mode === "delSpecialOpen") {
      await supabase.from("special_open").delete().eq("date", body.date);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), { status: 400, headers: corsHeaders });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});