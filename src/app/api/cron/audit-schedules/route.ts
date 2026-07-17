import { processAuditScheduleGenerationService } from "@/modules/audit-v2/audit-schedule.service";
import { timingSafeEqual } from "node:crypto";
import {
  NextRequest,
  NextResponse,
} from "next/server";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export const maxDuration =
  60;

type CronAuthorizationResult = {
  authorized: boolean;
  reason?: string;
};

function getBearerToken(
  request: NextRequest
) {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (!authorization) {
    return null;
  }

  const [
    scheme,
    token,
  ] = authorization
    .trim()
    .split(/\s+/);

  if (
    scheme?.toLowerCase() !==
      "bearer" ||
    !token
  ) {
    return null;
  }

  return token;
}

function safeSecretCompare(
  suppliedSecret: string,
  expectedSecret: string
) {
  const suppliedBuffer =
    Buffer.from(
      suppliedSecret,
      "utf8"
    );

  const expectedBuffer =
    Buffer.from(
      expectedSecret,
      "utf8"
    );

  if (
    suppliedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    suppliedBuffer,
    expectedBuffer
  );
}

function authorizeCronRequest(
  request: NextRequest
): CronAuthorizationResult {
  const cronSecret =
    process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    console.error(
      "CRON_SECRET is not configured."
    );

    return {
      authorized: false,
      reason:
        "Cron authentication is not configured.",
    };
  }

  const bearerToken =
    getBearerToken(request);

  if (!bearerToken) {
    return {
      authorized: false,
      reason:
        "A valid bearer token is required.",
    };
  }

  if (
    !safeSecretCompare(
      bearerToken,
      cronSecret
    )
  ) {
    return {
      authorized: false,
      reason:
        "The supplied cron token is invalid.",
    };
  }

  return {
    authorized: true,
  };
}

async function processScheduleGeneration(
  request: NextRequest
) {
  const authorization =
    authorizeCronRequest(
      request
    );

  if (
    !authorization.authorized
  ) {
    return NextResponse.json(
      {
        success: false,

        error:
          authorization.reason ||
          "Unauthorized cron request.",
      },
      {
        status: 401,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }

  const startedAt =
    new Date();

  try {
    const result =
      await processAuditScheduleGenerationService();

    const completedAt =
      new Date();

    return NextResponse.json(
      {
        success: true,

        message:
          "Audit schedule generation completed.",

        startedAt:
          startedAt.toISOString(),

        completedAt:
          completedAt.toISOString(),

        durationMilliseconds:
          completedAt.getTime() -
          startedAt.getTime(),

        result,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    const completedAt =
      new Date();

    const message =
      error instanceof Error
        ? error.message
        : "Audit schedule generation failed.";

    console.error(
      "Audit schedule cron processing failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          message,

        startedAt:
          startedAt.toISOString(),

        completedAt:
          completedAt.toISOString(),

        durationMilliseconds:
          completedAt.getTime() -
          startedAt.getTime(),
      },
      {
        status: 500,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}

export async function GET(
  request: NextRequest
) {
  return processScheduleGeneration(
    request
  );
}

export async function POST(
  request: NextRequest
) {
  return processScheduleGeneration(
    request
  );
}