import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

const rawBaseUrl = process.env.API_BASE_URL;
const baseUrl = rawBaseUrl ? rawBaseUrl.replace(/\/$/, "") : undefined;
const email = process.env.API_ADMIN_EMAIL;
const password = process.env.API_ADMIN_PASSWORD;
const timeoutMs = Number(process.env.API_HEALTH_TIMEOUT_MS || 2000);
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
});
