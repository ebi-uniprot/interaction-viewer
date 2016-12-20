const d3 = require('d3');
const apiLoader = require('./apiLoader');
const _ = require('underscore');
let flatFilters = [];
let nodes;

module.exports.render = function({
  el = required('el'),
  accession = 'P05067'
}) {
  // clear all previous vis
  d3.select(el).select('.interaction-title').remove();
  d3.select(el).select('svg').remove();
  d3.select(el).select('.interaction-tooltip').remove();

  // show spinner until data is loaded
  d3.select(el).append('div').attr('class','interaction-spinner');

  apiLoader.load(accession).then(data => {
    draw(el, accession, data);
  });
};

function draw(el, accession, data) {

    d3.select(el).select('.interaction-spinner').remove();

    nodes = data;

    var tooltip = d3.select(el).append("div")
        .attr("class", "interaction-tooltip")
        .attr("display", "none")
        .style("opacity", 0);
    tooltip.append('span')
        .attr('class','close-interaction-tooltip')
        .text('Close X')
        .on('click',closeTooltip);
    tooltip.append('div')
        .attr('class','tooltip-content');

    d3.select(el).append("p")
      .attr("class","interaction-title")
      .text(`${accession} has binary interactions with ${nodes.length-1} proteins`);

    const margin = {
        top: 100,
        right: 0,
        bottom: 10,
        left: 100
      },
      width = height = 18 * nodes.length;

    const x = d3.scale.ordinal().rangeBands([0, width]),
      intensity = d3.scale.linear().range([0.2, 1]);

    const svg = d3.select(el).append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .attr("class", "interaction-viewer")
      .append("g")
      .attr("class", "interaction-viewer-group")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    x.domain(nodes.map(entry => entry.accession));
    intensity.domain([0, 10]);

    // x.domain(nodes.map(entry => entry.accession));
    // intensity.domain([0, d3.max(nodes.map(link => link.experiments))]);

    const row = svg.selectAll(".interaction-row")
      .data(nodes)
      .enter().append("g")
      .attr("class", "interaction-row")
      .attr("transform", d => `translate(0,${x(d.accession)})`)
      .each(processRow);

    row.append("rect")
      .attr("x", -margin.left)
      .attr("width", margin.left)
      .attr("height", x.rangeBand())
      .attr("class", "text-highlight");

    // left axis text
    row.append("text")
      .attr("y", x.rangeBand() / 2)
      .attr("dy", ".32em")
      .attr("text-anchor", "end")
      .text((d, i) => {
        return nodes[i].name;
      })
      .attr('class', (d,i) => (nodes[i].accession === accession)? "main-accession" : "");

    const column = svg.selectAll(".column")
      .data(nodes)
      .enter().append("g")
      .attr("class", "column")
      .attr("transform", d => `translate(${x(d.accession)}, 0)rotate(-90)`);

    column.append("rect")
      .attr("x", 6)
      .attr("width", margin.top)
      .attr("height", x.rangeBand())
      .attr("class", "text-highlight");

    // top axis text
    column.append("text")
      .attr("x", 6)
      .attr("y", x.rangeBand() / 2)
      .attr("dy", ".32em")
      .attr("text-anchor", "start")
      .text((d, i) => nodes[i].name)
      .attr('class', (d,i) => (nodes[i].accession === accession)? "main-accession" : "");

    var points = `${x(nodes[1].accession)} 0,${x(nodes[nodes.length-1].accession)} 0,${x(nodes[nodes.length-1].accession)} ${x(nodes[nodes.length-1].accession)},${x(nodes[0].accession)} 0`;

    svg.append("polyline")
      .attr("points", points)
      .attr("class", "hidden-side")
      .attr("transform", d => `translate(${x(nodes[1].accession)}, 0)`);

    createFilter(el, data.filters);

    function processRow(row) {
      if(!row.interactions) {
        return;
      }


      var cell = d3.select(this).selectAll(".cell")
        .data(row.interactions);

      var circle = cell.enter().append("circle");

      circle.attr("class", "cell")
        .attr("cx", d => {
          return x(d.id) + x.rangeBand() / 2;
        })
        .attr("cy", d => x.rangeBand() / 2)
        .attr("r", x.rangeBand() / 3)
        .style("fill-opacity", d => intensity(d.experiments))
        .style("display", d => {
          //Only show left half of graph
          return (x(row.accession)<x(d.id))? "none" : "";
        })
        .on("click", mouseclick)
        .on("mouseover", mouseover)
        .on("mouseout", mouseout);

      cell.exit().remove();
    }

    function mouseover(p) {
      d3.select(this).classed("active-cell", true);
      d3.selectAll(".interaction-row").classed("active", d => d.accession === p.id);
      // d3.selectAll(".column").classed("active", d => d.accession === p.id);

      d3.selectAll('.interaction-viewer-group')
            .append('line')
            .attr('class','active-row')
            .attr('style','opacity:0')
            .attr('x1',0)
            .attr('y1',x(p.source) + x.rangeBand() / 2)
            .attr('x2',x(p.id))
            .attr('y2',x(p.source)+ x.rangeBand() / 2)
            .transition(50)
            .attr('style','opacity:.5');

      d3.selectAll('.interaction-viewer-group')
            .append('line')
            .attr('class','active-row')
            .attr('style','opacity:0')
            .attr('x1',x(p.id) + x.rangeBand() / 2)
            .attr('y1',0)
            .attr('x2',x(p.id) + x.rangeBand() / 2)
            .attr('y2',x(p.source))
            .transition(50)
            .attr('style','opacity:.5');
    }

    function mouseclick(p) {
      populateTooltip(d3.selectAll('.tooltip-content'), p);
      tooltip.style("opacity", 0.9)
        .style("display", "inline")
        .style("left", (d3.mouse(el)[0] + 10) + "px")
        .style("top", (d3.mouse(el)[1] - 15) + "px");
    }

    function populateTooltip(element, data) {
      element.html('');

      let source = _.find(nodes, d => d.accession === data.source);
      let target = _.find(nodes, d => d.accession === data.id);

      element.append('h3').text('Interaction');
      element.append('p').text(`Confirmed by ${data.experiments} experiment(s)`);

      var table = element.append('table').attr('class','interaction-viewer-table');
      var headerRow = table.append('tr');
      headerRow.append('th');
      headerRow.append('th').text('Interactor 1');
      headerRow.append('th').text('Interactor 2');

      var nameRow = table.append('tr');
      nameRow.append('td').text('Name').attr('class','interaction-viewer-table_row-header');
      nameRow.append('td')
          .text(`${source.name}`);
      nameRow.append('td')
          .text(`${target.name}`);

      var uniprotRow = table.append('tr');
      uniprotRow.append('td').text('UniProtKB').attr('class','interaction-viewer-table_row-header');
      uniprotRow.append('td')
          .append('a')
          .attr('href',`//uniprot.org/uniprot/${source.accession}`)
          .text(`${source.accession}`);
      uniprotRow.append('td')
          .append('a')
          .attr('href',`//uniprot.org/uniprot/${target.accession}`)
          .text(`${target.accession}`);

      var diseaseRow = table.append('tr');
      diseaseRow.append('td').text('Disease association').attr('class','interaction-viewer-table_row-header');
      diseaseRow.append('td').text(source.disease ? 'Y' : 'N');
      diseaseRow.append('td').text(target.disease ? 'Y' : 'N');

      var subcellRow = table.append('tr');
      subcellRow.append('td').text('Subcellular location').attr('class','interaction-viewer-table_row-header');
      subcellRow.append('td').text(source.subcell ? 'Y' : 'N');
      subcellRow.append('td').text(target.subcell ? 'Y' : 'N');

       var intactRow = table.append('tr');
       intactRow.append('td').text('IntAct').attr('class','interaction-viewer-table_row-header');
       intactRow.append('td')
                  .attr('colspan',2)
                .append('a')
                .attr('href', getIntactLink(data.interactor1, data.interactor2))
                .text(`${data.interactor1};${data.interactor2}`);
    }

    function getIntactLink(interactor1, interactor2) { return `//www.ebi.ac.uk/intact/query/id:${interactor1} AND id:${interactor2}`;
    }

    function mouseout() {
      d3.selectAll("g").classed("active", false);
      d3.selectAll("circle").classed("active-cell", false);
      d3.selectAll(".active-row").remove();
    }

    function closeTooltip() {
      d3.selectAll('.interaction-tooltip')
        .style("opacity", 0)
        .style("display", "none");
    }
}

