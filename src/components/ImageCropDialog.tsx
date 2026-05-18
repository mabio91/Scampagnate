import { type PointerEvent, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

interface ImageCropDialogProps {
  open: boolean;
  file: File | null;
  title: string;
  description?: string;
  aspect: { width: number; height: number };
  outputWidth: number;
  outputHeight: number;
  onCancel: () => void;
  onCropped: (file: File) => void;
}

type Point = { x: number; y: number };
type Size = { width: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const ImageCropDialog = ({
  open,
  file,
  title,
  description = "Sposta e ingrandisci l'immagine per scegliere il ritaglio.",
  aspect,
  outputWidth,
  outputHeight,
  onCancel,
  onCropped,
}: ImageCropDialogProps) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ start: Point; offset: Point } | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState<Size | null>(null);
  const [previewSize, setPreviewSize] = useState<Size | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!file || !open) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setLoaded(false);
    setNaturalSize(null);
    setPreviewSize(null);
    return () => URL.revokeObjectURL(url);
  }, [file, open]);

  useEffect(() => {
    if (!loaded || !naturalSize || !cropRef.current) return;

    const updatePreviewSize = () => {
      const rect = cropRef.current?.getBoundingClientRect();
      if (!rect) return;
      const baseScale = Math.max(rect.width / naturalSize.width, rect.height / naturalSize.height);
      setPreviewSize({
        width: naturalSize.width * baseScale,
        height: naturalSize.height * baseScale,
      });
    };

    updatePreviewSize();
    window.addEventListener("resize", updatePreviewSize);
    return () => window.removeEventListener("resize", updatePreviewSize);
  }, [loaded, naturalSize]);

  const clampOffset = (next: Point, nextZoom = zoom) => {
    const crop = cropRef.current;
    if (!crop || !previewSize || !loaded) return next;

    const rect = crop.getBoundingClientRect();
    const renderedWidth = previewSize.width * nextZoom;
    const renderedHeight = previewSize.height * nextZoom;
    const maxX = Math.max(0, (renderedWidth - rect.width) / 2);
    const maxY = Math.max(0, (renderedHeight - rect.height) / 2);

    return {
      x: clamp(next.x, -maxX, maxX),
      y: clamp(next.y, -maxY, maxY),
    };
  };

  const handleZoomChange = ([value]: number[]) => {
    setZoom(value);
    setOffset((current) => clampOffset(current, value));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      start: { x: event.clientX, y: event.clientY },
      offset,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const next = {
      x: dragRef.current.offset.x + event.clientX - dragRef.current.start.x,
      y: dragRef.current.offset.y + event.clientY - dragRef.current.start.y,
    };
    setOffset(clampOffset(next));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const createCroppedFile = async () => {
    if (!file || !imageRef.current || !cropRef.current) return;
    const img = imageRef.current;
    const rect = cropRef.current.getBoundingClientRect();
    const baseScale = Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
    const displayScale = baseScale * zoom;
    const sourceWidth = rect.width / displayScale;
    const sourceHeight = rect.height / displayScale;
    const sourceX = clamp(img.naturalWidth / 2 - offset.x / displayScale - sourceWidth / 2, 0, img.naturalWidth - sourceWidth);
    const sourceY = clamp(img.naturalHeight / 2 - offset.y / displayScale - sourceHeight / 2, 0, img.naturalHeight - sourceHeight);

    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas non disponibile");

    context.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("Impossibile creare il ritaglio"));
      }, "image/jpeg", 0.8);
    });

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    onCropped(new File([blob], `${baseName}-cropped.jpg`, { type: "image/jpeg" }));
  };

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      await createCroppedFile();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && !processing) onCancel();
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            ref={cropRef}
            className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-lg bg-muted touch-none"
            style={{ aspectRatio: `${aspect.width} / ${aspect.height}` }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {imageUrl && (
              <img
                ref={imageRef}
                src={imageUrl}
                alt=""
                className="absolute left-1/2 top-1/2 max-w-none select-none"
                style={{
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                  width: previewSize ? `${previewSize.width}px` : "100%",
                  height: previewSize ? `${previewSize.height}px` : "100%",
                }}
                draggable={false}
                onLoad={(event) => {
                  setNaturalSize({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  });
                  setLoaded(true);
                }}
              />
            )}
            <div className="pointer-events-none absolute inset-0 border-2 border-background/80 shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.08)]" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Zoom</span>
              <span>{zoom.toFixed(1)}x</span>
            </div>
            <Slider value={[zoom]} min={1} max={3} step={0.05} onValueChange={handleZoomChange} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={processing}>
            Annulla
          </Button>
          <Button onClick={handleConfirm} disabled={!loaded || processing}>
            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Usa ritaglio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageCropDialog;
