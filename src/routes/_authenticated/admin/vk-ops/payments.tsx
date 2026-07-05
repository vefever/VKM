import { createFileRoute } from "@tanstack/react-router";
import { SectionUnavailable } from "@/components/vkm/section-unavailable";

export const Route = createFileRoute("/_authenticated/admin/vk-ops/payments")({
  head: () => ({ meta: [{ title: "Payment Verification · VKM" }] }),
  component: () => <SectionUnavailable title="Payment Verification" home="/admin" />,
});
