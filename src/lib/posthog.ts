import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

export const isPostHogConfigured = Boolean(POSTHOG_KEY);

if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST || 'https://us.i.posthog.com',
    autocapture: false,
    capture_pageview: true,
    persistence: 'localStorage',
  });
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!isPostHogConfigured) return;
  posthog.identify(userId, properties);
}

export function resetUser() {
  if (!isPostHogConfigured) return;
  posthog.reset();
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!isPostHogConfigured) return;
  posthog.capture(event, properties);
}
