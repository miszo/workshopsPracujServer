const countries = require('./countries');
const cities = require('./cities');

module.exports.checkAnswerCorrectness = (answer, category) => {
  if (category === 'country') {
    for (let i = 0; i < countries.length; i++) {
      if (compareNamesEqual(countries[i].name_pl, answer)) {
        return true;
      }
    }
  } else if (category === 'city') {
    for (let i = 0; i < cities.length; i++) {
      if (compareNamesEqual(cities[i], answer)) {
        return true;
      }
    }
  }

  return false;
};

module.exports.generatePlayerExpirationDate = () => {

  const result = new Date();
  result.setSeconds(result.getSeconds() + 20);

  return result;
};

const compareNamesEqual = (first, second) => {
  return first.toLowerCase().trim() === second.toLowerCase().trim();
};
