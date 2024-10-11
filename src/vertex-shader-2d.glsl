attribute vec4 a_position;

varying vec4 v_xy;

void main() {
  gl_Position = a_position;
  gl_Position.z = 1.0;
  v_xy = a_position;
}
