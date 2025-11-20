// /api/freeTimes.js
import { google } from "googleapis";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date is required" });

  // サービスアカウント JSON
  const keyPath = path.join(process.cwd(), "service-account.json");
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = "あなたのカレンダーID@group.calendar.google.com";

  // 日付の開始と終了（UTCに注意）
  const start = new Date(`${date}T10:00:00`);
  const end = new Date(`${date}T18:00:00`);

  try {
    const response = await calendar.events.list({
      calendarId,
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    // 予約済み時間を抽出
    const bookedTimes = response.data.items.map(event => {
      const startTime = new Date(event.start.dateTime || event.start.date);
      return `${startTime.getHours().toString().padStart(2,"0")}:${startTime.getMinutes().toString().padStart(2,"0")}`;
    });

    // 10:00〜18:00 30分刻みで空き時間を計算
    const allSlots = [];
    for(let h=10; h<18; h++){
      allSlots.push(`${h.toString().padStart(2,'0')}:00`);
      allSlots.push(`${h.toString().padStart(2,'0')}:30`);
    }
    allSlots.push('18:00'); // 最後の18:00も追加

    const freeTimes = allSlots.filter(t => !bookedTimes.includes(t));

    res.status(200).json({ freeTimes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Google Calendar API error" });
  }
}
