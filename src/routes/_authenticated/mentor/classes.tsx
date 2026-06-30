import { createFileRoute } from "@tanstack/react-router";
import { WireframePage } from "@/components/vkm/wireframe-page";
import { getPageConfig } from "@/components/vkm/page-registry";

export const Route = createFileRoute("/_authenticated/mentor/classes")({
  head: () => ({ meta: [{ title: "Classes · VKM" }] }),
  component: () => <WireframePage config={getPageConfig("/mentor/classes")} />,
});
