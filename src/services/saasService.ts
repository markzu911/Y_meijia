export interface SaasUser {
  name: string;
  enterprise: string;
  integral: number;
}

export interface SaasTool {
  name: string;
  integral: number;
}

export interface LaunchResponse {
  success: boolean;
  data: {
    user: SaasUser;
    tool: SaasTool;
  };
}

export interface VerifyResponse {
  success: boolean;
  message?: string;
  data?: {
    currentIntegral: number;
    requiredIntegral: number;
  };
}

export interface ConsumeResponse {
  success: boolean;
  data: {
    currentIntegral: number;
    consumedIntegral: number;
  };
}

async function readJsonResponse(res: Response) {
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text.slice(0, 300) };
  }

  if (!res.ok || data.success === false) {
    throw new Error(data.error || data.message || `请求失败: ${res.status}`);
  }

  return data;
}

export const saasLaunch = async (userId: string, toolId: string): Promise<LaunchResponse> => {
  const response = await fetch('/api/tool/launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, toolId }),
  });
  return readJsonResponse(response);
};

export const saasVerify = async (userId: string, toolId: string): Promise<VerifyResponse> => {
  const response = await fetch('/api/tool/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, toolId }),
  });
  return readJsonResponse(response);
};

export const saasConsume = async (userId: string, toolId: string): Promise<ConsumeResponse> => {
  const response = await fetch('/api/tool/consume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, toolId }),
  });
  return readJsonResponse(response);
};

export const saasUploadImage = async (params: {
  userId: string;
  base64?: string;
  source?: 'result' | 'input';
}) => {
  const response = await fetch('/api/upload/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, source: params.source || 'result' }),
  });
  return readJsonResponse(response);
};

export const saasGetUploadToken = async (params: {
  userId: string;
  source: 'input' | 'result';
  fileName: string;
  mimeType: string;
  fileSize: number;
}) => {
  const response = await fetch('/api/upload/direct-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return readJsonResponse(response);
};

export const saasCommitImage = async (params: {
  userId: string;
  source: 'result';
  objectKey: string;
  fileSize: number;
}) => {
  const response = await fetch('/api/upload/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return readJsonResponse(response);
};

export const saasFileList = async (userId: string, role: number = 1) => {
  const response = await fetch(`/api/upload/image?userId=${userId}&role=${role}`);
  return readJsonResponse(response);
};
