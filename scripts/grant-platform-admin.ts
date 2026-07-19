import { prisma } from "../src/lib/prisma";

async function main() {
  const email = String(process.argv[2] || "").trim().toLowerCase();

  if (!email) {
    throw new Error(
      "Usage: npm run platform:grant -- administrator@company.com"
    );
  }

  const result = await prisma.user.updateMany({
    where: {
      email,
      role: "SUPER_ADMIN",
    },
    data: {
      isPlatformAdmin: true,
    },
  });

  if (result.count !== 1) {
    throw new Error(
      "A matching SUPER_ADMIN account was not found. Confirm the email and role."
    );
  }

  console.log(`Platform administration granted to ${email}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
