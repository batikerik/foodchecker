import { GoogleGenAI } from "@google/genai";

// Основная модель и запасная на случай, если основную переименуют/уберут.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const FALLBACK_MODEL = "gemini-flash-latest";

// Набор допустимых уровней зависит от модели, поэтому ошибку по нему обрабатываем отдельно.
const THINKING_LEVEL = process.env.GEMINI_THINKING || "high";

let client = null;
function getClient() {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

const RESULT_SCHEMA = {
  type: "object",
  properties: {
    readable: {
      type: "boolean",
      description: "Удалось ли прочитать состав на фото",
    },
    product: {
      type: "string",
      description:
        "Что это за продукт (например «шоколадный батончик», «гель для волос»). Если непонятно — «неизвестно».",
    },
    score: {
      type: "integer",
      description:
        "Оценка безопасности от 0 до 100 с учётом профиля пользователя. 0 — крайне опасно, 100 — полностью безопасно.",
    },
    verdict: {
      type: "string",
      enum: ["хорошо", "приемлемо", "с осторожностью", "плохо"],
    },
    summary: {
      type: "string",
      description: "Короткий вывод в 1–3 предложениях, простым языком.",
    },
    ingredients: {
      type: "array",
      description: "Разбор ключевых компонентов состава",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          risk: {
            type: "string",
            enum: ["безопасно", "нейтрально", "внимание", "опасно"],
          },
          note: {
            type: "string",
            description: "Что это и чем важно — 1–2 предложения",
          },
        },
        required: ["name", "risk", "note"],
      },
    },
    concerns: {
      type: "array",
      description: "Основные риски и опасные моменты состава",
      items: { type: "string" },
    },
    avoid_for: {
      type: "array",
      description: "Кому противопоказано или нежелательно",
      items: { type: "string" },
    },
    ok_for: {
      type: "array",
      description: "Кому можно применять без особых опасений",
      items: { type: "string" },
    },
    personal: {
      type: "array",
      description:
        "Замечания лично для этого пользователя на основе его профиля. Пустой массив, если профиль не заполнен.",
      items: { type: "string" },
    },
  },
  required: [
    "readable",
    "product",
    "score",
    "verdict",
    "summary",
    "ingredients",
    "concerns",
    "avoid_for",
    "ok_for",
    "personal",
  ],
};

const SYSTEM = `Ты — эксперт по составам: нутрициолог, токсиколог и косметический химик в одном лице.

Пользователь присылает фотографию состава чего угодно: еда, напиток, БАД, косметика, бытовая химия, детское питание, лекарство.

Твоя задача:
1. Прочитать состав с фотографии (текст может быть на любом языке, мелкий, под углом, с бликами).
2. Разобрать ключевые компоненты: что это, зачем оно там, чем оно рискованно.
3. Назвать, кому это противопоказано, а кому можно.
4. Дать оценку безопасности от 0 до 100.

Правила оценки:
- 85–100 — чистый состав, натуральные или безопасные компоненты.
- 65–84 — в целом нормально, есть мелкие замечания.
- 40–64 — есть спорные компоненты, регулярно употреблять/использовать не стоит.
- 15–39 — много проблемных компонентов, лучше избегать.
- 0–14 — опасно, есть запрещённые или сильно вредные вещества.

Важно:
- Пиши по-русски, коротко и по делу, без воды и без канцелярита.
- Опирайся на факты и научный консенсус, не пугай без причины и не приукрашивай.
- Если состав на фото не читается или это не состав — поставь readable=false, score=0 и объясни в summary, что именно нужно переснять.
- Если указан профиль пользователя — учитывай его в оценке score и обязательно заполни personal.
- Ты не врач. Не ставь диагнозов и не отменяй назначений врача. При серьёзных рисках советуй обратиться к специалисту.`;

function profileToText(profile) {
  if (!profile || typeof profile !== "object") return null;
  const lines = [];
  const push = (label, value) => {
    if (typeof value === "string" && value.trim()) {
      lines.push(`${label}: ${value.trim()}`);
    }
  };
  push("Возраст", profile.age);
  push("Пол", profile.sex);
  push("Аллергии и непереносимости", profile.allergies);
  push("Хронические заболевания", profile.conditions);
  push("Особые состояния (беременность, ГВ и т.п.)", profile.states);
  push("Диета и ограничения", profile.diet);
  push("Дополнительно", profile.notes);
  return lines.length ? lines.join("\n") : null;
}

/**
 * Отправляет запрос, обходя две вещи, которые зависят от конкретной модели:
 * имя модели (могут переименовать) и набор допустимых уровней размышления.
 */
