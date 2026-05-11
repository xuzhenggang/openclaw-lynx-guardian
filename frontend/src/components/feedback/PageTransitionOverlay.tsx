import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { useGlobalLoading } from "../../app/GlobalLoadingProvider";

const ROUTE_TRANSITION_HOLD_MS = 260;
const OVERLAY_EXIT_MS = 160;

function buildRouteKey(location: ReturnType<typeof useLocation>): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function PageTransitionOverlay() {
  const isGlobalLoading = useGlobalLoading();
  const location = useLocation();
  const routeKey = buildRouteKey(location);
  const lastRouteKeyRef = useRef(routeKey);
  const [routeSettling, setRouteSettling] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (lastRouteKeyRef.current === routeKey) {
      return undefined;
    }

    lastRouteKeyRef.current = routeKey;
    setRouteSettling(true);

    const timer = window.setTimeout(() => {
      setRouteSettling(false);
    }, ROUTE_TRANSITION_HOLD_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [routeKey]);

  const visible = isGlobalLoading || routeSettling;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setMounted(false);
    }, OVERLAY_EXIT_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [visible]);

  if (!mounted) {
    return null;
  }

  return (
    <div
      aria-label="页面切换中"
      className="page-transition-overlay"
      data-state={visible ? "visible" : "hidden"}
      role="status"
    >
      <div className="page-transition-overlay__panel">
        <span className="page-transition-overlay__orb" aria-hidden="true" />
        <span>
          <strong>正在切换视图</strong>
          <small>同步最新审计数据</small>
        </span>
      </div>
    </div>
  );
}
