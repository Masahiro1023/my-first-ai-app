import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ question: "" });
  }

  try {
    const prompt = [
      "あなたは英語学習コーチです。",
      "初心者〜中級者向けの「日本語→英語」翻訳クイズを1問だけ作ってください。",
      "日常会話でよく使う自然な日本語の文を1文だけ出力してください。",
      "余計な説明・記号・番号は一切つけず、日本語の文だけを返してください。",
      "例：私は毎朝ジョギングをしています。",
    ].join("\n");

    const response = await client.responses.create({
      model: "gpt-5.4",
      input: prompt,
    });

    const question = (response.output_text ?? "").trim();
    return res.status(200).json({ question });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ question: "" });
  }
}