import "dotenv/config";

import {
  PermissionKey,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not loaded. Confirm it exists in the project-root .env file."
    );
  }

  const role = "SUPER_ADMIN" as const;

  const permissions = [
    PermissionKey.VIEW_MOC,
    PermissionKey.MANAGE_MOC,
  ];

  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        role_permission: {
          role,
          permission,
        },
      },

      update: {},

      create: {
        role,
        permission,
      },
    });

    console.log(
      `Granted ${permission} to ${role}`
    );
  }

  console.log(
    "MOC permissions successfully assigned."
  );
}

main()
  .catch((error) => {
    console.error(
      "Failed to assign MOC permissions:",
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });