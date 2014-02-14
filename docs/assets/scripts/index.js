/*
  (C) 2014 David Lettier
  lettier.com
*/

// The WebGL context.

var gl;

// The compiled and linked vertex and fragment shaders.

var shaderProgram;

// A stack for preserving matrix transformation states.

var mvMatrixStack = [ ];

// Perspective or orthographic projection?

var perspective_projection = true;

// Model view and projection matrices.

var mvMatrix = mat4.create( );
var pMatrix  = mat4.create( );

// Isosurface data structures for holding the vertices, vertex normals, and vertex colors.

var isosurfaceVertexPositionBuffer;
var isosurfaceVertexNormalBuffer;
var isosurfaceVertexColorBuffer;

var isosurface1VertexPositionBuffer;
var isosurface1VertexNormalBuffer;
var isosurface1VertexColorBuffer;

var pointLightSphereVertexPositionBuffer;
var pointLightSphereVertexNormalBuffer;
var pointLightSphereVertexColorBuffer;

// Base color used for the ambient, fog, and clear-to colors.

var base_color  = [ 0.123, 0.154, 0.182 ];

// Lighting power.

var lighting_power = 2;

// Used for time based animation.

var time_last = 0;

// Used to rotate the isosurface.

var rotation_radians      = 0.0;
var rotation_radians_step = 0.3;

// Use lighting?

var use_lighting = 1;

// Use wireframe rendering?

var use_wireframe = 0;

// Render different buffers.

var show_depth    = 0;
var show_normals  = 0;
var show_position = 0;

// Alpha blending enabled?

var alpha_blending_enabled = 0;

// Normal map?

var normal_map = 1;

// Number of times initBuffers has been called.

var init_buffers_called = 0;

// Used to orbit the point lights.

var point_light_theta      = 1.57;
var point_light_phi        = 1.57;
var point_light_theta_step = 0.39;
var point_light_phi_step   = 0.39;

var point_light_theta1      = 1.57;
var point_light_phi1        = 1.57;
var point_light_theta_step1 = 0.3;
var point_light_phi_step1   = 0.3;

// Performs the draw loop iteration at roughly 60 frames per second.

window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;

// On-load event callback.

window.onload = function ( ) {
  var gui = new dat.GUI();

  gui.add(this, "lighting_power",               0,         5);
  gui.add(this, "perspective_projection", { On: true, Off: false });
  gui.add(this, "use_lighting",           { On:  1,   Off: 0 });
  gui.add(this, "use_wireframe",          { On:  1,   Off: 0 });
  gui.add(this, "show_depth",             { Yes: 1,   No:  0 });
  gui.add(this, "show_normals",           { Yes: 1,   No:  0 });
  gui.add(this, "show_position",          { Yes: 1,   No:  0 });
  gui.add(this, "normal_map",             { On:  1,   Off: 0 });

  webGLStart( );
};

// Browser window re-size event callback.

window.onresize = function ( ) { resize_contents( ); };

// Initializes the WebGL context.

function initGL( canvas )
{

  try
  {

    gl = canvas.getContext( "webgl" ) || canvas.getContext( "experimental-webgl" );

    gl.viewportWidth  = canvas.width;
    gl.viewportHeight = canvas.height;

  }
  catch ( error )
  {

    // Browser cannot initialize a WebGL context.

    window.location.assign( "http://get.webgl.org/" );

  }

  if ( !gl )
  {

    // Browser cannot initialize a WebGL context.

    window.location.assign( "http://get.webgl.org/" );

  }

}

// Function to retrieve the shader strings thereby compiling them into shader programs run by the GPU.

function getShader( gl, id )
{
  var shaderScript = document.getElementById( id );

  if ( !shaderScript )
  {

    console.error( "No shader scripts present." );

    return null;

  }

  var str = "";

  var k = shaderScript.firstChild;

  while ( k )
  {

    if ( k.nodeType == 3 )
    {

      str += k.textContent;

    }

    k = k.nextSibling;

  }

  var shader;

  if ( shaderScript.type == "x-shader/x-fragment" )
  {

    shader = gl.createShader( gl.FRAGMENT_SHADER );

  }
  else if ( shaderScript.type == "x-shader/x-vertex" )
  {

    shader = gl.createShader( gl.VERTEX_SHADER );

  }
  else
  {

    console.error( "No fragment/vertex shaders found." );

    return null;

  }

  gl.shaderSource( shader, str );

  gl.compileShader( shader );

  if ( !gl.getShaderParameter( shader, gl.COMPILE_STATUS ) )
  {

    console.error( gl.getShaderInfoLog( shader ) );

    return null;

  }

  return shader;

}

// Initialize the vertex and fragment shaders.

function initShaders( )
{

  var fragmentShader = getShader( gl, "shader-fs" );
  var vertexShader   = getShader( gl, "shader-vs" );

  shaderProgram = gl.createProgram( );

  gl.attachShader( shaderProgram, vertexShader );
  gl.attachShader( shaderProgram, fragmentShader );
  gl.linkProgram(  shaderProgram );

  if ( !gl.getProgramParameter( shaderProgram, gl.LINK_STATUS ) )
  {

    console.error( "Could not initialize shaders." );

  }

  gl.useProgram( shaderProgram );

  // Acquire handles to shader program variables in order to pass data to the shaders.

  shaderProgram.vertexPositionAttribute = gl.getAttribLocation( shaderProgram, "aVertexPosition" );
  gl.enableVertexAttribArray( shaderProgram.vertexPositionAttribute );

  shaderProgram.vertexColorAttribute = gl.getAttribLocation( shaderProgram, "aVertexColor" );
  gl.enableVertexAttribArray( shaderProgram.vertexColorAttribute );

  shaderProgram.vertexNormalAttribute = gl.getAttribLocation( shaderProgram, "aVertexNormal" );
  gl.enableVertexAttribArray( shaderProgram.vertexNormalAttribute );

  shaderProgram.pMatrixUniform  = gl.getUniformLocation( shaderProgram, "uPMatrix"  );
  shaderProgram.mvMatrixUniform = gl.getUniformLocation( shaderProgram, "uMVMatrix" );
  shaderProgram.nMatrixUniform  = gl.getUniformLocation( shaderProgram, "uNMatrix"  );

  shaderProgram.useLightingUniform = gl.getUniformLocation( shaderProgram, "uUseLighting" );

  shaderProgram.alphaBlendingEnabled = gl.getUniformLocation( shaderProgram, "uAlphaBlendingEnabled" );

  shaderProgram.normalMapEnabled = gl.getUniformLocation( shaderProgram, "uNormalMap" );

  shaderProgram.perspectiveProjection = gl.getUniformLocation( shaderProgram, "uPerspectiveProjection" );

  shaderProgram.showDepth    = gl.getUniformLocation( shaderProgram, "uShowDepth" );
  shaderProgram.showNormals  = gl.getUniformLocation( shaderProgram, "uShowNormals" );
  shaderProgram.showPosition = gl.getUniformLocation( shaderProgram, "uShowPosition" );

  shaderProgram.ambientColorUniform = gl.getUniformLocation( shaderProgram, "uAmbientColor" );

  shaderProgram.pointLightingLocationUniform = gl.getUniformLocation( shaderProgram, "uPointLightingLocation" );
  shaderProgram.pointLightingColorUniform    = gl.getUniformLocation( shaderProgram, "uPointLightingColor"    );

  shaderProgram.pointLightingLocationUniform1 = gl.getUniformLocation( shaderProgram, "uPointLightingLocation1" );
  shaderProgram.pointLightingColorUniform1    = gl.getUniformLocation( shaderProgram, "uPointLightingColor1"    );

}

// Initialize all of the vertex, vertex normal, and vertex color buffers.

