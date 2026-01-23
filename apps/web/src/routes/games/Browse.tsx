import { Link } from 'react-router-dom';
import bouncerScreen from '../../assets/bouncer_screen.jpg';

function GameListingExample() {
  return (
    <Link
      to="/games/bouncer"
      className="group block w-48 sm:w-52 md:w-56 lg:w-60 my-3"
    >
      <div className="overflow-hidden border border-white/10 bg-black/50 transition duration-200 group-hover:-translate-y-1 group-hover:border-white/30 group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
        <div className="aspect-[4/3] w-full overflow-hidden">
          <img
            src={bouncerScreen}
            alt="Bouncer screenshot"
            className="p-2 h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        </div>

        <div className="space-y-1 px-3 py-3 text-slate-200">
          <div className="text-sm font-semibold">Bouncer!</div>
          <div className="text-[11px] leading-snug text-slate-400">
            Flick a ball through an obstacle course while racing opponents to the goal
            — mini-golf if it was a platformer game
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Browse() {
    return (
        <main className="p-10 flex flex-wrap justify-center gap-4">
            <div className="text-center w-full">(Theres only 1 game so far...)</div>
            {GameListingExample()}
            {GameListingExample()}
            {GameListingExample()}
            {GameListingExample()}
            {GameListingExample()}
            {GameListingExample()}
            {GameListingExample()}
            {GameListingExample()}
        </main>
    )
}