import { createFileRoute } from "@tanstack/react-router";
import { WireframePage } from "@/components/vkm/wireframe-page";
import { getPageConfig } from "@/components/vkm/page-registry";

export const Route = createFileRoute("/_authenticated/coach/followups")({
  head: () => ({ meta: [{ title: "Followups · VKM" }] }),
  component: () => <WireframePage config={getPageConfig("/coach/followups")} />,
});
