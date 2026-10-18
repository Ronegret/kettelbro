"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useProgram } from "@/components/ProgramProvider";
import { OnboardingFlow } from "@/components/screens/Onboarding";
import { Splash } from "@/components/screens/Splash";
import { defaultSettings } from "@/lib/engine/defaults";

export default function Bienvenida() {
  const { status, signOut } = useAuth();
  const program = useProgram();
  const router = useRouter();

  useEffect(() => {
    if (status === "signedOut") router.replace("/");
    if (status === "signedIn" && program.status === "ready" && program.settings?.onboardedAt) router.replace("/hoy");
  }, [status, program.status, program.settings, router]);

  if (status !== "signedIn" || program.status !== "ready") return <Splash />;

  return (
    <OnboardingFlow
      initial={program.settings ?? defaultSettings()}
      onCancel={async () => {
        await signOut();
        router.replace("/");
      }}
      onDone={async (settings) => {
        await program.saveSettings(settings);
        router.replace("/hoy");
      }}
    />
  );
}
