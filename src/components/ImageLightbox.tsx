"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useEffect } from "react";

type Props = {
  src: string;
  alt?: string;
  onClose: () => void;
};

export function ImageLightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 anim-fade-in flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
      >
        <X size={20} />
      </button>
      <div
        className="relative max-w-full max-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={src}
          alt={alt ?? ""}
          width={1600}
          height={1600}
          unoptimized
          className="max-w-full max-h-[90vh] object-contain rounded-lg w-auto h-auto"
        />
      </div>
    </div>
  );
}
