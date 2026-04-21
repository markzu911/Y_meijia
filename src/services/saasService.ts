export interface UserInfo {
  name: string;
  enterprise: string;
  integral: number;
}

export interface ToolInfo {
  name: string;
  integral: number;
}

export interface LaunchResponse {
  success: boolean;
  data?: {
    user: UserInfo;
    tool: ToolInfo;
  };
  message?: string;
}

export interface VerifyResponse {
  success: boolean;
  data?: {
    currentIntegral: number;
    requiredIntegral: number;
  };
  message?: string;
}

export interface ConsumeResponse {
  success: boolean;
  data?: {
    currentIntegral: number;
    consumedIntegral: number;
  };
  message?: string;
}

export const launchTool = async (userId: string, toolId: string): Promise<LaunchResponse> => {
  const response = await fetch("/api/tool/launch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, toolId }),
  });
  return response.json();
};

export const verifyIntegral = async (userId: string, toolId: string): Promise<VerifyResponse> => {
  const response = await fetch("/api/tool/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, toolId }),
  });
  return response.json();
};

export const consumeIntegral = async (userId: string, toolId: string): Promise<ConsumeResponse> => {
  const response = await fetch("/api/tool/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, toolId }),
  });
  return response.json();
};
