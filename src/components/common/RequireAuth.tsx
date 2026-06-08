// Authentication is currently disabled — all routes are open.
// To re-enable, restore the user/authReady gate below (see git history).
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
