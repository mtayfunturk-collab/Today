import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import { LocalNotifications } from '@capacitor/local-notifications';

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

Object.defineProperty(globalThis, 'TodayNativeNotifications', {
  configurable: false,
  writable: false,
  value: Object.freeze({
    // Generated hosts have one WebView and no background JS archive writer.
    // Remove this capability before adding another window or JS runner.
    singleContext: true,
    platform: Capacitor.getPlatform(),
    isNative: Capacitor.isNativePlatform(),
    pluginAvailable: Capacitor.isPluginAvailable('LocalNotifications'),
    notifications: LocalNotifications
  })
});
