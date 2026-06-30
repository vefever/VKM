import { supabase } from "@/integrations/supabase/client";
import { uploadToStorage } from "@/lib/storage-upload";

export async function uploadAvatar(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const publicUrl = await uploadToStorage("chat-attachments", path, blob, "image/jpeg");
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", userId);
  if (updErr) throw updErr;
  return publicUrl;
}