function initBuffers( )
{

  // Generates one triangle complete with vertex normals and vertex colors.

  function triangle( p1, p2, p3, isosurface_function, resolution, invert_normals )
  {

    // Push the vertices to this triangle face.
    // Pushing point 3, then 2, and then 1 so that the front face of the triangle
    // points outward from the surface.

    // Push point 1, then 2, and then 3 so that the front front face of the triangle
    // points inward from the surface.

    vertices.push( p3[ 0 ] ); vertices.push( p3[ 1 ] ); vertices.push( p3[ 2 ] );
    vertices.push( p2[ 0 ] ); vertices.push( p2[ 1 ] ); vertices.push( p2[ 2 ] );
    vertices.push( p1[ 0 ] ); vertices.push( p1[ 1 ] ); vertices.push( p1[ 2 ] );

    // Calculate the isosurface gradient at point 1, 2, and 3 of the triangle.
    // These three gradient vectors are the vertex normals of this triangle.
    // This will provide a nice smooth appearance when the lighting is calculated.
    // These three gradient vectors will also be the vertex colors.

    var invert_normal = 1;

    if ( invert_normals === true ) invert_normal = -1;

    var vertext_color_alpha = 0.2;

    // Point 3.

    vertex_normal_x = 0.5 * ( isosurface_function( p3[ 0 ] + 1, p3[ 1 ],     p3[ 2 ]     ) - isosurface_function( p3[ 0 ] - 1, p3[ 1 ],     p3[ 2 ]     ) ) / resolution;
    vertex_normal_y = 0.5 * ( isosurface_function( p3[ 0 ],     p3[ 1 ] + 1, p3[ 2 ]     ) - isosurface_function( p3[ 0 ],     p3[ 1 ] - 1, p3[ 2 ]     ) ) / resolution;
    vertex_normal_z = 0.5 * ( isosurface_function( p3[ 0 ],     p3[ 1 ],     p3[ 2 ] + 1 ) - isosurface_function( p3[ 0 ],     p3[ 1 ],     p3[ 2 ] - 1 ) ) / resolution;

    vertex_normal_length = Math.sqrt( ( vertex_normal_x * vertex_normal_x ) + ( vertex_normal_y * vertex_normal_y ) + ( vertex_normal_z * vertex_normal_z ) );

    if ( vertex_normal_length !== 0 )
    {

      vertex_normal_x = vertex_normal_x / vertex_normal_length;
      vertex_normal_y = vertex_normal_y / vertex_normal_length;
      vertex_normal_z = vertex_normal_z / vertex_normal_length;

    }

    vertex_normals.push( invert_normal * vertex_normal_x ); vertex_normals.push( invert_normal * vertex_normal_y ); vertex_normals.push( invert_normal * vertex_normal_z );

    // Push the vertex colors for this triangle face point.

    vertex_colors.push( 1.0 - vertex_normal_x ); vertex_colors.push( 1.0 - vertex_normal_y ); vertex_colors.push( 1.0 - vertex_normal_z ); vertex_colors.push( vertext_color_alpha );

    // Point 2.

    vertex_normal_x = 0.5 * ( isosurface_function( p2[ 0 ] + 1, p2[ 1 ],     p2[ 2 ]     ) - isosurface_function( p2[ 0 ] - 1, p2[ 1 ],     p2[ 2 ]     ) ) / resolution;
    vertex_normal_y = 0.5 * ( isosurface_function( p2[ 0 ],     p2[ 1 ] + 1, p2[ 2 ]     ) - isosurface_function( p2[ 0 ],     p2[ 1 ] - 1, p2[ 2 ]     ) ) / resolution;
    vertex_normal_z = 0.5 * ( isosurface_function( p2[ 0 ],     p2[ 1 ],     p2[ 2 ] + 1 ) - isosurface_function( p2[ 0 ],     p2[ 1 ],     p2[ 2 ] - 1 ) ) / resolution;

    vertex_normal_length = Math.sqrt( ( vertex_normal_x * vertex_normal_x ) + ( vertex_normal_y * vertex_normal_y ) + ( vertex_normal_z * vertex_normal_z ) );

    if ( vertex_normal_length !== 0 )
    {

      vertex_normal_x = vertex_normal_x / vertex_normal_length;
      vertex_normal_y = vertex_normal_y / vertex_normal_length;
      vertex_normal_z = vertex_normal_z / vertex_normal_length;

    }

    vertex_normals.push( invert_normal * vertex_normal_x ); vertex_normals.push( invert_normal * vertex_normal_y ); vertex_normals.push( invert_normal * vertex_normal_z );

    // Push the vertex colors for this triangle face point.

    vertex_colors.push( 1.0 - vertex_normal_x ); vertex_colors.push( 1.0 - vertex_normal_y ); vertex_colors.push( 1.0 - vertex_normal_z ); vertex_colors.push( vertext_color_alpha );

    // Point 1.

    var vertex_normal_x = 0.5 * ( isosurface_function( p1[ 0 ] + 1, p1[ 1 ],     p1[ 2 ]     ) - isosurface_function( p1[ 0 ] - 1, p1[ 1 ],     p1[ 2 ]     ) ) / resolution;
    var vertex_normal_y = 0.5 * ( isosurface_function( p1[ 0 ],     p1[ 1 ] + 1, p1[ 2 ]     ) - isosurface_function( p1[ 0 ],     p1[ 1 ] - 1, p1[ 2 ]     ) ) / resolution;
    var vertex_normal_z = 0.5 * ( isosurface_function( p1[ 0 ],     p1[ 1 ],     p1[ 2 ] + 1 ) - isosurface_function( p1[ 0 ],     p1[ 1 ],     p1[ 2 ] - 1 ) ) / resolution;

    // Normalize.

    var vertex_normal_length = Math.sqrt( ( vertex_normal_x * vertex_normal_x ) + ( vertex_normal_y * vertex_normal_y ) + ( vertex_normal_z * vertex_normal_z ) );

    if ( vertex_normal_length !== 0 )
    {

      vertex_normal_x = vertex_normal_x / vertex_normal_length;
      vertex_normal_y = vertex_normal_y / vertex_normal_length;
      vertex_normal_z = vertex_normal_z / vertex_normal_length;

    }

    vertex_normals.push( invert_normal * vertex_normal_x ); vertex_normals.push( invert_normal * vertex_normal_y ); vertex_normals.push( invert_normal * vertex_normal_z );

    // Push the vertex colors for this triangle face point.

    vertex_colors.push( 1.0 - vertex_normal_x ); vertex_colors.push( 1.0 - vertex_normal_y ); vertex_colors.push( 1.0 - vertex_normal_z ); vertex_colors.push( vertext_color_alpha );

  }

  // The marching cubes algorithm.

  function marching_cubes( grid_min, grid_max, resolution, iso_level, isosurface_function, invert_normals )
  {

    // Cube grid dimensions.

    var cube_grid_axis_min = grid_min;
    var cube_grid_axis_max = grid_max;

    // Generate the cube grid scalar field.

    /*

    j
    |
    |          k
    |         .
    |       .
    |     .
    |    .
    |  .
    |._________________i

    */

    function Scalar_Point( x, y, z, value )
    {

      this.id = x.toFixed( 2 ) + y.toFixed( 2 ) + z.toFixed( 2 );

      this.x     = x;
      this.y     = y;
      this.z     = z;
      this.value = value;

    }

    var scalar_points = { };

    for ( var k = cube_grid_axis_min; k <= ( cube_grid_axis_max + resolution ); k += resolution )
    {

      for ( var j = cube_grid_axis_min; j <= ( cube_grid_axis_max + resolution ); j += resolution )
      {

        for ( var i = cube_grid_axis_min; i <= ( cube_grid_axis_max + resolution ); i += resolution )
        {

          var x = i;
          var y = j;
          var z = k;

          var value = isosurface_function( x, y, z );

          var scalar_point = new Scalar_Point( x, y, z, value );

          scalar_points[ scalar_point.id ] = scalar_point;

        }

      }

    }

    function edge_intersection_interpolation( cube_va, cube_vb )
    {

      if ( Math.abs( iso_level - cube_va.value ) < 0.00001 ) return [ cube_va.x, cube_va.y, cube_va.z ];

      if ( Math.abs( iso_level - cube_vb.value ) < 0.00001 ) return [ cube_vb.x, cube_vb.y, cube_vb.z ];

      if ( Math.abs( cube_va.value - cube_vb.value ) < 0.00001 ) return [ cube_va.x, cube_va.y, cube_va.z ];

      var mean = ( iso_level - cube_va.value ) / ( cube_vb.value - cube_va.value );

      var point = [ ];

      point.push( cube_va.x + mean * ( cube_vb.x - cube_va.x ) );
      point.push( cube_va.y + mean * ( cube_vb.y - cube_va.y ) );
      point.push( cube_va.z + mean * ( cube_vb.z - cube_va.z ) );

      return point;
    }

    for ( var k = cube_grid_axis_min; k < cube_grid_axis_max; k += resolution )
    {

      for ( var j = cube_grid_axis_min; j < cube_grid_axis_max; j += resolution )
      {

        for ( var i = cube_grid_axis_min; i < cube_grid_axis_max; i += resolution )
        {

          // Perform the algorithm on one cube in the grid.

          // The cube's vertices.
          // There are eight of them.

          //    4---------5
          //   /|        /|
          //  / |       / |
          // 7---------6  |
          // |  |      |  |
          // |  0------|--1
          // | /       | /
          // |/        |/
          // 3---------2

          var cube_v3 = scalar_points[ i.toFixed( 2 )                  + j.toFixed( 2 )                  + k.toFixed( 2 ) ]; // Lower left  front corner.
          var cube_v2 = scalar_points[ ( i + resolution ).toFixed( 2 ) + j.toFixed( 2 )                  + k.toFixed( 2 ) ]; // Lower right front corner.
          var cube_v6 = scalar_points[ ( i + resolution ).toFixed( 2 ) + ( j + resolution ).toFixed( 2 ) + k.toFixed( 2 ) ]; // Upper right front corner.
          var cube_v7 = scalar_points[ i.toFixed( 2 )                  + ( j + resolution ).toFixed( 2 ) + k.toFixed( 2 ) ]; // Upper left  front corner

          var cube_v0 = scalar_points[ i.toFixed( 2 )                  + j.toFixed( 2 )                  + ( k + resolution ).toFixed( 2 ) ]; // Lower left  back corner.
          var cube_v1 = scalar_points[ ( i + resolution ).toFixed( 2 ) + j.toFixed( 2 )                  + ( k + resolution ).toFixed( 2 ) ]; // Lower right back corner.
          var cube_v5 = scalar_points[ ( i + resolution ).toFixed( 2 ) + ( j + resolution ).toFixed( 2 ) + ( k + resolution ).toFixed( 2 ) ]; // Upper right back corner.
          var cube_v4 = scalar_points[ i.toFixed( 2 )                  + ( j + resolution ).toFixed( 2 ) + ( k + resolution ).toFixed( 2 ) ]; // Upper left  back corner.

          var cube_index = 0;

          if ( cube_v0.value < iso_level ) cube_index |= 1;
          if ( cube_v1.value < iso_level ) cube_index |= 2;
          if ( cube_v2.value < iso_level ) cube_index |= 4;
          if ( cube_v3.value < iso_level ) cube_index |= 8;
          if ( cube_v4.value < iso_level ) cube_index |= 16;
          if ( cube_v5.value < iso_level ) cube_index |= 32;
          if ( cube_v6.value < iso_level ) cube_index |= 64;
          if ( cube_v7.value < iso_level ) cube_index |= 128;

          // Does the isosurface not intersect any edges of the cube?

          if ( marching_cubes_edge_table[ cube_index ] === 0 ) continue;

          // What edges of the cube does the isosurface intersect?
          // For each cube edge intersected, interpolate an intersection vertex between the edge's incident vertices.
          // These vertices of intersection will form the triangle(s) that approximate the isosurface.

          // There are 12 edges in a cube.

          //       4----5----5
          //    8 /|       6/|
          //     / |9      / | 10
          //    7----7----6  |
          //    |  |      |  |
          // 12 |  0---1--|--1
          //    | /       | /
          //    |/ 4   11 |/ 2
          //    3----3----2
          //
          // 1={0,1},  2={1,2},  3={2,3},  4={3,0},
          // 5={4,5},  6={5,6},  7={6,7},  8={7,4},
          // 9={0,4}, 10={5,1}, 11={2,6}, 12={3,7}

          // Base ten slot: 2048 | 1024 | 512 | 256 | 128 | 64 | 32 | 16 | 8 | 4 | 2 | 1
          // Base two slot:    0 |    0 |   0 |   0 |   0 |  0 |  0 |  0 | 0 | 0 | 0 | 0
          // Edge slot:       12 |   11 |  10 |   9 |   8 |  7 |  6 |  5 | 4 | 3 | 2 | 1

          var vertices_of_intersection = [ ];

          // Fill allocate the array.

          for ( var c = 0; c < 12; ++c )
          {

            vertices_of_intersection.push( [ 0, 0, 0 ] );

          }

          if ( marching_cubes_edge_table[ cube_index ] & 1 ) // Intersects edge one.
          {

            vertices_of_intersection[ 0 ] = edge_intersection_interpolation( cube_v0, cube_v1 );

          }

          if ( marching_cubes_edge_table[ cube_index ] & 2 ) // Intersects edge two.
          {

            vertices_of_intersection[ 1 ] = edge_intersection_interpolation( cube_v1, cube_v2 );

          }

          if ( marching_cubes_edge_table[ cube_index ] & 4 ) // Intersects edge three.
          {

            vertices_of_intersection[ 2 ] = edge_intersection_interpolation( cube_v2, cube_v3 );

          }

          if ( marching_cubes_edge_table[ cube_index ] & 8 ) // Intersects edge four.
          {

            vertices_of_intersection[ 3 ] = edge_intersection_interpolation( cube_v3, cube_v0 );

          }

          if ( marching_cubes_edge_table[ cube_index ] & 16 ) // Intersects edge five.
          {

            vertices_of_intersection[ 4 ] = edge_intersection_interpolation( cube_v4, cube_v5 );

          }

          if ( marching_cubes_edge_table[ cube_index ] & 32 ) // Intersects edge six.
          {

            vertices_of_intersection[ 5 ] = edge_intersection_interpolation( cube_v5, cube_v6 );

          }

          if ( marching_cubes_edge_table[ cube_index ] & 64 ) // Intersects edge seven.
          {

            vertices_of_intersection[ 6 ] = edge_intersection_interpolation( cube_v6, cube_v7 );

          }

          if ( marching_cubes_edge_table[ cube_index ] & 128 ) // Intersects edge eight.
          {

            vertices_of_intersection[ 7 ] = edge_intersection_interpolation( cube_v7, cube_v4 );

          }

          if ( marching_cubes_edge_table[ cube_index ] & 256 ) // Intersects edge nine.
          {

            vertices_of_intersection[ 8 ] = edge_intersection_interpolation( cube_v0, cube_v4 );

          }

          if ( marching_cubes_edge_table[ cube_index ] & 512 ) // Intersects edge ten.
          {

            vertices_of_intersection[ 9 ] = edge_intersection_interpolation( cube_v1, cube_v5 );

          }

          if ( marching_cubes_edge_table[ cube_index ] & 1024 ) // Intersects edge eleven.
          {

            vertices_of_intersection[ 10 ] = edge_intersection_interpolation( cube_v2, cube_v6 );

          }

          if ( marching_cubes_edge_table[ cube_index ] & 2048 ) // Intersects edge twelve.
          {

            vertices_of_intersection[ 11 ] = edge_intersection_interpolation( cube_v3, cube_v7 );

          }

          // Create the triangles.
          // Three vertices make up a triangle per iteration.

          for ( var a = 0; marching_cubes_triangle_table[ cube_index ][ a ] != -1; a = a + 3 )
          {

            var v1 = vertices_of_intersection[ marching_cubes_triangle_table[ cube_index ][ a     ] ];
            var v2 = vertices_of_intersection[ marching_cubes_triangle_table[ cube_index ][ a + 1 ] ];
            var v3 = vertices_of_intersection[ marching_cubes_triangle_table[ cube_index ][ a + 2 ] ];

            triangle( v1, v2, v3, isosurface_function, resolution, invert_normals );

          }

        }

      }

    }

  }

  // Begin creating the isosurfaces.

  // First isosurface.

  // Temporary arrays to hold all of the data that will be read into the buffers.

  var vertices       = [ ];
  var vertex_normals = [ ];
  var vertex_colors  = [ ];

  function isosurface_function( x, y, z )
  {

    // Goursat's surface.

    var x2 = x * x;
    var y2 = y * y;
    var z2 = z * z;

    var x4 = x2 * x2;
    var y4 = y2 * y2;
    var z4 = z2 * z2;

    var a = -1.0;
    var b =  0.0;
    var c =  0.5;

    var d = x2 + y2 + z2;
    var d2 = d * d;

    var value = x4 + y4 + z4 + a * d2 + b * d + c;

    return value;

  }

  // Grid min, grid max, resolution, iso-level, isosurface function, and invert normals.
  // Do not set the resolution to small.

  marching_cubes( -1.0, 1.0, 0.07, 0, isosurface_function, false );

  // Create the vertex buffer and bind it getting it ready to read in the vertices to the isosurface.

  isosurfaceVertexPositionBuffer = gl.createBuffer( );

  gl.bindBuffer( gl.ARRAY_BUFFER, isosurfaceVertexPositionBuffer );

  // Bind and fill the isosurface vertices.

  gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vertices ), gl.STATIC_DRAW );
  isosurfaceVertexPositionBuffer.itemSize = 3;
  isosurfaceVertexPositionBuffer.numItems = vertices.length / 3;

  // Bind and fill the isosurface vertex normals.

  isosurfaceVertexNormalBuffer = gl.createBuffer( );
  gl.bindBuffer( gl.ARRAY_BUFFER, isosurfaceVertexNormalBuffer );

  gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vertex_normals ), gl.STATIC_DRAW );
  isosurfaceVertexNormalBuffer.itemSize = 3;
  isosurfaceVertexNormalBuffer.numItems = vertex_normals.length / 3;

  // Bind and fill the isosurface vertex colors.

  isosurfaceVertexColorBuffer = gl.createBuffer( );
  gl.bindBuffer( gl.ARRAY_BUFFER, isosurfaceVertexColorBuffer );

  gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vertex_colors ), gl.STATIC_DRAW );
  isosurfaceVertexColorBuffer.itemSize = 4;
  isosurfaceVertexColorBuffer.numItems = vertex_colors.length / 4;

  // Second isosurface.

  if ( init_buffers_called === 0 )
  {

    vertices       = [ ];
    vertex_normals = [ ];
    vertex_colors  = [ ];

    function isosurface_function1( x, y, z )
    {

      // The Taubin (heart) surface.

      // Swapped y and z from the standard formula.

      var x2 = x * x;
      var z2 = z * z;
      var y2 = y * y;
      var y3 = y * y * y;

      var a  = x2 + ( 9 / 4 ) * z2 + y2 - 1;
      var a3 = a * a * a;

      var value = a3 - ( x2 * y3 ) - ( ( 9 / 80 ) * z2 * y3 );

      return value;

    }

    // Grid min, grid max, resolution, iso-level, isosurface function, and invert normals.
    // Do not set the resolution to small.

    marching_cubes( -1.5, 1.5, 0.08, 0, isosurface_function1, false );

    // Create the vertex buffer and bind it getting it ready to read in the vertices to the isosurface.

    isosurface1VertexPositionBuffer = gl.createBuffer( );

    gl.bindBuffer( gl.ARRAY_BUFFER, isosurface1VertexPositionBuffer );

    // Bind and fill the isosurface vertices.

    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vertices ), gl.STATIC_DRAW );
    isosurface1VertexPositionBuffer.itemSize = 3;
    isosurface1VertexPositionBuffer.numItems = vertices.length / 3;

    // Bind and fill the isosurface vertex normals.

    isosurface1VertexNormalBuffer = gl.createBuffer( );
    gl.bindBuffer( gl.ARRAY_BUFFER, isosurface1VertexNormalBuffer );

    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vertex_normals ), gl.STATIC_DRAW );
    isosurface1VertexNormalBuffer.itemSize = 3;
    isosurface1VertexNormalBuffer.numItems = vertex_normals.length / 3;

    // Bind and fill the isosurface vertex colors.

    isosurface1VertexColorBuffer = gl.createBuffer( );
    gl.bindBuffer( gl.ARRAY_BUFFER, isosurface1VertexColorBuffer );

    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vertex_colors ), gl.STATIC_DRAW );
    isosurface1VertexColorBuffer.itemSize = 4;
    isosurface1VertexColorBuffer.numItems = vertex_colors.length / 4;

  }

  // Point light representation.

  if ( init_buffers_called === 0 ) // Do not recreate the point light sphere more than once.
  {

    vertices       = [ ];
    vertex_normals = [ ];
    vertex_colors  = [ ];

    function isosurface_function2( x, y, z )
    {

      // A sphere.

      var value = ( ( x - 0 ) * ( x - 0 ) ) +
          ( ( y - 0 ) * ( y - 0 ) ) +
          ( ( z - 0 ) * ( z - 0 ) ) -
          ( (  0.5  ) * (  0.5  ) );

      return value;

    }

    // Grid min, grid max, resolution, iso-level, isosurface function, and invert normals.
    // Do not set the resolution to small.

    marching_cubes( -2, 2, 0.2, 0, isosurface_function2, false );

    // Make the sphere bright white.

    for ( var i = 0; i < vertex_colors.length; i += 4 )
    {

      vertex_colors[ i     ] = 200.0;
      vertex_colors[ i + 1 ] = 200.0;
      vertex_colors[ i + 2 ] = 200.0;
      vertex_colors[ i + 3 ] = 1.0;

    }

    // Create the vertex buffer and bind it getting it ready to read in the vertices to the isosurface.

    pointLightSphereVertexPositionBuffer = gl.createBuffer( );

    gl.bindBuffer( gl.ARRAY_BUFFER, pointLightSphereVertexPositionBuffer );

    // Bind and fill the isosurface vertices.

    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vertices ), gl.STATIC_DRAW );
    pointLightSphereVertexPositionBuffer.itemSize = 3;
    pointLightSphereVertexPositionBuffer.numItems = vertices.length / 3;

    // Bind and fill the isosurface vertex normals.

    pointLightSphereVertexNormalBuffer = gl.createBuffer( );
    gl.bindBuffer( gl.ARRAY_BUFFER, pointLightSphereVertexNormalBuffer );

    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vertex_normals ), gl.STATIC_DRAW );
    pointLightSphereVertexNormalBuffer.itemSize = 3;
    pointLightSphereVertexNormalBuffer.numItems = vertex_normals.length / 3;

    // Bind and fill the isosurface vertex colors.

    pointLightSphereVertexColorBuffer = gl.createBuffer( );
    gl.bindBuffer( gl.ARRAY_BUFFER, pointLightSphereVertexColorBuffer );

    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vertex_colors ), gl.STATIC_DRAW );
    pointLightSphereVertexColorBuffer.itemSize = 4;
    pointLightSphereVertexColorBuffer.numItems = vertex_colors.length / 4;

  }

  init_buffers_called += 1;

}

function initHUD( )
{

  // Create and show an onscreen logo.

  var logo_box        = document.createElement( "div" );
  logo_box.id         = "logo_box";
  logo_box.title      = "Lettier";
  logo_box.className  = "logo_box";
  logo_box.innerHTML  = "<img id='logo' src='assets/images/logo.png' class='logo' onclick='window.open(\"http://www.lettier.com/\");'>";

  document.body.appendChild( logo_box );

  var logo_image          = document.getElementById( "logo" );
  logo_image_height       = logo_image.clientHeight * 0.5;
  logo_image_width        = logo_image.clientWidth  * 0.5;
  logo_image.style.height = logo_image_height + "px";
  logo_image.style.width  = logo_image_width  + "px";
  logo_box.style.top      = window.innerHeight - logo_image_height - 10 + "px";
  logo_box.style.left     = window.innerWidth  - logo_image_width  - 10 + "px";

}

// Pass to the vertex shader the needed matrices.

function setMatrixUniforms( )
{

  // Pass the vertex shader the projection matrix and the model-view matrix.

  gl.uniformMatrix4fv( shaderProgram.pMatrixUniform,  false, pMatrix );
  gl.uniformMatrix4fv( shaderProgram.mvMatrixUniform, false, mvMatrix );

  // Pass the vertex normal matrix to the shader so it can compute the lighting calculations.

  var normalMatrix = mat3.create( );
  mat3.normalFromMat4( normalMatrix, mvMatrix );
  gl.uniformMatrix3fv( shaderProgram.nMatrixUniform, false, normalMatrix );

}

