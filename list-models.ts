import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function main() {
  const models = await ai.models.list();
  for await (const m of models) {
    if (m.name.includes("veo")) {
      console.log(m.name);
    }
  }
}
main();
