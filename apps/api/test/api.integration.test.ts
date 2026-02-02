import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

const rawBaseUrl = process.env.API_BASE_URL;
const baseUrl = rawBaseUrl ? rawBaseUrl.replace(/\/$/, "") : undefined;
const email = process.env.API_ADMIN_EMAIL;
const password = process.env.API_ADMIN_PASSWORD;
const timeoutMs = Number(process.env.API_HEALTH_TIMEOUT_MS || 10000);
const requestTimeoutMs = Number(process.env.API_REQUEST_TIMEOUT_MS || 5000);

const request = async (url: string, options?: RequestInit) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const checkApi = async () => {
  if (!baseUrl || !email || !password) return false;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);
    try {
      const res = await fetch(`${baseUrl}/healthz`, { signal: controller.signal });
      if (res.ok) return true;
    } catch {
      // ignore and retry
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
};

const apiReady = await checkApi();
const maybeDescribe = apiReady ? describe : describe.skip;

maybeDescribe("api integration", () => {
  it("logs in and exports animals", async () => {
    const loginRes = await request(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.status).toBe(200);
    const login = await loginRes.json();
    const token = login.accessToken as string;
    expect(typeof token).toBe("string");

    const exportRes = await request(`${baseUrl}/export/animals`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(exportRes.status).toBe(200);
    const payload = await exportRes.json();
    expect(payload).toHaveProperty("data");
  });

  it("creates an animal and event, then exports events", async () => {
    const loginRes = await request(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.status).toBe(200);
    const login = await loginRes.json();
    const token = login.accessToken as string;

    const uid = `INT-${crypto.randomUUID().slice(0, 8)}`;
    const animalRes = await request(`${baseUrl}/animals`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ uid, sex: "F", race: "criollo" }),
    });
    expect(animalRes.status).toBe(201);

    const eventRes = await request(`${baseUrl}/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        uid,
        event_at: new Date().toISOString(),
        event_type: "weight",
        weight_kg: 350,
      }),
    });
    expect([200, 201]).toContain(eventRes.status);

    const listRes = await request(`${baseUrl}/events?uid=${uid}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.status).toBe(200);
    const listPayload = await listRes.json();
    expect(Array.isArray(listPayload.data)).toBe(true);

    const exportRes = await request(`${baseUrl}/export/events?uid=${uid}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(exportRes.status).toBe(200);
    const exportPayload = await exportRes.json();
    expect(Array.isArray(exportPayload.data)).toBe(true);

    const csvRes = await request(`${baseUrl}/export/events?format=csv&uid=${uid}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(csvRes.status).toBe(200);
    const csv = await csvRes.text();
    expect(csv.startsWith("event_id,")).toBe(true);
  });

  it("refresh rotates and revokes old token", async () => {
    const loginRes = await request(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.status).toBe(200);
    const login = await loginRes.json();
    const refreshToken = login.refreshToken as string;

    const refreshRes = await request(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    expect(refreshRes.status).toBe(200);
    const refreshed = await refreshRes.json();
    expect(refreshed.refreshToken).not.toBe(refreshToken);

    const reuseRes = await request(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    expect(reuseRes.status).toBe(401);
  });

  it("rejects invalid refresh token", async () => {
    const badRes = await request(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: "not-a-token" }),
    });
    expect(badRes.status).toBe(401);
  });
});