function mvPushMatrix( )
{

  // Save the model view matrix for later use.

  var copy = mat4.create( );
  copy = mat4.copy( copy, mvMatrix );
  mvMatrixStack.push( copy );

}

function mvPopMatrix( )
{

  // Gather the previously pushed model view matrix.

  if ( mvMatrixStack.length === 0 )
  {

    console.error( "mvMatrixStack empty." );

  }

  mvMatrix = mvMatrixStack.pop( );
}

// The function renders the isosurfaces lit with the point light.
// It also animates the rotation of the isosurfaces.

function drawScene( timestamp )
{

  // Call this function to draw the next frame.

  window.requestAnimationFrame( drawScene );

  // Time based animation instead of frame based animation.

  var time_now = new Date( ).getTime( );

  if ( time_last !== 0 )
  {

    var time_delta = ( time_now - time_last ) / 1000.0;

    rotation_radians += rotation_radians_step * time_delta;

    if ( rotation_radians > ( Math.PI * 2 ) ) rotation_radians = 0.0;

    if ( Number(use_lighting) === 1 )
    {

      point_light_theta += point_light_theta_step * time_delta;
      point_light_phi   += point_light_phi_step   * time_delta;

      if ( point_light_theta > ( Math.PI * 2 ) ) point_light_theta = 0.0;
      if ( point_light_phi   > ( Math.PI * 2 ) ) point_light_phi   = 0.0;

      point_light_theta1 += point_light_theta_step1 * time_delta;
      point_light_phi1   += point_light_phi_step1   * time_delta;

      if ( point_light_theta1 > ( Math.PI * 2 ) ) point_light_theta1 = 0.0;
      if ( point_light_phi1   > ( Math.PI * 2 ) ) point_light_phi1   = 0.0;

    }

  }

  time_last = time_now;

  // Set the size of and clear the render window.

  gl.viewport( 0, 0, gl.viewportWidth, gl.viewportHeight );

  gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

  // Create the projection matrix.

  var near  = 0.1;
  var far   = 50.0;
  var fov_d = 55.0;
  var fov_r = 55 * ( Math.PI / 180.0 );

  if ( JSON.parse(perspective_projection) )
  {

    // Resulting perspective matrix, FOV in radians, aspect ratio, near, and far clipping plane.

    mat4.perspective( pMatrix, fov_r, gl.viewportWidth / gl.viewportHeight, near, far );

    // Let the fragment shader know that perspective projection is being used.

    gl.uniform1i( shaderProgram.perspectiveProjection, 1 );

  }
  else
  {

    // The goal is to have the object be about the same size in the window
    // during orthographic project as it is during perspective projection.

    var a = gl.viewportWidth / gl.viewportHeight; // Window aspect ratio.
    var h = 2 * ( 25 * Math.tan( fov_r / 2 ) ); // 25 is the absolute distance from the world origin to all of the isosurfaces' local origins.
    var w = h * a; // Knowing the new window height size, get the new window width size based on the aspect ratio.

    // The canvas' origin is the upper left corner. To the right is the positive x-axis.
    // Going down is the positive y-axis.

    // Any object at the world origin would appear at the upper left hand corner.
    // Shift the origin to the middle of the screen.

    // Also, invert the y-axis as WebgL's positive y-axis points up while the canvas' positive
    // y-axis points down the screen.

    //           (0,O)------------------------(w,0)
    //               |                        |
    //               |                        |
    //               |                        |
    //           (0,h)------------------------(w,h)
    //
    //  (-(w/2),(h/2))------------------------((w/2),(h/2))
    //               |                        |
    //               |         (0,0)          |
    //               |                        |
    // (-(w/2),-(h/2))------------------------((w/2),-(h/2))

    // Resulting perspective matrix, left, right, bottom, top, near, and far clipping plane.

    mat4.ortho(

      pMatrix,
      -( w / 2 ),
       ( w / 2 ),
      -( h / 2 ),
       ( h / 2 ),
       near,
       far

    );

    // Let the fragment shader know that orthographic projection is being used.

    gl.uniform1i( shaderProgram.perspectiveProjection, 0 );

  }

  // Render different buffers to screen.

  gl.uniform1i( shaderProgram.showDepth,    show_depth );
  gl.uniform1i( shaderProgram.showNormals,  show_normals );
  gl.uniform1i( shaderProgram.showPosition, show_position );

  // Move to the 3D space origin.

  mat4.identity( mvMatrix );

  // Disable alpha blending.

  gl.disable( gl.BLEND );

  alpha_blending_enabled = 0;

  gl.uniform1i( shaderProgram.alphaBlendingEnabled, alpha_blending_enabled );

  if ( Number(use_lighting) === 1 )
  {

    // Pass the lighting parameters to the fragment shader.

    // Global ambient color.

    gl.uniform3f( shaderProgram.ambientColorUniform, base_color[ 0 ], base_color[ 1 ], base_color[ 2 ] );

    // Point light 1.

    var point_light_position_x =   0 + 13.5 * Math.cos( point_light_theta ) * Math.sin( point_light_phi );
    var point_light_position_y =   0 + 13.5 * Math.sin( point_light_theta ) * Math.sin( point_light_phi );
    var point_light_position_z = -25 + 13.5 * Math.cos( point_light_phi   );

    gl.uniform3f( shaderProgram.pointLightingColorUniform, lighting_power, lighting_power, lighting_power );

    gl.uniform3f( shaderProgram.pointLightingLocationUniform, point_light_position_x, point_light_position_y, point_light_position_z );

    // Point light 2.

    var point_light_position_x1 =   0 + 8.0 * Math.cos( point_light_theta1 ) * Math.sin( point_light_phi1 );
    var point_light_position_y1 =   0 + 8.0 * Math.sin( point_light_theta1 ) * Math.sin( point_light_phi1 );
    var point_light_position_z1 = -25 + 8.0 * Math.cos( point_light_phi1   );

    gl.uniform3f( shaderProgram.ambientColorUniform1, base_color[ 0 ], base_color[ 1 ], base_color[ 2 ] );

    gl.uniform3f( shaderProgram.pointLightingColorUniform1, lighting_power, lighting_power, lighting_power );

    gl.uniform3f( shaderProgram.pointLightingLocationUniform1, point_light_position_x1, point_light_position_y1, point_light_position_z1 );

    // Turn off lighting for a moment so that the point light isosurface is
    // bright simulating that the light is emanating from the surface.

    use_lighting = 0;

    gl.uniform1i( shaderProgram.useLightingUniform, use_lighting );

    // Point light surfaces.

    // Save the model view matrix state.

    mvPushMatrix( );

    // Point light surface 1.

    mat4.translate( mvMatrix, mvMatrix, [ point_light_position_x, point_light_position_y, point_light_position_z ] );

    gl.bindBuffer( gl.ARRAY_BUFFER, pointLightSphereVertexPositionBuffer );
    gl.vertexAttribPointer( shaderProgram.vertexPositionAttribute, pointLightSphereVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0 );

    gl.bindBuffer( gl.ARRAY_BUFFER, pointLightSphereVertexNormalBuffer );
    gl.vertexAttribPointer( shaderProgram.vertexNormalAttribute,   pointLightSphereVertexNormalBuffer.itemSize,   gl.FLOAT, false, 0, 0 );

    gl.bindBuffer( gl.ARRAY_BUFFER, pointLightSphereVertexColorBuffer );
    gl.vertexAttribPointer( shaderProgram.vertexColorAttribute,    pointLightSphereVertexColorBuffer.itemSize,    gl.FLOAT, false, 0, 0 );

    setMatrixUniforms( );

    gl.drawArrays( gl.TRIANGLES, 0, pointLightSphereVertexPositionBuffer.numItems );

    mvPopMatrix( );

    // Save the model view matrix state.

    mvPushMatrix( );

    // Point light surface 2.

    mat4.translate( mvMatrix, mvMatrix, [ point_light_position_x1, point_light_position_y1, point_light_position_z1 ] );

    gl.bindBuffer( gl.ARRAY_BUFFER, pointLightSphereVertexPositionBuffer );
    gl.vertexAttribPointer( shaderProgram.vertexPositionAttribute, pointLightSphereVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0 );

    gl.bindBuffer( gl.ARRAY_BUFFER, pointLightSphereVertexNormalBuffer );
    gl.vertexAttribPointer( shaderProgram.vertexNormalAttribute,   pointLightSphereVertexNormalBuffer.itemSize,   gl.FLOAT, false, 0, 0 );

    gl.bindBuffer( gl.ARRAY_BUFFER, pointLightSphereVertexColorBuffer );
    gl.vertexAttribPointer( shaderProgram.vertexColorAttribute,    pointLightSphereVertexColorBuffer.itemSize,    gl.FLOAT, false, 0, 0 );

    setMatrixUniforms( );

    gl.drawArrays( gl.TRIANGLES, 0, pointLightSphereVertexPositionBuffer.numItems );

    mvPopMatrix( );

    use_lighting = 1;

  }

  // Move down the negative z-axis by 25 units.

  mat4.translate( mvMatrix, mvMatrix, [ 0.0, 0.0, -25.0 ] );

  // Save the model view matrix state.

  mvPushMatrix( );

  // Use lighting if enabled.

  gl.uniform1i( shaderProgram.useLightingUniform, Number(use_lighting) );

  // If normal map is enabled.

  gl.uniform1i( shaderProgram.normalMapEnabled, normal_map );

  // Second isosurface.

  // Scale up the surface in all dimensions.

  mat4.scale(  mvMatrix, mvMatrix, [ 5.0, 5.0, 5.0 ] );

  // Rotate around the y-axis.

  mat4.rotate( mvMatrix, mvMatrix, -rotation_radians, [ 0, 1, 0 ] );

  gl.bindBuffer( gl.ARRAY_BUFFER, isosurface1VertexPositionBuffer );
  gl.vertexAttribPointer( shaderProgram.vertexPositionAttribute, isosurface1VertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0 );

  gl.bindBuffer( gl.ARRAY_BUFFER, isosurface1VertexNormalBuffer );
  gl.vertexAttribPointer( shaderProgram.vertexNormalAttribute,   isosurface1VertexNormalBuffer.itemSize,   gl.FLOAT, false, 0, 0 );

  gl.bindBuffer( gl.ARRAY_BUFFER, isosurface1VertexColorBuffer );
  gl.vertexAttribPointer( shaderProgram.vertexColorAttribute,    isosurface1VertexColorBuffer.itemSize,    gl.FLOAT, false, 0, 0 );

  setMatrixUniforms( );

  if ( Number(use_wireframe) === 0 )
  {

    gl.drawArrays( gl.TRIANGLES, 0, isosurface1VertexPositionBuffer.numItems );

  }
  else
  {

    gl.drawArrays( gl.LINES,     0, isosurface1VertexPositionBuffer.numItems );

  }

  // Restore the model view matrix state.

  mvPopMatrix( );

  // Enable alpha blending.

  gl.blendFunc( gl.ONE, gl.ONE_MINUS_SRC_ALPHA );

  gl.enable( gl.BLEND );

  alpha_blending_enabled = 1;

  gl.uniform1i( shaderProgram.alphaBlendingEnabled, alpha_blending_enabled );

  // Save the current model view matrix for later use.

  mvPushMatrix( );

  // First isosurface.

  mat4.scale(  mvMatrix, mvMatrix, [ 11.0, 11.0, 11.0 ] );

  // Rotate the model view matrix thereby rotating the isosurface.

  mat4.rotate( mvMatrix, mvMatrix,  rotation_radians, [ 1, 1, 0 ] );

  // Pass to the vertex shader the isosurface data.

  gl.bindBuffer( gl.ARRAY_BUFFER, isosurfaceVertexPositionBuffer );
  gl.vertexAttribPointer( shaderProgram.vertexPositionAttribute, isosurfaceVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0 );

  gl.bindBuffer( gl.ARRAY_BUFFER, isosurfaceVertexNormalBuffer   );
  gl.vertexAttribPointer( shaderProgram.vertexNormalAttribute,   isosurfaceVertexNormalBuffer.itemSize,   gl.FLOAT, false, 0, 0 );

  gl.bindBuffer( gl.ARRAY_BUFFER, isosurfaceVertexColorBuffer    );
  gl.vertexAttribPointer( shaderProgram.vertexColorAttribute,    isosurfaceVertexColorBuffer.itemSize,    gl.FLOAT, false, 0, 0 );

  setMatrixUniforms( );

  // Render the isosurface to the screen.

  if ( Number(use_wireframe) === 0 )
  {

    gl.drawArrays( gl.TRIANGLES, 0, isosurfaceVertexPositionBuffer.numItems );

  }
  else
  {

    gl.drawArrays( gl.LINES,     0, isosurfaceVertexPositionBuffer.numItems );

  }

  // Get back the old model view matrix.

  mvPopMatrix( );

}

