import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

export const ISSUE_MEDIA_BUCKET = "issue-media";
export const ISSUE_MEDIA_MAX_FILES = 4;
export const ISSUE_MEDIA_MAX_SIZE_BYTES = 50 * 1024 * 1024;

export type IssueMediaAttachment = {
  path: string;
  type: "image" | "video";
  content_type: string;
  name: string;
  size: number;
};

const ALLOWED_ISSUE_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

const isAllowedIssueMediaType = (file: File) =>
  ALLOWED_ISSUE_MEDIA_TYPES.has(file.type);

const sanitizeFileName = (name: string) => {
  const cleanName = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 90);

  return cleanName || "attachment";
};

export const formatIssueMediaSize = (size: number) => {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
};

export const getIssueMediaAttachments = (value: unknown): IssueMediaAttachment[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const attachment = item as Partial<IssueMediaAttachment>;
    if (typeof attachment.path !== "string" || !attachment.path) return [];

    const type = attachment.type === "video" ? "video" : "image";
    return [{
      path: attachment.path,
      type,
      content_type: typeof attachment.content_type === "string" ? attachment.content_type : type === "video" ? "video/mp4" : "image/jpeg",
      name: typeof attachment.name === "string" && attachment.name ? attachment.name : type === "video" ? "video" : "immagine",
      size: typeof attachment.size === "number" ? attachment.size : 0,
    }];
  });
};

export const validateIssueMediaFiles = (files: File[], existingCount = 0): string | null => {
  if (existingCount + files.length > ISSUE_MEDIA_MAX_FILES) {
    return `Puoi allegare al massimo ${ISSUE_MEDIA_MAX_FILES} file.`;
  }

  const unsupported = files.find((file) => !isAllowedIssueMediaType(file));
  if (unsupported) {
    return "Puoi allegare JPG, PNG, WebP, GIF, MP4, MOV o WebM.";
  }

  const tooLarge = files.find((file) => file.size > ISSUE_MEDIA_MAX_SIZE_BYTES);
  if (tooLarge) {
    return `${tooLarge.name} supera il limite di ${formatIssueMediaSize(ISSUE_MEDIA_MAX_SIZE_BYTES)}.`;
  }

  return null;
};

export const uploadIssueMediaFiles = async (
  supabase: SupabaseClient<Database>,
  userId: string,
  files: File[],
): Promise<IssueMediaAttachment[]> => {
  const uploaded: IssueMediaAttachment[] = [];

  try {
    for (const file of files) {
      const attachmentType = file.type.startsWith("video/") ? "video" : "image";
      const filePath = `${userId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
      const { error } = await supabase.storage.from(ISSUE_MEDIA_BUCKET).upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

      if (error) throw error;

      uploaded.push({
        path: filePath,
        type: attachmentType,
        content_type: file.type,
        name: file.name,
        size: file.size,
      });
    }

    return uploaded;
  } catch (error) {
    if (uploaded.length > 0) {
      await supabase.storage.from(ISSUE_MEDIA_BUCKET).remove(uploaded.map((item) => item.path));
    }
    throw error;
  }
};

export const signIssueMediaAttachments = async (
  supabase: SupabaseClient<Database>,
  attachments: IssueMediaAttachment[],
) => {
  const entries = await Promise.all(
    attachments.map(async (attachment) => {
      const { data, error } = await supabase.storage
        .from(ISSUE_MEDIA_BUCKET)
        .createSignedUrl(attachment.path, 60 * 60);

      if (error || !data?.signedUrl) return null;
      return [attachment.path, data.signedUrl] as const;
    }),
  );

  return Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, string]>);
};

export const issueMediaAttachmentsToJson = (attachments: IssueMediaAttachment[]): Json =>
  attachments as unknown as Json;
