import { Outlet } from "react-router-dom";

export default function SpellDuelLayout() {
  return (
    <div className="gamePage">
      <main className="gameContent">
        <section className="gameStage">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
