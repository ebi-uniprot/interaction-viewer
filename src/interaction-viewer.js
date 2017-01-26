const d3 = require('d3');
const sparqlLoader = require('./sparqlLoader');
const _ = require('underscore');

const filters = [{
  name: 'Disease',
  value: 'disease',
  filter: false
}, {
  name: 'Subcellular location',
  value: 'subcell',
  filter: false
}];

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

  sparqlLoader.loadData(accession).then(data => {
    d3.select(el).select('.interaction-spinner').remove();

    let nodes = data.nodes,
      links = data.links;

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
    intensity.domain([0, d3.max(links.map(link => link.experiments))]);

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
      .text((d, i) => nodes[i].entryName)
      .attr('class', (d,i) => (nodes[i].accession === accession)? "main-accession interaction-accession" : "interaction-accession");

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
      .text((d, i) => nodes[i].entryName)
      .attr('class', (d,i) => (nodes[i].accession === accession)? "main-accession interaction-accession" : "interaction-accession");
    var points = `${x(nodes[1].accession)} 0,${x(nodes[nodes.length-1].accession)} 0,${x(nodes[nodes.length-1].accession)} ${x(nodes[nodes.length-1].accession)},${x(nodes[0].accession)} 0`;

    svg.append("polyline")
      .attr("points", points)
      .attr("class", "hidden-side")
      .attr("transform", d => `translate(${x(nodes[1].accession)}, 0)`);

    createFilter(el);

    function processRow(row) {
      const filtered = links.filter(d => d.source === row.accession);

      var cell = d3.select(this).selectAll(".cell")
        .data(filtered);

      var circle = cell.enter().append("circle");

      circle.attr("class", "cell")
        .attr("cx", d => {
          return x(d.target) + x.rangeBand() / 2;
        })
        .attr("cy", d => x.rangeBand() / 2)
        .attr("r", x.rangeBand() / 3)
        .style("fill-opacity", d => intensity(d.experiments))
        .style("display", d => {
          return (x(d.target)-x(row.accession) > 0)? "none" : "";
        })
        .on("click", mouseclick)
        .on("mouseover", mouseover)
        .on("mouseout", mouseout);

      cell.exit().remove();
    }

    function mouseover(p) {
      d3.select(this).classed("active-cell", true);
      d3.selectAll(".interaction-row").classed("active", d => d.accession === p.source);
      d3.selectAll(".column").classed("active", d => d.accession === p.target);

      d3.selectAll('.interaction-viewer-group')
            .append('line')
            .attr('class','active-row')
            .attr('style','opacity:0')
            .attr('x1',0)
            .attr('y1',x(p.source) + x.rangeBand() / 2)
            .attr('x2',x(p.target))
            .attr('y2',x(p.source)+ x.rangeBand() / 2)
            .transition(50)
            .attr('style','opacity:.5');

      d3.selectAll('.interaction-viewer-group')
            .append('line')
            .attr('class','active-row')
            .attr('style','opacity:0')
            .attr('x1',x(p.target) + x.rangeBand() / 2)
            .attr('y1',0)
            .attr('x2',x(p.target) + x.rangeBand() / 2)
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
      let target = _.find(nodes, d => d.accession === data.target);

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
          .text(`${source.entryName}`);
      nameRow.append('td')
          .text(`${target.entryName}`);

      var uniprotRow = table.append('tr');
      uniprotRow.append('td').text('UniProtKB').attr('class','interaction-viewer-table_row-header');
      uniprotRow.append('td')
          .append('a')
          .attr('href',`//uniprot.org/uniprot/${data.source}`)
          .text(`${data.source}`);
      uniprotRow.append('td')
          .append('a')
          .attr('href',`//uniprot.org/uniprot/${data.target}`)
          .text(`${data.target}`);

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
                .attr('href', getIntactLink(data.intact))
                .text(data.intact);
    }

    function getIntactLink(intactIds) {
      let url = '//www.ebi.ac.uk/intact/query/';
      var first = true;
      for(var id of intactIds) {
        if(!first){
          url+=` AND id:${id}`;
        }
        else{
          first = false;
          url+=`id:${id}`;
        }
      }
      return url;
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

  });
};

function filter(_filter) {
  toggle(_filter);
  let visible = _.filter(filters, d => d.visible);
  const hide = [];
  d3.selectAll('.interaction-accession')
    .attr('opacity', d => {
      let show = _.every(visible, filter => {
        return d[filter.value];
      });
      if(!show) {
        hide.push(d.accession);
      }
      return show ? 1 : 0.1;
    });

  d3.selectAll('.cell')
    .attr('opacity', d => {
      return (_.contains(hide, d.source) && _.contains(hide, d.target)) ? 0.1 :1;
    });
}

function toggle(_filter) {
  var match = _.find(filters, d => _filter === d.value);
  match.visible = match.visible ? false : true;
}

function createFilter(el) {
  d3.select(el).selectAll(".interaction-filter").remove();
  const container = d3.select(el).append("div")
    .attr("class", "interaction-filter");

  container.append("label").text('Show only interactions where one or both interactors have:');

  var listItem = container.append("ul")
    .selectAll('li')
    .data(filters)
    .enter()
    .append('li');

  listItem.append('input')
    .attr('type', 'checkbox')
    .attr('id', d => d.value)
    .property('checked', d => {
      return d.filter;
    })
    .on('click', d => filter(d.value));

  listItem.append('label')
    .text(d => `${d.name.toLowerCase()} annotation`)
    .attr('for', d => d.value);
}

function required(name) {
  throw Error(`missing option: ${name}`);
}