function resize_contents( )
{

  // The browser window has been re-sized so re-size the render window and onscreen elements.

  var logo_image      = document.getElementById( "logo" );
  logo_image_height   = logo_image.clientHeight;
  logo_image_width    = logo_image.clientWidth;

  var logo_box        = document.getElementById( "logo_box" );
  logo_box.style.top  = window.innerHeight - logo_image_height - 10 + "px";
  logo_box.style.left = window.innerWidth  - logo_image_width  - 10 + "px";

  var canvas    = document.getElementById( "webgl_canvas" );
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  gl.viewportWidth  = canvas.width;
  gl.viewportHeight = canvas.height;

}

function webGLStart( )
{

  // Create and add the canvas that will be "painted" on or rather rendered to by WebGL.

  var canvas    = document.createElement( "canvas" );
  canvas.id     = "webgl_canvas";
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild( canvas );

  // Vertex shader GLSL code.

  var vertex_shader = document.createElement( "script" );
  vertex_shader.id = "shader-vs";
  vertex_shader.type = "x-shader/x-vertex";
  vertex_shader.innerHTML   = "precision mediump float;";
  vertex_shader.innerHTML  += "attribute vec3 aVertexPosition;";
  vertex_shader.innerHTML  += "attribute vec3 aVertexNormal;";
  vertex_shader.innerHTML  += "attribute vec4 aVertexColor;";
  vertex_shader.innerHTML  += "uniform mat4 uMVMatrix;";
  vertex_shader.innerHTML  += "uniform mat4 uPMatrix;";
  vertex_shader.innerHTML  += "uniform mat3 uNMatrix;";
  vertex_shader.innerHTML  += "varying vec4 vPosition;";
  vertex_shader.innerHTML  += "varying vec4 vDiffuseColor;";
  vertex_shader.innerHTML  += "varying vec3 vTransformedNormal;";
  vertex_shader.innerHTML  += "void main( void ) {";
  vertex_shader.innerHTML  += "     vDiffuseColor      = aVertexColor;";
  vertex_shader.innerHTML  += "     vTransformedNormal = uNMatrix * aVertexNormal;";
  vertex_shader.innerHTML  += "     vPosition          = uMVMatrix * vec4( aVertexPosition, 1.0 );";
  vertex_shader.innerHTML  += "     gl_Position        = uPMatrix * vPosition;";
  vertex_shader.innerHTML  += "}";
  document.body.appendChild( vertex_shader );

  // Fragment shader GLSL code.

  var fragment_shader = document.createElement( "script" );
  fragment_shader.id = "shader-fs";
  fragment_shader.type = "x-shader/x-fragment";
  fragment_shader.innerHTML   = "precision mediump float;";
  fragment_shader.innerHTML  += "uniform mat4 uPMatrix;";
  fragment_shader.innerHTML  += "uniform bool uUseLighting;";
  fragment_shader.innerHTML  += "uniform bool uAlphaBlendingEnabled;";
  fragment_shader.innerHTML  += "uniform bool uShowDepth;";
  fragment_shader.innerHTML  += "uniform bool uShowNormals;";
  fragment_shader.innerHTML  += "uniform bool uShowPosition;";
  fragment_shader.innerHTML  += "uniform bool uPerspectiveProjection;";
  fragment_shader.innerHTML  += "uniform bool uNormalMap;";
  fragment_shader.innerHTML  += "uniform vec3 uAmbientColor;";
  fragment_shader.innerHTML  += "uniform vec3 uPointLightingLocation;";
  fragment_shader.innerHTML  += "uniform vec3 uPointLightingColor;";
  fragment_shader.innerHTML  += "uniform vec3 uPointLightingLocation1;";
  fragment_shader.innerHTML  += "uniform vec3 uPointLightingColor1;";
  fragment_shader.innerHTML  += "varying vec4 vPosition;";
  fragment_shader.innerHTML  += "varying vec3 vTransformedNormal;";
  fragment_shader.innerHTML  += "varying vec4 vDiffuseColor;";
  fragment_shader.innerHTML  += "void main( void ) {";
  fragment_shader.innerHTML  += "     vec3 uAmbientColor         = pow(uAmbientColor,        vec3(2.2));";
  fragment_shader.innerHTML  += "     vec4 vDiffuseColor         = vDiffuseColor;";
  fragment_shader.innerHTML  += "          vDiffuseColor.rgb     = pow(vDiffuseColor.rgb,    vec3(2.2));";
  fragment_shader.innerHTML  += "     vec3 uPointLightingColor   = pow(uPointLightingColor,  vec3(2.2));";
  fragment_shader.innerHTML  += "     vec3 uPointLightingColor1  = pow(uPointLightingColor1, vec3(2.2));";
  fragment_shader.innerHTML  += "     vec4 fog_color             = vec4( " + base_color[ 0 ] + ", " + base_color[ 1 ] + ", " + base_color[ 2 ] + ", 1.0 );";
  fragment_shader.innerHTML  += "          fog_color.rgb         = pow(fog_color.rgb, vec3(2.2));";
  fragment_shader.innerHTML  += "     vec3 ambient               = vDiffuseColor.rgb * uAmbientColor;";
  fragment_shader.innerHTML  += "     vec3 color                 = ambient;";
  fragment_shader.innerHTML  += "     if ( uUseLighting ) {";
  fragment_shader.innerHTML  += "          vec3 light_direction  =  normalize( uPointLightingLocation  - vPosition.xyz );";
  fragment_shader.innerHTML  += "          vec3 light_direction1 =  normalize( uPointLightingLocation1 - vPosition.xyz );";
  fragment_shader.innerHTML  += "          vec3 eye_direction    = -normalize( vPosition.xyz );";
  fragment_shader.innerHTML  += "          vec3 half_vector      =  normalize(light_direction  + eye_direction);";
  fragment_shader.innerHTML  += "          vec3 half_vector1     =  normalize(light_direction1 + eye_direction);";
  fragment_shader.innerHTML  += "          vec3 surface_normal;";
  fragment_shader.innerHTML  += "          if ( gl_FrontFacing ) {";
  fragment_shader.innerHTML  += "               surface_normal   =  normalize( vTransformedNormal );";
  fragment_shader.innerHTML  += "          }";
  fragment_shader.innerHTML  += "          else {";
  fragment_shader.innerHTML  += "               surface_normal   = -normalize( vTransformedNormal );";
  fragment_shader.innerHTML  += "          }";
  fragment_shader.innerHTML  += "          if ( uNormalMap ) {";
  fragment_shader.innerHTML  += "               surface_normal   = normalize( surface_normal - ( sin( dot( vDiffuseColor.rgb, vec3( 12.9898, 78.233, 1.0 ) ) ) ) );";
  fragment_shader.innerHTML  += "          }";
  fragment_shader.innerHTML  += "          vec3 diffuse   = vDiffuseColor.rgb * uPointLightingColor  * max( dot( surface_normal, light_direction  ), 0.0 );";
  fragment_shader.innerHTML  += "          vec3 diffuse1  = vDiffuseColor.rgb * uPointLightingColor1 * max( dot( surface_normal, light_direction1 ), 0.0 );";
  fragment_shader.innerHTML  += "          vec3 specular  = uPointLightingColor  * pow( max( dot( half_vector,  surface_normal ), 0.0 ), 100.0 );";
  fragment_shader.innerHTML  += "          vec3 specular1 = uPointLightingColor1 * pow( max( dot( half_vector1, surface_normal ), 0.0 ), 100.0 );";
  fragment_shader.innerHTML  += "          float light_outer_radius  = 20.0;";
  fragment_shader.innerHTML  += "          float light_inner_radius  = 0.0;";
  fragment_shader.innerHTML  += "          float light_outer_radius1 = 10.0;";
  fragment_shader.innerHTML  += "          float light_inner_radius1 = 0.0;";
  fragment_shader.innerHTML  += "          float light_distance  = length( vPosition.xyz - uPointLightingLocation  );";
  fragment_shader.innerHTML  += "          float light_distance1 = length( vPosition.xyz - uPointLightingLocation1 );";
  fragment_shader.innerHTML  += "          float attenuation     = 1.0 - smoothstep( light_inner_radius,  light_outer_radius,  light_distance  );";
  fragment_shader.innerHTML  += "          float attenuation1    = 1.0 - smoothstep( light_inner_radius1, light_outer_radius1, light_distance1 );";
  fragment_shader.innerHTML  += "          diffuse   = attenuation  * diffuse;";
  fragment_shader.innerHTML  += "          diffuse1  = attenuation1 * diffuse1;";
  fragment_shader.innerHTML  += "          specular  = attenuation  * specular;";
  fragment_shader.innerHTML  += "          specular1 = attenuation1 * specular1;";
  fragment_shader.innerHTML  += "          color     = ambient + diffuse + diffuse1 + specular + specular1;";
  fragment_shader.innerHTML  += "     }";
  fragment_shader.innerHTML  += "     vec4 final_color;";
  fragment_shader.innerHTML  += "     if ( uAlphaBlendingEnabled ) {";
  fragment_shader.innerHTML  += "          final_color    = vec4( color, vDiffuseColor.a );";
  fragment_shader.innerHTML  += "     }";
  fragment_shader.innerHTML  += "     else {";
  fragment_shader.innerHTML  += "          final_color    = vec4( color, 1.0             );";
  fragment_shader.innerHTML  += "     }";
  fragment_shader.innerHTML  += "     float far           = 50.0;";
  fragment_shader.innerHTML  += "     float fog_coord;";
  fragment_shader.innerHTML  += "     if ( uPerspectiveProjection ) {";
  fragment_shader.innerHTML  += "          fog_coord      = ( gl_FragCoord.z / gl_FragCoord.w ) / far;";
  fragment_shader.innerHTML  += "     }";
  fragment_shader.innerHTML  += "     else {";
  fragment_shader.innerHTML  += "          fog_coord      = ( gl_FragCoord.z / gl_FragCoord.w );";
  fragment_shader.innerHTML  += "     }";
  fragment_shader.innerHTML  += "     float fog_density   = 1.5;";
  fragment_shader.innerHTML  += "     float fog           = fog_coord * fog_density;";
  fragment_shader.innerHTML  += "     float fog_factor    = clamp( 1.0 - fog, 0.0, 1.0 );";
  fragment_shader.innerHTML  += "     gl_FragColor        = mix( fog_color, final_color, vec4( fog_factor, fog_factor, fog_factor, fog_factor ) );";
  fragment_shader.innerHTML  += "     gl_FragColor.rgb    = pow(gl_FragColor.rgb, vec3(1.0 / 2.2));";
  fragment_shader.innerHTML  += "     if ( uShowDepth ) {";
  fragment_shader.innerHTML  += "          gl_FragColor   = mix( vec4( 1.0 ), vec4( vec3( 0.0 ), 1.0 ), smoothstep( 0.1, 1.0, fog_coord ) );";
  fragment_shader.innerHTML  += "     }";
  fragment_shader.innerHTML  += "     if ( uShowNormals ) {";
  fragment_shader.innerHTML  += "          vec3 nTN       = normalize( vTransformedNormal );";
  fragment_shader.innerHTML  += "          gl_FragColor   = vec4( nTN.r, nTN.g, nTN.b, 1.0 );";
  fragment_shader.innerHTML  += "     }";
  fragment_shader.innerHTML  += "     if ( uShowPosition ) {";
  fragment_shader.innerHTML  += "          vec3 nP        = normalize( vPosition.xyz );";
  fragment_shader.innerHTML  += "          gl_FragColor   = vec4( nP.r, nP.g, nP.b, 1.0 );";
  fragment_shader.innerHTML  += "     }";
  fragment_shader.innerHTML  += "}";
  document.body.appendChild( fragment_shader );

  initGL( canvas ); // Initialize WebGL.
  initShaders( );   // Initialize the shaders.
  initBuffers( );   // Initialize the 3D shapes.
  initHUD( );       // Initialize the onscreen elements.

  gl.clearColor( base_color[ 0 ], base_color[ 1 ], base_color[ 2 ], 1.0 ); // Set the WebGL background color.
  gl.enable( gl.DEPTH_TEST ); // Enable the depth buffer.

  window.requestAnimationFrame( drawScene ); // Begin rendering animation.

}

