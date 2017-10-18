const countries = require('./countries');
const cities = require('./cities');

const events = require('events');
const express = require('express');
const expressJwt = require('express-jwt');
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

const apiRoutes = express.Router();


app.use('/api/players', apiRoutes);
app.use('/api/game', apiRoutes);
app.use(bodyParser.json());

app.use(function(req, res, next) {
  req.testing = 'testing';
  return next();
});

const playersChanged = new events.EventEmitter();
const newGame = new events.EventEmitter();

let playersRegistered = [];
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
    expires: utils.generatePlayerExpirationDate()
  };

  playersRegistered.push(newPlayer);
  playersChanged.emit(gameEvents.PLAYERS_CHANGED, false);

  res.status(200).send(newPlayer);
});

app.post('/api/game/play/answer',
  expressJwt({secret: secret}),
  (req, res) => {

    console.log(req.header('Authorization'));

    const player = playersRegistered.filter((p) => {
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

io.on('connection', (socket) => {

  console.log('socket connected');

  socket.emit('message', {
    type: 'player',
    body: {
      players: playersRegistered
    }
  });

  playersChanged.on(gameEvents.PLAYERS_CHANGED, (v) => {
    socket.emit('message', {
      type: 'player',
      body: {
        players: playersRegistered
      }
    });
  });

  newGame.on(gameEvents.GAME_CHANGED, (game) => {
    socket.emit('message', {
      type: 'game',
      body: {
        game: game
      }
    });
  });

  newGame.on(gameEvents.GAME_SOLVED, (game) => {
    socket.emit('message', {
      type: 'solution',
      body: {
        game: game
      }
    })
  })
});


const createNewGame = () => {
  const plays = playersRegistered.map((p) => {
    return {
      playerId: p.id,
      answer: '?',
      points: 0
    }
  });

  if (plays.length) {

    const alphabet = 'ABCDEFGHIJKLŁMNOPRSTUWZŻ';
    const category = Math.random() > .5 ? 'country' : 'city';
    const letter = alphabet.charAt(Math.random() * alphabet.length);

    const endsOn = new Date();
    endsOn.setSeconds(endsOn.getSeconds() + gameLength);

    gameOngoing = {
      plays: plays,
      category: category,
      letter: letter,
      question: category === 'country' ? 'podaj państwo na literę ' + letter : 'podaj miasto w Polsce na literę ' + letter,
      ongoing: true,
      createdAt: new Date(),
      endsOn: endsOn
    };

    newGame.emit('gameChanged', gameOngoing);
  }
};

const solveGame = () => {

  if (gameOngoing) {

    console.log(gameOngoing.plays);

    gameOngoing.plays = gameOngoing.plays.map((play) => {

      if (play.answer.trim().charAt(0).toUpperCase() !== gameOngoing.letter.toUpperCase()) {
        return play;
      }

      if (gameOngoing.category === 'country') {
        countries.filter(country => {
          if (play.answer.toUpperCase() === country.name_pl.toUpperCase()) {
            play.points = 1;
          }
        });
      } else if (gameOngoing.category === 'city') {
        cities.filter(city => {
          if (play.answer.toUpperCase() === city.toUpperCase()) {
            play.points = 1;
          }
        })
      }

      if (utils.checkAnswerCorrectness(play.answer, gameOngoing.category)) {
        play.points = 1;
      }

      return play;
    });

    newGame.emit(gameEvents.GAME_SOLVED, gameOngoing)
  }

  setTimeout(createNewGame, timeBetweenGames)
};

const removeInactivePlayers = () => {

  const playersNum = playersRegistered.length;
  playersRegistered = playersRegistered.filter((player) => {

    return new Date() <= player.expires;
  });

  if (playersNum !== playersRegistered.length) {
    playersChanged.emit(gameEvents.PLAYERS_CHANGED);
  }
};


setInterval(() => {
  removeInactivePlayers();
}, 20000);

setInterval(() => {
  solveGame()
}, gameLength + timeBetweenGames);