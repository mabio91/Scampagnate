import { useState } from "react";
import {
  Link2, MessageCircle, Facebook, Twitter, Linkedin, Send, X
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  url: string;
  text?: string;
}

const ShareSheet = ({ open, onOpenChange, title, url, text }: ShareSheetProps) => {
  const { toast } = useToast();
  const shareText = text || title;
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(shareText);

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied to clipboard" });
    onOpenChange(false);
  };

  const shareOptions = [
    {
      name: "WhatsApp",
      icon: MessageCircle,
      onClick: () => window.open(`https://wa.me/?text=${encodedText}%20${encodedUrl}`, "_blank"),
      className: "bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20",
    },
    {
      name: "Facebook",
      icon: Facebook,
      onClick: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, "_blank"),
      className: "bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20",
    },
    {
      name: "X",
      icon: Twitter,
      onClick: () => window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, "_blank"),
      className: "bg-foreground/10 text-foreground hover:bg-foreground/20",
    },
    {
      name: "LinkedIn",
      icon: Linkedin,
      onClick: () => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, "_blank"),
      className: "bg-[#0A66C2]/10 text-[#0A66C2] hover:bg-[#0A66C2]/20",
    },
    {
      name: "Telegram",
      icon: Send,
      onClick: () => window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, "_blank"),
      className: "bg-[#0088cc]/10 text-[#0088cc] hover:bg-[#0088cc]/20",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="font-display text-base">Share Event</DialogTitle>
        </DialogHeader>

        {/* Copy link */}
        <button
          onClick={copyLink}
          className="flex items-center gap-3 w-full p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-body font-semibold text-foreground">Copy Link</p>
            <p className="text-[10px] font-body text-muted-foreground truncate max-w-[180px]">{url}</p>
          </div>
        </button>

        {/* Social options */}
        <div className="grid grid-cols-5 gap-2">
          {shareOptions.map((option) => (
            <button
              key={option.name}
              onClick={() => { option.onClick(); onOpenChange(false); }}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors ${option.className}`}
            >
              <option.icon className="h-5 w-5" />
              <span className="text-[9px] font-body font-medium">{option.name}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareSheet;
