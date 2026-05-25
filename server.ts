import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import { GoogleGenAI, Type, GenerateVideosOperation } from "@google/genai";

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  if (!process.env.GEMINI_API_KEY) {
    console.error('CRITICAL: GEMINI_API_KEY is not set in .env or environment variables.');
  }

  app.use(express.json({ limit: '20mb' }));

  // SaaS Compliance Headers
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    next();
  });

  // SaaS Proxy Logic - Follows V4-3Step Doc
  const proxyRequest = async (req: any, res: any, targetPath: string) => {
    const targetUrl = `http://aibigtree.com${targetPath}`;
    try {
      const response = await axios({
        method: req.method,
        url: targetUrl,
        data: req.method === 'GET' ? undefined : req.body,
        params: req.method === 'GET' ? req.query : undefined,
        headers: { 'Content-Type': 'application/json' }
      });
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error(`SaaS Proxy Error (${targetUrl}):`, error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "代理转发失败" });
    }
  };

  // Support potential path prefixes from SaaS platform proxy (e.g. /ai-tool/{toolId}/api/...)
  const registerApi = (method: 'get' | 'post' | 'delete', path: string, handler: any) => {
    app[method](path, handler);
    app[method](`*/${path.replace(/^\//, '')}`, handler);
  };

  registerApi('post', "/api/tool/launch", (req, res) => proxyRequest(req, res, "/api/tool/launch"));
  registerApi('post', "/api/tool/verify", (req, res) => proxyRequest(req, res, "/api/tool/verify"));
  registerApi('post', "/api/tool/consume", (req, res) => proxyRequest(req, res, "/api/tool/consume"));
  registerApi('post', "/api/upload/direct-token", (req, res) => proxyRequest(req, res, "/api/upload/direct-token"));
  registerApi('post', "/api/upload/commit", (req, res) => proxyRequest(req, res, "/api/upload/commit"));
 
   const ai = new GoogleGenAI({
     apiKey: process.env.GEMINI_API_KEY || '',
     httpOptions: {
       headers: {
         'User-Agent': 'aistudio-build'
       }
     }
   });

  // SaaS Backend Save Logic (Rule 8-3)
  const saveResultToSaas = async (userId: string, toolId: string, base64Data: string, mimeType: string) => {
    const SAAS_ORIGIN = "http://aibigtree.com";
    const imageBuffer = Buffer.from(base64Data, 'base64');

    try {
      // 1. Consume
      const consumeRes = await axios.post(`${SAAS_ORIGIN}/api/tool/consume`, { userId, toolId });
      if (!consumeRes.data.success) throw new Error(consumeRes.data.message || "扣费失败");

      // 2. Direct Token
      const tokenRes = await axios.post(`${SAAS_ORIGIN}/api/upload/direct-token`, {
        userId, toolId, source: 'result', mimeType, fileSize: imageBuffer.length
      });
      if (!tokenRes.data.success) throw new Error("获取上传地址失败");

      const { uploadUrl, objectKey, headers } = tokenRes.data;

      // 3. PUT to OSS
      await axios.put(uploadUrl, imageBuffer, {
        headers: { ...headers, 'Content-Length': imageBuffer.length }
      });

      // 4. Commit
      const commitRes = await axios.post(`${SAAS_ORIGIN}/api/upload/commit`, {
        userId, toolId, source: 'result', objectKey, fileSize: imageBuffer.length
      });
      if (!commitRes.data.success || !commitRes.data.savedToRecords) throw new Error("图片入库失败");

      return commitRes.data.image;
    } catch (error: any) {
      console.error("SaaS Save Error:", error.response?.data || error.message);
      return null;
    }
  };

  // API Routes
  registerApi('post', "/api/analyze-hand", async (req, res) => {
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

  registerApi('post', "/api/analyze-nail-reference", async (req, res) => {
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

  registerApi('post', "/api/generate-nail-try-on", async (req, res) => {
    try {
      const { handImageBase64, handImageMimeType, prompt, referenceImageBase64, referenceImageMimeType, userId, toolId } = req.body;

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
        let saasImage = null;
        if (userId && toolId) {
          // Rule 8-3: Save in backend
          const base64Data = resultImage.split(',')[1];
          const mimeType = resultImage.split(';')[0].split(':')[1];
          saasImage = await saveResultToSaas(userId, toolId, base64Data, mimeType);
        }
        res.json({ result: resultImage, saasImage });
      } else {
        throw new Error("Failed to generate image");
      }
    } catch (error: any) {
      console.error('Error generating nail try-on:', error);
      res.status(500).json({ error: error.message });
    }
  });

  registerApi('post', "/api/generate-video", async (req, res) => {
    try {
      const { imageBase64, prompt } = req.body;
      let cleanBase64 = imageBase64;
      let resolvedMimeType = 'image/png';
      
      if (imageBase64.startsWith('http://') || imageBase64.startsWith('https://')) {
        // Fetch the image from URL and convert to Base64
        const imgRes = await axios.get(imageBase64, { responseType: 'arraybuffer' });
        const contentType = imgRes.headers['content-type'];
        if (contentType && typeof contentType === 'string') {
          resolvedMimeType = contentType;
        }
        cleanBase64 = Buffer.from(imgRes.data).toString('base64');
      } else if (imageBase64.includes(',')) {
        const parts = imageBase64.split(',');
        const mimeMatch = parts[0].match(/data:(.*?);/);
        if (mimeMatch) {
          resolvedMimeType = mimeMatch[1];
        }
        cleanBase64 = parts[1];
      } else {
        // If it looks like base64 chunk without data prefix, try basic prefix sniffing
        if (cleanBase64.startsWith('/9j/')) {
          resolvedMimeType = 'image/jpeg';
        } else if (cleanBase64.startsWith('UklGR')) {
          resolvedMimeType = 'image/webp';
        }
      }

      const operation = await ai.models.generateVideos({
        model: 'veo-3.1-lite-generate-preview',
        prompt: prompt || 'An ultra-high-quality, continuous 8-second video of a single elegant hand showcasing its custom manicure. For the first 4 seconds, the hand exhibits the beautiful back of the hand (nail-art/manicure side facing the camera) with elegant finger adjustments to highlight the shine. Then, a highly natural and realistic 180-degree continuous hand-flip occurs as the wrist rotates smoothly. For the remaining 4 seconds, the hand is completely turned around to showcase the palm of the hand facing the camera, with graceful finger flexing. Absolute physics consistency, smooth rotation, no sudden frame cuts, and perfectly matching skin tone and background throughout the 3D movement.',
        image: {
          imageBytes: cleanBase64,
          mimeType: resolvedMimeType,
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '9:16'
        }
      });

      res.json({ operationName: operation.name });
    } catch (error: any) {
      console.error('Error starting video generation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  registerApi('post', "/api/video-status", async (req, res) => {
    try {
      const { operationName } = req.body;
      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });
      res.json({ done: updated.done });
    } catch (error: any) {
      console.error('Error fetching video status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  registerApi('post', "/api/video-download", async (req, res) => {
    try {
      const { operationName } = req.body;
      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });
      const uri = updated.response?.generatedVideos?.[0]?.video?.uri;

      if (!uri) {
        throw new Error("Video download URI not found in completed operation");
      }

      const apiKey = process.env.GEMINI_API_KEY || '';
      const videoRes = await axios.get(uri, {
        headers: { 'x-goog-api-key': apiKey },
        responseType: 'arraybuffer'
      });

      res.setHeader('Content-Type', 'video/mp4');
      res.send(Buffer.from(videoRes.data));
    } catch (error: any) {
      console.error('Error downloading video:', error);
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
