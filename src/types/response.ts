export interface ResponseMeta {
  requestId: string;
  traceId?: string;
  generatedAt: string;
  [key: string]: unknown;
}

export interface SuccessResponse {
  status: "success";
  code: number;
  message: string;
  data: any;
  meta: ResponseMeta;
}

export interface ErrorResponse {
  status: "error";
  code: number;
  message: string;
  error: {
    code: string;
    details?: any;
  };
  meta: ResponseMeta;
}
