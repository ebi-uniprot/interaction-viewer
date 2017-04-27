/*jshint expr: true*/

const apiLoader = require('../src/apiLoader');
const data = require('./resources/O60941.json');
const result = require('./resources/subcell.json');

describe('apiLoader', function(){
  it('should build the data structure', function(){
    let processedData = apiLoader.process(data);
  });
});
