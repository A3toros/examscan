// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
  };
  token: string;
}

export interface TemplatesResponse {
  templates: import('./index').Template[];
}

export interface ScanResultResponse {
  success: boolean;
  resultId?: string;
}
