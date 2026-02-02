import fp from "fastify-plugin";
import websocket from "@fastify/websocket";
import { makeMessage, WSTopic } from "@livestock/shared";
import WebSocket from "ws";

export default fp(async (fastify) => {
  const clients = new Set<WebSocket>();

  await fastify.register(websocket);

  const serialize = (obj: any) => JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

  fastify.decorate("publish", async (topic: WSTopic | string, data: any, requestId?: string) => {
    const message = makeMessage(topic as WSTopic, data, requestId);
    const payload = serialize(message);
    await fastify.redis.publish("ws:events", payload);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  });

  await fastify.redisSubscriber.subscribe("ws:events");
  fastify.redisSubscriber.on("message", (_, payload) => {
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  });

  fastify.get(
    "/ws",
    {
      websocket: true,
      schema: {
        tags: ["WebSocket"],
        summary: "WebSocket endpoint",
      },
    },
    (connection) => {
      const socket = connection.socket as WebSocket & { on: (...args: any[]) => void };
      clients.add(socket);
      socket.on("close", () => clients.delete(socket));
    }
  );

  fastify.addHook("onClose", async () => {
    for (const c of clients) c.close();
    await fastify.redisSubscriber.unsubscribe("ws:events");
  });
});
