import { createFileRoute } from "@tanstack/react-router";
import { BatchesManager } from "@/components/admin/batches-manager";

export const Route = createFileRoute("/_authenticated/admin/batches")({
  head: () => ({ meta: [{ title: "Batches · VKM" }] }),
  component: BatchesManager,
});
