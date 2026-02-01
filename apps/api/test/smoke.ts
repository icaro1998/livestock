import crypto from "crypto";

const base = process.env.SMOKE_BASE || "http://localhost:3000";

const post = async (url: string, body: any, token?: string) => {
  const res = await fetch(base + url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} failed ${res.status}`);
  return res.json();
};

const get = async (url: string, token?: string) => {
  const res = await fetch(base + url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`${url} failed ${res.status}`);
  return res.json();
};

const main = async () => {
  const health = await get("/healthz");
  console.log("healthz", health);

  let login;
  try {
    login = await post("/auth/login", { email: "admin@example.com", password: "admin1234" });
  } catch (err) {
    console.error("Login failed; ensure seed ran.");
    throw err;
  }

  const token = login.accessToken;
  const uid = `SMK-${crypto.randomUUID().slice(0, 8)}`;
  await post(
    "/animals",
    {
      uid,
      sex: "F",
      race: "criollo",
    },
    token
  );

  await post(
    "/events",
    {
      uid,
      event_at: new Date().toISOString(),
      event_type: "weight",
      weight_kg: 350,
    },
    token
  );

  const events = await get(`/events?uid=${uid}`, token);
  if (!events.data || events.data.length === 0) throw new Error("No events returned");
  console.log("smoke PASS");
};

main().catch((err) => {
  console.error("smoke FAIL", err);
  process.exit(1);
});
