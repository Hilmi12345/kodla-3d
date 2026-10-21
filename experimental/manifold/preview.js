import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const scenes=[];
function addView(id,file,cameraPosition) {
  const host=document.getElementById(id);
  const status=document.createElement('span');status.className='view-status';status.textContent='STL yükleniyor…';host.appendChild(status);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#d9ddcf');
  scene.add(new THREE.HemisphereLight(0xffffff,0x606b56,2));
  const sun=new THREE.DirectionalLight(0xffffff,2.3);sun.position.set(45,-55,80);scene.add(sun);
  const camera=new THREE.PerspectiveCamera(38,1,.1,10000);camera.up.set(0,0,1);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(1.5);renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
  new STLLoader().loadAsync(`/experimental/manifold/outputs/${file}`).then(g=>{
    g.computeBoundingBox();const center=g.boundingBox.getCenter(new THREE.Vector3());const size=g.boundingBox.getSize(new THREE.Vector3());g.translate(-center.x,-center.y,-center.z);
    const smooth=mergeVertices(g,1e-5);smooth.computeVertexNormals();
    const mesh=new THREE.Mesh(smooth,new THREE.MeshStandardMaterial({color:0x738a5a,roughness:.63}));scene.add(mesh);
    const span=Math.max(size.x,size.y,size.z);camera.position.set(...cameraPosition).normalize().multiplyScalar(span*2.35);camera.lookAt(0,0,0);camera.near=span/1000;camera.far=span*10;camera.updateProjectionMatrix();
    status.textContent=`Yüklendi · ${Math.round(smooth.index.count/3).toLocaleString('tr-TR')} üçgen`;
  }).catch(error=>{status.classList.add('error');status.textContent=`STL yükleme/render hatası: ${error.message}`;console.error(`Preview ${id} failed`,error)});
  function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
  new ResizeObserver(resize).observe(host);resize();
  scenes.push({renderer,scene,camera});
}
addView('hard','pair-hard.stl',[1,-1.7,1.2]);
addView('soft','pair-smooth.stl',[1,-1.7,1.2]);
addView('neck','curved-neck-head.stl',[1,-1.7,1.2]);
addView('side','curved-neck-head.stl',[0,-1,.08]);
function animate(){for(const {renderer,scene,camera} of scenes)renderer.render(scene,camera);requestAnimationFrame(animate)}animate();
