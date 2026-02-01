import { FastifyInstance } from "fastify";
import { costCreateSchema, bulkCostsSchema, eventsQuerySchema } from "@livestock/shared";
import { bulkCreateCosts, createCost, listCosts } from "../services/costs";

export default async function costRoutes(fastify: FastifyInstance) {
  fastify.post("/costs", { preHandler: fastify.authorize("manager") }, async (request, reply) => {
    const body = costCreateSchema.parse(request.body);
    const cost = await createCost(fastify, body, request.id);
    reply.code(201).send(cost);
  });

  fastify.post("/costs/bulk", { preHandler: fastify.authorize("manager") }, async (request, reply) => {
    const body = bulkCostsSchema.parse(request.body);
    const created = await bulkCreateCosts(fastify, body.costs, request.id);
    reply.code(201).send({ costs: created });
  });

  fastify.get("/costs", { preHandler: fastify.authorize("viewer") }, async (request, reply) => {
    const query = (request.query as any) || {};
    const page = await listCosts(fastify, query);
    reply.send(page);
  });
}