/* Taken from http://paulbourke.net/geometry/polygonise/ */

var marching_cubes_edge_table = [

  0x0  , 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c,
  0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00,
  0x190, 0x99 , 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c,
  0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90,
  0x230, 0x339, 0x33 , 0x13a, 0x636, 0x73f, 0x435, 0x53c,
  0xa3c, 0xb35, 0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30,
  0x3a0, 0x2a9, 0x1a3, 0xaa , 0x7a6, 0x6af, 0x5a5, 0x4ac,
  0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0,
  0x460, 0x569, 0x663, 0x76a, 0x66 , 0x16f, 0x265, 0x36c,
  0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60,
  0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0xff , 0x3f5, 0x2fc,
  0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0,
  0x650, 0x759, 0x453, 0x55a, 0x256, 0x35f, 0x55 , 0x15c,
  0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950,
  0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0xcc ,
  0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0,
  0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc,
  0xcc , 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9, 0x7c0,
  0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c,
  0x15c, 0x55 , 0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650,
  0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcf5, 0xdfc,
  0x2fc, 0x3f5, 0xff , 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0,
  0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c,
  0x36c, 0x265, 0x16f, 0x66 , 0x76a, 0x663, 0x569, 0x460,
  0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af, 0xaa5, 0xbac,
  0x4ac, 0x5a5, 0x6af, 0x7a6, 0xaa , 0x1a3, 0x2a9, 0x3a0,
  0xd30, 0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c,
  0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x33 , 0x339, 0x230,
  0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c,
  0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x99 , 0x190,
  0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c,
  0x70c, 0x605, 0x50f, 0x406, 0x30a, 0x203, 0x109, 0x0

];

