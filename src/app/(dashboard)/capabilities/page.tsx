import { Suspense } from "react";
import { CapabilityPageClient } from "./_components/CapabilityPageClient";

export default function CapabilitiesPage() {
  return (
    <Suspense>
      <CapabilityPageClient />
    </Suspense>
  );
}
