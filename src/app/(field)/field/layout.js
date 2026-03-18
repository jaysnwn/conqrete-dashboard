export default function FieldLayout({ children }) {
  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#000",
      color: "#fff",
      fontFamily: 'Inter, sans-serif'
    }}>
      {children}
    </div>
  );
}