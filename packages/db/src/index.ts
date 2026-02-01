import { PrismaClient, Prisma } from "@prisma/client";
import pino from "pino";

const logger = pino({ name: "db" });

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query"] : [],
});

export type DBClient = PrismaClient;

export const initDb = async () => {
  await prisma.$connect();
  logger.info("DB connected");
};

export const shutdownDb = async () => {
  await prisma.$disconnect();
};

export const withTransaction = async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(fn);