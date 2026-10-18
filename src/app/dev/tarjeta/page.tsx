import { notFound } from "next/navigation";
import { TarjetaLab } from "./TarjetaLab";

/** Banco de pruebas SOLO de desarrollo (404 en producción): la imagen para compartir con datos de ejemplo. */
export default function TarjetaPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <TarjetaLab />;
}
