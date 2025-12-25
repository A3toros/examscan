export interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string>;
  body?: string;
}

export interface NetlifyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
