const pendingImages = new Map<string, Promise<void>>();

// Prepare only the images above the fold; never hold the page indefinitely on a failed image.
export async function preloadImages(urls: (string | undefined)[]) {
  const loads = [...new Set(urls.filter((url): url is string => !!url))].map((url) => {
    let pending = pendingImages.get(url);
    if (!pending) {
      pending = new Promise<void>((resolve) => {
        const image = new Image();
        image.onload = () => {
          void image
            .decode()
            .catch(() => {})
            .finally(resolve);
        };
        image.onerror = () => {
          pendingImages.delete(url);
          resolve();
        };
        image.src = url;
      });
      pendingImages.set(url, pending);
    }
    return pending;
  });
  let timer: ReturnType<typeof setTimeout>;
  await Promise.race([
    Promise.all(loads),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, 1800);
    }),
  ]);
  clearTimeout(timer!);
}
