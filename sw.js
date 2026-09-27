const FALLBACK_TITLE = "새 알림";
const ICON_FILE = "duck.ico";
const BADGE_FILE = "duck.ico";
const LATEST_NOTIFICATION_TAG = "demo-latest-notification";
const SET_APP_BADGE_MESSAGE_TYPE = "DEMO_SET_APP_BADGE";
const APP_BADGE_REFRESH_REQUEST_TYPE = "DEMO_APP_BADGE_REFRESH_REQUEST";
const SET_ACTIVE_CHAT_WINDOWS_MESSAGE_TYPE = "P6IX_SET_ACTIVE_CHAT_WINDOWS";
const ACTIVE_CHAT_WINDOW_TTL_MS = 45000;
let lastClientBadgeCount = null;
const activeChatWindowsByClientId = new Map();
const SCOPE_URL = new URL(self.registration.scope);
const SCOPE_ORIGIN = SCOPE_URL.origin;
const SCOPE_PATH = SCOPE_URL.pathname.endsWith("/")
  ? SCOPE_URL.pathname
  : `${SCOPE_URL.pathname}/`;

const isAbsoluteUrl = (value) => /^(?:[a-z][a-z\d+\-.]*:)?\/\//i.test(value);

const resolveAssetUrl = (fileName) => new URL(fileName, self.registration.scope).toString();

const normalizeBadgeCount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
};

const getPayloadBadgeCount = (payload) => {
  const candidates = [payload.badgeCount, payload.badge_count];
  for (const candidate of candidates) {
    const count = normalizeBadgeCount(candidate);
    if (count !== null) return count;
  }
  return null;
};

const normalizeConversationId = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return String(Math.floor(parsed));
};

const setAppBadgeCount = async (count) => {
  const badgeCount = normalizeBadgeCount(count);
  if (badgeCount === null) return;

  try {
    if (badgeCount > 0 && typeof self.navigator?.setAppBadge === "function") {
      await self.navigator.setAppBadge(badgeCount);
      return;
    }

    if (typeof self.navigator?.clearAppBadge === "function") {
      await self.navigator.clearAppBadge();
    }
  } catch {
    // Badging is best-effort and may be unavailable outside installed PWAs.
  }
};

const isScopedClientUrl = (clientUrl) => {
  try {
    const parsed = new URL(clientUrl);
    return parsed.origin === SCOPE_ORIGIN && parsed.pathname.startsWith(SCOPE_PATH);
  } catch {
    return false;
  }
};

const normalizeTargetUrl = (targetUrl) => {
  const rawValue = String(targetUrl || "").trim();
  if (!rawValue) return self.registration.scope;

  if (isAbsoluteUrl(rawValue)) {
    try {
      const absoluteUrl = new URL(rawValue);
      if (absoluteUrl.origin !== SCOPE_ORIGIN) return absoluteUrl.toString();
      if (absoluteUrl.pathname.startsWith(SCOPE_PATH)) return absoluteUrl.toString();

      const rebasedPath = absoluteUrl.pathname.replace(/^\/+/, "");
      return new URL(
        `${rebasedPath}${absoluteUrl.search}${absoluteUrl.hash}`,
        self.registration.scope
      ).toString();
    } catch {
      return self.registration.scope;
    }
  }

  if (rawValue.startsWith(SCOPE_PATH)) {
    return new URL(rawValue.slice(SCOPE_PATH.length), self.registration.scope).toString();
  }

  const relativePath = rawValue.replace(/^\/+/, "");
  return new URL(relativePath, self.registration.scope).toString();
};

const appendScheduleNotificationMarker = (targetUrl, notificationType) => {
  const normalizedTargetUrl = normalizeTargetUrl(targetUrl);
  if (notificationType !== "schedule") {
    return normalizedTargetUrl;
  }

  try {
    const parsedUrl = new URL(normalizedTargetUrl);
    const scheduleId = parsedUrl.searchParams.get("schedule_id");
    const isScheduleCalendarPath = parsedUrl.pathname.includes("/schedule/calendar/");

    if (!scheduleId || !isScheduleCalendarPath) {
      return normalizedTargetUrl;
    }

    parsedUrl.searchParams.set("from_notification", "1");
    return parsedUrl.toString();
  } catch {
    return normalizedTargetUrl;
  }
};

const getScopedWindowClients = async () => {
  const windowClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  return windowClients.filter((client) => isScopedClientUrl(client.url));
};

const hasFocusedClient = async (scopedClients = null) => {
  const clients = scopedClients || (await getScopedWindowClients());
  return clients.some((client) => client.focused);
};

const isVisibleWindowClient = (client) => {
  if (client?.visibilityState) return client.visibilityState === "visible";
  return Boolean(client?.focused);
};

const getConversationIdFromUrl = (url) => {
  try {
    const parsedUrl = new URL(url, self.registration.scope);
    return normalizeConversationId(parsedUrl.searchParams.get("open_chat"));
  } catch {
    return null;
  }
};

