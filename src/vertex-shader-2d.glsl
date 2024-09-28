attribute vec4 a_position;

varying vec4 v_xy;

void main() {
  gl_Position = a_position;
  v_xy = a_position;
}
