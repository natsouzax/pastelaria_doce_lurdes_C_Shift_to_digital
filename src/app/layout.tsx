import type { Metadata, Viewport } from "next";
import { Poppins, Volkhov } from "next/font/google";
import "./real.css";

const serif = Volkhov({ weight: ["400", "700"], style: ["normal", "italic"], subsets: ["latin"], display: "swap", variable: "--font-serif" });
const sans = Poppins({ weight: ["400", "500", "600"], subsets: ["latin"], display: "swap", variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Doce Lurdes · Bolos, doces e salgados por encomenda",
  description: "Encomende na pastelaria Doce Lurdes e acompanhe a confirmação da Gestora. Sem pagamento online.",
};

export const viewport: Viewport = { themeColor: "#0f2a4a" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-PT" className={`${serif.variable} ${sans.variable}`}><body>{children}</body></html>;
}
