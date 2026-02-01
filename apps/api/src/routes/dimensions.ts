import { FastifyInstance } from "fastify";
import { dimensionCreateSchema, WS_TOPICS } from "@livestock/shared";
import { createDimension, listDimension } from "../services/dimensions";

const register = (
  fastify: FastifyInstance,
  path: string,
  table: "location" | "herdGroup" | "party" | "product"
) => {
  fastify.get(path, { preHandler: fastify.authorize("viewer") }, async (_, reply) => {
    const rows = await listDimension(fastify.prisma, table);
    reply.send(rows);
  });

  fastify.post(path, { preHandler: fastify.authorize("admin") }, async (request, reply) => {
    const body = dimensionCreateSchema.parse(request.body);
    const created = await createDimension(fastify.prisma, table, body);
    await fastify.publish(WS_TOPICS.dimensionUpdated, { table, code: created.code }, request.id);
    reply.code(201).send(created);
  });
};

export default async function dimensionRoutes(fastify: FastifyInstance) {
  register(fastify, "/locations", "location");
  register(fastify, "/groups", "herdGroup");
  register(fastify, "/parties", "party");
  register(fastify, "/products", "product");
}
