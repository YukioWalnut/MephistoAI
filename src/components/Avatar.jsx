
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

export default function Avatar({ emotion = {} }) {
  const mount = useRef(null);
  const [vrmReady, setVrmReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(
      32,
      el.clientWidth / el.clientHeight,
      0.1,
      100
    );

    // 40% larger framing: move the camera 1/1.4 of its
    // original offset from the avatar's look-at target.
    camera.position.set(0, 1.3786, 1.8);
    camera.lookAt(0, 1.2, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    el.appendChild(renderer.domElement);

    // Lighting
    scene.add(
      new THREE.HemisphereLight(0xffffff, 0x351526, 2.2)
    );

    const key = new THREE.DirectionalLight(0xffdce8, 3);
    key.position.set(2, 4, 4);
    scene.add(key);

    const rim = new THREE.PointLight(0xb51c50, 18, 8);
    rim.position.set(-2, 2, 1);
    scene.add(rim);

    // VRM loader
    const loader = new GLTFLoader();
    loader.register(
      parser => new VRMLoaderPlugin(parser)
    );

    let loadedVrm = null;
    let disposed = false;
    let frame = 0;

    const clock = new THREE.Clock();

    let bones = {};
    let baseRotations = {};

    let blinkTimer = 0;
    let nextBlink = 2.5;
    let blinkActive = false;

    // Mouse-follow target and smoothed values (normalized to the avatar stage).
    let pointerTargetX = 0;
    let pointerTargetY = 0;
    let pointerX = 0;
    let pointerY = 0;

    const onPointerMove = event => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      pointerTargetX = THREE.MathUtils.clamp(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -1,
        1
      );
      pointerTargetY = THREE.MathUtils.clamp(
        ((event.clientY - rect.top) / rect.height) * 2 - 1,
        -1,
        1
      );
    };

    const onPointerLeave = () => {
      pointerTargetX = 0;
      pointerTargetY = 0;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerleave", onPointerLeave);

    const boneNames = [
      "hips",
      "spine",
      "chest",
      "upperChest",
      "neck",
      "head",
      "leftEye",
      "rightEye",
      "leftUpperArm",
      "rightUpperArm",
      "leftLowerArm",
      "rightLowerArm"
    ];

    // Configure VRM skeleton
    function setupVrmAnimation(vrm) {
      bones = {};
      baseRotations = {};

      boneNames.forEach(name => {
        const bone =
          vrm.humanoid?.getNormalizedBoneNode(name);

        if (bone) {
          bones[name] = bone;
        }
      });

      // Lower the arms from the imported T-pose.
      // This VRM's upper-arm local axes run in opposite X directions,
      // so the Z rotation signs must be opposite to the previous avatar.
      if (bones.leftUpperArm) {
        bones.leftUpperArm.rotation.z += 1.38;
      }

      if (bones.rightUpperArm) {
        bones.rightUpperArm.rotation.z -= 1.38;
      }

      // Small inward elbow bends for a relaxed resting pose.
      if (bones.leftLowerArm) {
        bones.leftLowerArm.rotation.z += 0.16;
      }

      if (bones.rightLowerArm) {
        bones.rightLowerArm.rotation.z -= 0.16;
      }

      // Save resting pose
      Object.keys(bones).forEach(name => {
        baseRotations[name] =
          bones[name].rotation.clone();
      });

      console.log(
        "Mephisto bones:",
        Object.keys(bones)
      );
    }

    function animateVrm(delta, time) {
      if (!loadedVrm) return;

      const wave = (speed, amount, phase = 0) =>
        Math.sin(time * speed + phase) * amount;

      // Smooth the pointer so the gaze follows naturally without snapping.
      const pointerSmoothing = 1 - Math.exp(-delta * 6);
      pointerX += (pointerTargetX - pointerX) * pointerSmoothing;
      pointerY += (pointerTargetY - pointerY) * pointerSmoothing;

      const head = bones.head;
      const neck = bones.neck;
      const spine = bones.spine;
      const chest = bones.chest;
      const upperChest = bones.upperChest;
      const hips = bones.hips;

      // Head movement
      if (head) {
        head.rotation.y =
          baseRotations.head.y + wave(0.55, 0.10) + pointerX * 0.22;

        head.rotation.x =
          baseRotations.head.x + wave(0.8, 0.025) - pointerY * 0.12;

        head.rotation.z =
          baseRotations.head.z + wave(0.4, 0.025);
      }

      // Neck
      if (neck) {
        neck.rotation.y =
          baseRotations.neck.y + wave(0.55, 0.035) + pointerX * 0.07;

        neck.rotation.x =
          baseRotations.neck.x + wave(0.8, 0.012) - pointerY * 0.035;
      }

      // Subtle eye movement follows the pointer more than the head does.
      ["leftEye", "rightEye"].forEach(name => {
        const eye = bones[name];
        if (!eye) return;

        eye.rotation.y = baseRotations[name].y + pointerX * 0.12;
        eye.rotation.x = baseRotations[name].x - pointerY * 0.07;
      });

      // Breathing
      if (spine) {
        spine.rotation.x =
          baseRotations.spine.x + wave(1.1, 0.012);
      }

      if (chest) {
        chest.rotation.x =
          baseRotations.chest.x + wave(1.1, 0.018);
      }

      if (upperChest) {
        upperChest.rotation.x =
          baseRotations.upperChest.x + wave(1.1, 0.012);
      }

      // Body sway
      if (hips) {
        hips.rotation.y =
          baseRotations.hips.y + wave(0.45, 0.025);

        hips.rotation.z =
          baseRotations.hips.z + wave(0.7, 0.012);
      }

      // Gentle arm movement
      ["leftUpperArm", "rightUpperArm"].forEach(
        (name, index) => {
          const bone = bones[name];
          if (!bone) return;

          bone.rotation.z =
            baseRotations[name].z +
            wave(0.8, 0.018, index * Math.PI);
        }
      );

      // Natural blinking
      blinkTimer += delta;

      if (!blinkActive && blinkTimer >= nextBlink) {
        blinkActive = true;
        blinkTimer = 0;
      }

      if (blinkActive) {
        const duration = 0.18;
        const progress = blinkTimer / duration;

        const value =
          progress < 0.5
            ? progress * 2
            : (1 - progress) * 2;

        loadedVrm.expressionManager?.setValue(
          "blink",
          Math.max(0, value)
        );

        if (blinkTimer >= duration) {
          blinkActive = false;
          blinkTimer = 0;
          nextBlink = 2.2 + Math.random() * 3.5;

          loadedVrm.expressionManager?.setValue(
            "blink",
            0
          );
        }
      }

    }

    // Animation loop
    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;

      if (loadedVrm) {
        // Update VRM systems first, then apply procedural bone animation
        // so the pose is not overwritten during the same frame.
        loadedVrm.update(delta);
        animateVrm(delta, time);
      }

      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);

    // Resize
    const onResize = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;

      if (!width || !height) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(el);

    // Load VRM directly - no JSX character
    // Resolve the public VRM next to the built app entry point.
    // Relative URLs work in both Vite development and packaged Electron (file://).
    const vrmUrl = new URL("./character.vrm", window.location.href).href;

    loader.load(
      vrmUrl,

      gltf => {
        if (disposed) {
          VRMUtils.deepDispose(gltf.scene);
          return;
        }

        const vrm = gltf.userData.vrm;

        if (!vrm) {
          console.error("Invalid VRM model.");
          setLoadError(true);
          return;
        }

        loadedVrm = vrm;

        // VRM 0.0 uses the opposite forward direction from the scene's
        // expected VRM 1.0 orientation. Rotate the whole avatar once so
        // its face points toward the camera at +Z.
        const vrmSpecVersion =
          gltf.parser?.json?.extensions?.VRM?.specVersion;

        if (
          vrm.meta?.metaVersion === "0" ||
          (typeof vrmSpecVersion === "string" &&
            vrmSpecVersion.startsWith("0."))
        ) {
          if (typeof VRMUtils.rotateVRM0 === "function") {
            VRMUtils.rotateVRM0(vrm);
          } else {
            vrm.scene.rotation.y += Math.PI;
          }
        }

        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.removeUnnecessaryJoints(gltf.scene);

        // Setup animation and arm pose after orientation correction.
        setupVrmAnimation(vrm);

        // Add original VRM model
        scene.add(vrm.scene);

        setVrmReady(true);

        console.log(
          "Mephisto VRM loaded successfully."
        );
      },

      undefined,

      error => {
        console.error(
          "Mephisto VRM loading failed:",
          error
        );

        setLoadError(true);
      }
    );

    // Cleanup
    return () => {
      disposed = true;

      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);

      if (loadedVrm) {
        VRMUtils.deepDispose(loadedVrm.scene);
      }

      renderer.dispose();

      if (renderer.domElement.parentNode === el) {
        el.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="avatar-stage" ref={mount}>
      <div className="avatar-aura" />

      {!vrmReady && !loadError && (
        <div className="avatar-tag">
          LOADING MEPHISTO...
        </div>
      )}

      {vrmReady && (
        <div className="avatar-tag">
          MEPHISTO VRM
        </div>
      )}

      {loadError && (
        <div className="avatar-tag">
          VRM LOAD FAILED — CHECK public/character.vrm
        </div>
      )}
    </div>
  );
}