const getPushConversationId = (payload) => {
  const directCandidates = [
    payload.conversationId,
    payload.conversation_id,
    payload.chatConversationId,
    payload.chat_conversation_id,
  ];

  for (const candidate of directCandidates) {
    const normalized = normalizeConversationId(candidate);
    if (normalized) return normalized;
  }

  const urlCandidates = [payload.url, payload.link, payload.targetUrl, payload.target_url];
  for (const candidate of urlCandidates) {
    const normalized = getConversationIdFromUrl(candidate);
    if (normalized) return normalized;
  }

  return null;
};

const pruneActiveChatWindows = () => {
  const now = Date.now();
  activeChatWindowsByClientId.forEach((state, clientId) => {
    if (!state?.visible || now - Number(state.updatedAt || 0) > ACTIVE_CHAT_WINDOW_TTL_MS) {
      activeChatWindowsByClientId.delete(clientId);
    }
  });
};

const isConversationActiveInClientState = (conversationId) => {
  pruneActiveChatWindows();
  if (!conversationId) return false;

  for (const state of activeChatWindowsByClientId.values()) {
    if (
      state.visible &&
      Array.isArray(state.conversationIds) &&
      state.conversationIds.includes(conversationId)
    ) {
      return true;
    }
  }

  return false;
};

const isConversationVisibleInClientUrls = (conversationId, scopedClients = []) => {
  if (!conversationId) return false;

  return scopedClients.some(
    (client) =>
      isVisibleWindowClient(client) &&
      getConversationIdFromUrl(client.url) === conversationId,
  );
};

const shouldSuppressPushNotification = async (payload, scopedClients = null) => {
  if (payload.pushKind !== "chat_message") return false;

  const conversationId = getPushConversationId(payload);
  if (!conversationId) return false;

  const clients = scopedClients || (await getScopedWindowClients());
  return (
    isConversationActiveInClientState(conversationId) ||
    isConversationVisibleInClientUrls(conversationId, clients)
  );
};

const requestClientBadgeRefresh = async (scopedClients = null) => {
  const clients = scopedClients || (await getScopedWindowClients());
  clients.forEach((client) => {
    client.postMessage({ type: APP_BADGE_REFRESH_REQUEST_TYPE });
  });
};

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const payload = event.data || {};
  if (payload.type === SET_ACTIVE_CHAT_WINDOWS_MESSAGE_TYPE) {
    const sourceClientId =
      event.source?.id || String(payload.clientId || "unknown-client");
    const conversationIds = Array.isArray(payload.conversationIds)
      ? payload.conversationIds
          .map((conversationId) => normalizeConversationId(conversationId))
          .filter(Boolean)
      : [];

    if (!payload.visible || conversationIds.length === 0) {
      activeChatWindowsByClientId.delete(sourceClientId);
      return;
    }

    activeChatWindowsByClientId.set(sourceClientId, {
      conversationIds,
      visible: true,
      updatedAt: Date.now(),
    });
    return;
  }

  if (payload.type !== SET_APP_BADGE_MESSAGE_TYPE) return;

  const badgeCount = normalizeBadgeCount(payload.badgeCount ?? payload.count);
  if (badgeCount !== null) {
    lastClientBadgeCount = badgeCount;
  }

  const update = setAppBadgeCount(badgeCount);
  if (typeof event.waitUntil === "function") {
    event.waitUntil(update);
  }
});

self.addEventListener("push", (event) => {
  const payload = (() => {
    if (!event.data) return {};
    try {
      return event.data.json();
    } catch {
      return { body: event.data.text() };
    }
  })();

  const title = payload.title || FALLBACK_TITLE;
  const targetUrl = normalizeTargetUrl(payload.url);
  const options = {
    body: payload.body || "",
    icon: resolveAssetUrl(ICON_FILE),
    badge: resolveAssetUrl(BADGE_FILE),
    tag: LATEST_NOTIFICATION_TAG,
    renotify: true,
    data: {
      url: targetUrl,
      notificationId: payload.notificationId ?? null,
      notificationType: payload.notificationType ?? "system",
      sourceTag: payload.tag || null,
    },
  };

  event.waitUntil(
    getScopedWindowClients().then((scopedClients) =>
      Promise.all([
        scopedClients.length > 0
          ? requestClientBadgeRefresh(scopedClients).then(() =>
              lastClientBadgeCount === null
                ? undefined
                : setAppBadgeCount(lastClientBadgeCount)
            )
          : setAppBadgeCount(getPayloadBadgeCount(payload)),
        shouldSuppressPushNotification(payload, scopedClients).then((suppressed) => {
          if (suppressed) return undefined;
          return hasFocusedClient(scopedClients).then((focused) => {
            if (focused) return undefined;
            return self.registration.showNotification(title, options);
          });
        }),
      ])
    )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = appendScheduleNotificationMarker(
    event.notification.data?.url,
    event.notification.data?.notificationType,
  );

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then(async (windowClients) => {
        for (const client of windowClients) {
          if (!isScopedClientUrl(client.url)) continue;

          if ("navigate" in client) {
            await client.navigate(targetUrl);
          }
          if ("focus" in client) {
            await client.focus();
          }
          return;
        }

        await self.clients.openWindow(targetUrl);
      })
  );
});
