const events = require('events');
const express = require('express');
const expressJwt = require('express-jwt');
const socketioJwt = require('socketio-jwt');
const jwt = require('jsonwebtoken');
const logger = require('morgan');

const bodyParser = require('body-parser');


const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

// Logging every request to API using morgan
app.use(logger('dev'));

const utils = require('./utils');
const Game = require('./game');
const players = require('./playerUtils');

const gameEvents = require('./gameEvents');

// in miliseconds
const gameLength = 10000;
const timeBetweenGames = 3000;

server.listen(process.env.PORT);

server.on('close', () => {
  console.log('server closed');
});

const secret = 'shhh';

const socketAuthorize = socketioJwt.authorize({
  secret: secret,
  handshake: true
});

io.use(function(socket, next) {
  const handshakeData = socket.request;

  socketAuthorize(handshakeData, (data, success) => {
    if (success) {
      socket.payload = handshakeData.decoded_token;

      if (players.playerIsActive(handshakeData.decoded_token)) {
        next();
      } else {
        next(new Error('not a doge!!'))
      }
    } else {
      //
    }
  });
});

const apiRoutes = express.Router();


app.use('/api/players', apiRoutes);
app.use('/api/game', apiRoutes);
app.use(bodyParser.json());

app.use(function(req, res, next) {
  req.testing = 'testing';
  return next();
});

// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

const playersChanged = new events.EventEmitter();
const newGame = new events.EventEmitter();

app.all('/api/*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type, Authorization");
  next();
});

app.get('/', function(req, res) {
  res.send('Hello world!');
});


app.post('/api/player', (req, res) => {

  if (req.body.password !== 'pracuj456$') {
    res.status(401).send();
    return;
  }

  if (players.getRegistered().filter((p) => p.id === req.body.id).length) {
    res.status(400).send('user with this name already exists');
    return;
  }

  const newPlayer = players.generateNewPlayer(req.body.id, secret);

  players.getRegistered().push(newPlayer);
  playersChanged.emit(gameEvents.PLAYERS_CHANGED, false);

  if (players.getRegistered().length === 1 && !Game.getOngoingGame()) {
    createNewGame();
  }

  res.status(200).send(newPlayer);
});

app.post('/api/player/logout',
  expressJwt({secret: secret}),
  (req, res) => {

    players.unregisterPlayer(req.user);
    res.status(200).send();
  });

app.post('/api/game/play/answer',
  expressJwt({secret: secret}),
  (req, res) => {

    const player = players.getRegisteredPlayer(req.user);

    if (!player) {
      res.status(400).send('player with this playerId doesn\'t play');
      return;
    }

    player.expires = utils.generatePlayerExpirationDate();

    if (Game.getOngoingGame()) {

      Game.getOngoingGame().plays = Game.getOngoingGame().plays.map((play) => {
        if (play.playerId === req.user) {
          play.answer = req.body.answer;
        }
        return play;
      });
    } else {
      res.status(400).send('no game ongoing right now')
    }

    res.status(200).send();

  });

// keep array of sockets
const sockets = [];

io.on('connection', (socket) => {

  if (!players.playerIsActive(socket.request.decoded_token)) {
    players.activatePlayer(socket.request.decoded_token);
  }

  sockets.push(socket);

  socket.emit('message', {
    type: 'player',
    body: {
      players: players.getRegistered().map((p) => {
        return {
          id: p.id,
          points: p.points
        }
      })
    }
  });

  if (Game.getOngoingGame()) {
    socket.emit('message', {
      type: 'game',
      body: {
        game: Game.getOngoingGame()
      }
    });
  }

  socket.on('disconnect', function() {
    let i = sockets.indexOf(socket);
    sockets.splice(i, 1);
  });
});

playersChanged.on(gameEvents.PLAYERS_CHANGED, (v) => {
  sockets.forEach((socket) => {
    socket.emit('message', {
      type: 'player',
      body: {
        players: players.getRegistered().map((p) => {
          return {
            id: p.id,
            points: p.points
          }
        })
      }
    });
  });
});

newGame.on(gameEvents.GAME_CHANGED, (game) => {

  sockets.forEach((socket) => {
    socket.emit('message', {
      type: 'game',
      body: {
        game: game
      }
    });
  });
});

newGame.on(gameEvents.GAME_SOLVED, (game) => {

  sockets.forEach((socket) => {
    socket.emit('message', {
      type: 'solution',
      body: {
        game: game
      }
    })
  });
});

const solveGame = (game) => {

  if (game) {
    Game.solveGame(game);
    players.givePoints(game);

    playersChanged.emit(gameEvents.PLAYERS_CHANGED);
    newGame.emit(gameEvents.GAME_SOLVED, game);

  }

  setTimeout(() => {

    Game.setOngoingGame(null);

    if (players.getRegistered().length) {
      createNewGame()
    }
  }, timeBetweenGames)

};

const createNewGame = () => {

  console.log('new game');
  Game.createNewGame(players.getRegistered(), gameLength);
  newGame.emit(gameEvents.GAME_CHANGED, Game.getOngoingGame());
  setTimeout(() => solveGame(Game.getOngoingGame()), gameLength);
};


setInterval(() => {
  if (players.removeInactivePlayers()) {
    playersChanged.emit(gameEvents.PLAYERS_CHANGED);
  }

}, 200000);