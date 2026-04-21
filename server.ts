import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;
const SAAS_API_BASE_URL = process.env.SAAS_API_BASE_URL || "http://aibigtree.com";

const getGeminiApiKey = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in .env");
  }
  return apiKey;
};

const getAi = () => new GoogleGenAI({ apiKey: getGeminiApiKey() });

const proxyToSaas = async (req: express.Request, res: express.Response, targetPath: string) => {
  try {
    const response = await fetch(`${SAAS_API_BASE_URL}${targetPath}`, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    res.status(response.status).json(payload);
  } catch (error) {
    console.error(`Failed to proxy ${targetPath}`, error);
    res.status(500).json({ success: false, message: "代理转发失败" });
  }
};

async function startServer() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    next();
  });

  app.post("/api/tool/launch", async (req, res) => {
    await proxyToSaas(req, res, "/api/tool/launch");
  });

  app.post("/api/tool/verify", async (req, res) => {
    await proxyToSaas(req, res, "/api/tool/verify");
  });

  app.post("/api/tool/consume", async (req, res) => {
    await proxyToSaas(req, res, "/api/tool/consume");
  });

  app.post("/api/analyze-hand", async (req, res) => {
    try {
      const { base64Image, mimeType } = req.body;
      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType,
              },
            },
            {
              text: "Analyze this hand photo. Provide the hand shape, skin tone, and recommend a nail style (猫眼, 法式, 渐变, 纯色, 装饰, or 手绘) that would look best. Also provide a brief explanation for the recommendation. Please respond in Chinese.",
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              handShape: { type: Type.STRING, description: "The shape of the hand/fingers (in Chinese)" },
              skinTone: { type: Type.STRING, description: "The skin tone (in Chinese)" },
              recommendedStyle: { type: Type.STRING, description: "The recommended nail style (must be one of: 猫眼, 法式, 渐变, 纯色, 装饰, 手绘)" },
              explanation: { type: Type.STRING, description: "Explanation for the recommendation (in Chinese)" },
            },
            required: ["handShape", "skinTone", "recommendedStyle", "explanation"],
          },
        },
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to analyze hand" });
    }
  });

  app.post("/api/analyze-reference", async (req, res) => {
    try {
      const { base64Image, mimeType } = req.body;
      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType,
              },
            },
            {
              text: "Analyze this nail design reference photo. Extract the detailed information about the nails: color, length, material or finish, and any specific patterns or decorations. Please respond in Chinese.",
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              color: { type: Type.STRING, description: "Color of the nails (in Chinese)" },
              length: { type: Type.STRING, description: "Length and shape of the nails (in Chinese)" },
              material: { type: Type.STRING, description: "Material or finish of the nails (in Chinese)" },
              details: { type: Type.STRING, description: "Patterns or decorations on the nails (in Chinese)" },
            },
            required: ["color", "length", "material", "details"],
          },
        },
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to analyze reference" });
    }
  });

  app.post("/api/generate-tryon", async (req, res) => {
    try {
      const {
        handImageBase64,
        handImageMimeType,
        prompt,
        referenceImageBase64,
        referenceImageMimeType,
      } = req.body;

      const ai = getAi();
      const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];

      if (referenceImageBase64 && referenceImageMimeType) {
        parts.push({ text: "Image 1 (Target Hand):" });
        parts.push({
          inlineData: {
            data: handImageBase64,
            mimeType: handImageMimeType,
          },
        });
        parts.push({ text: "Image 2 (Reference Nails):" });
        parts.push({
          inlineData: {
            data: referenceImageBase64,
            mimeType: referenceImageMimeType,
          },
        });
        parts.push({
          text: `CRITICAL INSTRUCTION: This is a strict style transfer task. Edit Image 1 (Target Hand). Keep the hand, skin, lighting, and background of Image 1 EXACTLY the same. ONLY change the fingernails.
You MUST extract the nail design from Image 2 (Reference Nails) and apply it directly onto the fingernails in Image 1.

To ensure absolute accuracy, you must perfectly replicate these details from Image 2:
>>>
${prompt}
<<<

RULES:
1. EXACT REPLICATION: You must copy the exact colors, 3D decorations (for example bows, flowers, pearls, rhinestones), and layout seen in Image 2.
2. NO ALTERATIONS: Do not change the material, texture, length, shape, or finish of the reference nails.
3. NO INVENTIONS: Do not add any new decorations, gems, or patterns.
4. NO OMISSIONS: Do not skip or simplify any of the 3D structures or designs from Image 2.
5. REALISM: The final result must look like a direct Photoshop copy-paste of the nails from Image 2 onto the fingers in Image 1.`,
        });
      } else {
        parts.push({
          inlineData: {
            data: handImageBase64,
            mimeType: handImageMimeType,
          },
        });
        parts.push({
          text: `CRITICAL INSTRUCTION: Edit this image to apply the following nail style to the fingernails. You MUST strictly and exactly follow this description without adding, removing, or inventing any details: "${prompt}". Do not self-play or hallucinate. Ensure the lighting and shadows match the original hand.`,
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: {
          parts,
        },
      });

      let returnedImage: string | null = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          returnedImage = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (!returnedImage) {
        throw new Error("No image generated by model");
      }

      res.json({ resultImage: returnedImage });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate try-on" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
