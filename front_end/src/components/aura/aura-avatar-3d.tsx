import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { AuraEmotion } from "../../types/project";

type Motion = {
    tint: string;
    bobAmplitude: number;
    bobSpeed: number;
    sway: number;
    spin: number;
    headPitch: number;
    headRoll: number;
    breath: number;
};

const MOTION: Record<AuraEmotion, Motion> = {
    neutral: { tint: "#64d5c4", bobAmplitude: 0.035, bobSpeed: 0.9, sway: 0.1, spin: 0.04, headPitch: 0, headRoll: 0, breath: 1 },
    happy: { tint: "#64d5c4", bobAmplitude: 0.05, bobSpeed: 1.5, sway: 0.14, spin: 0.05, headPitch: 0.02, headRoll: 0.03, breath: 1.1 },
    excited: { tint: "#f2b84b", bobAmplitude: 0.07, bobSpeed: 2.2, sway: 0.18, spin: 0.12, headPitch: 0.01, headRoll: 0.05, breath: 1.25 },
    concerned: { tint: "#f2a34b", bobAmplitude: 0.025, bobSpeed: 0.8, sway: 0.07, spin: 0.02, headPitch: 0.05, headRoll: 0.04, breath: 0.9 },
    alert: { tint: "#f17c71", bobAmplitude: 0.012, bobSpeed: 3.0, sway: 0.03, spin: 0.08, headPitch: 0.03, headRoll: 0.01, breath: 1.05 },
    thinking: { tint: "#7fa4ff", bobAmplitude: 0.02, bobSpeed: 0.65, sway: 0.09, spin: 0.02, headPitch: 0.03, headRoll: 0.09, breath: 0.95 },
    sad: { tint: "#7fa4ff", bobAmplitude: 0.018, bobSpeed: 0.55, sway: 0.05, spin: 0.01, headPitch: 0.16, headRoll: 0.02, breath: 0.85 },
    listening: { tint: "#64d5c4", bobAmplitude: 0.028, bobSpeed: 1.0, sway: 0.11, spin: 0.04, headPitch: 0.01, headRoll: 0.02, breath: 1 },
};

const SKIN = 0xf0c49c;
const SKIN_DEEP = 0xd9a878;
const HAIR = 0x2c2017;
const SHIRT = 0x24403a;
const LIP = 0xb06a5c;
const MOUTH_DARK = 0x54231f;
const SCLERA = 0xf7f3ec;
const IRIS = 0x4a3222;

type EyeGroup = THREE.Group;

type DynamicState = {
    eyes: EyeGroup[];
    openMouth: THREE.Mesh | null;
    pupilsUp: boolean;
};

function makeCircle(color: number, radius: number): THREE.Mesh {
    return new THREE.Mesh(
        new THREE.CircleGeometry(radius, 24),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    );
}

function buildEye(side: number): THREE.Group {
    const group = new THREE.Group();
    const sclera = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 24, 24),
        new THREE.MeshStandardMaterial({ color: SCLERA, roughness: 0.25 }),
    );
    sclera.scale.set(1, 1.04, 0.9);
    group.add(sclera);

    const iris = makeCircle(IRIS, 0.065);
    iris.position.set(0, 0, 0.138);
    group.add(iris);
    const pupil = makeCircle(0x14100c, 0.032);
    pupil.position.set(0, 0, 0.141);
    group.add(pupil);
    const highlight = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }),
    );
    highlight.position.set(0.045, 0.05, 0.148);
    group.add(highlight);

    group.position.set(0.3 * side, 0.12, 0.85);
    return group;
}

function buildLips(kind: "neutral" | "smile" | "bigSmile" | "sad" | "pursed" | "smallO") {
    const material = new THREE.MeshStandardMaterial({ color: LIP, roughness: 0.45 });
    let mesh: THREE.Mesh;
    if (kind === "pursed") {
        mesh = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.022, 10, 20, Math.PI * 2), material);
    } else if (kind === "smallO") {
        mesh = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.018, 8, 16, Math.PI * 2), material);
    } else {
        const radius = kind === "bigSmile" ? 0.2 : kind === "sad" ? 0.16 : 0.15;
        const tube = kind === "bigSmile" ? 0.03 : 0.026;
        mesh = new THREE.Mesh(
            new THREE.TorusGeometry(radius, tube, 10, 22, Math.PI * (kind === "bigSmile" ? 1.05 : 1.0)),
            material,
        );
        if (kind !== "sad") {
            mesh.rotation.z = Math.PI;
        }
    }
    mesh.position.set(0, -0.32, 0.95);
    return mesh;
}

function buildOpenMouth(): THREE.Mesh {
    const mouth = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 20, 16),
        new THREE.MeshStandardMaterial({ color: MOUTH_DARK, roughness: 0.6 }),
    );
    mouth.position.set(0, -0.3, 0.99);
    mouth.scale.set(0.85, 0.4, 0.55);
    return mouth;
}

