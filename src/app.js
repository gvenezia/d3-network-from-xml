;import * as d3 from 'd3';

// ============== Variables ===================

// Setup the graph container
// DOM elements
let graphContainer  = d3.select("#graph-container");
let paddingContainer= d3.select('.padding-container');
let htmlBody        = d3.select('body');

// Set the dimensions and margins of the graph
let margin = { top: 10, right: 10, bottom: 10, left: 10};

let width = parseInt(graphContainer.style('width')),
    height= window.innerHeight - margin.top - margin.bottom;

let d3W = width + margin.left + margin.right,
    d3H = height + margin.top + margin.bottom;

// Checks for Retina and other high-res screens and configures accordingly
let context = createProperResCanvas(d3W, d3H);

// Set the SVG and G (with Bostock's margin convention)
const svg = graphContainer.append('svg')
                .attr('width', d3W) // sets the viewport width
                .attr('height', d3H) // sets the viewport height
              .append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

// Setup graph features
let tooltip = d3.select("body").append("div")
              .attr("class", "tooltip");

const nodeRadius = 15;

// Declare a function for scaling the with of the links based on the nodeRadius
let linkScale = d3.scaleLinear()
      .domain([0,1])
      .range([1,nodeRadius])

// Formats input to whole number
let f = d3.format(".0f");

// ========
// The following code for setting up the graph and drawing with xml data
// is based on Mike Bostock's block: https://bl.ocks.org/mbostock/1080941
// ========

var link = svg.append("g")
    .attr("class", "linkG")
  .selectAll("line");

var node = svg.append("g")
    .attr("class", "node")
  .selectAll("circle");

var linkNode = svg.selectAll(".link-node")
  .append("circle") 

var drag = d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);

var simulation = d3.forceSimulation()
    .force("link", 
      d3.forceLink()
        .id(d => d.id)
        // .distance(10)
        // .strength(100)
    )
    .force("charge", 
      d3.forceManyBody()
        .strength(-500)
      )
    // .force('collision', 
    //   d3.forceCollide()
    //     .radius(d => 15)
    // )
    // .force('x', d3.forceX().x(function(d,i) {
    //   return width / (i % 3);
    // }))
    // .force("center", d3.forceCenter(width / 2, height / 2))
    .force('x', d3.forceX(width / 2))
    .force('y', d3.forceY(height / 2))
    .on("tick", ticked)
    .stop();

