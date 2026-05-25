
export const analyzeHand = async (base64Image: string, mimeType: string) => {
  const response = await fetch('/api/analyze-hand', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64: base64Image, mimeType }),
  });
  if (!response.ok) throw new Error('Failed to analyze hand');
  return response.json();
};

export const analyzeNailReference = async (base64Image: string, mimeType: string) => {
  const response = await fetch('/api/analyze-nail-reference', {
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
  referenceImageMimeType?: string,
  userId?: string,
  toolId?: string
) => {
  const response = await fetch('/api/generate-nail-try-on', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      handImageBase64,
      handImageMimeType,
      prompt,
      referenceImageBase64,
      referenceImageMimeType,
      userId,
      toolId
    }),
  });
  if (!response.ok) throw new Error('Failed to generate image');
  const data = await response.json();
  // Return either the direct result (base64) or the saas url if available
  return data.saasImage?.url || data.result;
};

export const generateVideoStart = async (imageBase64: string, prompt?: string) => {
  const response = await fetch('/api/generate-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, prompt }),
  });
  if (!response.ok) {
    let errMsg = 'Failed to start video generation';
    try {
      const data = await response.json();
      if (data && data.error) {
        errMsg = data.error;
      }
    } catch (e) {}
    throw new Error(errMsg);
  }
  return response.json(); // { operationName }
};

export const checkVideoStatus = async (operationName: string) => {
  const response = await fetch('/api/video-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operationName }),
  });
  if (!response.ok) {
    let errMsg = 'Failed to check video status';
    try {
      const data = await response.json();
      if (data && data.error) {
        errMsg = data.error;
      }
    } catch (e) {}
    throw new Error(errMsg);
  }
  return response.json(); // { done }
};

export const downloadVideoUrl = async (operationName: string) => {
  const response = await fetch('/api/video-download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operationName }),
  });
  if (!response.ok) {
    let errMsg = 'Failed to download video';
    try {
      const data = await response.json();
      if (data && data.error) {
        errMsg = data.error;
      }
    } catch (e) {}
    throw new Error(errMsg);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
