import "server-only";

type AlertSeverity = "info" | "warn" | "error";

interface OpsAlertPayload {
  scope: string;
  message: string;
  severity: AlertSeverity;
  context?: Record<string, unknown>;
}

function getAlertWebhookUrl(): string | null {
  return process.env.OPS_ALERT_WEBHOOK_URL || process.env.ALERT_WEBHOOK_URL || null;
}

export async function sendOpsAlert(payload: OpsAlertPayload): Promise<void> {
  const url = getAlertWebhookUrl();
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: "my-app",
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    });
  } catch (error) {
    console.error("[ops-alert] Failed to publish alert:", error);
  }
}