// Note: d3@v5 wasn't working with a promise for d3.xml import
d3.xml("data/nested-nodes.xml", (error, coggle) => {
  if (error) throw error;

  let xmlNodes = d3.select(coggle)
                  .selectAll("*")
                  .nodes()
                  .slice(1);

  xmlNodes.forEach(d => {
    d.children[0]
    if(d.nodeName.match(/^node$|x-coggle-rootnode/))
      d.id = d.attributes.ID.nodeValue;
      // d.color = d.attributes.COLOR.nodeValue
  })

  // Create d3 nodes only using coggle nodes (not XML nodes)
  let nodes = xmlNodes
        .filter(xmlNode => xmlNode.nodeName.match(/^node$|x-coggle-rootnode/) && xmlNode.attributes.TEXT.nodeValue );

  // Create d3 links with only the child nodes (so as to avoid linking to the parent 'map' XML object)
  let links = xmlNodes
        .filter(xmlNode => xmlNode.nodeName.match(/^node$/) && xmlNode.parentNode.nodeName !== 'map')
        .map(function(d) {
          if(d.attributes.TEXT.nodeValue !== '') {
            return {source: d.parentNode, target: d};

          } else {
            let idLink = d.attributes.X_COGGLE_JOINEDTO.nodeValue;
            let targetIDNode = nodes.find( d => d.id === idLink);
            return {source: d.parentNode, target: targetIDNode}

          }
        });

  // Set the link attributes for `line` and particles
  links.forEach(link => {
    link.transitionRate = getRandomInt(1);
    link.width = f(linkScale(link.transitionRate));
  });

  // Set the link color for the line and its marker end styles
  let linkColors = [];
  links.forEach(d => {
    linkColors.push(
      (d.source.children.length > 0 && d.source.children[0].tagName === 'edge') ?
          d.source.children[0].attributes.COLOR.nodeValue :
          'red'
      );
  });

  let linkNodes = [];
  links.forEach(link => {
    linkNodes.push({
      source: link.source,
      target: link.target
    });
  });

  links.forEach(link => {
        link.freq = link.transitionRate;
        link.particleSize = 5 * link.transitionRate;
      });

  // Both the actual nodes and the nodes on the links need to have a force in order to minimize collisions AND overlaps
  simulation.nodes(nodes.concat(linkNodes));
  simulation.force("link", d3.forceLink(links));

  // Directional arrow for links
  svg.append("svg:defs").selectAll("marker")
      .data(links)
    .enter().append("svg:marker")  // This section adds in the arrows
      .attr("class", 'arrow')
      .attr('id', (d,i) => 'arrow' + i.toString() ) // Create a unique arrow for each link
      // Use corresponding width to size dynamically and math svg path 
      .attr("viewBox", (d,i) => `0 -${d.width/2} ${+d.width + 1} ${d.width}`)
      .attr("refX", 0)
      .attr("refY", 0)
      .attr("markerWidth", 1)
      .attr("markerHeight", 1)
      .attr('markerUnits', 'strokeWidth')
      .attr("orient", "auto")
    .append("svg:path")
      .attr("d", d => {
        // Use corresponding width to size dynamically and match viewbox
        let w = d.width;
        return `M 0,0 m -${w},-${w} L ${w},0 L -${w},${w} Z`
      })
      .style('fill', (d,i) => linkColors[i])
      .style('stroke', (d,i) => linkColors[i]);

  link = link.data(links)
            .enter()
            .append('path')
            .attr('class', 'link')
            .style('stroke', (d,i) => linkColors[i])
            .attr('stroke-width', d => d.width )
            .attr('stroke-linecap', 'butt')
            .attr('opacity', .5)
            .attr("marker-end", (d,i) => `url(#arrow${i})`) // Use unique arrowhead for proper color and size
            .style('fill', 'none');

  node = node.data(nodes)
      .enter()
      .append("circle")
      .style('fill', d => {
        if (d.children.length > 0 && d.children[0].tagName === 'edge')
          return d.children[0].attributes.COLOR.nodeValue;
        else
          return 'black';
      })
      .attr("r", nodeRadius)
      // Tooltip
      .on("mouseover", function(d) {
        let tooltip_str = `${d.attributes.TEXT.nodeValue}`

        tooltip.html(tooltip_str)
            .style("visibility", "visible");
      })
      .on("mousemove", function(d) {
        tooltip.style("top", d3.event.pageY - (tooltip.node().clientHeight + 5) + "px").style("left", d3.event.pageX + "px");
      })
      .on("mouseout", function(d) {
        tooltip.style("visibility", "hidden");
      })
      .call(drag);

  // Link between nodes helps prevent link crowding
  linkNode = linkNode.data(linkNodes)
      .enter().append("circle")
        .attr("class", "link-node")
        .attr("r", 3)
        .style("fill", "#ccc")
        .style('opacity', 0);

  simulation.restart();
});

// ===================== HELPER FUNCTIONS =====================
function linkArc(d) {
  var dx = d.target.x - d.source.x,
      dy = d.target.y - d.source.y,
      dr = Math.sqrt(dx * dx + dy * dy);
  return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
}

function getRandomInt(max) {
  let randNum = Math.random() * Math.floor(max);
  return randNum;
}

// Try to get something like this: http://visualdataweb.de/webvowl/#personasonto
function calculatePathEnd(d){

  function calculateAngle(sx, sy, ex, ey) {
    var dy = ey - sy;
    var dx = ex - sx;
    return Math.atan2(dy, dx); // range (-PI, PI]; In Radians
  }

  // The hypotenuse represents the length from the node center to the end of the incoming link
  let hypotenuse = nodeRadius*2; // The longest that any marker end can be is twice the node radius since the maximum of links' stroke-width is nodeRadius and the marker-end can be higher or longer than the stroke-width 

  // Since .sin and .cos use radians, use radians
  let radianAngle = calculateAngle(d.source.x, d.source.y, d.target.x, d.target.y);

  // Calculate the side length of opposite and adjacent
  let opposite = Math.sin(radianAngle) * hypotenuse;
  let adjacent = Math.cos(radianAngle) * hypotenuse;

  // Use the adjacent and opposite to calculate the offsets
  let targetXpadding = adjacent;
  let targetYpadding = opposite;
  
  // Return the end of the path
  return `${(d.target.x - targetXpadding)} 
          ${(d.target.y - targetYpadding)} `
}

// ===================== FORCE TICK =====================
function ticked() {
  // Use max and min to constrain the nodes to the graph container
  node
      .attr("cx", d => d.x = Math.max(margin.left, Math.min(width - margin.right, d.x)))
      .attr("cy", d => d.y = Math.max(margin.top, Math.min(height - margin.bottom, d.y)));

  // Commented out portion present different path options
  link
      // Single curve <path>
      // .attr('d', linkArc);

      // Straight line <path>
      // .attr('d', d => 
      //   `M${d.source.x} ${d.source.y} 
      //   L ${(d.target.x*.9 + d.source.x*.1)} ${(d.target.y*.9 + d.source.y*.1)} `
      // )

      // Cutoff line path
      .attr('d', d => `M${d.source.x} ${d.source.y} L` + calculatePathEnd(d))

      // <line>
      // .attr("x1", d => d.source.x)
      // .attr("y1", d => d.source.y)
      // .attr("x2", d => d.target.x)
      // .attr("y2", d => d.target.y);

  linkNode
      .attr("cx", d => d.x = (d.source.x + d.target.x) * 0.5)
      .attr("cy", d => d.y = (d.source.y + d.target.y) * 0.5);
}

