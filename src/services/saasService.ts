export type InitPayload = {
  userId: string;
  toolId: string;
  context?: string;
  prompt?: string[] | string;
  callbackUrl?: string;
};

export type LaunchResponse = {
  success: boolean;
  data?: {
    user?: {
      name?: string;
      enterprise?: string;
      integral?: number;
    };
    tool?: {
      name?: string;
      integral?: number;
    };
  };
  message?: string;
};

export type VerifyResponse = {
  success: boolean;
  data?: {
    currentIntegral?: number;
    requiredIntegral?: number;
  };
  message?: string;
};

export type ConsumeResponse = {
  success: boolean;
  data?: {
    currentIntegral?: number;
    consumedIntegral?: number;
  };
  message?: string;
};

const postJson = async <T>(url: string, body: Record<string, unknown>): Promise<T> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || '接口请求失败');
  }

  return data as T;
};

export const launchTool = async (userId: string, toolId: string) => {
  return postJson<LaunchResponse>('/api/tool/launch', { userId, toolId });
};

export const verifyIntegral = async (userId: string, toolId: string) => {
  return postJson<VerifyResponse>('/api/tool/verify', { userId, toolId });
};

export const consumeIntegral = async (userId: string, toolId: string) => {
  return postJson<ConsumeResponse>('/api/tool/consume', { userId, toolId });
};
