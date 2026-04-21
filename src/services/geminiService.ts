const callGeminiProxy = async (model: string, contents: any, config?: any) => {
  const response = await fetch("/api/gemini-proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, contents, config }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Gemini API request failed");
  }

  return response.json();
};

export const analyzeHand = async (base64Image: string, mimeType: string) => {
  const data = await callGeminiProxy("gemini-3-flash-preview", {
    parts: [
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
      {
        text: "Analyze this hand photo. Provide the hand shape, skin tone, and recommend a nail style (猫眼, 法式, 渐变, 纯色, 装饰, or 手绘) that would look best. Also provide a brief explanation for the recommendation. Please respond in Chinese.",
      },
    ],
  }, {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        handShape: { type: "STRING", description: "The shape of the hand/fingers (in Chinese)" },
        skinTone: { type: "STRING", description: "The skin tone (in Chinese)" },
        recommendedStyle: { type: "STRING", description: "The recommended nail style (must be one of: 猫眼, 法式, 渐变, 纯色, 装饰, 手绘)" },
        explanation: { type: "STRING", description: "Explanation for the recommendation (in Chinese)" },
      },
      required: ["handShape", "skinTone", "recommendedStyle", "explanation"],
    },
  });

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(text || "{}");
};

export const analyzeNailReference = async (base64Image: string, mimeType: string) => {
  const data = await callGeminiProxy("gemini-3-flash-preview", {
    parts: [
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
      {
        text: "Analyze this nail design reference photo. Extract the detailed information about the nails: color, length, material/finish, and any specific patterns or decorations. Please respond in Chinese.",
      },
    ],
  }, {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        color: { type: "STRING", description: "Color of the nails (in Chinese)" },
        length: { type: "STRING", description: "Length and shape of the nails (in Chinese)" },
        material: { type: "STRING", description: "Material or finish of the nails (in Chinese)" },
        details: { type: "STRING", description: "Patterns or decorations on the nails (in Chinese)" },
      },
      required: ["color", "length", "material", "details"],
    },
  });

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(text || "{}");
};

export const generateNailTryOn = async (
  handImageBase64: string,
  handImageMimeType: string,
  prompt: string,
  referenceImageBase64?: string,
  referenceImageMimeType?: string
) => {
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

  const data = await callGeminiProxy("gemini-3.1-flash-image-preview", {
    parts: parts,
  });

  for (const part of data.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
    }
  }

  throw new Error("Failed to generate image");
};
