import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.presensi.app',
  appName: 'Presensi Pintar',
  webDir: 'dist',
  server: {
    url: 'https://presensi-pintar.vercel.app/', // PENTING: Ganti dengan URL Vercel Anda yang sebenarnya!
    cleartext: true
  }
};

export default config;