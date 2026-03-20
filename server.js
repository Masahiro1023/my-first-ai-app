import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const port = 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());

// ルートにある静的ファイルを配信
app.use(express.static("."));

// トップページで index.html を返す
app.get("/", (req, res) => {
  res.sendFile(path.resolve("index.html"));
});

// 日本語を含むか簡易判定（ひらがな・カタカナ・漢字）
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

// 初心者向けにシンプルに: サーバーのメモリ上に履歴を保存します（再起動すると消えます）。
// ※この実装だと全ユーザーで履歴が共有されます。必要なら後で「ユーザーごと」に拡張できます。
const conversation = [];
const MAX_TURNS = 20;

function buildPrompt(history, nextUserMessage, mode) {
  const systemMessage = SYSTEM_MESSAGES[mode] ?? SYSTEM_MESSAGES.correct;
  const lines = [];
  lines.push(systemMessage);
  lines.push("");
  lines.push("以下はこれまでの会話です。ここに書かれた内容だけを根拠に、会話の流れと事実（例: ユーザー名）を必ず踏まえて回答してください。");
  lines.push("");

  for (const turn of history) {
    lines.push(`ユーザー: ${turn.user}`);
    lines.push(`AI: ${turn.ai}`);
    lines.push("");
  }

  lines.push(`ユーザー: ${nextUserMessage}`);
  lines.push("AI:");

  return lines.join("\n");
}

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = String(req.body?.message ?? "").trim();

    if (!userMessage) {
      return res.status(400).json({ reply: "メッセージが空です。" });
    }

    const mode = (() => {
      const m = req.body?.mode;
      if (m === "explain" || m === "conversation") return m;
      return isJapanese(userMessage) ? "translate" : "correct";
    })();

    const clientHistory = Array.isArray(req.body?.history)
      ? req.body.history.filter(
          (t) =>
            t &&
            typeof t.user === "string" &&
            typeof t.ai === "string"
        )
      : null;

    let history = clientHistory ?? conversation;

    if (history.length > MAX_TURNS) {
      history = history.slice(-MAX_TURNS);
    }

    const prompt = buildPrompt(history, userMessage, mode);

    const response = await client.responses.create({
      model: "gpt-5.4",
      input: prompt,
    });

    const replyText = response.output_text ?? "";

    if (!clientHistory) {
      conversation.push({ user: userMessage, ai: replyText });
    }

    res.json({
      reply: replyText,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      reply: "エラーが発生しました。",
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});