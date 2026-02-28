import * as THREE from 'three';

/** Create a Box mesh */
export function B(
  w: number, h: number, d: number,
  color: string,
  opts: Partial<THREE.MeshPhongMaterialParameters> = {},
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshPhongMaterial({
    color: new THREE.Color(color),
    shininess: 35,
    ...opts,
  });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

/** Create a Cylinder mesh */
export function C(
  rt: number, rb: number, h: number,
  segs: number,
  color: string,
  opts: Partial<THREE.MeshPhongMaterialParameters> = {},
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(rt, rb, h, segs);
  const mat = new THREE.MeshPhongMaterial({
    color: new THREE.Color(color),
    shininess: 35,
    ...opts,
  });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

/** Add mesh to group at position / optional rotation, returns the mesh */
export function add(
  g: THREE.Group,
  m: THREE.Mesh | THREE.Group,
  x = 0, y = 0, z = 0,
  rx?: number, ry?: number, rz?: number,
): THREE.Mesh | THREE.Group {
  m.position.set(x, y, z);
  if (rx !== undefined) m.rotation.x = rx;
  if (ry !== undefined) m.rotation.y = ry;
  if (rz !== undefined) m.rotation.z = rz;
  g.add(m);
  return m;
}
