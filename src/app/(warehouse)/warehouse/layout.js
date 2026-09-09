import AuthGuard from "../../../component/AuthGuard";

export default function WarehouseLayout({ children }) {
  return (
    <AuthGuard>
      <div style={{
        minHeight: "100vh",
        backgroundColor: "#F8F9FA",
        color: "#111827",
        fontFamily: 'Inter, -apple-system, sans-serif'
      }}>
        {children}
      </div>
    </AuthGuard>
  );
}
