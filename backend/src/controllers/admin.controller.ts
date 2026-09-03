import { Response } from "express";
import { prisma } from "../db/prisma";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

export async function listUsers(req: AuthenticatedRequest, res: Response) {
  const { status } = req.query;

  const users = await prisma.user.findMany({
    where: typeof status === "string" ? { status: status as any } : {},
    select: {
      id: true,
      email: true,
      name: true,
      clubUsername: true,
      role: true,
      status: true,
      createdAt: true,
      approvedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return res.json(users);
}

export async function approveUser(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  const user = await prisma.user.update({
    where: { id },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  return res.json({ id: user.id, status: user.status });
}

export async function rejectUser(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  if (id === req.userId) {
    return res.status(400).json({ error: "No puedes rechazarte a ti mismo." });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { status: "REJECTED" },
  });

  return res.json({ id: user.id, status: user.status });
}
