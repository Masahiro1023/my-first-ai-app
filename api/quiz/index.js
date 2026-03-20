import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const QUIZ_SYSTEM_MESSAGE =
  "あなたは英語学習コーチです。ユーザーが日本語の問題文を英語に訳した回答を採点してください。必ず次の形式で返答してください。\n\n【判定】正解 / 惜しい / 不正解\n\n【模範解答】自然な英語の正解例を1〜2文書く。\n\n【解説】どこが良かったか、または何を直すべきかを日本語で2〜3文で説明する。初心者にわかりやすく、やさしいトーンで。\n\n返答は読みやすく、長くなりすぎないようにしてください。";

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
    const question = String(body.question ?? "").trim();
    const userAnswer = String(body.userAnswer ?? "").trim();

    if (!question || !userAnswer) {
      return res.status(400).json({ reply: "問題または回答が空です。" });
    }

    const prompt = [
      QUIZ_SYSTEM_MESSAGE,
      "",
      `問題（日本語）：${question}`,
      `ユーザーの回答：${userAnswer}`,
      "採点結果：",
    ].join("\n");

    const response = await client.responses.create({
      model: "gpt-5.4",
      input: prompt,
    });

    const replyText = response.output_text ?? "";
    return res.status(200).json({ reply: replyText });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ reply: "採点中にエラーが発生しました。" });
  }
}
