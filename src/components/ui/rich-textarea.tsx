import * as React from "react";
import { cn } from "@/lib/utils";
import { Bold, Italic, Underline, Strikethrough, List } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";

interface RichTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

const wrapSelection = (
  textarea: HTMLTextAreaElement,
  openTag: string,
  closeTag: string,
  value: string,
  onChange: (v: string) => void
) => {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.substring(start, end);
  
  // Check if already wrapped
  const beforeOpen = value.substring(Math.max(0, start - openTag.length), start);
  const afterClose = value.substring(end, end + closeTag.length);
  
  if (beforeOpen === openTag && afterClose === closeTag) {
    // Unwrap
    const newValue = value.substring(0, start - openTag.length) + selected + value.substring(end + closeTag.length);
    onChange(newValue);
    requestAnimationFrame(() => {
      textarea.selectionStart = start - openTag.length;
      textarea.selectionEnd = end - openTag.length;
      textarea.focus();
    });
    return;
  }

  const wrapped = `${openTag}${selected}${closeTag}`;
  const newValue = value.substring(0, start) + wrapped + value.substring(end);
  onChange(newValue);
  requestAnimationFrame(() => {
    textarea.selectionStart = start + openTag.length;
    textarea.selectionEnd = end + openTag.length;
    textarea.focus();
  });
};

const toggleBullet = (
  textarea: HTMLTextAreaElement,
  value: string,
  onChange: (v: string) => void
) => {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  // Find line boundaries
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = value.indexOf("\n", end);
  const actualEnd = lineEnd === -1 ? value.length : lineEnd;
  
  const lines = value.substring(lineStart, actualEnd).split("\n");
  const allBulleted = lines.every(l => l.trimStart().startsWith("• "));
  
  const newLines = lines.map(l => {
    if (allBulleted) {
      return l.replace(/^(\s*)• /, "$1");
    }
    const trimmed = l.trimStart();
    const indent = l.substring(0, l.length - trimmed.length);
    return `${indent}• ${trimmed}`;
  });
  
  const newValue = value.substring(0, lineStart) + newLines.join("\n") + value.substring(actualEnd);
  onChange(newValue);
  requestAnimationFrame(() => {
    textarea.focus();
  });
};

const RichTextarea = React.forwardRef<HTMLTextAreaElement, RichTextareaProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const internalRef = React.useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

    const getTextarea = () => {
      if (ref && typeof ref === "object" && ref.current) return ref.current;
      return internalRef.current;
    };

    const handleFormat = (openTag: string, closeTag: string) => {
      const ta = getTextarea();
      if (!ta) return;
      wrapSelection(ta, openTag, closeTag, value, onChange);
    };

    const handleBullet = () => {
      const ta = getTextarea();
      if (!ta) return;
      toggleBullet(ta, value, onChange);
    };

    const buttons = [
      { icon: Bold, label: "Grassetto", action: () => handleFormat("<b>", "</b>") },
      { icon: Italic, label: "Corsivo", action: () => handleFormat("<i>", "</i>") },
      { icon: Underline, label: "Sottolineato", action: () => handleFormat("<u>", "</u>") },
      { icon: Strikethrough, label: "Barrato", action: () => handleFormat("<s>", "</s>") },
      { icon: List, label: "Elenco", action: handleBullet },
    ];

    return (
      <div className="space-y-0">
        <div className="flex items-center gap-0.5 p-1 border border-b-0 border-input rounded-t-md bg-muted/50">
          {buttons.map((btn) => (
            <Toggle
              key={btn.label}
              size="sm"
              aria-label={btn.label}
              className="h-7 w-7 p-0 data-[state=on]:bg-accent"
              onPressedChange={() => btn.action()}
              pressed={false}
            >
              <btn.icon className="h-3.5 w-3.5" />
            </Toggle>
          ))}
        </div>
        <textarea
          ref={internalRef}
          className={cn(
            "flex min-h-[80px] w-full rounded-b-md rounded-t-none border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...props}
        />
      </div>
    );
  }
);

RichTextarea.displayName = "RichTextarea";

export { RichTextarea };
