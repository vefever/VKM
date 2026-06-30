import { createFileRoute } from "@tanstack/react-router";
import { WireframePage } from "@/components/vkm/wireframe-page";
import { getPageConfig } from "@/components/vkm/page-registry";

export const Route = createFileRoute("/_authenticated/coach/reports")({
  head: () => ({ meta: [{ title: "Reports · VKM" }] }),
  component: () => <WireframePage config={getPageConfig("/coach/reports")} />,
});
