import { describe, it, expect } from "vitest";

const rawBaseUrl = process.env.API_BASE_URL;
const baseUrl = rawBaseUrl ? rawBaseUrl.replace(/\/$/, "") : undefined;
const email = process.env.API_ADMIN_EMAIL;
const password = process.env.API_ADMIN_PASSWORD;
const timeoutMs = Number(process.env.API_HEALTH_TIMEOUT_MS || 2000);

const checkApi = async () => {
  if (!baseUrl || !email || !password) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/healthz`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

const apiReady = await checkApi();
const maybeDescribe = apiReady ? describe : describe.skip;

maybeDescribe("api integration", () => {
  it("logs in and exports animals", async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.status).toBe(200);
    const login = await loginRes.json();
    const token = login.accessToken as string;
    expect(typeof token).toBe("string");

    const exportRes = await fetch(`${baseUrl}/export/animals`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(exportRes.status).toBe(200);
    const payload = await exportRes.json();
    expect(payload).toHaveProperty("data");
  });
});
