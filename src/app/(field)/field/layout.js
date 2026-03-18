export default function FieldLayout({ children }) {
  return (
    <html lang="en">
      <body style={{
        margin: 0,
        backgroundColor: "#000",
        color: "#fff",
        fontFamily: 'Inter, sans-serif'
      }}>
        {children}
      </body>
    </html>
  );
}