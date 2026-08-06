"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export type FileKind = "image" | "video" | "document" | "other";

export type MediaItem = {
  id: string;
  storage_path: string;
  file_name: string;
  file_type: FileKind;
  mime_type: string | null;
  size_bytes: number | null;
  caption: string | null;
  tags: string[];
  created_at: string;
  url?: string;
};

const BUCKET = "media";
const SIGNED_URL_TTL = 60 * 60; // 1 hour
const MEDIA_KEY = "media";

export const kindFromMime = (mime: string): FileKind => {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf" || mime.startsWith("text/") || mime.includes("document")) return "document";
  return "other";
};

async function fetchMediaItems(supabase: ReturnType<typeof createClient>): Promise<MediaItem[]> {
  const { data, error } = await supabase
    .from("media_items")
    .select("id, storage_path, file_name, file_type, mime_type, size_bytes, caption, tags, created_at")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  // Signed URLs are per-item and expire, so they're fetched alongside the
  // metadata rather than cached separately from them.
  const withUrls = await Promise.all(
    (data as MediaItem[]).map(async (item) => {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(item.storage_path, SIGNED_URL_TTL);
      return { ...item, url: signed?.signedUrl };
    })
  );
  return withUrls;
}

export function useMediaVault() {
  const supabase = useMemo(() => createClient(), []);

  const { data, error, isLoading, mutate } = useSWR<MediaItem[]>(MEDIA_KEY, () => fetchMediaItems(supabase));

  const items = data ?? [];

  // Uploads touch both Storage and the metadata table per file, and the new
  // rows need signed URLs too — simplest correct approach is a full
  // revalidate after all uploads finish, rather than trying to hand-splice
  // optimistic entries in.
  const uploadFiles = useCallback(
    async (fileList: FileList, tags: string[]) => {
      const failures: string[] = [];

      for (const file of Array.from(fileList)) {
        const kind = kindFromMime(file.type);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
        if (uploadError) {
          failures.push(`${file.name}: ${uploadError.message}`);
          continue;
        }

        const { error: insertError } = await supabase.from("media_items").insert({
          storage_path: path,
          file_name: file.name,
          file_type: kind,
          mime_type: file.type || null,
          size_bytes: file.size,
          tags,
        });
        if (insertError) {
          failures.push(`${file.name} uploaded but metadata failed: ${insertError.message}`);
        }
      }

      await mutate();
      return failures;
    },
    [supabase, mutate]
  );

  const deleteItem = useCallback(
    async (item: MediaItem) => {
      await mutate((current) => (current ?? []).filter((i) => i.id !== item.id), { revalidate: false });
      await supabase.storage.from(BUCKET).remove([item.storage_path]);
      const { error } = await supabase.from("media_items").delete().eq("id", item.id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  const updateCaption = useCallback(
    async (item: MediaItem, caption: string) => {
      await mutate(
        (current) => (current ?? []).map((i) => (i.id === item.id ? { ...i, caption } : i)),
        { revalidate: false }
      );
      const { error } = await supabase.from("media_items").update({ caption: caption || null }).eq("id", item.id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  const renameFile = useCallback(
    async (item: MediaItem, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed || trimmed === item.file_name) return;
      await mutate(
        (current) => (current ?? []).map((i) => (i.id === item.id ? { ...i, file_name: trimmed } : i)),
        { revalidate: false }
      );
      const { error } = await supabase.from("media_items").update({ file_name: trimmed }).eq("id", item.id);
      if (error) await mutate();
    },
    [supabase, mutate]
  );

  return {
    items,
    isLoading,
    error,
    uploadFiles,
    deleteItem,
    updateCaption,
    renameFile,
    refresh: mutate,
  };
}