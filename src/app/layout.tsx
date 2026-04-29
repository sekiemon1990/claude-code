import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "マクサスサーチ",
  description: "出張買取スタッフ向け 一括相場検索ツール",
  applicationName: "マクサスサーチ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "マクサスサーチ",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1f6feb",
};

const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('maxus_search:theme');
    if (t === 'dark' || t === 'light') {
      document.documentElement.dataset.theme = t;
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
