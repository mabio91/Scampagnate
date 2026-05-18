type ImageCompressionOptions = {
  maxDimension: number;
  quality?: number;
  outputType?: "image/webp" | "image/jpeg";
};

const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossibile leggere l'immagine"));
    };
    image.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Impossibile comprimere l'immagine"));
      },
      type,
      quality,
    );
  });

export const imageFileExtension = (file: File) =>
  extensionByType[file.type] || file.name.split(".").pop()?.toLowerCase() || "jpg";

export const compressImageForUpload = async (
  file: File,
  { maxDimension, quality = 0.8, outputType = "image/webp" }: ImageCompressionOptions,
): Promise<File> => {
  if (!file.type.startsWith("image/")) return file;

  const image = await loadImage(file);
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas non disponibile");

  context.drawImage(image, 0, 0, width, height);

  let blob: Blob;
  let type = outputType;
  try {
    blob = await canvasToBlob(canvas, outputType, quality);
  } catch {
    type = "image/jpeg";
    blob = await canvasToBlob(canvas, type, quality);
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  const extension = extensionByType[type] || "jpg";
  return new File([blob], `${baseName}.${extension}`, {
    type,
    lastModified: Date.now(),
  });
};
