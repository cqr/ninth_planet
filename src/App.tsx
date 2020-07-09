// import React from 'react';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer'
import { NinthPlanet } from './Game';
import { Board } from './Board';
import { Transport, TransportOpts } from 'boardgame.io/dist/types/src/client/transport/transport';

// const gameComponents = [
//   {game: NinthPlanet, board: Board}
// ];


// export default function App(props:any) {
//   return <Lobby
//     gameServer={`http://${window.location.hostname}:8000`}
//     lobbyServer={`http://${window.location.hostname}:8000`}
//     gameComponents={gameComponents} debug={true} />;
// }

export default Client({ game: NinthPlanet, board: Board, numPlayers: 3, debug: true, multiplayer: SocketIO({server: 'http://localhost:8000'}) as (opts: TransportOpts) => Transport });



// export default class App extends Component<{playerId?: string, autoGameId?:string}, {gameId?: string, numPlayers: number, pendingGameName?: string}, {}> {
//   state = {
//     numPlayers: 3,
//     gameId: undefined,
//     pendingGameName: undefined
//   };

//   render() {
//     if (typeof this.props['autoGameId'] !== 'undefined') {
//       const NinthPlanetClient = Client({ game: NinthPlanet, board: Board, numPlayers: 1, multiplayer: SocketIO({server: '10.7.2.146:8000'}), debug: false });
//       return <NinthPlanetClient playerID={this.props.playerId} gameID={this.props.autoGameId} />;
//     } else if (this.state.gameId) {
//       const NinthPlanetClient = Client({ game: NinthPlanet, board: Board, numPlayers: this.state.numPlayers, multiplayer: SocketIO({server: '10.7.2.146:8000'}), debug: false });
//       return <NinthPlanetClient playerID="0" gameID={this.state.gameId} />
//     }
//     return <>
//       <form onSubmit={(e) => ([e.preventDefault(), this.setState(state => ({...state, gameId: state.pendingGameName}))])}>
//         <input name="gameName" type="text" value={this.state.pendingGameName} onChange={(e) => this.setState({pendingGameName: e.target.value})} />
//         <input type="number" min="3" max="5" value={this.state.numPlayers} onChange={(e) => this.setState({numPlayers: parseInt(e.target.value, 10)})} />
//         <button type="submit">Start</button>
//       </form>
//     </>;
//   }
// }