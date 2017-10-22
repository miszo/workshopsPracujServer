const countries = require('./countries');
const cities = require('./cities');

const events = require('events');
const express = require('express');
const expressJwt = require('express-jwt');
const socketioJwt = require('socketio-jwt');
const jwt = require('jsonwebtoken');

const bodyParser = require('body-parser');


const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);


const utils = require('./utils');

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

      const playerIsRegistered = !!playersRegistered.filter((player) => {
        return player.id === handshakeData.decoded_token;
      })[0];

      if (playerIsRegistered) {
        next();
      } else {
        next(new Error('not a doge'))
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

let playersActive = [];
const playersRegistered = [];
let gameOngoing;

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

  if (playersRegistered.filter((p) => p.id === req.body.id).length) {
    res.status(400).send('user with this name already exists');
    return;
  }

  const newPlayer = {
    id: req.body.id,
    token: jwt.sign(req.body.id, secret),
    expires: utils.generatePlayerExpirationDate(),
    points: 0
  };

  playersRegistered.push(newPlayer);
  playersActive.push(newPlayer);
  playersChanged.emit(gameEvents.PLAYERS_CHANGED, false);

  if (playersActive.length === 1 && !gameOngoing) {
    createNewGame();
  }

  res.status(200).send(newPlayer);
});

app.post('/api/game/play/answer',
  expressJwt({secret: secret}),
  (req, res) => {

    const player = playersActive.filter((p) => {
      return p.id === req.body.playerId;
    })[0];

    if (!player) {
      res.status(400).send('player with this playerId doesn\'t play');
      return;
    }

    player.expires = utils.generatePlayerExpirationDate();

    if (gameOngoing) {

      gameOngoing.plays = gameOngoing.plays.map((play) => {
        if (play.playerId === req.body.playerId) {
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

  if (!playerIsActive(socket.request.decoded_token)) {
    activatePlayer(socket.request.decoded_token);
  }

  sockets.push(socket);

  socket.emit('message', {
    type: 'player',
    body: {
      players: playersActive
    }
  });

  if (gameOngoing) {
    socket.emit('message', {
      type: 'game',
      body: {
        game: gameOngoing
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
        players: playersActive
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

const createNewGame = () => {
  const plays = playersActive.map((p) => {
    return {
      playerId: p.id,
      answer: '?'
    }
  });

  if (plays.length) {

    const alphabet = 'ABCDEFGHIJKLŁMNOPRSTUWZŻ';
    const category = Math.random() > .5 ? 'country' : 'city';
    const letter = alphabet.charAt(Math.random() * alphabet.length);

    const endsOn = new Date();
    endsOn.setSeconds(endsOn.getSeconds() + gameLength / 1000);

    gameOngoing = {
      plays: plays,
      category: category,
      letter: letter,
      question: category === 'country' ? 'podaj państwo na literę ' + letter : 'podaj miasto w Polsce na literę ' + letter,
      ongoing: true,
      createdAt: new Date(),
      endsOn: endsOn
    };

    newGame.emit(gameEvents.GAME_CHANGED, gameOngoing);
  }

  setTimeout(() => solveGame(gameOngoing), gameLength);
};

const solveGame = (game) => {

  game.plays = game.plays.map((play) => {

    play.points = 0;

    if (play.answer.trim().charAt(0).toUpperCase() !== game.letter.toUpperCase()) {
      return play;
    }

    if (game.category === 'country') {
      countries.filter(country => {
        if (play.answer.toUpperCase() === country.name_pl.toUpperCase()) {
          play.points = 1;
        }
      });
    } else if (game.category === 'city') {
      cities.filter(city => {
        if (play.answer.toUpperCase() === city.toUpperCase()) {
          play.points = 1;
        }
      })
    }

    if (utils.checkAnswerCorrectness(play.answer, game.category)) {
      play.points = 1;
    }

    return play;
  });

  playersActive = playersActive.map((player) => {
    const play = game.plays.filter((play) => {
      return play.playerId === player.id;
    })[0];

    if (play) {
      player.points += play.points;
    }

    return player;
  });

  playersChanged.emit(gameEvents.PLAYERS_CHANGED);
  newGame.emit(gameEvents.GAME_SOLVED, game);

  setTimeout(() => {

    gameOngoing = null;

    if (playersActive.length) {
      createNewGame()
    }
  }, timeBetweenGames)
};

const activatePlayer = (playerId) => {

  const player = playersRegistered.filter((player) => {
    return player.id === playerId;
  })[0];

  if (player) {
    playersActive.push(player);
  }
};

const playerIsActive = (playerId) => {
  return !!playersActive.filter((player) => {
    return player.id === playerId;
  })[0];
};

const removeInactivePlayers = () => {

  const playersNum = playersActive.length;
  playersActive = playersActive.filter((player) => {

    return new Date() <= player.expires;
  });

  if (playersNum !== playersActive.length) {
    playersChanged.emit(gameEvents.PLAYERS_CHANGED);
  }
};


setInterval(() => {
  removeInactivePlayers();
}, 200000);