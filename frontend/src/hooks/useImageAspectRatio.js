import { useEffect, useState } from "react";

export function useImageAspectRatio(imageUrl) {
  const [loaded, setLoaded] = useState({});

  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        setLoaded({ source: imageUrl, error: "The puzzle image has invalid dimensions." });
        return;
      }
      setLoaded({ source: imageUrl, ratio: image.naturalWidth / image.naturalHeight });
    };
    image.onerror = () => {
      if (!cancelled) {
        setLoaded({ source: imageUrl, error: "Unable to load the puzzle image. Check your connection and refresh." });
      }
    };
    image.src = imageUrl;
    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [imageUrl]);

  const isCurrentImage = loaded.source === imageUrl;
  return {
    imageAspectRatio: isCurrentImage ? loaded.ratio || null : null,
    imageError: isCurrentImage ? loaded.error || "" : "",
  };
}
