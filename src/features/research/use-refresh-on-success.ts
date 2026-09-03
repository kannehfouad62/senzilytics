"use client";

import type { FormActionState } from "@/core/actions/action-state";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useRefreshOnSuccess(state: FormActionState) {
  const router = useRouter();
  useEffect(() => {
    if (state.status === "SUCCESS") router.refresh();
  }, [router, state.status]);
}
