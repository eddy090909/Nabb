export const metadata = {
  title: "WesSeats - Wesleyan Seat Availability Alerts",
  description: "Get notified the instant a seat opens up in a Wesleyan course.",
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
