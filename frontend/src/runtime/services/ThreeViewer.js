const serviceId = 'hookup.to/service/three-viewer';
const serviceName = 'ThreeViewer';

/*
import React, { Component } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ConvexBufferGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

import ServiceUI from './ServiceUI';

class ThreeViewerUI extends Component {
  componentDidMount() {
    const { width, height } = this.getDimensions();

    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);
    this.root.appendChild(this.renderer.domElement);

    // camera
    this.camera = new THREE.PerspectiveCamera(40, width /height, 1, 1000);
    this.camera.position.set(15, 20, 30);
    this.scene.add(this.camera);
    
    const renderScene = this.renderScene.bind(this);
    // controls
    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.minDistance = 20;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 2;
    controls.addEventListener('change', renderScene);
    this.scene.add(new THREE.AmbientLight(0x222222));
    
    // light
    const light = new THREE.PointLight(0xffffff, 1);
    this.camera.add(light);

    // helper
    this.scene.add(new THREE.AxesHelper( 20 ));
    
    this.group = new THREE.Group();
    this.scene.add(this.group);
    
    // points
    const vertices = this.update();

   const points = this.createGeometry(vertices);
   this.group.add(points);
    
    const { backFaces, frontFaces } = this.createConvexHull(vertices);
    this.group.add(backFaces);
    this.group.add(frontFaces);

    this.root.addEventListener('resize', () => {
      const { width, height } = this.getDimensions();
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }, false);

    renderScene();
  }

  createGeometry = vertices => {
    const pointsGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
    const pointsMaterial = new THREE.PointsMaterial({
      color: 0x0080ff,
      size: 1,
      alphaTest: 0.5
    });
    return new THREE.Points(pointsGeometry, pointsMaterial); 
  }

  createConvexHull = vertices => {
    const meshMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      opacity: 0.5,
      transparent: true
    });
    
    const meshGeometry = new ConvexBufferGeometry(vertices);
    const backFaces = new THREE.Mesh(meshGeometry, meshMaterial);
    backFaces.material.side = THREE.BackSide; // back faces
    backFaces.renderOrder = 0;
    
    const frontFaces = new THREE.Mesh(meshGeometry, meshMaterial.clone());
    frontFaces.material.side = THREE.FrontSide; // front faces
    frontFaces.renderOrder = 1;

    return { frontFaces, backFaces };
  }

  getDimensions = () => {
    const width = 640;
    const height = 340;
    return { width, height };
  }

  renderScene = () => {
    this.renderer.render(this.scene, this.camera);
  }

  update = data => {
    const vertices = new THREE.DodecahedronGeometry(10).vertices;
    
    for ( let i = 0; i < vertices.length; i ++ ) {
      // vertices[ i ].add(randomPoint().multiplyScalar( 2 )); // wiggle the points
    }

    console.log('!!!!', vertices);
    return vertices;
  }

  render() {
    return (
      <ServiceUI  {...this.props}>
      {
        ({ service }) => (
          service && service.register(this.update) && 
            <div 
              style={{
                marginLeft: 10,
                marginRight: 10,
                marginBottom: 20
              }}
              ref={root => this.root = root} 
            />
        )
      }
      </ServiceUI>
    );
  }
}
*/
class ThreeViewer {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
    
    this.fullscreen = false;
  }

  register(callback) {
    this.callback = callback;
    return true;
  }

  configure(config) {
  }

  process(params) {
    if (this.callback) {
      this.callback(params);
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new ThreeViewer(app, board, descriptor, id),
  //createUI: ThreeViewerUI
};

export default descriptor;
