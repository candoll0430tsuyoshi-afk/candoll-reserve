import { google } from "googleapis";

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

// 表示したい時間枠（サンプル：毎日10:00〜18:00を1時間単位で）
const AVAILABLE_TIMES = [
  "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"
];

export default async function handler(req, res) {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: "date parameter required" });
    }

    // 日付の開始・終了
    const start = new Date(`${date}T00:00:00+09:00`).toISOString();
    const end   = new Date(`${date}T23:59:59+09:00`).toISOString();

    const events = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
      timeMin: start,
      timeMax: end,
      singleEvents: true,
      orderBy: "startTime"
    });

    const bookedTimes = events.data.items.map(item => {
      return new Date(item.start.dateTime).getHours().toString().padStart(2, "0")
             + ":" 
             + new Date(item.start.dateTime).getMinutes().toString().padStart(2, "0");
    });

    const freeTimes = AVAILABLE_TIMES.filter(t => !bookedTimes.includes(t));

    return res.status(200).json({ date, freeTimes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
