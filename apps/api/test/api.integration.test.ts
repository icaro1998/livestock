import { describe, it, expect } from "vitest";

const baseUrl = process.env.API_BASE_URL;
const email = process.env.API_ADMIN_EMAIL;
const password = process.env.API_ADMIN_PASSWORD;
const enabled = Boolean(baseUrl && email && password);

const maybeDescribe = enabled ? describe : describe.skip;

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
