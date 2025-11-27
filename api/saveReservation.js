import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { name, menus, date, time } = req.body;

  // 入力チェック
  if (!name || !menus || !date || !time) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const { data, error } = await supabase
    .from("reservations")
    .insert([
      {
        name: name,
        menus: menus,
        date: date,
        time: time,
      }
    ]);

  if (error) {
    return res.status(500).json({ error });
  }

  return res.status(200).json({ success: true });
}
