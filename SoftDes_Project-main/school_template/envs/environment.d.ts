export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      JWT_SECRET_KEY?: string;
      SESSION_SECRET_KEY?: string;
      SCHEDULER_API_KEY?: string;
      NEXT_PUBLIC_BASE_URL?: string;
    }
  }
}