const events = require('events');
const express = require('express');
// const expressJwt = require('express-jwt');
const jwt = require('jsonwebtoken');

const bodyParser = require('body-parser');
const Player = require('./db').Player;
const Game = require('./db').Game;

const app = express();

const ws = require('express-ws')(app);

const secret = 'shhh';

const apiRoutes = express.Router();

apiRoutes.use((req, res, next) => {

  console.log('routes middleware req', req);

  // check header or url parameters or post parameters for token
  let token;

  if (req.body) {
    token = req.body.token;
  }

  if (req.query) {
    token = req.query.token;
  }

  if (req.headers) {
    token = req.headers['x-access-token'];
  }

  console.log('token', token);

  if (token) {

    console.log('verifying', token);

    jwt.verify(token, secret, (err, decoded) => {

      if (err) {
        console.log('failed to authenticate token');
      } else {

        console.log('all good, I tell ya');

        req.decoded = decoded;

        next();
      }

    })
  } else {
    console.log('nah, no token');
  }

});

app.use('/api/players', apiRoutes);
app.use('/api/game', apiRoutes);
app.use(bodyParser.json());

app.use(function(req, res, next) {
  req.testing = 'testing';
  return next();
});

// app.use(expressJwt({secret: secret}).unless({path: ['/api/player']}));

const playersChanged = new events.EventEmitter();
const newGame = new events.EventEmitter();

let playersRegistered = [];
let gameOngoing;

app.all('/api/player', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type");
  next();
});

app.get('/', function(req, res) {
  res.send('Hello world!');
});


app.post('/api/player', (req, res) => {

  console.log('post came', req.body.id);
  if (playersRegistered.filter((p) => p.id === req.body.id).length) {
    res.status(400).send('user with this name already exists');
    return;
  }

  playersRegistered.push({id: req.body.id});
  playersChanged.emit('playersChanged', false);

  res.status(200).send({token: jwt.sign(req.body.id, secret)});

  //
  // Player.create({id: req.body.id}, () => {
  //   // todo: handle errors
  //   playersChanged.emit('playersChanged', false);
  //   res.send('kay');
  // });
});

app.ws('/api/players', function(ws, req) {


  const returnAllPlayers = (callback) => {
    // Player.find({}, (error, players) => {
    console.log('restsdfzsdf');
    if (ws.readyState === 1) {
      console.log('return playas');
      ws.send(JSON.stringify(playersRegistered));
    }
    // });
  };

  const playersChangedHandler = (value) => {
    returnAllPlayers();
  };

  const teardownWSPlayersConnection = () => {
    playersChanged.removeListener('playersChanged', playersChangedHandler)
  };

  playersChanged.on('playersChanged', playersChangedHandler);

  ws.on('message', function(msg) {
    returnAllPlayers();
  });
  returnAllPlayers();

  ws.on('close', () => {
    console.log('ws closed');
    teardownWSPlayersConnection();
  })
});

app.ws('/api/game', (ws, req) => {

  console.log('game');

  const onNewGame = (game) => {
    console.log(game);
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(game));
    }
  };

  newGame.on('gameChanged', onNewGame);

  const returnCurrentGame = () => {

    if (ws.readyState === 1 && gameOngoing) {
      ws.send(JSON.stringify(gameOngoing));
    }
    // Game.findOne({ongoing: true}, (error, game) => {
    //   if (ws.readyState === 1) {
    //     ws.send(JSON.stringify(game))
    //   }
    // })
  };

  ws.on('message', function(msg) {
    returnCurrentGame();
  });

  returnCurrentGame();

  ws.on('close', () => {
    newGame.removeListener('gameChanged', onNewGame)
  })

});

const server = app.listen(3000, () => {
  console.log('server started')
});

server.on('close', () => {
  console.log('server closed');
});

setInterval(() => {

  // stop all games
  // Game.update(
  //   {},
  //   {$set: {ongoing: false}},
  //   {multi: true},
  //   (errors, result) => {
  //     console.log(errors, result);
  //   }
  // );

  // create a new game
  // const players = Player.find({}, (error, result) => {
  //   //
  // });


  const plays = playersRegistered.map((p) => {
    return {
      playerId: p.id,
      answer: 'dunno'
    }
  });

  if (plays.length) {
    gameOngoing = {
      plays: plays,
      question: Math.random() > .5 ? 'name a country starting with letter A' : 'name a city starting with letter M',
      ongoing: true,
      createdAt: new Date()
    };

    newGame.emit('gameChanged', gameOngoing);
  }

}, 7000);