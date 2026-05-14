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
  message?: string;
  data: {
    currentIntegral: number;
    consumedIntegral: number;
    toolId?: string;
  };
}

export interface DirectTokenResponse {
  success: boolean;
  uploadUrl: string;
  objectKey: string;
  headers: Record<string, string>;
  method?: string;
  fileName?: string;
  ossUploadUrl?: string;
  uploadStrategy?: string;
  commitUrl?: string;
  expiresIn?: number;
  publicUrl?: string;
  readUrl?: string;
  [key: string]: any;
}

export interface CommitResponse {
  success: boolean;
  savedToRecords: boolean;
  recordId: string;
  url: string;
  image?: {
    recordId: string;
    url: string;
    fileName: string;
    savedToRecords: boolean;
  };
  [key: string]: any;
}

export const saasLaunch = async (userId: string, toolId: string): Promise<LaunchResponse> => {
  const response = await fetch('/api/tool/launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, toolId }),
  });
  return response.json();
};

export const saasVerify = async (userId: string, toolId: string): Promise<VerifyResponse> => {
  const response = await fetch('/api/tool/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, toolId }),
  });
  return response.json();
};

export const saasConsume = async (userId: string, toolId: string): Promise<ConsumeResponse> => {
  const response = await fetch('/api/tool/consume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, toolId }),
  });
  return response.json();
};

export const saasDirectToken = async (params: {
  userId: string;
  toolId: string;
  source: 'result';
  mimeType: string;
  fileName?: string;
  fileSize: number;
}): Promise<DirectTokenResponse> => {
  const response = await fetch('/api/upload/direct-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return response.json();
};

export const saasCommit = async (params: {
  userId: string;
  toolId: string;
  source: 'result';
  objectKey: string;
  fileSize: number;
}): Promise<CommitResponse> => {
  const response = await fetch('/api/upload/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return response.json();
};
