import { Link } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { MessageCircle, ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const WHATSAPP_NUMBER = "923027858300";
const WHATSAPP_BASE = `https://wa.me/${WHATSAPP_NUMBER}`;

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
  sort_order: number;
  whatsapp_number: string | null;
}

const useProducts = () =>
  useQuery({
    queryKey: ["merch-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merch_products" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data as unknown as MerchProduct[]) ?? [];
    },
  });

const ProductCard = ({ product }: { product: MerchProduct }) => {
  const { t, language } = useLanguage();
  const displayName = language === "it" && product.name_it ? product.name_it : product.name;
  const displayDesc = language === "it" && product.description_it ? product.description_it : product.description;
  const displayBadge = language === "it" && product.badge_it ? product.badge_it : product.badge;

  const productNumber = product.whatsapp_number?.replace(/\D/g, '') || WHATSAPP_NUMBER;
  const whatsappUrl = `https://wa.me/${productNumber}?text=${encodeURIComponent(
    `Ciao! Vorrei acquistare: ${displayName} (€${product.price})`
  )}`;

  return (
    <Link to={`/shop/${product.id}`} className="block">
      <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
        <div className="relative aspect-square bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <ShoppingBag className="h-12 w-12 opacity-30" />
            </div>
          )}
          {displayBadge && (
            <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground text-[10px] font-body">
              {displayBadge}
            </Badge>
          )}
        </div>
        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="font-display text-sm font-bold text-foreground leading-tight">
              {displayName}
            </h3>
            <p className="text-lg font-display font-bold text-primary mt-1">
              €{Number(product.price).toFixed(2)}
            </p>
          </div>
          <p className="text-xs font-body text-muted-foreground leading-relaxed line-clamp-2">
            {displayDesc}
          </p>
          <Button
            className="w-full gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-body text-[11px] sm:text-sm px-2 sm:px-4 h-9 sm:h-10"
            onClick={(e) => { e.preventDefault(); window.open(whatsappUrl, "_blank"); }}
          >
            <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="truncate">{t("whatsapp")}</span>
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
};

const ProductSkeleton = () => (
  <Card className="overflow-hidden border-0 shadow-sm">
    <Skeleton className="aspect-square w-full" />
    <CardContent className="p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-10 w-full" />
    </CardContent>
  </Card>
);

const Merch = () => {
  const { t } = useLanguage();
  const { data: products, isLoading } = useProducts();

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h1 className="font-display text-xl font-bold text-foreground">
              {t("merchandise")}
            </h1>
          </div>
          <p className="text-sm font-body text-muted-foreground">
            {t("merchDescription")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)
            : products?.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
        </div>

        {!isLoading && products?.length === 0 && (
          <div className="rounded-xl bg-muted p-8 text-center">
            <p className="text-sm font-body text-muted-foreground">
              {t("noProducts")}
            </p>
          </div>
        )}

        <div className="rounded-xl bg-muted p-4 text-center space-y-1">
          <p className="text-xs font-body text-muted-foreground">
            {t("merchOrderInfo")}
          </p>
          <p className="text-xs font-body text-muted-foreground">
            {t("merchDeliveryInfo")}
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default Merch;
