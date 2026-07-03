import { createFileRoute } from "@tanstack/react-router";
import { AdminFilesPage } from "@/components/admin/files-page";

export const Route = createFileRoute("/_authenticated/admin/files")({
  head: () => ({ meta: [{ title: "Files · VKM" }] }),
  component: AdminFilesPage,
});
