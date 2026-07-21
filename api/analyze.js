import { handleAnalyze } from "../lib/analyze.js";

export const config = {
  // 4.5 МБ — потолок тела запроса на Vercel. Клиент сжимает фото до ~0.5 МБ.
  api: { bodyParser: { sizeLimit: "4.5mb" } },
  maxDuration: 120,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST" });
    return;
  }

  const body =
    typeof req.body === "string" ? safeParse(req.body) : req.body;

  const { status, body: payload } = await handleAnalyze(body);
  res.status(status).json(payload);
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
