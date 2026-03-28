import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MessageCircle, ShoppingBag, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const WHATSAPP_NUMBER = "923027858300";

interface MerchProduct {
  id: string;
  name: string;
  name_it: string | null;
  description: string;
  description_it: string | null;
  price: number;
  image_url: string | null;
  badge: string | null;
  badge_it: string | null;
  gallery_images: string[] | null;
  whatsapp_number: string | null;
}

const useProduct = (id: string | undefined) =>
  useQuery({
    queryKey: ["merch-product", id],
    queryFn: async () => {
      if (!id) throw new Error("No product ID");
      const { data, error } = await supabase
        .from("merch_products" as any)
        .select("*")
        .eq("id", id)
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return data as unknown as MerchProduct;
    },
    enabled: !!id,
  });

const FullscreenViewer = ({
  images,
  currentIndex,
  onClose,
  onPrev,
  onNext,
}: {
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = e.changedTouches[0].clientX - touchStart;
    if (Math.abs(diff) > 50) {
      if (diff > 0) onPrev();
      else onNext();
    }
    setTouchStart(null);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-none w-screen h-screen p-0 border-0 bg-black/95 [&>button]:hidden">
        <div
          className="relative w-full h-full flex items-center justify-center"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={onPrev}
                className="absolute left-3 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={onNext}
                className="absolute right-3 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <img
            src={images[currentIndex]}
            alt=""
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
          />

          {images.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    i === currentIndex ? "bg-white scale-125" : "bg-white/40"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ImageGallery = ({ images }: { images: string[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const goTo = useCallback((i: number) => {
    setCurrentIndex(((i % images.length) + images.length) % images.length);
  }, [images.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = e.changedTouches[0].clientX - touchStart;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goTo(currentIndex - 1);
      else goTo(currentIndex + 1);
    }
    setTouchStart(null);
  };

  return (
    <>
      {/* Hero / main image */}
      <div
        className="relative aspect-square bg-muted overflow-hidden cursor-pointer"
        onClick={() => setFullscreen(true)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={images[currentIndex]}
          alt=""
          className="w-full h-full object-cover transition-opacity duration-300"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goTo(currentIndex - 1); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/70 text-foreground backdrop-blur-sm hover:bg-background/90 transition-colors hidden sm:flex"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goTo(currentIndex + 1); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/70 text-foreground backdrop-blur-sm hover:bg-background/90 transition-colors hidden sm:flex"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    i === currentIndex ? "bg-primary scale-125" : "bg-foreground/30"
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                "shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                i === currentIndex ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {fullscreen && (
        <FullscreenViewer
          images={images}
          currentIndex={currentIndex}
          onClose={() => setFullscreen(false)}
          onPrev={() => goTo(currentIndex - 1)}
          onNext={() => goTo(currentIndex + 1)}
        />
      )}
    </>
  );
};

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { data: product, isLoading, isError } = useProduct(id);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton className="aspect-square w-full" />
          <div className="px-4 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isError || !product) {
    return (
      <AppLayout>
        <div className="px-4 py-12 text-center space-y-4">
          <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground opacity-40" />
          <h1 className="font-display text-lg font-bold text-foreground">{t("productNotFound")}</h1>
          <p className="text-sm font-body text-muted-foreground">{t("productNotFoundDesc")}</p>
          <Button variant="outline" onClick={() => navigate("/shop")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("backToShop")}
          </Button>
        </div>
      </AppLayout>
    );
  }

  const displayName = language === "it" && product.name_it ? product.name_it : product.name;
  const displayDesc = language === "it" && product.description_it ? product.description_it : product.description;
  const displayBadge = language === "it" && product.badge_it ? product.badge_it : product.badge;

  // Build gallery: hero image + gallery_images
  const allImages: string[] = [];
  if (product.image_url) allImages.push(product.image_url);
  if (product.gallery_images && Array.isArray(product.gallery_images)) {
    allImages.push(...product.gallery_images.filter((img) => img && typeof img === "string"));
  }

  const productNumber = product.whatsapp_number?.replace(/\D/g, "") || WHATSAPP_NUMBER;
  const whatsappUrl = `https://wa.me/${productNumber}?text=${encodeURIComponent(
    `Ciao! Vorrei acquistare: ${displayName} (€${product.price})`
  )}`;

  return (
    <AppLayout>
      <div className="pb-6">
        {/* Back button */}
        <div className="px-4 py-3">
          <button
            onClick={() => navigate("/shop")}
            className="flex items-center gap-1 text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToShop")}
          </button>
        </div>

        {/* Image gallery or placeholder */}
        {allImages.length > 0 ? (
          <ImageGallery images={allImages} />
        ) : (
          <div className="aspect-square bg-muted flex items-center justify-center">
            <ShoppingBag className="h-16 w-16 text-muted-foreground opacity-20" />
          </div>
        )}

        {/* Product info */}
        <div className="px-4 pt-4 space-y-4">
          <div className="space-y-2">
            {displayBadge && (
              <Badge className="bg-accent text-accent-foreground text-[10px] font-body">
                {displayBadge}
              </Badge>
            )}
            <h1 className="font-display text-xl font-bold text-foreground leading-tight">
              {displayName}
            </h1>
            <p className="text-2xl font-display font-bold text-primary">
              €{Number(product.price).toFixed(2)}
            </p>
          </div>

          <p className="text-sm font-body text-muted-foreground leading-relaxed whitespace-pre-line">
            {displayDesc}
          </p>

          {/* WhatsApp CTA */}
          <Button
            className="w-full gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-body text-sm h-12"
            onClick={() => window.open(whatsappUrl, "_blank")}
          >
            <MessageCircle className="h-5 w-5" />
            {t("buyOnWhatsApp")}
          </Button>

          <div className="rounded-xl bg-muted p-4 text-center space-y-1">
            <p className="text-xs font-body text-muted-foreground">{t("merchOrderInfo")}</p>
            <p className="text-xs font-body text-muted-foreground">{t("merchDeliveryInfo")}</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ProductDetail;
