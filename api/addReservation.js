import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { name, menus, date, time } = req.body;

  const { data, error } = await supabase
    .from('reservations')
    .insert([
      {
        name,
        menus,
        date,
        time,
        created_at: new Date(),
      }
    ]);

  if (error) return res.status(400).json({ error });

  res.status(200).json({ success: true });
}
