import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';

// No permission prompt, health read or account/network setup runs on import.
Object.defineProperty(globalThis, 'TodayNativeHealth', {
  configurable: false,
  writable: false,
  value: Object.freeze({
    platform: Capacitor.getPlatform(),
    isNative: Capacitor.isNativePlatform(),
    pluginAvailable: Capacitor.isPluginAvailable('Health'),
    health: Health
  })
});
