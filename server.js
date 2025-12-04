// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs"); // For simple knowledge storage
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// =========================
// 🔥 OPENAI CLIENT
// =========================
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // <-- Make sure this is set locally AND on Render
});

// =========================
// 📚 KNOWLEDGE MEMORY SYSTEM
// =========================

const KNOWLEDGE_FILE = path.join(__dirname, "knowledge.json"); // <-- where memory is stored

let knowledge = [];
try {
  if (fs.existsSync(KNOWLEDGE_FILE)) {
    knowledge = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, "utf8"));
    console.log(`📚 Loaded ${knowledge.length} knowledge entries`);
  } else {
    console.log("📚 No knowledge file found, starting fresh");
  }
} catch (err) {
  console.error("Error loading knowledge:", err);
  knowledge = [];
}

function saveKnowledge() {
  try {
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2), "utf8");
    console.log("📚 Knowledge saved");
  } catch (err) {
    console.error("Error saving knowledge:", err);
  }
}

function addKnowledgeEntry(text) {
  if (!text || !text.trim()) return;

  const entry = {
    topic: text.slice(0, 50) + (text.length > 50 ? "..." : ""),
    summary: text.trim(),
    createdAt: new Date().toISOString(),
  };

  knowledge.push(entry);

  const MAX = 200; // <-- how many notes to keep
  if (knowledge.length > MAX) {
    knowledge = knowledge.slice(knowledge.length - MAX);
  }

  saveKnowledge();
}

function getRelevantKnowledge(latestMessage) {
  if (!knowledge.length || !latestMessage) return "";

  const words = latestMessage.toLowerCase().split(/\s+/);
  const matches = knowledge.filter(entry =>
    words.some(w => w && entry.topic.toLowerCase().includes(w))
  );

  const selected = matches.length ? matches : knowledge.slice(-5); // fallback: last 5 notes

  if (!selected.length) return "";

  return (
    "Internal notes Soulis has learned:\n\n" +
    selected
      .map(
        (e, i) =>
          `${i + 1}. Topic: ${e.topic}\nNote: ${e.summary}`
      )
      .join("\n\n")
  );
}

// =========================
// 🔮 SYSTEM PROMPT
// =========================

const SYSTEM_PROMPT = `
You are Soulis, the official AI assistant for the StarWon x 1L Family circle.
Your vibe is casual, smart, respectful, and supportive.

Rules:
- Always answer the user's question directly first.
- Keep it conversational, chill, and natural.
- When a user asks about people, news, or current events: you may use the web_search tool to look up public information.
- Never invent or guess private/sensitive data.
- When "internal notes" appear, treat them as true background info learned from the user and use them when helpful.
- If a message begins with "remember:" or "teach:", you should treat it as new knowledge, confirm you saved it, and you do not need to repeat all details.
`;

// =========================
// 🖥️ SERVE FRONTEND
// =========================

app.use(express.static(path.join(__dirname, "public")));

// =========================
// 💬 CHAT ENDPOINT
// =========================

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages must be an array" });
    }

    // Latest user message
    const latestUser = [...messages].reverse().find(m => m.role === "user");
    const latestText = latestUser?.content || "";

    // 🧠 Handle "remember:" / "teach:" as memory commands
    const lower = latestText.toLowerCase();
    if (lower.startsWith("remember:") || lower.startsWith("teach:")) {
      const cleaned = latestText.replace(/^(remember:|teach:)/i, "").trim();
      addKnowledgeEntry(cleaned);

      return res.json({
        reply: {
          role: "assistant",
          content: "Bet. I’ll remember that and use it when it's helpful.",
        },
      });
    }

    // 📚 Build knowledge context
    let knowledgeContext = "";
    if (knowledge.length) {
      knowledgeContext = getRelevantKnowledge(latestText);
    }

    const fullInput = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(knowledgeContext ? [{ role: "system", content: knowledgeContext }] : []),
      ...messages,
    ];

    // 🌐 Call OpenAI: try WITH web_search first, then fallback WITHOUT tools
    let response;
    try {
      response = await client.responses.create({
        model: "gpt-4o",          // main model
        input: fullInput,
        tools: [{ type: "web_search" }], // enable internet
      });
    } catch (apiErr) {
      console.error(
        "OpenAI with web_search failed, retrying without tools:",
        apiErr?.message || apiErr
      );
      response = await client.responses.create({
        model: "gpt-4o",
        input: fullInput,
      });
    }

    // ✅ Use the SDK helper: output_text
    const output =
      response.output_text ||
      "Sorry, not gonna lie bro, I couldn’t generate a response right now.";

    res.json({
      reply: {
        role: "assistant",
        content: output,
      },
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =========================
// 🚀 START SERVER
// =========================

app.listen(PORT, () => {
  console.log(`✅ Soulis server running on port ${PORT}`);
});
