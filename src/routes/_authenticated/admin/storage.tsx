import { createFileRoute } from "@tanstack/react-router";
import { StorageSettings } from "@/components/admin/storage-settings";

export const Route = createFileRoute("/_authenticated/admin/storage")({
  head: () => ({ meta: [{ title: "Storage · VKM" }] }),
  component: () => <StorageSettings />,
});
