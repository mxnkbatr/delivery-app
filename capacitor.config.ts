import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'mn.delivery.app',
  appName: 'Soyol Delivery',
  webDir: 'public',
  ios: {
    // Prevent iOS WebView from adding automatic top inset (safe-area gap).
    // We handle safe-area with CSS + viewport-fit=cover.
    contentInset: 'never',
    scrollEnabled: true,
  },
  server: {
    url: 'https://soyol-io.vercel.app',
    androidScheme: 'https',
    errorPath: '/offline.html',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      // Keep splash visible until the web app signals it's ready.
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#FF4500",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
