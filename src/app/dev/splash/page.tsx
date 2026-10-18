import { notFound } from "next/navigation";
import { Splash } from "@/components/screens/Splash";

/** Vista previa de la pantalla de carga (solo desarrollo; en producción responde 404). */
export default function SplashPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Splash message="Abriendo kettellbro…" />;
}
