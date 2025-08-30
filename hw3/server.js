const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router(__dirname + '/db.json');
const middlewares = jsonServer.defaults({ logger: true });

server.use(middlewares);
server.use(jsonServer.bodyParser);
server.use(router);

const PORT = 3000;

server.listen(PORT, () => console.log(`JSON Server running on :${PORT}`));