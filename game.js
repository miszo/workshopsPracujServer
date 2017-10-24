const countries = require('./countries');
const cities = require('./cities');
const utils = require('./utils');


const assessPlay = (game, play) => {
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
};

let gameOngoing = null;

module.exports = {

  getOngoingGame: () => {
    return gameOngoing;
  },
  setOngoingGame: (v) => {
    gameOngoing = v;
  },
  solveGame: (game) => {

    game.ongoing = false;
    game.plays = game.plays.map((play) => assessPlay(game, play));

    return game;

  },

  createNewGame: (players, gameLength) => {
    const plays = players.map((p) => {
      return {
        playerId: p.id,
        answer: '...'
      }
    });

    if (plays.length) {

      const alphabet = 'ABCDEFGHIJKLŁMNOPRSTUWZ';
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

    }

  }
}