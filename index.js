const countries = require('./countries');
const cities = require('./cities');

const events = require('events');
const express = require('express');
const jwt = require('jsonwebtoken');

const bodyParser = require('body-parser');


const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

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
  res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type");
  next();
});

app.get('/', function(req, res) {
  res.send('Hello world!');
});


app.post('/api/player', (req, res) => {

  if(req.body.password !== 'pracuj456$') {
    res.status(401).send();
    return;
  }

  if (playersRegistered.filter((p) => p.id === req.body.id).length) {
    res.status(400).send('user with this name already exists');
    return;
  }

  playersRegistered.push({id: req.body.id});
  playersChanged.emit('playersChanged', false);

  res.status(200).send({token: jwt.sign(req.body.id, secret)});
});

app.post('/api/game/play/answer', (req, res) => {

  const player = playersRegistered.filter((p) => {
    return p.id === req.body.playerId;
  })[0];

  if (!player) {
    res.status(400).send('player with this playerId doesn\'t play');
    return;
  }

  gameOngoing.plays = gameOngoing.plays.map((play) => {
    if (play.playerId === req.body.playerId) {
      play.answer = req.body.answer;
    }
    return play;
  });

  res.status(200).send();

});

io.on('connection', function(socket) {

  console.log('socket connected');

  socket.emit('message', {
    type: 'player',
    body: {
      players: playersRegistered
    }
  });

  playersChanged.on('playersChanged', (v) => {
    socket.emit('message', {
      type: 'player',
      body: {
        players: playersRegistered
      }
    });
  });

  newGame.on('gameChanged', (game) => {
    socket.emit('message', {
      type: 'game',
      body: {
        game: game
      }
    });
  });

  newGame.on('gameSolved', (game) => {
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

    const alphabet = 'ABCDEFGHIJKLMNOPRSTUWVZŹŻ';
    const category = Math.random() > .5 ? 'country' : 'city';
    const letter = alphabet.charAt(Math.random() * alphabet.length);

    gameOngoing = {
      plays: plays,
      category: category,
      letter: letter,
      question: category === 'country' ? 'podaj kraj na literę ' + letter : 'podaj miasto w Polsce na literę ' + letter,
      ongoing: true,
      createdAt: new Date()
    };

    newGame.emit('gameChanged', gameOngoing);
  }
};

const solveGame = () => {

  if (gameOngoing) {

    console.log(gameOngoing.plays);

    gameOngoing.plays = gameOngoing.plays.map((play) => {

      if (play.answer.charAt(0).toUpperCase() !== gameOngoing.letter.toUpperCase()) {
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
          if(play.answer.toUpperCase() === city.toUpperCase()) {
            play.points = 1;
          }
        })
      }

      return play;
    });

    newGame.emit('gameSolved', gameOngoing)
  }

  setTimeout(createNewGame, 3000)
};

setInterval(() => {
  solveGame()
}, 12000);