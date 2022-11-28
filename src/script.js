import maplibregl from 'maplibre-gl';
//npm i https://github.com/wolfiex/maplibre-gl-js-webgl2

//https://webglfundamentals.org/

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
  style: 'https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
  antialias: true,
}));
document.querySelector ('canvas').style.filter = 'invert(1)';


// create a custom style layer to implement the WebGL content
var highlightLayer = {
  id: 'highlight',
  type: 'custom',

  onAdd: function (map, gl) {
    console.log (gl.getParameter (gl.VERSION));
    // create GLSL source for vertex shader
    var vertexSource = `uniform mat4 u_matrix;  
      attribute vec2 a_pos;
      void main() {
          gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
      }`;

    // create GLSL source for fragment shader
    // need to set precision!!
    var fragmentSource = `
    precision mediump float;
    precision mediump int;
    // layout(binding = 0, offset = 0) uniform atomic_uint u_counter;
    
  // uniform vec2 u_resolution;
  uniform float u_density;
  uniform float u_time;
  uniform mat4 u_thresholds;
  

//   float rand(vec2 co){
    
//     // return fract(sin(dot(co.xy ,vec2(1.9898,1.2323))) * 43758.5453);
//     return noise  (co.xy, 42);
// }




// Gold Noise ©2015 dcerisano@standard3d.com
// - based on the Golden Ratio
// - uniform normalized distribution
// - fastest static noise generator function (also runs at low precision)
// - use with indicated fractional seeding method. 

float PHI = 1.61803398874989484820459;  // Φ = Golden Ratio   

float gold_noise(in vec2 co, in float seed){
       return fract(tan(distance(co.xy*PHI, co.xy)*seed)*co.xy.x);
}

float show(vec2 co){
  return 0.7*float(int(u_density>gold_noise(co,42.0)));
}



  void main() {
    // uint c = atomicCounterIncrement(ac);
    // float r = (c/255)/255.f;
    // vec2 st = gl_FragCoord.xy/u_resolution.xy;


    // 5 categories

    vec2 co = gl_FragCoord.xy;
    float thresh = gold_noise(co,42.0);




    if (thresh > u_thresholds[0][3]){
      gl_FragColor = vec4(u_thresholds[0]);
    } else if (thresh > u_thresholds[1][3]){
      gl_FragColor = vec4(u_thresholds[1]);
    } else if (thresh > u_thresholds[2][3]){
      gl_FragColor = vec4(u_thresholds[2]);
    } else if (thresh > u_thresholds[3][3]){
      gl_FragColor = vec4(u_thresholds[3]);
    } else {
      gl_FragColor = vec4(255.,255.,255.,1.);
    }





    // gl_FragColor = ;
    gl_FragColor[3] = show(co);
  }`;

    //key
    /// 1 px = x people
    // 4px y people

    console.error (gl);
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
  render: function (gl, matrix) {
    gl.useProgram (this.program);
    gl.uniform1f (this.timeLocation, 0.5);
    gl.uniform1f (this.density, 0.29);
    gl.uniform1f (this.counter, 0);
    // big to small. //[r,g,b,.gt.]
    // rgb as a ratio 0-1 i.e. n/255
    var breaks = [
      [0.5, 0.5, 0.5, 0.9],
      [1.1, 0.0, 0.0, 0.45],
      [0.0, 0.0, 1.2, 0.2],
      [0.1, 1.1, 0.2, 0.0],
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
    gl.blendFunc (gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays (gl.TRIANGLE_STRIP, 0, 3);
  },
};

// add the custom style layer to the map
map.on ('load', function () {
  map.addLayer (highlightLayer, 'building');
});
