import { NOTIFICATION_TEMPLATES } from './wearable-read-adapter.mjs';

// This namespace is reserved for Today delivery only. Importing or detecting the
// bridge never asks permission, creates a channel or schedules a notification.
export const NOTIFICATION_ID_MIN = 1903000000;
export const NOTIFICATION_ID_MAX = 1903999999;
const MAX_PENDING = 1000;
const MAX_AHEAD = 7 * 86400000;
const identifier = value => typeof value === 'string' && /^[a-z0-9][a-z0-9._:-]{0,95}$/i.test(value);
const version = value => typeof value === 'string' && /^[a-z0-9][a-z0-9._:-]{0,79}$/i.test(value);
const ownedId = value => Number.isInteger(value) && value >= NOTIFICATION_ID_MIN && value <= NOTIFICATION_ID_MAX;
const failure = error => Object.freeze({ ok: false, error });
const success = extra => Object.freeze({ ok: true, ...extra });
const unavailable = () => failure('native-notifications-unavailable');
const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));

function permission(result) {
  const status = result?.display;
  return ['granted', 'denied', 'prompt', 'prompt-with-rationale'].includes(status)
    ? success({ granted: status === 'granted', permission: status })
    : Object.freeze({ ok: false, granted: false, permission: 'unknown', error: 'invalid-notification-permission' });
}

function reference(extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return null;
  if (extra.kind === 'ai' && identifier(extra.insightId) && extra.version == null) {
    return Object.freeze({ kind: 'ai', insightId: extra.insightId });
  }
  if (extra.kind === 'update' && version(extra.version) && extra.insightId == null) {
    return Object.freeze({ kind: 'update', version: extra.version });
  }
  return null;
}

function candidatePayload(candidate, now) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) ||
      Object.keys(candidate).some(key => !['id', 'kind', 'insightId', 'version', 'scheduledFor', 'title', 'body'].includes(key)) ||
      !ownedId(candidate.id) || !instant(candidate.scheduledFor) ||
      !Number.isFinite(now.getTime()) || Date.parse(candidate.scheduledFor) <= now.getTime() ||
      Date.parse(candidate.scheduledFor) > now.getTime() + MAX_AHEAD) return null;
  const extra = reference(candidate);
  if (!extra) return null;
  const template = extra.kind === 'ai' ? NOTIFICATION_TEMPLATES.aiObservation : NOTIFICATION_TEMPLATES.appUpdate;
  if ((candidate.title !== undefined && candidate.title !== template.title) ||
      (candidate.body !== undefined && candidate.body !== template.body)) return null;
  return {
    id: candidate.id, title: template.title, body: template.body,
    extra: { ...extra },
    schedule: { at: new Date(candidate.scheduledFor), allowWhileIdle: false },
    isExactNotification: false, isExactMandatory: false,
    channelId: extra.kind === 'ai' ? 'today-ai-observation' : 'today-app-update'
  };
}

function queueItems(result) {
  if (!Array.isArray(result?.notifications) || result.notifications.length > MAX_PENDING) {
    throw new Error('native-notification-queue-unavailable');
  }
  return Object.freeze(result.notifications.filter(item => ownedId(item?.id)).map(item => {
    const extra = reference(item.extra);
    const at = item.schedule?.at;
    const scheduledFor = at instanceof Date ? at.toISOString() : instant(at) ? new Date(at).toISOString() : null;
    return Object.freeze({ id: item.id, ...(extra || { kind: null }), ...(scheduledFor ? { scheduledFor } : {}) });
  }));
}

