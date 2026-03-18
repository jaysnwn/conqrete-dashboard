import "./globals.css";

export const metadata = {
  title: "CONQRETE ERP",
  description: "Core ERP System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}