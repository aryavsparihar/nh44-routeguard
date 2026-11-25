// web-push 4.0.0 ships no types. Only what src/server/push/send.ts uses.
declare module "web-push" {
  export type PushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
  export type RequestOptions = {
    vapidDetails?: { subject: string; publicKey: string; privateKey: string };
    TTL?: number;
    urgency?: "very-low" | "low" | "normal" | "high";
    topic?: string;
    timeout?: number;
  };
  export type SendResult = { statusCode: number; body: string; headers: Record<string, string> };
  export function sendNotification(subscription: PushSubscription, payload?: string | Buffer | null, options?: RequestOptions): Promise<SendResult>;
  export function generateVAPIDKeys(): { publicKey: string; privateKey: string };
  export class WebPushError extends Error {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    endpoint: string;
  }
}
