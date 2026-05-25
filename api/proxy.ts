import { GoogleGenAI, Type, GenerateVideosOperation } from "@google/genai";
import axios from "axios";
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const SAAS_ORIGIN = "http://aibigtree.com";

const saveResultToSaas = async (userId: string, toolId: string, base64Data: string, mimeType: string) => {
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

const proxyToSaas = async (req: VercelRequest, res: VercelResponse, targetPath: string) => {
  const targetUrl = `${SAAS_ORIGIN}${targetPath}`;
  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.method === 'GET' ? undefined : req.body,
      params: req.method === 'GET' ? req.query : undefined,
      headers: { 'Content-Type': 'application/json' }
    });
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error(`SaaS Proxy Error (${targetUrl}):`, error.response?.data || error.message);
    return res.status(error.response?.status || 500).json(error.response?.data || { error: "代理转发失败" });
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const fullPath = req.url || '';
  // Extract path from URL, handling potential Vercel rewrite structure
  const url = new URL(fullPath, `http://${req.headers.host}`);
  const path = url.pathname;

  // SaaS Proxy Routes
  if (path.includes("/api/tool/") || path.includes("/api/upload/")) {
    const targetPath = path.match(/\/api\/(tool|upload)\/.*/)?.[0];
    if (targetPath) {
      return proxyToSaas(req, res, targetPath);
    }
  }

  // Gemini Routes (Aliased or direct)
  if (path.endsWith("/api/analyze-hand") || (path.endsWith("/api/gemini") && req.body.action === 'analyze-hand')) {
    try {
      const { base64, mimeType } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { data: base64, mimeType } },
            { text: "Analyze this hand photo. Provide the hand shape, skin tone, and recommend a nail style (猫眼, 法式, 渐变, 纯色, 装饰, or 手绘) that would look best. Also provide a brief explanation for the recommendation. Please respond in Chinese." }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              handShape: { type: Type.STRING },
              skinTone: { type: Type.STRING },
              recommendedStyle: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ["handShape", "skinTone", "recommendedStyle", "explanation"],
          },
        },
      });
      return res.status(200).json(JSON.parse(response.text || "{}"));
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (path.endsWith("/api/analyze-nail-reference") || (path.endsWith("/api/gemini") && req.body.action === 'analyze-nail-reference')) {
    try {
      const { base64, mimeType } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { data: base64, mimeType } },
            { text: "Analyze this nail design reference photo. Extract the detailed information about the nails: color, length, material/finish, and any specific patterns or decorations. Please respond in Chinese." }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              color: { type: Type.STRING },
              length: { type: Type.STRING },
              material: { type: Type.STRING },
              details: { type: Type.STRING },
            },
            required: ["color", "length", "material", "details"],
          },
        },
      });
      return res.status(200).json(JSON.parse(response.text || "{}"));
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (path.endsWith("/api/generate-nail-try-on") || path.endsWith("/api/gemini")) {
    try {
      const { handImageBase64, handImageMimeType, prompt, referenceImageBase64, referenceImageMimeType, userId, toolId } = req.body;

      const parts: any[] = [];
      if (referenceImageBase64 && referenceImageMimeType) {
        parts.push({ text: "Image 1 (Target Hand):" });
        parts.push({ inlineData: { data: handImageBase64, mimeType: handImageMimeType } });
        parts.push({ text: "Image 2 (Reference Nails):" });
        parts.push({ inlineData: { data: referenceImageBase64, mimeType: referenceImageMimeType } });
        parts.push({ text: `CRITICAL INSTRUCTION: Replicate the nails from Image 2 onto Image 1. ${prompt}` });
      } else {
        parts.push({ inlineData: { data: handImageBase64, mimeType: handImageMimeType } });
        parts.push({ text: `Apply this nail style: ${prompt}` });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: [{ role: 'user', parts: parts }],
        config: {
          imageConfig: {
            aspectRatio: "9:16",
            imageSize: "1K"
          }
        }
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
          const base64Data = resultImage.split(',')[1];
          const mimeType = resultImage.split(';')[0].split(':')[1];
          saasImage = await saveResultToSaas(userId, toolId, base64Data, mimeType);
        }
        return res.status(200).json({ result: resultImage, saasImage });
      }
      return res.status(500).json({ error: "Failed to generate image" });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (path.endsWith("/api/generate-video")) {
    try {
      const { imageBase64, prompt } = req.body;
      let cleanBase64 = imageBase64;
      let imgMimeType = 'image/jpeg';
      
      if (imageBase64.startsWith('http://') || imageBase64.startsWith('https://')) {
        const imgRes = await axios.get(imageBase64, { responseType: 'arraybuffer' });
        cleanBase64 = Buffer.from(imgRes.data).toString('base64');
        imgMimeType = imgRes.headers['content-type'] || 'image/jpeg';
      } else if (imageBase64.includes(',')) {
        const match = imageBase64.match(/^data:([^;]+);/);
        if (match) {
          imgMimeType = match[1];
        }
        cleanBase64 = imageBase64.split(',')[1];
      }

      const operation = await ai.models.generateVideos({
        model: 'veo-3.1-lite-generate-preview',
        prompt: prompt || 'An ultra-high-quality, continuous 8-second video of a single elegant hand showcasing its custom manicure. For the first 4 seconds, the hand exhibits the beautiful back of the hand (nail-art/manicure side facing the camera) with elegant finger adjustments to highlight the shine. Then, a highly natural and realistic 180-degree continuous hand-flip occurs as the wrist rotates smoothly. For the remaining 4 seconds, the hand is completely turned around to showcase the palm of the hand facing the camera, with graceful finger flexing. Absolute physics consistency, smooth rotation, no sudden frame cuts, and perfectly matching skin tone and background throughout the 3D movement.',
        image: {
          imageBytes: cleanBase64,
          mimeType: imgMimeType,
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '9:16'
        }
      });

      return res.status(200).json({ operationName: operation.name });
    } catch (e: any) {
      console.error('Error starting video generation:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (path.endsWith("/api/video-status")) {
    try {
      const { operationName } = req.body;
      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });
      return res.status(200).json({ done: updated.done });
    } catch (e: any) {
      console.error('Error fetching video status:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (path.endsWith("/api/video-download")) {
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
      return res.status(200).send(Buffer.from(videoRes.data));
    } catch (e: any) {
      console.error('Error downloading video:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(404).json({ error: "Route not found", path });
}
