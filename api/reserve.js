// /api/reserve.js
import { google } from "googleapis";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, menus, date, time } = req.body;
  if (!name || !menus || !date || !time) return res.status(400).json({ error: "Missing parameters" });

  const keyPath = path.join(process.cwd(), "service-account.json");
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = "candoll202601@gmail.com";

  // 予約時間と終了時間（ここでは60分固定）
  const startDateTime = new Date(`${date}T${time}:00`);
  const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1時間後

  try {
    await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `予約: ${menus.join(", ")}`,
        description: `予約者: ${name}`,
        start: { dateTime: startDateTime.toISOString(), timeZone: "Asia/Tokyo" },
        end: { dateTime: endDateTime.toISOString(), timeZone: "Asia/Tokyo" },
      },
    });

    res.status(200).json({ message: "予約が完了しました！" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Google Calendar API error" });
  }
}

