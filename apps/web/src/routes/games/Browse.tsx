import { Link } from "react-router-dom";
import bouncerScreen from "../../assets/bouncer_screen.jpg";

type GameCardProps = {
  to: string;
  title: string;
  description: string;
  image?: string;
  placeholder?: string;
};

function GameCard({ to, title, description, image, placeholder }: GameCardProps) {
  return (
    <Link to={to} className="group block w-48 sm:w-52 md:w-56 lg:w-60 my-3">
      <div className="overflow-hidden border border-[color:var(--line)] bg-[color:var(--panel)]/70 transition duration-200 group-hover:-translate-y-1 group-hover:border-[color:var(--text)] group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
        <div className="aspect-[4/3] w-full overflow-hidden flex items-center justify-center bg-[color:var(--panel-strong)]">
          {image ? (
            <img
              src={image}
              alt={`${title} screenshot`}
              className="p-2 h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <span className="text-3xl tracking-widest text-[color:var(--accent)] font-bold select-none">
              {placeholder}
            </span>
          )}
        </div>
        <div className="space-y-1 px-3 py-3 text-[color:var(--text)]">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[11px] leading-snug text-[color:var(--muted)]">{description}</div>
        </div>
      </div>
    </Link>
  );
}

export default function Browse() {
  return (
    <main className="p-10 flex flex-wrap justify-center gap-4 text-[color:var(--text)]">
      <GameCard
        to="/games/bouncer"
        title="Bouncer!"
        description="Race your friends by rolling, jumping, and dashing through a physics-based platformer world."
        image={bouncerScreen}
      />
      <GameCard
        to="/games/spellduel"
        title="SpellDuel"
        description="Race opponents to solve multiple Wordle-style puzzles. Claim boards before anyone else does."
        placeholder="SPELL"
      />
    </main>
  );
}
