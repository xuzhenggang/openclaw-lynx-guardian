import {
  createContext,
  useContext,
  useSyncExternalStore,
} from "react";
import type { PropsWithChildren } from "react";

import {
  getGlobalLoadingSnapshot,
  subscribeGlobalLoading,
} from "./loading-store";

const GlobalLoadingContext = createContext(false);

export function GlobalLoadingProvider({ children }: PropsWithChildren) {
  const isGlobalLoading = useSyncExternalStore(
    subscribeGlobalLoading,
    getGlobalLoadingSnapshot,
    getGlobalLoadingSnapshot,
  );

  return (
    <GlobalLoadingContext.Provider value={isGlobalLoading}>
      {children}
    </GlobalLoadingContext.Provider>
  );
}

export function useGlobalLoading(): boolean {
  return useContext(GlobalLoadingContext);
}