function getNodeByAccession(accession) {
  return _.find(nodes, function(node){
    return node.accession === accession;
  });
}

function hasFilterMatch(source, target, filters) {
  if(filters.length <= 0) {
    return true;
  }
  return _.intersection(source.filterTerms, _.pluck(filters, 'name')).length > 0 ||
        _.intersection(target.filterTerms, _.pluck(filters, 'name')).length > 0;
}

function filterData(_filter) {
  toggle(_filter);
  let visibleFilters = _.filter(flatFilters, d => d.visible);
  let visibleAccessions = [];
  d3.selectAll('.cell')
    .attr('opacity', d => {
      const source = getNodeByAccession(d.source);
      const target = getNodeByAccession(d.id);
      const visible = hasFilterMatch(source, target, visibleFilters);
      if(visible) {
        visibleAccessions.push(source.accession);
        visibleAccessions.push(target.accession);
      }
      return visible ? 1 :0.1;
    });
  d3.selectAll('text')
    .attr('fill-opacity', d => {
      return (_.contains(visibleAccessions, d.accession)) ? 1 : 0.1;
    });
}

// Toggle the visible state of a given filter
function toggle(_filter) {
  var match = _.find(flatFilters, d => _filter === d.name);
  match.visible = match.visible ? false : true;
}

// Add a filter to the interface
function createFilter(el, filters) {
  d3.select(el).selectAll(".interaction-filter").remove();
  const container = d3.select(el).append("div")
    .attr("class", "interaction-filter");

  container.append("label").text('Show only interactions where one or both interactors have:');
  for(let filter of filters) {
    flatFilters = flatFilters.concat(filter.items);
    container.append("h4").text(filter.label);

    var listItem = container.append("ul")
      .selectAll('li')
      .data(filter.items)
      .enter()
      .append('li');

    listItem.append('input')
      .attr('type', 'checkbox')
      .property('checked', d => {
        return d.checked;
      })
      .on('click', d => filterData(d.name));

    listItem.append('label')
      .text(d => d.name.toLowerCase());
  }
}

function required(name) {
  throw Error(`missing option: ${name}`);
}