async function createWithFallbacks(request) {
  const ai = getClient();
  try {
    return await ai.interactions.create({ ...request, model: MODEL });
  } catch (err) {
    const message = apiMessage(err);

    if (err?.status === 404 && MODEL !== FALLBACK_MODEL) {
      console.warn(`Модель ${MODEL} недоступна, пробую ${FALLBACK_MODEL}`);
      return ai.interactions.create({ ...request, model: FALLBACK_MODEL });
    }

    if (err?.status === 400 && /thinking level/i.test(message)) {
      console.warn(
        `Уровень размышления "${THINKING_LEVEL}" не принят (${message}), повторяю без него`,
      );
      const { thinking_level, ...rest } = request.generation_config;
      return ai.interactions.create({
        ...request,
        model: MODEL,
        generation_config: rest,
      });
    }

    throw err;
  }
}

/** Текст ответа: сначала готовое поле, иначе собираем из шагов вручную. */
function readText(interaction) {
  if (interaction.output_text) return interaction.output_text;
  const parts = [];
  for (const step of interaction.steps ?? []) {
    for (const block of step.content ?? []) {
      if (block.type === "text" && block.text) parts.push(block.text);
    }
  }
  return parts.join("");
}

/**
 * @param {{ imageBase64: string, mediaType: string, profile?: object }} input
 */
export async function analyzeComposition({ imageBase64, mediaType, profile }) {
  const profileText = profileToText(profile);

  const prompt = profileText
    ? `Разбери состав с этой фотографии.\n\nПрофиль пользователя, для которого нужно оценить безопасность:\n${profileText}`
    : `Разбери состав с этой фотографии. Профиль пользователя не указан — дай общую оценку и оставь personal пустым.`;

  const request = {
    system_instruction: SYSTEM,
    input: [
      { type: "image", data: imageBase64, mime_type: mediaType },
      { type: "text", text: prompt },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: RESULT_SCHEMA,
    },
    generation_config: {
      max_output_tokens: 8000,
      thinking_level: THINKING_LEVEL,
    },
  };

  const interaction = await createWithFallbacks(request);

  const text = readText(interaction);
  if (!text) {
    throw Object.assign(new Error("Пустой ответ модели."), { status: 502 });
  }
  return JSON.parse(text);
}

export const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Общая обработка запроса — используется и на Vercel, и локальным сервером. */
export async function handleAnalyze(body) {
  const { image, mediaType, profile } = body ?? {};

  if (typeof image !== "string" || image.length < 100) {
    return { status: 400, body: { error: "Фотография не передана." } };
  }
  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return { status: 400, body: { error: "Неподдерживаемый формат изображения." } };
  }
  if (!process.env.GEMINI_API_KEY) {
    return {
      status: 500,
      body: { error: "На сервере не задан GEMINI_API_KEY." },
    };
  }

  try {
    const result = await analyzeComposition({
      imageBase64: image,
      mediaType,
      profile,
    });
    return { status: 200, body: result };
  } catch (err) {
    const status = err.status ?? err.statusCode ?? 500;
    // SDK кладёт в ошибку весь HTTP-объект — в лог нужны только суть и код.
    console.error(`analyze failed [${status}]:`, apiMessage(err) || err);
    return {
      status: status >= 400 && status < 600 ? status : 500,
      body: { error: friendlyError(status, err) },
    };
  }
}

/** Достаём короткий текст ошибки: SDK прячет его в разных местах. */
function apiMessage(err) {
  const raw =
    err?.error?.error?.message ??
    err?.error?.message ??
    err?.message ??
    "";
  return String(raw).replace(/^\d{3}\s+/, "").trim();
}

/** Сырые ошибки API пользователю показывать нельзя — переводим в человеческий текст. */
function friendlyError(status, err) {
  const message = apiMessage(err);

  if (/API key not valid|API_KEY_INVALID|API key expired/i.test(message)) {
    return "Ключ Gemini недействителен. Проверь GEMINI_API_KEY на сервере.";
  }
  if (/SAFETY|blocked/i.test(message)) {
    return "Модель отказалась разбирать это изображение.";
  }

  switch (status) {
    case 400:
      // Текст от Google тут диагностический и не содержит секретов — показываем.
      return message
        ? `Запрос отклонён API: ${message}`
        : "Запрос отклонён API. Смотри логи сервера.";
    case 403:
      return "У ключа нет доступа к этой модели.";
    case 404:
      return "Модель недоступна. Попробуй задать другую в GEMINI_MODEL.";
    case 413:
      return "Фотография слишком большая.";
    case 429:
      return "Исчерпан бесплатный лимит запросов. Подожди минуту и попробуй снова.";
    default:
      return status >= 500
        ? "Gemini временно недоступен. Попробуй ещё раз."
        : "Не получилось разобрать состав.";
  }
}
