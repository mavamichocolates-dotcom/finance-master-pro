/// <reference types="vite/client" />

declare module '*.css';
declare module '*.png';
declare module '*.svg';
declare module '*.jpeg';
declare module '*.jpg';

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Augment the NodeJS namespace to include API_KEY in ProcessEnv
// preventing conflicts with @types/node or other definitions of 'process'
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY?: string;
    [key: string]: string | undefined;
  }
}
