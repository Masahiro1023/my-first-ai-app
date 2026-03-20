import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function isJapanese(text) {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
}

const SYSTEM_MESSAGES = {
  correct:
    "あなたは英語学習コーチです。ユーザーが英語を書いたときは、必ず次の順番で返答してください。\n\n1. 修正版：自然な英語に直した文を書く。\n2. 解説：なぜそう直したかを日本語で短く説明する（1〜2文程度）。\n3. 言い換え：似た表現を1つだけ示す（「こんな言い方も：」など）。\n\n全体は読みやすく、長くなりすぎないようにしてください。日本語で質問された場合は、英語学習に役立つ形で簡潔に答えてください。会話の履歴と文脈は踏まえて回答してください。",
  translate:
    "あなたは英語学習コーチです。ユーザーが日本語を書いたときは、次の順番で返答してください。\n\n1. 自然な英語：日本語を自然な英語に翻訳した文を書く。\n2. 補足：必要なら使い方のポイントを日本語で1〜2文で説明する。\n\n全体は読みやすく、長くなりすぎないようにしてください。会話の履歴と文脈は踏まえて回答してください。",
  explain:
    "あなたは英語の説明役です。ユーザーが文法・単語・表現について質問したら、日本語でわかりやすく説明してください。例文を1〜2個挙げ、使い方のポイントを簡潔にまとめてください。返答は長くなりすぎないようにしてください。会話の履歴と文脈は踏まえて回答してください。",
  conversation:
    "あなたは英語会話の練習相手です。ユーザーと英語で自然な会話を続けてください。ユーザーが英語で書いたら、主に英語で返答し、ときどき日本語でヒントを添えてください。文法のミスがあれば優しく直しつつ、会話を続けましょう。返答は短めに、長くなりすぎないようにしてください。会話の履歴と文脈は踏まえて回答してください。",
};

const MAX_TURNS = 20;

function buildPrompt(history, nextUserMessage, mode) {
  const systemMessage = SYSTEM_MESSAGES[mode] ?? SYSTEM_MESSAGES.correct;
  const lines = [
    systemMessage,
    "",
    "以下はこれまでの会話です。ここに書かれた内容だけを根拠に、会話の流れと事実（例: ユーザー名）を必ず踏まえて回答してください。",
    "",
  ];
  for (const turn of history) {
    lines.push(`ユーザー: ${turn.user}`);
    lines.push(`AI: ${turn.ai}`);
    lines.push("");
  }
  lines.push(`ユーザー: ${nextUserMessage}`);
  lines.push("AI:");
  return lines.join("\n");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
    const userMessage = String(body.message ?? "").trim();
    if (!userMessage) {
      return res.status(400).json({ reply: "メッセージが空です。" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ reply: "OPENAI_API_KEY が設定されていません。" });
    }

    const m = body.mode;
    const mode = m === "explain" || m === "conversation" ? m : isJapanese(userMessage) ? "translate" : "correct";

    const clientHistory = Array.isArray(body.history)
      ? body.history.filter((t) => t && typeof t.user === "string" && typeof t.ai === "string")
      : null;
    let history = clientHistory ?? [];
    if (history.length > MAX_TURNS) history = history.slice(-MAX_TURNS);

    const prompt = buildPrompt(history, userMessage, mode);
    const response = await client.responses.create({
      model: "gpt-5.4",
      input: prompt,
    });

    const replyText = response.output_text ?? "";
    return res.status(200).json({ reply: replyText });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ reply: "エラーが発生しました。" });
  }
}
