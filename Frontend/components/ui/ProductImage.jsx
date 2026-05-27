"use client";

import { useState, useEffect } from "react";
import { Package } from "lucide-react";

/**
 * Renders a product image (Cloudinary URL stored on the Product document).
 *
 * If the URL is missing, empty, fails to load, or points at a legacy local
 * asset path (`/images/*`), we render a neutral `Package` icon instead of
 * substituting another product image. This keeps the UI honest — a missing
 * image never silently turns into a hardcoded serum picture, and we never
 * fall back to bundled frontend assets for a product image.
 *
 * Props pass through to the underlying <img> so callers control sizing,
 * `className`, etc. The fallback is rendered into the parent container so
 * existing aspect-ratio wrappers continue to work.
 */
export default function ProductImage({
  src,
  alt = "",
  className = "",
  fallbackClassName = "w-full h-full flex items-center justify-center bg-brand-dark/5 text-brand-dark/30",
  iconSize,
  ...rest
}) {
  const isUsableSrc = (value) =>
    typeof value === "string" &&
    value.trim() !== "" &&
    !value.startsWith("/images/");

  const [errored, setErrored] = useState(!isUsableSrc(src));

  // If the source prop changes (e.g. parent loaded data), reset the error
  // flag so the new URL gets a chance to render.
  useEffect(() => {
    setErrored(!isUsableSrc(src));
  }, [src]);

  if (errored) {
    return (
      <div className={fallbackClassName}>
        <Package size={iconSize || 28} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
      {...rest}
    />
  );
}
