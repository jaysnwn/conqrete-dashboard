import AuthGuard from "../../../component/AuthGuard";

export default function WarehouseLayout({ children }) {
  return (
    <AuthGuard>
      <div style={{
        minHeight: "100vh",
        backgroundColor: "#000",
        color: "#fff",
        fontFamily: 'Inter, sans-serif'
      }}>
        {children}
      </div>
    </AuthGuard>
  );
}