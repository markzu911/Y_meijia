
export const analyzeHand = async (base64Image: string, mimeType: string) => {
  const response = await fetch('api/analyze-hand', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64: base64Image, mimeType }),
  });
  if (!response.ok) throw new Error('Failed to analyze hand');
  return response.json();
};

export const analyzeNailReference = async (base64Image: string, mimeType: string) => {
  const response = await fetch('api/analyze-nail-reference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64: base64Image, mimeType }),
  });
  if (!response.ok) throw new Error('Failed to analyze nail reference');
  return response.json();
};

export const generateNailTryOn = async (
  handImageBase64: string,
  handImageMimeType: string,
  prompt: string,
  referenceImageBase64?: string,
  referenceImageMimeType?: string
) => {
  const response = await fetch('api/generate-nail-try-on', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      handImageBase64,
      handImageMimeType,
      prompt,
      referenceImageBase64,
      referenceImageMimeType,
    }),
  });
  if (!response.ok) throw new Error('Failed to generate image');
  const data = await response.json();
  return data.result;
};
