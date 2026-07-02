import { createFileRoute } from "@tanstack/react-router";
import { SeoSettingsPage } from "@/components/admin/seo-settings";

export const Route = createFileRoute("/_authenticated/admin/seo")({
  head: () => ({ meta: [{ title: "SEO & Analytics · VKM" }] }),
  component: SeoSettingsPage,
});
