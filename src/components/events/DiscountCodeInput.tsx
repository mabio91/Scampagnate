import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Ticket, Check, X, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface DiscountResult {
  valid: boolean;
  error?: string;
  discount_code_id?: string;
  discount_type?: string;
  discount_value?: number;
  original_price?: number;
  final_price?: number;
  description?: string;
  waives_service_fee?: boolean;
}

interface DiscountCodeInputProps {
  eventId: string;
  userId: string;
  onDiscountApplied: (result: DiscountResult | null) => void;
}

const DiscountCodeInput = ({ eventId, userId, onDiscountApplied }: DiscountCodeInputProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiscountResult | null>(null);
  const { t } = useLanguage();

  const validateCode = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("validate_discount_code", {
        p_code: code.trim(),
        p_event_id: eventId,
        p_user_id: userId,
      });
      if (error) throw error;
      const res = data as unknown as DiscountResult;
      let enrichedResult = res;
      if (res.valid && res.discount_code_id) {
        const { data: discountMeta } = await supabase
          .from("discount_codes")
          .select("waives_service_fee")
          .eq("id", res.discount_code_id)
          .maybeSingle();

        enrichedResult = {
          ...res,
          waives_service_fee: res.waives_service_fee === true || discountMeta?.waives_service_fee === true,
        };
      }

      setResult(enrichedResult);
      onDiscountApplied(enrichedResult.valid ? enrichedResult : null);
    } catch {
      setResult({ valid: false, error: t("validationError") });
      onDiscountApplied(null);
    } finally {
      setLoading(false);
    }
  };

  const clearDiscount = () => {
    setCode("");
    setResult(null);
    onDiscountApplied(null);
  };

  if (result?.valid) {
    return (
      <div className="p-3 rounded-xl bg-success/10 border border-success/20 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-success" />
            <span className="text-xs font-body font-bold text-success">{t("codeApplied", { code: code.toUpperCase() })}</span>
          </div>
          <button onClick={clearDiscount} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex justify-between text-xs font-body">
          <span className="text-muted-foreground">
            {result.discount_type === "percentage" ? t("percentDiscount", { value: result.discount_value || 0 }) : t("amountDiscount", { value: result.discount_value || 0 })}
          </span>
          <div className="text-right">
            <span className="line-through text-muted-foreground mr-2">€{Number(result.original_price).toFixed(2)}</span>
            <span className="font-bold text-success">€{Number(result.final_price).toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (result) setResult(null);
            }}
            placeholder={t("discountPlaceholder")}
            className="pl-9 font-mono text-sm h-9"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), validateCode())}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={validateCode}
          disabled={!code.trim() || loading}
          className="h-9 px-3"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("apply")}
        </Button>
      </div>
      {result && !result.valid && (
        <p className="text-[11px] text-destructive font-body">{result.error}</p>
      )}
    </div>
  );
};

export default DiscountCodeInput;
