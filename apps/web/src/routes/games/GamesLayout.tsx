import { Outlet } from "react-router-dom";


export default function GamesLayout() {
    return (
        <div className="pt-14 font-['Manrope'] text-slate-200/90S min-h-screen w-full text-slate-100 bg-gradient-to-b from-indigo-950 to-neutral-950">
            <Outlet />
        </div>
    )
}