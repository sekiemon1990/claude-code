export type ToastVariant = "success" | "info" | "error";

export type ToastOptions = {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  actionLabel?: string;
  actionHref?: string;
};

export function toast(options: ToastOptions): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("maxus_toast", {
      detail: {
        variant: "success",
        duration: 2400,
        ...options,
      },
    })
  );
}
