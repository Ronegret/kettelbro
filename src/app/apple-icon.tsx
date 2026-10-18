import { ImageResponse } from "next/og";
import { IconArt } from "@/lib/brandArt";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Ícono de iOS: a sangre completa (iOS aplica su propia esquina redondeada, sin transparencia). */
export default function AppleIcon() {
  return new ImageResponse(<IconArt size={180} variant="any" />, size);
}
