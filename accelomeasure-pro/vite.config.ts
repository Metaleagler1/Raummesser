
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Ersetze 'accelomeasure-pro' durch deinen Repository-Namen
export default defineConfig({
  plugins: [react()],
  base: './', 
});
