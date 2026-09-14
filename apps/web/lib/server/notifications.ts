import "server-only";
import { prisma } from "./db";

export const notify = async (
  userId: string,
  title: string,
  message: string,
  link?: string,
): Promise<void> => {
  await prisma.notification.create({
    data: { userId, title, message, link },
  });
};
