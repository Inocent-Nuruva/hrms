import type { AppProps } from "next/app";
import { Poppins } from "next/font/google";
import App from "@/App";
import { ThemeProvider } from "@/components/theme-provider";
import "@/app/globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function MyApp(props: AppProps) {
  return (
    <main className={`${poppins.variable} ${poppins.className}`}>
      <ThemeProvider>
        <App {...props} />
      </ThemeProvider>
    </main>
  );
}
