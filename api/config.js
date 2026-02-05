export default function handler(req, res) {
  res.setHeader("Content-Type", "application/javascript");
  res.send(`
    window.CONFIG = {
      SUPABASE_URL: "${process.env.SUPABASE_URL}",
      SUPABASE_KEY: "${process.env.SUPABASE_KEY}",
      SUPABASE_SERVICE_ROLE_KEY: "${process.env.SUPABASE_SERVICE_ROLE_KEY}"
    };
  `);
}
