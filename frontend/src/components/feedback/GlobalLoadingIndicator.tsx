import { useGlobalLoading } from "../../app/GlobalLoadingProvider";

export function GlobalLoadingIndicator() {
  const isGlobalLoading = useGlobalLoading();

  if (!isGlobalLoading) {
    return null;
  }

  return (
    <div
      aria-label="全局加载中"
      className="global-loading"
      role="status"
    >
      <span className="global-loading__bar" />
    </div>
  );
}
