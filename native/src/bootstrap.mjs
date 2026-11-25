import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import { LocalNotifications } from '@capacitor/local-notifications';
import { NativeBiometric, BiometryType, AccessControl } from '@capgo/capacitor-native-biometric';

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

// OS prompts run only from an explicit, PIN-authorized setup or unlock action.
Object.defineProperty(globalThis, 'TodayNativeBiometrics', {
  value: Object.freeze({
    isNative: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
    available: Capacitor.isPluginAvailable('NativeBiometric'),
    type: Object.freeze({
      FACE_ID: BiometryType.FACE_ID, TOUCH_ID: BiometryType.TOUCH_ID,
      FINGERPRINT: BiometryType.FINGERPRINT, MULTIPLE: BiometryType.MULTIPLE
    }),
    protection: AccessControl.BIOMETRY_CURRENT_SET,
    plugin: NativeBiometric
  })
});
