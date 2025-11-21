import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "date が必要です" });
    }

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const client = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ["https://www.googleapis.com/auth/calendar.readonly"]
    );

    const calendar = google.calendar({ version: "v3", auth: client });

    const start = new Date(`${date}T00:00:00+09:00`);
    const end = new Date(`${date}T23:59:59+09:00`);

    const result = await calendar.events.list({
      calendarId: "candoll202601@gmail.com",
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime"
    });

    const events = result.data.items;
    const free = [];

    const times = [];
    for (let h = 10; h <= 18; h++) {
      times.push(`${h.toString().padStart(2, "0")}:00`);
      if (h < 18) times.push(`${h.toString().padStart(2, "0")}:30`);
    }

    times.forEach((t) => {
      const s = new Date(`${date}T${t}:00+09:00`);
      const overlap = events.some((ev) => {
        const evStart = new Date(ev.start.dateTime);
        const evEnd = new Date(ev.end.dateTime);
        return s >= evStart && s < evEnd;
      });
      free.push({ time: t, available: !overlap });
    });

    res.status(200).json(free);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
}
