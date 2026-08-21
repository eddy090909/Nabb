export const metadata = {
  title: "Nabb - The easiest way in to a course you're trying to get into",
  description: "Get an instant notification the moment a seat opens in a course.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#fafafa" }}>
        {children}
      </body>
    </html>
  );
}
