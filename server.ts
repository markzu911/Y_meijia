import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  if (!process.env.GEMINI_API_KEY) {
    console.error('CRITICAL: GEMINI_API_KEY is not set in .env or environment variables.');
  }

  app.use(express.json({ limit: '50mb' }));

  // SaaS Proxy Logic
  const proxyRequest = async (req: any, res: any, targetPath: string) => {
    const targetUrl = `http://aibigtree.com${targetPath}`;
    try {
      const response = await axios({
        method: req.method,
        url: targetUrl,
        data: req.body,
        headers: { 'Content-Type': 'application/json' }
      });
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error(`SaaS Proxy Error (${targetPath}):`, error.message);
      res.status(500).json({ success: false, message: "代理转发失败", error: error.message });
    }
  };

  app.post("*/api/tool/launch", (req, res) => proxyRequest(req, res, "/api/tool/launch"));
  app.post("*/api/tool/verify", (req, res) => proxyRequest(req, res, "/api/tool/verify"));
  app.post("*/api/tool/consume", (req, res) => proxyRequest(req, res, "/api/tool/consume"));

  app.get("*/api/health-check", async (req, res) => {
    try {
      const saasRes = await axios.get("http://aibigtree.com/api/tool/launch", { 
        timeout: 3000,
        validateStatus: () => true
      });
      
      res.json({ 
        success: true, 
        connected: true,
        message: "SaaS 系统接口已连接"
      });
    } catch (e: any) {
      res.json({ 
        success: true, 
        connected: false,
        message: "SaaS 系统接口连接失败 (aibigtree.com)"
      });
    }
  });

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  // API Routes
  app.post('*/api/analyze-hand', async (req, res) => {
    try {
      const { base64, mimeType } = req.body;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64,
                mimeType: mimeType,
              },
            },
            {
              text: "Analyze this hand photo. Provide the hand shape, skin tone, and recommend a nail style (猫眼, 法式, 渐变, 纯色, 装饰, or 手绘) that would look best. Also provide a brief explanation for the recommendation. Please respond in Chinese.",
            },
          ],
        }],
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
    } catch (error: any) {
      console.error('Error analyzing hand:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('*/api/analyze-nail-reference', async (req, res) => {
    try {
      const { base64, mimeType } = req.body;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64,
                mimeType: mimeType,
              },
            },
            {
              text: "Analyze this nail design reference photo. Extract the detailed information about the nails: color, length, material/finish, and any specific patterns or decorations. Please respond in Chinese.",
            },
          ],
        }],
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
    } catch (error: any) {
      console.error('Error analyzing nail reference:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('*/api/generate-nail-try-on', async (req, res) => {
    try {
      const { handImageBase64, handImageMimeType, prompt, referenceImageBase64, referenceImageMimeType } = req.body;

      const parts: any[] = [];

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
1. EXACT REPLICATION: You must copy the exact colors, 3D decorations (e.g., bows, flowers, pearls, rhinestones), and layout seen in Image 2. 
2. NO ALTERATIONS: DO NOT color the nails differently. DO NOT change the material, texture, length, shape, or finish of the reference nails.
3. NO INVENTIONS: DO NOT add any new decorations, gems, or patterns.
4. NO OMISSIONS: DO NOT skip or simplify any of the 3D structures or designs from Image 2.
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
        contents: [{ role: 'user', parts: parts }]
      });

      let resultImage = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          resultImage = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (resultImage) {
        res.json({ result: resultImage });
      } else {
        throw new Error("Failed to generate image");
      }
    } catch (error: any) {
      console.error('Error generating nail try-on:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
