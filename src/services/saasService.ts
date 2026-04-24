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

export const saasLaunch = async (userId: string, toolId: string): Promise<LaunchResponse> => {
  const response = await fetch('api/tool/launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, toolId }),
  });
  return response.json();
};

export const saasVerify = async (userId: string, toolId: string): Promise<VerifyResponse> => {
  const response = await fetch('api/tool/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, toolId }),
  });
  return response.json();
};

export const saasConsume = async (userId: string, toolId: string): Promise<ConsumeResponse> => {
  const response = await fetch('api/tool/consume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, toolId }),
  });
  return response.json();
};
