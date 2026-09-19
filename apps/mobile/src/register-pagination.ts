import { useEffect, useState } from "react";
import { loadMobileRegister, type MobileRegisterName } from "./api";

export function mergeRegisterRecords<T extends { id: string }>(
  current: readonly T[],
  incoming: readonly T[]
) {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !seen.has(item.id))];
}

export function useMobileRegisterPagination<T extends { id: string }>(input: {
  register: MobileRegisterName;
  initialItems: T[];
  initialHasMore: boolean;
  online: boolean;
}) {
  const { register, initialItems, initialHasMore, online } = input;
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialHasMore && initialItems.length
      ? initialItems[initialItems.length - 1]!.id
      : null
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setItems(initialItems);
    setHasMore(initialHasMore);
    setNextCursor(
      initialHasMore && initialItems.length
        ? initialItems[initialItems.length - 1]!.id
        : null
    );
    setLoadError(null);
  }, [initialItems, initialHasMore, register]);

  async function loadMore() {
    if (!online || !hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const page = await loadMobileRegister(register, nextCursor);
      setItems((current) => mergeRegisterRecords(current, page.items as unknown as T[]));
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "More records could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  }

  return { items, hasMore, loadingMore, loadError, loadMore };
}
