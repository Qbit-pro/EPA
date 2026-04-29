import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'CostTrack',
  webDir: 'www',
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  },
  server: {
    androidScheme: 'http'
  }
};

export default config;
