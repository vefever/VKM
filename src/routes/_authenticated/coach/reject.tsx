import { createFileRoute } from "@tanstack/react-router";
import { WireframePage } from "@/components/vkm/wireframe-page";
import { getPageConfig } from "@/components/vkm/page-registry";

export const Route = createFileRoute("/_authenticated/coach/reject")({
  head: () => ({ meta: [{ title: "Reject · VKM" }] }),
  component: () => <WireframePage config={getPageConfig("/coach/reject")} />,
});
