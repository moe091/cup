import { Link, Outlet } from 'react-router-dom';


export default function BouncerLayout() {
    return (
        <div className="gamePage">
            <h2 className="gameTitle">Play Bouncer!</h2>

            <main className="gameContent">
                <section className="gameStage">
                    <Outlet />
                </section>
            </main>
            
            <div className="gameFooter">
                <Link to="/games">Back to games</Link>
            </div>
        </div>
    );
}