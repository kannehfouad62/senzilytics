import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

async function main() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run password:reset -- user@company.com");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("No matching user was found.");
  const temporaryPassword = `${randomBytes(15).toString("base64url")}!7a`;
  const password = await bcrypt.hash(temporaryPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { password, isActive: true, sessionVersion: { increment: 1 } } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
  ]);
  console.log(`Temporary password for ${email}: ${temporaryPassword}`);
  console.log("Share it securely and have the user complete the email reset flow immediately.");
}

main().catch((error)=>{console.error(error instanceof Error?error.message:error);process.exitCode=1}).finally(async()=>{await prisma.$disconnect()});