export default function AuraAvatar3D({
    emotion = "neutral",
    speaking = false,
    size = 56,
}: {
    emotion?: AuraEmotion;
    speaking?: boolean;
    size?: number;
}) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const emotionRef = useRef<AuraEmotion>(emotion);
    const speakingRef = useRef<boolean>(speaking);
    const tintRef = useRef<string>(MOTION[emotion]?.tint ?? MOTION.neutral.tint);

    emotionRef.current = emotion;
    speakingRef.current = speaking;
    tintRef.current = MOTION[emotion]?.tint ?? MOTION.neutral.tint;

    useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;

        const canvas = document.createElement("canvas");
        wrap.appendChild(canvas);

        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(size, size);
        renderer.setClearColor(0x000000, 0);
        rendererRef.current = renderer;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        camera.position.set(0, 0.2, 5.1);

        scene.add(new THREE.AmbientLight(0xfff5ea, 0.8));
        const keyLight = new THREE.DirectionalLight(0xfff2e0, 1.7);
        keyLight.position.set(2.4, 4.2, 4.2);
        const fillLight = new THREE.DirectionalLight(0xbcd9ff, 0.4);
        fillLight.position.set(-3.2, 1.2, 2.4);
        const skinGlow = new THREE.PointLight(0xffd9b8, 0.9, 6);
        skinGlow.position.set(0, 1.8, 3.2);
        const auraRim = new THREE.PointLight(0x64d5c4, 0.7, 6);
        auraRim.position.set(0, 1.4, -2.6);
        scene.add(keyLight, fillLight, skinGlow, auraRim);

        const root = new THREE.Group();
        root.scale.setScalar(0.82);
        scene.add(root);

        const bodyGroup = new THREE.Group();
        root.add(bodyGroup);

        const shirtMaterial = new THREE.MeshStandardMaterial({ color: SHIRT, roughness: 0.85 });
        const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), shirtMaterial);
        torso.scale.set(1.5, 0.8, 1.05);
        torso.position.set(0, -1.95, 0);
        bodyGroup.add(torso);
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.2, 20), shirtMaterial);
        collar.position.set(0, -1.22, 0);
        bodyGroup.add(collar);

        const neck = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.34, 0.5, 20),
            new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.55 }),
        );
        neck.position.set(0, -1.28, 0);
        bodyGroup.add(neck);

        const headGroup = new THREE.Group();
        headGroup.position.y = -0.08;
        root.add(headGroup);

        const headMaterial = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.42, metalness: 0 });
        const head = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 48), headMaterial);
        head.scale.set(0.92, 1.06, 0.96);
        headGroup.add(head);

        const earMaterial = new THREE.MeshStandardMaterial({ color: SKIN_DEEP, roughness: 0.55 });
        for (const side of [-1, 1] as const) {
            const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), earMaterial);
            ear.scale.set(0.5, 1.4, 0.8);
            ear.position.set(0.94 * side, 0.0, 0.18);
            headGroup.add(ear);
        }

        const hairMaterial = new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.8 });
        const hairCap = new THREE.Mesh(
            new THREE.SphereGeometry(1.045, 40, 22, 0, Math.PI * 2, 0, 1.05),
            hairMaterial,
        );
        hairCap.scale.set(0.95, 1.02, 0.97);
        headGroup.add(hairCap);
        const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), hairMaterial);
        fringe.scale.set(1.25, 0.5, 0.5);
        fringe.position.set(0, 0.62, 0.68);
        headGroup.add(fringe);
        for (const side of [-1, 1] as const) {
            const burn = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), hairMaterial);
            burn.scale.set(0.4, 1.3, 0.7);
            burn.position.set(0.9 * side, 0.3, 0.42);
            headGroup.add(burn);
        }

        const nose = new THREE.Mesh(
            new THREE.SphereGeometry(0.085, 20, 16),
            new THREE.MeshStandardMaterial({ color: SKIN_DEEP, roughness: 0.5 }),
        );
        nose.scale.set(0.75, 1.45, 0.95);
        nose.position.set(0, -0.03, 0.97);
        headGroup.add(nose);

        const faceGroup = new THREE.Group();
        headGroup.add(faceGroup);

        const state: DynamicState = { eyes: [], openMouth: null, pupilsUp: false };

        function disposeObject(object: THREE.Object3D) {
            object.traverse((child) => {
                const mesh = child as THREE.Mesh;
                if (mesh.geometry) mesh.geometry.dispose();
                const material = mesh.material;
                if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
                else if (material) material.dispose();
            });
        }

        function clearGroup(group: THREE.Group) {
            for (const child of [...group.children]) {
                group.remove(child);
                disposeObject(child);
            }
        }

        function buildFace(current: AuraEmotion, spk: boolean) {
            clearGroup(faceGroup);
            state.eyes = [];
            state.openMouth = null;
            state.pupilsUp = current === "thinking" || current === "alert";

            const leftEye = buildEye(-1);
            const rightEye = buildEye(1);
            faceGroup.add(leftEye, rightEye);
            state.eyes = [leftEye, rightEye];

            const openness =
                current === "happy" ? 0.66 :
                current === "sad" ? 0.72 :
                current === "alert" ? 1.18 :
                current === "excited" ? 1.12 :
                current === "thinking" ? 0.9 : 1.0;
            const eyeScaleY = spk ? 0.82 : openness;
            leftEye.scale.y = eyeScaleY;
            rightEye.scale.y = eyeScaleY;

            const browMaterial = new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.8 });
            const makeBrow = (x: number, rotationZ: number, y: number) => {
                const brow = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.042, 0.035), browMaterial);
                brow.position.set(x, y, 0.92);
                brow.rotation.z = rotationZ;
                faceGroup.add(brow);
            };
            const browY = current === "alert" ? 0.42 : 0.365;
            if (current === "thinking") {
                makeBrow(-0.3, 0.28, browY + 0.02);
                makeBrow(0.3, 0.0, browY);
            } else if (current === "concerned" || current === "sad") {
                makeBrow(-0.3, 0.22, browY);
                makeBrow(0.3, -0.22, browY);
            } else if (current === "alert" || current === "excited") {
                makeBrow(-0.3, 0.06, browY);
                makeBrow(0.3, -0.06, browY);
            } else {
                makeBrow(-0.3, 0.02, browY);
                makeBrow(0.3, -0.02, browY);
            }

            if (spk) {
                const openMouth = buildOpenMouth();
                faceGroup.add(openMouth);
                state.openMouth = openMouth;
                faceGroup.add(buildLips("neutral"));
                return;
            }
            switch (current) {
                case "happy":
                    faceGroup.add(buildLips("smile"));
                    break;
                case "excited":
                    faceGroup.add(buildLips("bigSmile"));
                    break;
                case "sad":
                    faceGroup.add(buildLips("sad"));
                    break;
                case "concerned":
                    faceGroup.add(buildLips("pursed"));
                    break;
                case "alert":
                    faceGroup.add(buildLips("smallO"));
                    break;
                case "thinking":
                    faceGroup.add(buildLips("pursed"));
                    break;
                default:
                    faceGroup.add(buildLips("neutral"));
            }
        }

        buildFace(emotionRef.current, speakingRef.current);

        let blinkUntil = -1;
        let nextBlinkTarget = window.performance.now() + 1800 + Math.random() * 3200;
        let lastBuild = "";

        let frameId: number | undefined;
        const render = (time: number) => {
            frameId = requestAnimationFrame(render);
            const t = time * 0.001;
            const current = emotionRef.current;
            const spk = speakingRef.current;
            const cfg = MOTION[current] ?? MOTION.neutral;

            const signature = current + ":" + spk;
            if (signature !== lastBuild) {
                buildFace(current, spk);
                lastBuild = signature;
            }

            const bob = Math.sin(t * cfg.bobSpeed) * cfg.bobAmplitude;
            const sway = Math.sin(t * 0.55 + 0.8) * cfg.sway * 0.05;
            const breath = 1 + Math.sin(t * cfg.breath * 1.6) * 0.012;
            root.position.y = bob + sway;
            root.rotation.z = Math.sin(t * 0.45) * cfg.sway * 0.12;
            root.rotation.y = Math.sin(t * 0.4 + 1.2) * cfg.sway * 0.25;
            root.rotation.x = Math.sin(t * 0.7) * 0.012;
            torso.scale.y = breath;

            const spin = Math.sin(t * 1.25) * cfg.spin;
            const jitter = current === "alert" ? Math.sin(t * 37) * 0.004 : 0;
            headGroup.rotation.y = spin + jitter;
            headGroup.rotation.x = cfg.headPitch + jitter * 0.5;
            headGroup.rotation.z = cfg.headRoll;

            for (const eye of state.eyes) {
                eye.rotation.x = state.pupilsUp ? -0.28 : 0;
            }

            if (t * 1000 > nextBlinkTarget) {
                blinkUntil = t + 0.13;
                nextBlinkTarget = t * 1000 + 1800 + Math.random() * 3400;
            }
            const blinking = t < blinkUntil;
            const blinkScale = blinking ? 0.1 : 1;
            for (const eye of state.eyes) {
                eye.scale.y = eye.scale.y * blinkScale;
            }

            if (state.openMouth) {
                const open = 0.32 + Math.abs(Math.sin(t * 11)) * 0.85;
                state.openMouth.scale.y = 0.4 * open;
            }

            (auraRim.color as THREE.Color).set(cfg.tint);

            renderer.render(scene, camera);
        };
        frameId = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(frameId as number);
            disposeObject(root);
            renderer.dispose();
            rendererRef.current = null;
            canvas.remove();
        };
    }, [size]);

    return (
        <div
            ref={wrapRef}
            style={{ width: size, height: size, position: "relative", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.25))" }}
            aria-hidden="true"
        />
    );
}
