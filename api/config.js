export default function handler(req, res) {
  res.setHeader("Content-Type", "application/javascript");
  
  const config = {
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_KEY: process.env.SUPABASE_KEY || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  };

  res.send(`window.CONFIG = ${JSON.stringify(config)};`);
}
