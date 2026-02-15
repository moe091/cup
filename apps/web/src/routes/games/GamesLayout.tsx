import { Outlet } from "react-router-dom";

export default function GamesLayout() {
  return (
    <div className="pt-14 min-h-screen w-full text-[color:var(--text)]">
      <Outlet />
    </div>
  );
}
