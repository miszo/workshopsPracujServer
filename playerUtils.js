const utils = require('./utils');
const jwt = require('jsonwebtoken');

let playersRegistered = [];

module.exports = {

  getRegistered: () => {
    return playersRegistered;
  },

  activatePlayer: (playerId) => {

    playersRegistered.push(generateNewPLayer(playerId))
  },

  playerIsActive: (playerId) => {
    return !!playersRegistered.filter((player) => {
      return player.id === playerId;
    })[0];
  },

  removeInactivePlayers: () => {

    const playersNum = playersRegistered.length;
    playersRegistered = playersRegistered.filter((player) => {

      return new Date() <= player.expires;
    });

    return playersNum !== playersRegistered.length;
  },

  generateNewPlayer: (playerId, secret) => ({
    id: playerId,
    token: jwt.sign(playerId, secret),
    expires: utils.generatePlayerExpirationDate(),
    points: 0
  }),

  givePoints: (game) => {

    playersRegistered = playersRegistered.map((player) => {
      const play = game.plays.filter((play) => {
        return play.playerId === player.id;
      })[0];

      if (play) {
        player.points += play.points;
      }

      return player;
    });
  },

  getRegisteredPlayer: (playerId) => {

    return playersRegistered.filter((p) => {
      return p.id === playerId;
    })[0];
  },

  unregisterPlayer: (playerId) => {

    playersRegistered = playersRegistered.filter((p) => {
      return p.id !== playerId;
    })
  }
};
