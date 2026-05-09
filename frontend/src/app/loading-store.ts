let pendingCount = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function beginGlobalRequest(): () => void {
  pendingCount += 1;
  emit();

  let closed = false;
  return () => {
    if (closed) {
      return;
    }

    closed = true;
    pendingCount = Math.max(0, pendingCount - 1);
    emit();
  };
}

export function getGlobalLoadingSnapshot(): boolean {
  return pendingCount > 0;
}

export function subscribeGlobalLoading(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