// ===================== PARTICLE TICK AND DRAW =====================

// ========= 
// The following two functions, tick() and drawParticlePathOnCanvas() are based on Micah Stub's code
// SOURCE: https://bl.ocks.org/micahstubbs/ed0ae1c70256849dab3e35a0241389c9
// =========

// First setup two unnested variables
// Start the particle timer, tick(), after a 1 second delay; pass the elapsed time to callback
var t = d3.timer(tick, 1000);

// Start with 0 particles; the populated array is contained within the tick function
let particles = [];

// Tick function is for the particles
// d3.timer passes elapsed time as first argument
function tick(elapsed){
  // Filter the particle array from the previous tick()
  particles = particles.filter(d => d.current < d.path.getTotalLength());

  d3.selectAll('path.link')
    .each( function(d) { // DO NOT CONVERT TO ARROW FUNCTION, `this` will not bind properly, and you won't be able to access the SVG path properly
        // let elapsedF = f(elapsed);
        // let freqF= f((1-d.freq)*10);

        // if (elapsedF % freqF*10 === 0){}

        // the `x` limit also controls the frequency per second
        // for (let x = 0; x < 2; x++) {
          const offset = (Math.random() * nodeRadius - nodeRadius/2);

          // The higher the multiplied Math.random(), the less particles (because the probability is lower that there will be a decimal smaller than the d.freq)
          if (Math.random() * 15 < d.freq) {
          // if ( f(elapsed/1000) % f((1-d.freq)*100) === 0 ){
                      
            const length = this.getTotalLength();

            // Update the particle array
            particles.push({
              link: d,
              time: elapsed,
              offset,
              path: this,
              length,
              animateTime: length,
              speed: .5
            });
          // }
        }
      });

  // With updated particle array and elapsed time, draw those particles on the canvas
  drawParticlePathOnCanvas(elapsed);
}

function drawParticlePathOnCanvas(elapsed){
  context.clearRect(0, 0, d3W, d3H);

  context.fillStyle = 'orange';
  context.lineWidth = '50px';

  for (const p in particles){
    // Exclude prototye chain inherited properties:
    // {} and .call are the safest ways: https://eslint.org/docs/rules/no-prototype-builtins
    if( {}.hasOwnProperty.call(particles, p) ){
      const currentTime = elapsed - particles[p].time;
      particles[p].current = currentTime * 0.15 * particles[p].speed;

      // CAUTION: .getPointAtLength has been deprecated and does not work on Safari
      // MDN: https://developer.mozilla.org/en-US/docs/Web/API/SVGPathElement/getPointAtLength#Browser_compatibility
      const currentPos = particles[p].path.getPointAtLength(particles[p].current);

      // Draw the particles
      context.beginPath();
      context.arc( // creates a circle in canvas
        currentPos.x + margin.left, // Add particles[p].offset for displacement
        currentPos.y + margin.top,
        particles[p].link.particleSize, // radius of circle
        0, // circle starting position
        2 * Math.PI  // circle ending position
      );
      context.lineWidth = 2;
      context.stroke();
      context.fill();

    }  
  }
  
}

// ===================== DRAG =====================
function dragstarted(d) {
  if (!d3.event.active) 
    simulation.alphaTarget(0.3).restart();

  d.fx = d.x;
  d.fy = d.y;
}

function dragged(d) {
  d.fx = d3.event.x;
  d.fy = d3.event.y;
}

function dragended(d) {
  if (!d3.event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}

// ===================== IMPORTED HELPER FUNCTIONS =====================
// ========== Canvas Setup ==========
// Based on @MyNameIsKo's helper function ( https://stackoverflow.com/a/15666143/8585320 )
function createProperResCanvas(w, h, ratio) {
    if (!ratio) { ratio = Math.round(window.devicePixelRatio) || 1 }

    // Keep canvas within the allowable size:
    // https://stackoverflow.com/a/11585939/8585320
    h = Math.min(32767, h * ratio);

    // Set canvas
    var can = document.querySelector("#graph-canvas");
    can.width = w * ratio;
    can.height = h * ratio;
    can.style.width = w + "px";
    can.style.height = h + "px";

    // Set context
    var ctx = can.getContext("2d");
    ctx.scale(ratio,ratio);
    ctx.clearRect(0, 0, w, h);

    // Since context does all of the drawing, no need to return canvas itself
    return ctx;
}
