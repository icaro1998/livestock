import "fastify";
import { FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
import { Role } from "@livestock/shared";
import Redis from "ioredis";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    redisSubscriber: Redis;
    config: typeof import("../config").config;
    publish: (topic: string, data: any, requestId?: string) => Promise<void>;
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (role: Role) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user?: { id: bigint; role: Role; email: string };
  }
}
