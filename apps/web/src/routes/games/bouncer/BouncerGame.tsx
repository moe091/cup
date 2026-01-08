import { useParams, Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { connectBouncer, type BouncerConnection } from '@cup/bouncer-client';
import type { LobbyJoinResponse } from '@cup/shared-types';

type Params = { matchId: string };

export function BouncerGame() {
    const { matchId } = useParams<Params>();
    const gameContainerRef = useRef<HTMLDivElement | null>(null);

    console.log("BEFORE USEEFFECT");
    useEffect(() => {
        if (!matchId) return; // can't have this check earlier because useEffect shouldn't be called conditionally. Just return instantly if no matchId

        const gameEl = gameContainerRef.current;
        if (!gameEl) return; // el should always exist by now but this protects from weird behavior(hanging sockets) if anything goes wrong. Also tells typescript it's not null before we pass in to connectToLobby


        function connectToLobby(lobbyInfo: LobbyJoinResponse, gameContainerEl: HTMLElement): BouncerConnection {
            const bouncerConnection = connectBouncer(lobbyInfo.socketUrl, lobbyInfo.matchId, gameContainerEl);
            console.log("Got bouncerConnection:", bouncerConnection);

            return bouncerConnection;
        }

        const controller = new AbortController();
        let conn: BouncerConnection | null = null;
        
        fetch(`/api/games/bouncer/join/${matchId}`, { 
            method: 'POST',
            signal: controller.signal,
            credentials: 'include',
        })
        .then(res => {
            if (res.ok) return res.json();
            if (res.status == 404) throw new Error("Lobby not found");
            if (res.status == 410) throw new Error("Lobby has expired");
            if (res.status == 409) throw new Error("Lobby is not open for joining");
            throw new Error("Failed to join lobby: " + res.statusText);
        })
        .then((data: LobbyJoinResponse) => {
            console.log("Joining lobby with data:", data);
            conn = connectToLobby(data, gameEl);
        })
        .catch(err => {
            if (err?.name === 'AbortError') return;
            console.error("Error joining lobby:", err);
        });

        return () => {
            controller.abort();
            if (conn) conn.disconnect();
        };
    }, [matchId]);
    
    
    if (!matchId) {
        return <div>Missing matchId</div>;
    }

    return (
        <div ref={gameContainerRef} id="bouncer_client_container">
            {/*<Link to="/games/bouncer">Back</Link> */}
        </div>
    )

}
