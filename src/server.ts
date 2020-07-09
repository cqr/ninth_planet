import { Server } from 'boardgame.io/server';
import { resolve } from 'path';
import serve from 'koa-static';
import { NinthPlanet } from './Game';

const server = Server({ games: [NinthPlanet] });
const PORT = parseInt(process.env.PORT || '8000', 10);

const frontEndAppBuildPath = resolve(__dirname, '../build');
server.app.use(serve(frontEndAppBuildPath));

server.run(PORT, () => {
  server.app.use(
    async (ctx: any, next:any) => await serve(frontEndAppBuildPath)(
      Object.assign(ctx, { path: 'index.html' }),
      next
    )
  )
});