var marching_cubes_triangle_table =  [

  [ -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 1, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 8, 3, 9, 8, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 8, 3, 1, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 2, 10, 0, 2, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  2, 8, 3, 2, 10, 8, 10, 9, 8, -1, -1, -1, -1, -1, -1, -1 ],
  [  3, 11, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 11, 2, 8, 11, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 9, 0, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 11, 2, 1, 9, 11, 9, 8, 11, -1, -1, -1, -1, -1, -1, -1 ],
  [  3, 10, 1, 11, 10, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 10, 1, 0, 8, 10, 8, 11, 10, -1, -1, -1, -1, -1, -1, -1 ],
  [  3, 9, 0, 3, 11, 9, 11, 10, 9, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 8, 10, 10, 8, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  4, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  4, 3, 0, 7, 3, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 1, 9, 8, 4, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  4, 1, 9, 4, 7, 1, 7, 3, 1, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 2, 10, 8, 4, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  3, 4, 7, 3, 0, 4, 1, 2, 10, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 2, 10, 9, 0, 2, 8, 4, 7, -1, -1, -1, -1, -1, -1, -1 ],
  [  2, 10, 9, 2, 9, 7, 2, 7, 3, 7, 9, 4, -1, -1, -1, -1 ],
  [  8, 4, 7, 3, 11, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  11, 4, 7, 11, 2, 4, 2, 0, 4, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 0, 1, 8, 4, 7, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1 ],
  [  4, 7, 11, 9, 4, 11, 9, 11, 2, 9, 2, 1, -1, -1, -1, -1 ],
  [  3, 10, 1, 3, 11, 10, 7, 8, 4, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 11, 10, 1, 4, 11, 1, 0, 4, 7, 11, 4, -1, -1, -1, -1 ],
  [  4, 7, 8, 9, 0, 11, 9, 11, 10, 11, 0, 3, -1, -1, -1, -1 ],
  [  4, 7, 11, 4, 11, 9, 9, 11, 10, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 5, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 5, 4, 0, 8, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 5, 4, 1, 5, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  8, 5, 4, 8, 3, 5, 3, 1, 5, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 2, 10, 9, 5, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  3, 0, 8, 1, 2, 10, 4, 9, 5, -1, -1, -1, -1, -1, -1, -1 ],
  [  5, 2, 10, 5, 4, 2, 4, 0, 2, -1, -1, -1, -1, -1, -1, -1 ],
  [  2, 10, 5, 3, 2, 5, 3, 5, 4, 3, 4, 8, -1, -1, -1, -1 ],
  [  9, 5, 4, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 11, 2, 0, 8, 11, 4, 9, 5, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 5, 4, 0, 1, 5, 2, 3, 11, -1, -1, -1, -1, -1, -1, -1 ],
  [  2, 1, 5, 2, 5, 8, 2, 8, 11, 4, 8, 5, -1, -1, -1, -1 ],
  [ 10, 3, 11, 10, 1, 3, 9, 5, 4, -1, -1, -1, -1, -1, -1, -1 ],
  [  4, 9, 5, 0, 8, 1, 8, 10, 1, 8, 11, 10, -1, -1, -1, -1 ],
  [  5, 4, 0, 5, 0, 11, 5, 11, 10, 11, 0, 3, -1, -1, -1, -1 ],
  [  5, 4, 8, 5, 8, 10, 10, 8, 11, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 7, 8, 5, 7, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 3, 0, 9, 5, 3, 5, 7, 3, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 7, 8, 0, 1, 7, 1, 5, 7, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 5, 3, 3, 5, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 7, 8, 9, 5, 7, 10, 1, 2, -1, -1, -1, -1, -1, -1, -1 ],
  [ 10, 1, 2, 9, 5, 0, 5, 3, 0, 5, 7, 3, -1, -1, -1, -1 ],
  [  8, 0, 2, 8, 2, 5, 8, 5, 7, 10, 5, 2, -1, -1, -1, -1 ],
  [  2, 10, 5, 2, 5, 3, 3, 5, 7, -1, -1, -1, -1, -1, -1, -1 ],
  [  7, 9, 5, 7, 8, 9, 3, 11, 2, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 5, 7, 9, 7, 2, 9, 2, 0, 2, 7, 11, -1, -1, -1, -1 ],
  [  2, 3, 11, 0, 1, 8, 1, 7, 8, 1, 5, 7, -1, -1, -1, -1 ],
  [ 11, 2, 1, 11, 1, 7, 7, 1, 5, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 5, 8, 8, 5, 7, 10, 1, 3, 10, 3, 11, -1, -1, -1, -1 ],
  [  5, 7, 0, 5, 0, 9, 7, 11, 0, 1, 0, 10, 11, 10, 0, -1 ],
  [ 11, 10, 0, 11, 0, 3, 10, 5, 0, 8, 0, 7, 5, 7, 0, -1 ],
  [ 11, 10, 5, 7, 11, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [ 10, 6, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 8, 3, 5, 10, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 0, 1, 5, 10, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 8, 3, 1, 9, 8, 5, 10, 6, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 6, 5, 2, 6, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 6, 5, 1, 2, 6, 3, 0, 8, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 6, 5, 9, 0, 6, 0, 2, 6, -1, -1, -1, -1, -1, -1, -1 ],
  [  5, 9, 8, 5, 8, 2, 5, 2, 6, 3, 2, 8, -1, -1, -1, -1 ],
  [  2, 3, 11, 10, 6, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [ 11, 0, 8, 11, 2, 0, 10, 6, 5, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 1, 9, 2, 3, 11, 5, 10, 6, -1, -1, -1, -1, -1, -1, -1 ],
  [  5, 10, 6, 1, 9, 2, 9, 11, 2, 9, 8, 11, -1, -1, -1, -1 ],
  [  6, 3, 11, 6, 5, 3, 5, 1, 3, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 8, 11, 0, 11, 5, 0, 5, 1, 5, 11, 6, -1, -1, -1, -1 ],
  [  3, 11, 6, 0, 3, 6, 0, 6, 5, 0, 5, 9, -1, -1, -1, -1 ],
  [  6, 5, 9, 6, 9, 11, 11, 9, 8, -1, -1, -1, -1, -1, -1, -1 ],
  [  5, 10, 6, 4, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  4, 3, 0, 4, 7, 3, 6, 5, 10, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 9, 0, 5, 10, 6, 8, 4, 7, -1, -1, -1, -1, -1, -1, -1 ],
  [ 10, 6, 5, 1, 9, 7, 1, 7, 3, 7, 9, 4, -1, -1, -1, -1 ],
  [  6, 1, 2, 6, 5, 1, 4, 7, 8, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 2, 5, 5, 2, 6, 3, 0, 4, 3, 4, 7, -1, -1, -1, -1 ],
  [  8, 4, 7, 9, 0, 5, 0, 6, 5, 0, 2, 6, -1, -1, -1, -1 ],
  [  7, 3, 9, 7, 9, 4, 3, 2, 9, 5, 9, 6, 2, 6, 9, -1 ],
  [  3, 11, 2, 7, 8, 4, 10, 6, 5, -1, -1, -1, -1, -1, -1, -1 ],
  [  5, 10, 6, 4, 7, 2, 4, 2, 0, 2, 7, 11, -1, -1, -1, -1 ],
  [  0, 1, 9, 4, 7, 8, 2, 3, 11, 5, 10, 6, -1, -1, -1, -1 ],
  [  9, 2, 1, 9, 11, 2, 9, 4, 11, 7, 11, 4, 5, 10, 6, -1 ],
  [  8, 4, 7, 3, 11, 5, 3, 5, 1, 5, 11, 6, -1, -1, -1, -1 ],
  [  5, 1, 11, 5, 11, 6, 1, 0, 11, 7, 11, 4, 0, 4, 11, -1 ],
  [  0, 5, 9, 0, 6, 5, 0, 3, 6, 11, 6, 3, 8, 4, 7, -1 ],
  [  6, 5, 9, 6, 9, 11, 4, 7, 9, 7, 11, 9, -1, -1, -1, -1 ],
  [ 10, 4, 9, 6, 4, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  4, 10, 6, 4, 9, 10, 0, 8, 3, -1, -1, -1, -1, -1, -1, -1 ],
  [ 10, 0, 1, 10, 6, 0, 6, 4, 0, -1, -1, -1, -1, -1, -1, -1 ],
  [  8, 3, 1, 8, 1, 6, 8, 6, 4, 6, 1, 10, -1, -1, -1, -1 ],
  [  1, 4, 9, 1, 2, 4, 2, 6, 4, -1, -1, -1, -1, -1, -1, -1 ],
  [  3, 0, 8, 1, 2, 9, 2, 4, 9, 2, 6, 4, -1, -1, -1, -1 ],
  [  0, 2, 4, 4, 2, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  8, 3, 2, 8, 2, 4, 4, 2, 6, -1, -1, -1, -1, -1, -1, -1 ],
  [ 10, 4, 9, 10, 6, 4, 11, 2, 3, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 8, 2, 2, 8, 11, 4, 9, 10, 4, 10, 6, -1, -1, -1, -1 ],
  [  3, 11, 2, 0, 1, 6, 0, 6, 4, 6, 1, 10, -1, -1, -1, -1 ],
  [  6, 4, 1, 6, 1, 10, 4, 8, 1, 2, 1, 11, 8, 11, 1, -1 ],
  [  9, 6, 4, 9, 3, 6, 9, 1, 3, 11, 6, 3, -1, -1, -1, -1 ],
  [  8, 11, 1, 8, 1, 0, 11, 6, 1, 9, 1, 4, 6, 4, 1, -1 ],
  [  3, 11, 6, 3, 6, 0, 0, 6, 4, -1, -1, -1, -1, -1, -1, -1 ],
  [  6, 4, 8, 11, 6, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  7, 10, 6, 7, 8, 10, 8, 9, 10, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 7, 3, 0, 10, 7, 0, 9, 10, 6, 7, 10, -1, -1, -1, -1 ],
  [ 10, 6, 7, 1, 10, 7, 1, 7, 8, 1, 8, 0, -1, -1, -1, -1 ],
  [ 10, 6, 7, 10, 7, 1, 1, 7, 3, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 2, 6, 1, 6, 8, 1, 8, 9, 8, 6, 7, -1, -1, -1, -1 ],
  [  2, 6, 9, 2, 9, 1, 6, 7, 9, 0, 9, 3, 7, 3, 9, -1 ],
  [  7, 8, 0, 7, 0, 6, 6, 0, 2, -1, -1, -1, -1, -1, -1, -1 ],
  [  7, 3, 2, 6, 7, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  2, 3, 11, 10, 6, 8, 10, 8, 9, 8, 6, 7, -1, -1, -1, -1 ],
  [  2, 0, 7, 2, 7, 11, 0, 9, 7, 6, 7, 10, 9, 10, 7, -1 ],
  [  1, 8, 0, 1, 7, 8, 1, 10, 7, 6, 7, 10, 2, 3, 11, -1 ],
  [ 11, 2, 1, 11, 1, 7, 10, 6, 1, 6, 7, 1, -1, -1, -1, -1 ],
  [  8, 9, 6, 8, 6, 7, 9, 1, 6, 11, 6, 3, 1, 3, 6, -1 ],
  [  0, 9, 1, 11, 6, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  7, 8, 0, 7, 0, 6, 3, 11, 0, 11, 6, 0, -1, -1, -1, -1 ],
  [  7, 11, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  7, 6, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  3, 0, 8, 11, 7, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 1, 9, 11, 7, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  8, 1, 9, 8, 3, 1, 11, 7, 6, -1, -1, -1, -1, -1, -1, -1 ],
  [ 10, 1, 2, 6, 11, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 2, 10, 3, 0, 8, 6, 11, 7, -1, -1, -1, -1, -1, -1, -1 ],
  [  2, 9, 0, 2, 10, 9, 6, 11, 7, -1, -1, -1, -1, -1, -1, -1 ],
  [  6, 11, 7, 2, 10, 3, 10, 8, 3, 10, 9, 8, -1, -1, -1, -1 ],
  [  7, 2, 3, 6, 2, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  7, 0, 8, 7, 6, 0, 6, 2, 0, -1, -1, -1, -1, -1, -1, -1 ],
  [  2, 7, 6, 2, 3, 7, 0, 1, 9, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 6, 2, 1, 8, 6, 1, 9, 8, 8, 7, 6, -1, -1, -1, -1 ],
  [ 10, 7, 6, 10, 1, 7, 1, 3, 7, -1, -1, -1, -1, -1, -1, -1 ],
  [ 10, 7, 6, 1, 7, 10, 1, 8, 7, 1, 0, 8, -1, -1, -1, -1 ],
  [  0, 3, 7, 0, 7, 10, 0, 10, 9, 6, 10, 7, -1, -1, -1, -1 ],
  [  7, 6, 10, 7, 10, 8, 8, 10, 9, -1, -1, -1, -1, -1, -1, -1 ],
  [  6, 8, 4, 11, 8, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  3, 6, 11, 3, 0, 6, 0, 4, 6, -1, -1, -1, -1, -1, -1, -1 ],
  [  8, 6, 11, 8, 4, 6, 9, 0, 1, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 4, 6, 9, 6, 3, 9, 3, 1, 11, 3, 6, -1, -1, -1, -1 ],
  [  6, 8, 4, 6, 11, 8, 2, 10, 1, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 2, 10, 3, 0, 11, 0, 6, 11, 0, 4, 6, -1, -1, -1, -1 ],
  [  4, 11, 8, 4, 6, 11, 0, 2, 9, 2, 10, 9, -1, -1, -1, -1 ],
  [ 10, 9, 3, 10, 3, 2, 9, 4, 3, 11, 3, 6, 4, 6, 3, -1 ],
  [  8, 2, 3, 8, 4, 2, 4, 6, 2, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 4, 2, 4, 6, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 9, 0, 2, 3, 4, 2, 4, 6, 4, 3, 8, -1, -1, -1, -1 ],
  [  1, 9, 4, 1, 4, 2, 2, 4, 6, -1, -1, -1, -1, -1, -1, -1 ],
  [  8, 1, 3, 8, 6, 1, 8, 4, 6, 6, 10, 1, -1, -1, -1, -1 ],
  [ 10, 1, 0, 10, 0, 6, 6, 0, 4, -1, -1, -1, -1, -1, -1, -1 ],
  [  4, 6, 3, 4, 3, 8, 6, 10, 3, 0, 3, 9, 10, 9, 3, -1 ],
  [ 10, 9, 4, 6, 10, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  4, 9, 5, 7, 6, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 8, 3, 4, 9, 5, 11, 7, 6, -1, -1, -1, -1, -1, -1, -1 ],
  [  5, 0, 1, 5, 4, 0, 7, 6, 11, -1, -1, -1, -1, -1, -1, -1 ],
  [ 11, 7, 6, 8, 3, 4, 3, 5, 4, 3, 1, 5, -1, -1, -1, -1 ],
  [  9, 5, 4, 10, 1, 2, 7, 6, 11, -1, -1, -1, -1, -1, -1, -1 ],
  [  6, 11, 7, 1, 2, 10, 0, 8, 3, 4, 9, 5, -1, -1, -1, -1 ],
  [  7, 6, 11, 5, 4, 10, 4, 2, 10, 4, 0, 2, -1, -1, -1, -1 ],
  [  3, 4, 8, 3, 5, 4, 3, 2, 5, 10, 5, 2, 11, 7, 6, -1 ],
  [  7, 2, 3, 7, 6, 2, 5, 4, 9, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 5, 4, 0, 8, 6, 0, 6, 2, 6, 8, 7, -1, -1, -1, -1 ],
  [  3, 6, 2, 3, 7, 6, 1, 5, 0, 5, 4, 0, -1, -1, -1, -1 ],
  [  6, 2, 8, 6, 8, 7, 2, 1, 8, 4, 8, 5, 1, 5, 8, -1 ],
  [  9, 5, 4, 10, 1, 6, 1, 7, 6, 1, 3, 7, -1, -1, -1, -1 ],
  [  1, 6, 10, 1, 7, 6, 1, 0, 7, 8, 7, 0, 9, 5, 4, -1 ],
  [  4, 0, 10, 4, 10, 5, 0, 3, 10, 6, 10, 7, 3, 7, 10, -1 ],
  [  7, 6, 10, 7, 10, 8, 5, 4, 10, 4, 8, 10, -1, -1, -1, -1 ],
  [  6, 9, 5, 6, 11, 9, 11, 8, 9, -1, -1, -1, -1, -1, -1, -1 ],
  [  3, 6, 11, 0, 6, 3, 0, 5, 6, 0, 9, 5, -1, -1, -1, -1 ],
  [  0, 11, 8, 0, 5, 11, 0, 1, 5, 5, 6, 11, -1, -1, -1, -1 ],
  [  6, 11, 3, 6, 3, 5, 5, 3, 1, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 2, 10, 9, 5, 11, 9, 11, 8, 11, 5, 6, -1, -1, -1, -1 ],
  [  0, 11, 3, 0, 6, 11, 0, 9, 6, 5, 6, 9, 1, 2, 10, -1 ],
  [ 11, 8, 5, 11, 5, 6, 8, 0, 5, 10, 5, 2, 0, 2, 5, -1 ],
  [  6, 11, 3, 6, 3, 5, 2, 10, 3, 10, 5, 3, -1, -1, -1, -1 ],
  [  5, 8, 9, 5, 2, 8, 5, 6, 2, 3, 8, 2, -1, -1, -1, -1 ],
  [  9, 5, 6, 9, 6, 0, 0, 6, 2, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 5, 8, 1, 8, 0, 5, 6, 8, 3, 8, 2, 6, 2, 8, -1 ],
  [  1, 5, 6, 2, 1, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 3, 6, 1, 6, 10, 3, 8, 6, 5, 6, 9, 8, 9, 6, -1 ],
  [ 10, 1, 0, 10, 0, 6, 9, 5, 0, 5, 6, 0, -1, -1, -1, -1 ],
  [  0, 3, 8, 5, 6, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [ 10, 5, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [ 11, 5, 10, 7, 5, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [ 11, 5, 10, 11, 7, 5, 8, 3, 0, -1, -1, -1, -1, -1, -1, -1 ],
  [  5, 11, 7, 5, 10, 11, 1, 9, 0, -1, -1, -1, -1, -1, -1, -1 ],
  [ 10, 7, 5, 10, 11, 7, 9, 8, 1, 8, 3, 1, -1, -1, -1, -1 ],
  [ 11, 1, 2, 11, 7, 1, 7, 5, 1, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 8, 3, 1, 2, 7, 1, 7, 5, 7, 2, 11, -1, -1, -1, -1 ],
  [  9, 7, 5, 9, 2, 7, 9, 0, 2, 2, 11, 7, -1, -1, -1, -1 ],
  [  7, 5, 2, 7, 2, 11, 5, 9, 2, 3, 2, 8, 9, 8, 2, -1 ],
  [  2, 5, 10, 2, 3, 5, 3, 7, 5, -1, -1, -1, -1, -1, -1, -1 ],
  [  8, 2, 0, 8, 5, 2, 8, 7, 5, 10, 2, 5, -1, -1, -1, -1 ],
  [  9, 0, 1, 5, 10, 3, 5, 3, 7, 3, 10, 2, -1, -1, -1, -1 ],
  [  9, 8, 2, 9, 2, 1, 8, 7, 2, 10, 2, 5, 7, 5, 2, -1 ],
  [  1, 3, 5, 3, 7, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 8, 7, 0, 7, 1, 1, 7, 5, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 0, 3, 9, 3, 5, 5, 3, 7, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 8, 7, 5, 9, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  5, 8, 4, 5, 10, 8, 10, 11, 8, -1, -1, -1, -1, -1, -1, -1 ],
  [  5, 0, 4, 5, 11, 0, 5, 10, 11, 11, 3, 0, -1, -1, -1, -1 ],
  [  0, 1, 9, 8, 4, 10, 8, 10, 11, 10, 4, 5, -1, -1, -1, -1 ],
  [ 10, 11, 4, 10, 4, 5, 11, 3, 4, 9, 4, 1, 3, 1, 4, -1 ],
  [  2, 5, 1, 2, 8, 5, 2, 11, 8, 4, 5, 8, -1, -1, -1, -1 ],
  [  0, 4, 11, 0, 11, 3, 4, 5, 11, 2, 11, 1, 5, 1, 11, -1 ],
  [  0, 2, 5, 0, 5, 9, 2, 11, 5, 4, 5, 8, 11, 8, 5, -1 ],
  [  9, 4, 5, 2, 11, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  2, 5, 10, 3, 5, 2, 3, 4, 5, 3, 8, 4, -1, -1, -1, -1 ],
  [  5, 10, 2, 5, 2, 4, 4, 2, 0, -1, -1, -1, -1, -1, -1, -1 ],
  [  3, 10, 2, 3, 5, 10, 3, 8, 5, 4, 5, 8, 0, 1, 9, -1 ],
  [  5, 10, 2, 5, 2, 4, 1, 9, 2, 9, 4, 2, -1, -1, -1, -1 ],
  [  8, 4, 5, 8, 5, 3, 3, 5, 1, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 4, 5, 1, 0, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  8, 4, 5, 8, 5, 3, 9, 0, 5, 0, 3, 5, -1, -1, -1, -1 ],
  [  9, 4, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  4, 11, 7, 4, 9, 11, 9, 10, 11, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 8, 3, 4, 9, 7, 9, 11, 7, 9, 10, 11, -1, -1, -1, -1 ],
  [  1, 10, 11, 1, 11, 4, 1, 4, 0, 7, 4, 11, -1, -1, -1, -1 ],
  [  3, 1, 4, 3, 4, 8, 1, 10, 4, 7, 4, 11, 10, 11, 4, -1 ],
  [  4, 11, 7, 9, 11, 4, 9, 2, 11, 9, 1, 2, -1, -1, -1, -1 ],
  [  9, 7, 4, 9, 11, 7, 9, 1, 11, 2, 11, 1, 0, 8, 3, -1 ],
  [ 11, 7, 4, 11, 4, 2, 2, 4, 0, -1, -1, -1, -1, -1, -1, -1 ],
  [ 11, 7, 4, 11, 4, 2, 8, 3, 4, 3, 2, 4, -1, -1, -1, -1 ],
  [  2, 9, 10, 2, 7, 9, 2, 3, 7, 7, 4, 9, -1, -1, -1, -1 ],
  [  9, 10, 7, 9, 7, 4, 10, 2, 7, 8, 7, 0, 2, 0, 7, -1 ],
  [  3, 7, 10, 3, 10, 2, 7, 4, 10, 1, 10, 0, 4, 0, 10, -1 ],
  [  1, 10, 2, 8, 7, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  4, 9, 1, 4, 1, 7, 7, 1, 3, -1, -1, -1, -1, -1, -1, -1 ],
  [  4, 9, 1, 4, 1, 7, 0, 8, 1, 8, 7, 1, -1, -1, -1, -1 ],
  [  4, 0, 3, 7, 4, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  4, 8, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  9, 10, 8, 10, 11, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  3, 0, 9, 3, 9, 11, 11, 9, 10, -1, -1, -1, -1, -1, -1, -1 ],
  [  0, 1, 10, 0, 10, 8, 8, 10, 11, -1, -1, -1, -1, -1, -1, -1 ],
  [  3, 1, 10, 11, 3, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ],
  [  1, 2, 11, 1, 11, 9, 9, 11, 8, -1, -1, -1, -1, -1, -1, -1 ],
  [  3, 0, 9, 3, 9, 11, 1, 2, 9, 2, 11, 9, -1, -1, -1, -1          ],
  [  0, 2, 11, 8, 0, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1    ],
  [  3, 2, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1  ],
  [  2, 3, 8, 2, 8, 10, 10, 8, 9, -1, -1, -1, -1, -1, -1, -1       ],
  [  9, 10, 2, 0, 9, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1     ],
  [  2, 3, 8, 2, 8, 10, 0, 1, 8, 1, 10, 8, -1, -1, -1, -1          ],
  [  1, 10, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1  ],
  [  1, 3, 8, 9, 1, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1      ],
  [  0, 9, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1   ],
  [  0, 3, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1   ],
  [ -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ]

];
