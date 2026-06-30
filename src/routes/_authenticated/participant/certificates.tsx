import { createFileRoute } from "@tanstack/react-router";
import { CertificatesPage } from "@/components/participant/certificates-page";

export const Route = createFileRoute("/_authenticated/participant/certificates")({
  head: () => ({ meta: [{ title: "Certificate · VKM" }] }),
  component: CertificatesPage,
});
