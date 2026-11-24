import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture what our code passes to Supabase's createClient.
const createSupabaseClient = vi.fn<(...args: unknown[]) => unknown>(() => ({ fake: "client" }));
vi.mock("@supabase/supabase-js", () => ({ createClient: createSupabaseClient }));

const getToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ getToken }) }));

const { createClient, fetchWithTimeout, SUPABASE_TIMEOUT_MS } = await import("./server");

type Options = {
  accessToken: () => Promise<string | null>;
  global: { fetch: typeof fetch };
};
function lastOptions(): Options {
  return createSupabaseClient.mock.calls.at(-1)![2] as Options;
}

beforeEach(() => {
  createSupabaseClient.mockClear();
  getToken.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_not_a_real_key");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_not_a_real_key");
  vi.stubEnv("CLERK_SECRET_KEY", "not-a-real-key-for-tests");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("server Supabase client", () => {
  it("returns null when the Supabase env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(await createClient()).toBeNull();
    expect(createSupabaseClient).not.toHaveBeenCalled();
  });

  it("uses the URL and the publishable key", async () => {
    await createClient();
    const [url, key] = createSupabaseClient.mock.calls[0];
    expect(url).toBe("https://example.supabase.co");
    expect(key).toBe("sb_publishable_not_a_real_key");
  });

  it("sends the signed-in user's Clerk token", async () => {
    getToken.mockResolvedValue("clerk.session.token");
    await createClient();
    expect(await lastOptions().accessToken()).toBe("clerk.session.token");
  });

  it("sends no token when signed out", async () => {
    getToken.mockResolvedValue(null);
    await createClient();
    expect(await lastOptions().accessToken()).toBeNull();
  });

  it("sends no token and never calls Clerk when Clerk has no keys", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "");
    await createClient();
    expect(await lastOptions().accessToken()).toBeNull();
    expect(getToken).not.toHaveBeenCalled();
  });

  it("gives Supabase calls a 5 s timeout", async () => {
    expect(SUPABASE_TIMEOUT_MS).toBe(5_000);
    await createClient();
    expect(typeof lastOptions().global.fetch).toBe("function");
  });
});

describe("fetchWithTimeout", () => {
  // A fetch that never answers unless it is aborted.
  const hanging = (_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
    });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("aborts a call that takes too long", async () => {
    vi.stubGlobal("fetch", hanging);
    const call = fetchWithTimeout(20)("https://example.supabase.co/rest/v1/zones");
    await expect(call).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("passes a fast answer through", async () => {
    vi.stubGlobal("fetch", async () => new Response("[]"));
    const res = await fetchWithTimeout(1_000)("https://example.supabase.co/rest/v1/zones");
    expect(await res.text()).toBe("[]");
  });
});
