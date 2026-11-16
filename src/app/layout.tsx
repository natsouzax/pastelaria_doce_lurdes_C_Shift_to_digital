import type { Metadata } from "next";
import "./real.css";

export const metadata: Metadata = {
  title: "Doce Lurdes · Encomendas",
  description: "Gestão de encomendas da pastelaria Doce Lurdes",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-PT"><body>{children}</body></html>;
}
