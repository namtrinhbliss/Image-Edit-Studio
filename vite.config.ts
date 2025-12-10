import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // Quan trọng: Inject biến API_KEY từ môi trường server (Vercel) vào client
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Định nghĩa process.env rỗng để tránh lỗi "process is not defined" trên trình duyệt
      'process.env': {},
    },
  };
});