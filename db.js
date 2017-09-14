const env = require('./env');

const mongoose = require('mongoose');

mongoose.connect(env.DATABASE_URL);

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error: '));
db.once('open', (callback) => {
  console.log('yay, db open');
});

const playerSchema = mongoose.Schema({
  id: String
});

const gameSchema = mongoose.Schema({
  question: String,
  plays: [{playerId: String, answer: String}],
  ongoing: Boolean,
  createdAt: {type: Date, expires: 20}
});

const Game = mongoose.model('Game', gameSchema);

module.exports.Player = mongoose.model('Player', playerSchema);
module.exports.Game = Game;