export async function createNativeNotificationAdapter(bridge = globalThis.TodayNativeNotifications, { now = () => new Date() } = {}) {
  const plugin = bridge?.notifications;
  const methods = ['checkPermissions', 'requestPermissions', 'schedule', 'getPending', 'cancel',
    'getDeliveredNotifications', 'removeDeliveredNotifications', 'addListener'];
  const supported = bridge?.isNative === true && bridge?.pluginAvailable === true &&
    ['ios', 'android'].includes(bridge?.platform) && methods.every(method => typeof plugin?.[method] === 'function') &&
    (bridge.platform !== 'android' || typeof plugin.createChannel === 'function');

  async function checkPermission() {
    if (!supported) return Object.freeze({ ...unavailable(), granted: false, permission: 'unsupported' });
    try { return permission(await plugin.checkPermissions()); }
    catch { return Object.freeze({ ok: false, granted: false, permission: 'unknown', error: 'notification-permission-check-failed' }); }
  }
  async function requestPermission() {
    // Called only from the user's explicit enable action, never from schedule.
    if (!supported) return Object.freeze({ ...unavailable(), granted: false, permission: 'unsupported' });
    try { return permission(await plugin.requestPermissions()); }
    catch { return Object.freeze({ ok: false, granted: false, permission: 'unknown', error: 'notification-permission-request-failed' }); }
  }
  async function mutateIds(ids, method) {
    if (!Array.isArray(ids) || ids.length > MAX_PENDING || ids.some(id => !ownedId(id))) return failure('invalid-notification-ids');
    if (!ids.length) return success();
    if (!supported) return unavailable();
    try { await plugin[method]({ notifications: [...new Set(ids)].map(id => ({ id })) }); return success(); }
    catch { return failure('notification-cleanup-failed'); }
  }

  return Object.freeze({
    supported, checkPermission, requestPermission,
    async schedule(candidate) {
      if (!supported) return unavailable();
      let payload;
      try { payload = candidatePayload(candidate, now()); } catch { return failure('invalid-notification-candidate'); }
      if (!payload) return failure('invalid-notification-candidate');
      const granted = await checkPermission();
      if (granted.ok !== true || granted.granted !== true) return failure('notification-permission-required');
      try {
        if (bridge.platform === 'android') {
          await plugin.createChannel({ id: payload.channelId, name: payload.title,
            description: payload.extra.kind === 'ai' ? 'Today gözlem bildirimleri' : 'Today uygulama yenilikleri', importance: 3 });
          // Channel creation is asynchronous: permission may have been revoked
          // while Android was handling it. Never knowingly invoke schedule denied.
          const currentPermission = await checkPermission();
          if (currentPermission.ok !== true || currentPermission.granted !== true) return failure('notification-permission-required');
        }
        if (!candidatePayload(candidate, now())) return failure('invalid-notification-candidate');
        // The SDK's default can request exact-alarm settings or permission.
        // Both are explicitly disabled, and granted permission was checked above.
        const result = await plugin.schedule({ notifications: [payload] });
        if (!Array.isArray(result?.notifications) || result.notifications.length !== 1 || result.notifications[0]?.id !== payload.id) {
          try { await plugin.cancel({ notifications: [{ id: payload.id }] }); } catch {}
          return failure('invalid-notification-schedule-result');
        }
        return success({ id: payload.id });
      } catch { return failure('notification-schedule-failed'); }
    },
    async getPending() {
      if (!supported) throw new Error('native-notifications-unavailable');
      try { return queueItems(await plugin.getPending()); }
      catch { throw new Error('native-notification-queue-unavailable'); }
    },
    cancel: ids => mutateIds(ids, 'cancel'),
    async getDelivered() {
      if (!supported) throw new Error('native-notifications-unavailable');
      try { return queueItems(await plugin.getDeliveredNotifications()); }
      catch { throw new Error('native-notification-delivered-unavailable'); }
    },
    removeDelivered: ids => mutateIds(ids, 'removeDeliveredNotifications'),
    async onAction(callback) {
      if (!supported) return unavailable();
      if (typeof callback !== 'function') return failure('invalid-notification-action-handler');
      try {
        const listener = await plugin.addListener('localNotificationActionPerformed', action => {
          const item = action?.notification;
          const extra = reference(item?.extra);
          if (!ownedId(item?.id) || !extra) return;
          try { Promise.resolve(callback(Object.freeze({ id: item.id, ...extra }))).catch(() => {}); } catch {}
        });
        if (typeof listener?.remove !== 'function') return failure('notification-action-listener-failed');
        return success({ remove: () => listener.remove() });
      } catch { return failure('notification-action-listener-failed'); }
    }
  });
}
