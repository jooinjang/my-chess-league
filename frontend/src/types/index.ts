export * from './user';
export * from './match';
export * from './league';
export * from './tournament';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
