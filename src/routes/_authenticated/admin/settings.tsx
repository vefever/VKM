import { createFileRoute } from "@tanstack/react-router";
import { ProgramSettingsForm } from "@/components/admin/program-settings-form";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings · VKM" }] }),
  component: ProgramSettingsForm,
});
