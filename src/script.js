import maplibregl from 'maplibre-gl';
import noUiSlider from 'nouislider';
import 'nouislider/dist/nouislider.css';
//npm i https://github.com/wolfiex/maplibre-gl-js-webgl2

//https://webglfundamentals.org/

var slider = document.getElementById ('slider');
var densityslider = document.getElementById ('densityslider');

noUiSlider.create (slider, {
  start: [10, 70],
  connect: true,
  range: {
    min: 0,
    max: 100,
  },
});

slider.addEventListener ('click', redraw);
densityslider.addEventListener ('change', redraw);

function redraw () {
  console.log (map);
  map.redraw ();
}

//include webgl2 in mapboxgl
if (
  maplibregl.Map.prototype._setupPainter.toString ().indexOf ('webgl2') == -1
) {
  var _setupPainter_old = maplibregl.Map.prototype._setupPainter;
  maplibregl.Map.prototype._setupPainter = function () {
    let getContext_old = this._canvas.getContext;
    this._canvas.getContext = function (name, attrib) {
      return (
        getContext_old.apply (this, ['webgl2', attrib]) ||
        getContext_old.apply (this, ['webgl', attrib]) ||
        getContext_old.apply (this, ['experimental-webgl', attrib])
      );
    };
    _setupPainter_old.apply (this);
    this._canvas.getContext = getContext_old;
  };
}

var map = (window.map = new maplibregl.Map ({
  container: 'map',
  zoom: 3,
  center: [7.5, 58],
  style: `https://api.jawg.io/styles/jawg-dark.json?access-token=${'u8QexmjeotzH3gqD6qXyuKblwQi4DkhbOQp8Ydm6aUAjyIsvlO4RHBCedF07KIDW'}`,
  antialias: true,
}));

// create a custom style layer to implement the WebGL content
var highlightLayer = {
  id: 'highlight',
  type: 'custom',

  onAdd: function (map, gl) {
    console.log (gl.getParameter (gl.VERSION));
    // create GLSL source for vertex shader
    var vertexSource = document.getElementById ('vertexShader').textContent;

    // create GLSL source for fragment shader
    // need to set precision!!
    var fragmentSource = document.getElementById ('fragmentShader').textContent;

    // create a vertex shader
    var vertexShader = gl.createShader (gl.VERTEX_SHADER);
    gl.shaderSource (vertexShader, vertexSource);
    gl.compileShader (vertexShader);

    // create a fragment shader
    var fragmentShader = gl.createShader (gl.FRAGMENT_SHADER);
    gl.shaderSource (fragmentShader, fragmentSource);
    gl.compileShader (fragmentShader);

    // link the two shaders into a WebGL program
    this.program = gl.createProgram ();
    gl.attachShader (this.program, vertexShader);
    gl.attachShader (this.program, fragmentShader);
    gl.linkProgram (this.program);

    // set the time uniform
    this.timeLocation = gl.getUniformLocation (this.program, 'u_time');
    this.density = gl.getUniformLocation (this.program, 'u_density');
    this.thresholds = gl.getUniformLocation (this.program, 'u_thresholds');

    window.g = gl;

    this.aPos = gl.getAttribLocation (this.program, 'a_pos');

    // define vertices of the triangle to be rendered in the custom style layer
    var helsinki = maplibregl.MercatorCoordinate.fromLngLat ({
      lng: 25.004,
      lat: 60.239,
    });
    var berlin = maplibregl.MercatorCoordinate.fromLngLat ({
      lng: 13.403,
      lat: 52.562,
    });
    var kyiv = maplibregl.MercatorCoordinate.fromLngLat ({
      lng: 30.498,
      lat: 50.541,
    });

    // create and initialize a WebGLBuffer to store vertex and color data
    this.buffer = gl.createBuffer ();
    gl.bindBuffer (gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData (
      gl.ARRAY_BUFFER,
      new Float32Array ([
        helsinki.x,
        helsinki.y,
        berlin.x,
        berlin.y,
        kyiv.x,
        kyiv.y,
      ]),
      gl.STATIC_DRAW
    );
  },

  // method fired on each animation frame
  // https://maplibre.org/maplibre-gl-js-docs/api/map/#map.event:render
  render: render,
};

//////////

function render (gl, matrix) {
  gl.useProgram (this.program);
  gl.uniform1f (this.timeLocation, 0.5);
  gl.uniform1f (this.density, parseFloat (densityslider.value) / 100.);
  gl.uniform1f (this.counter, 0);
  // big to small. //[r,g,b,.gt.]
  // rgb as a ratio 0-1 i.e. n/255

  var splits = slider.noUiSlider.getPositions ();

  // console.log(splits,densityslider.value)

  var breaks = [
    [1, 0.0, 0.0, splits[1] / 100],
    [0.0, 0.0, 1, splits[0] / 100],
    [0.0, 1, 0.0, 0.0],
    [0.5, 0.5, 0.5, 0.0],
  ]
    .flat ()
    .map (parseFloat);

  gl.uniformMatrix4fv (this.thresholds, false, breaks);

  gl.uniformMatrix4fv (
    gl.getUniformLocation (this.program, 'u_matrix'),
    false,
    matrix
  );
  gl.bindBuffer (gl.ARRAY_BUFFER, this.buffer);
  gl.enableVertexAttribArray (this.aPos);
  gl.vertexAttribPointer (this.aPos, 2, gl.FLOAT, false, 0, 0);
  gl.enable (gl.BLEND);

  // sourcefactor, destinationfactor
  // gl.blendFunc(gl.SRC_COLOR,gl.ONE_MINUS_SRC_ALPHA)

  gl.blendFunc (gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays (gl.TRIANGLE_STRIP, 0, 3);
}

// add the custom style layer to the map
map.on ('load', function () {
  map.addLayer (highlightLayer, 'building');
});
