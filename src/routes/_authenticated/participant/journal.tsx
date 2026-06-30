import { createFileRoute } from "@tanstack/react-router";
import { WireframePage } from "@/components/vkm/wireframe-page";
import { getPageConfig } from "@/components/vkm/page-registry";

export const Route = createFileRoute("/_authenticated/participant/journal")({
  head: () => ({ meta: [{ title: "Journal · VKM" }] }),
  component: () => <WireframePage config={getPageConfig("/participant/journal")} />,
});
