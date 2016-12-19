const d3 = require('d3');
const _ = require('underscore');

var process = function(data) {
  // remove interactions which are not part of current set
  const subcellularLocations = {};
  const diseases = {};

  _.each( data, function(element){
    let interactors = [];
    element.filterTerms = [];
      _.each(element.interactions, function(interactor){
        if(_.some(data, function(d){
          return d.accession === interactor.id;
        })) {
          interactor.source = element.accession;
          interactors.push(interactor);
        }
      });
    element.interactions = interactors;
    if(element.subcellularLocations) {
      for(let location of element.subcellularLocations) {
        for(let actualLocation of location.locations) {
          subcellularLocations[actualLocation.location.value] = {
            name:actualLocation.location.value,
            checked: false
          };
          element.filterTerms.push(actualLocation.location.value);
        }
      }
    }
    if(element.diseases) {
      for(let disease of element.diseases) {
        if(disease.diseaseId) {
          diseases[disease.diseaseId] = {
            name:disease.diseaseId,
            checked: false
          };
          element.filterTerms.push(disease.diseaseId);
        }
      }
    }
  });
  data.filters = [{
    name:'subcellularLocations',
    label: 'Subcellular location',
    items: _.values(subcellularLocations)
  }, {
    name:'diseases',
    label: 'Diseases',
    items: _.values(diseases)
  }];
  // data.filters.diseases.items = _.uniq(data.filters.diseases.items);
  return data;
};

const apiLoader = {
  load: function(accession) {
    var promise = new Promise(function(resolve) {
      return d3.json(`http://wwwdev.ebi.ac.uk/proteins/api/proteins/interaction/${accession}.json`, function(json){
        var data = process(json);
        resolve(data);
      });
    });
    return promise;
  }
};
module.exports = apiLoader;
