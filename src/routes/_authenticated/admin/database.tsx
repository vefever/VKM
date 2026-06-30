import { createFileRoute } from "@tanstack/react-router";
import { WireframePage } from "@/components/vkm/wireframe-page";
import { getPageConfig } from "@/components/vkm/page-registry";

export const Route = createFileRoute("/_authenticated/admin/database")({
  head: () => ({ meta: [{ title: "Database · VKM" }] }),
  component: () => <WireframePage config={getPageConfig("/admin/database")} />,
});
