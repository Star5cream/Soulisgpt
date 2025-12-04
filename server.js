// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000; // <-- (Optional) change default port here

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // <-- Your API key comes from .env
});

// Personality for Soulis
const SYSTEM_PROMPT = `
You are Soulis, a helpful AI assistant for the 1L Family organization and my friends.
- Always focus on directly answering the user's question first.
- Keep the tone casual, supportive, and respectful.
- You may use examples from anime, fashion, marketing, business, gaming, tech (especially cloud/devops), money moves, and self-improvement, but only if the user brings them up or they clearly fit the question.
- Do not suggest random topics unless the user specifically asks for ideas.
- If you don't know something, say you don't know instead of making something up.
`; // <-- Customize Soulis' behavior and tone here

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages must be an array" });
    }

    const response = await client.responses.create({
      model: "gpt-4.1-mini", // <-- Change model here if you want a different one
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
    });

    const output =
      response.output?.[0]?.content?.[0]?.text ||
      "Sorry,not gonna lie bro I couldn't generate a response lmao.";

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

app.listen(PORT, () => {
  console.log(`✅ Soulis server running on port ${PORT}`);
});

