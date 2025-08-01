// 标准 API 响应类型定义

export interface ApiResponse<T = unknown> {
  code: number; // 0=成功，非0=错误
  msg: string;
  data?: T;
}

export type ApiSuccess<T = unknown> = ApiResponse<T> & { code: 0 };
export type ApiError = ApiResponse<null> & { code: number; data?: null };

// 常用错误码
export enum ApiErrorCode {
  OK = 0,
  INVALID_PARAM = 1001,
  NOT_FOUND = 1002,
  DOWNLOAD_FAILED = 2001,
  META_FETCH_FAILED = 2002,
  INTERNAL_ERROR = 5000,
}
