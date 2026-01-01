import { useParams, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { connectBouncer } from '@cup/bouncer-client';

type Params = { matchId: string };

export function BouncerGameRoute() {
    const { matchId } = useParams<Params>();

    if (!matchId) {
        return <div>Missing matchId</div>
    }

    useEffect(() => {
        const bouncerConnection = connectBouncer('http://localhost:4001', matchId);
        console.log("Got bouncerConnection:", bouncerConnection);

        return () => bouncerConnection.disconnect();
    }, []);

    return (
        <div>
            <h1>Bouncer</h1>
            <div>Match ID: {matchId}</div>
            <Link to="/game">Back</Link>
        </div>
    )

}