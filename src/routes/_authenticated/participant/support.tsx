import { createFileRoute } from "@tanstack/react-router";
import { SupportPage } from "@/components/support/support-page";

export const Route = createFileRoute("/_authenticated/participant/support")({
  head: () => ({ meta: [{ title: "Support · VKM" }] }),
  component: SupportPage,
});
