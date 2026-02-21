import "./globals.css";

export const metadata = {
  title: "GrubSwipe — Swipe Right on Dinner",
  description:
    "Swipe on restaurants and recipes, solo or with friends. Match on where to eat out, discover new recipes, and build smart grocery lists.",
  metadataBase: new URL("https://grubswipe.com"),
  openGraph: {
    title: "GrubSwipe — Swipe Right on Dinner",
    description:
      "Swipe on restaurants and recipes, solo or with friends.",
    url: "https://grubswipe.com",
    siteName: "GrubSwipe",
    images: [
      {
        url: "/GrubSwipe_Logo.png",
        width: 1200,
        height: 630,
        alt: "GrubSwipe Logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GrubSwipe — Swipe Right on Dinner",
    description: "Swipe on restaurants and recipes, solo or with friends.",
    images: ["/GrubSwipe_Logo.png"],
  },
  icons: {
    icon: "/GrubSwipe_Icon.png",
    apple: "/GrubSwipe_Icon.png",
  },
  other: {
    "theme-color": "#FF6B35",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FF6B35",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
