import { Server } from 'boardgame.io/server';
import { NinthPlanet } from './Game';

const server = Server({ games: [NinthPlanet] });

server.run(8000);