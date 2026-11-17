import type { Pose, Shot } from "./engine";
const names = [
  "Nose",
  "LeftEyeInner",
  "LeftEye",
  "LeftEyeOuter",
  "RightEyeInner",
  "RightEye",
  "RightEyeOuter",
  "LeftEar",
  "RightEar",
  "LeftMouth",
  "RightMouth",
  "LeftShoulder",
  "RightShoulder",
  "LeftElbow",
  "RightElbow",
  "LeftWrist",
  "RightWrist",
  "LeftPinky",
  "RightPinky",
  "LeftIndex",
  "RightIndex",
  "LeftThumb",
  "RightThumb",
  "LeftHip",
  "RightHip",
  "LeftKnee",
  "RightKnee",
  "LeftAnkle",
  "RightAnkle",
  "LeftHeel",
  "RightHeel",
  "LeftFootIndex",
  "RightFootIndex",
];
const bones = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [29, 31],
  [28, 30],
  [30, 32],
  [0, 7],
  [0, 8],
];
let script: Promise<void> | undefined;
async function load() {
  if ((window as any).Pose) return;
  return (script ??= new Promise<void>((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = "/pose/pose.js";
    tag.onload = () => resolve();
    tag.onerror = () => {
      script = undefined;
      tag.remove();
      reject(new Error("관절 추적 모델을 불러오지 못했습니다."));
    };
    document.head.append(tag);
  }));
}
export async function tracker() {
  await load();
  const model = new (window as any).Pose({
    locateFile: (f: string) => "/pose/" + f,
  });
  model.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    selfieMode: false,
  });
  try {
    await model.initialize();
  } catch (e) {
    await model.close().catch(() => {});
    throw e;
  }
  let closed = false,
    work: Promise<Pose | null> | undefined;
  return {
    infer(canvas: HTMLCanvasElement): Promise<Pose | null> {
      if (closed || work)
        return Promise.reject(new Error("카메라 분석이 이미 진행 중입니다."));
      const task = new Promise<Pose | null>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(new Error("관절 추적 시간이 초과됐습니다. 다시 켜 주세요.")),
          15000,
        );
        model.onResults((r: any) => {
          clearTimeout(timer);
          if (!r.poseLandmarks?.length) {
            resolve(null);
            return;
          }
          const p: Pose = {};
          r.poseLandmarks.forEach((v: any, i: number) => {
            p[names[i]] = {
              x: v.x * 1000,
              y: (v.y * 1000 * canvas.height) / canvas.width,
              z: v.z * 1000,
              visibility: v.visibility ?? 0,
            };
          });
          p.LeftPinkyFinger = p.LeftPinky;
          p.RightPinkyFinger = p.RightPinky;
          p.LeftToe = p.LeftFootIndex;
          p.RightToe = p.RightFootIndex;
          resolve(p);
        });
        model.send({ image: canvas }).catch((e: Error) => {
          clearTimeout(timer);
          reject(e);
        });
      });
      work = task;
      return task.finally(() => {
        work = undefined;
      });
    },
    async close() {
      if (closed) return;
      closed = true;
      await work?.catch(() => {});
      await model.close();
    },
  };
}
export function draw(canvas: HTMLCanvasElement, p: Pose, w: number, h: number) {
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d")!;
  c.strokeStyle = "#d0ff8d";
  c.fillStyle = "#fff";
  c.lineWidth = Math.max(2, w / 190);
  for (const [i, j] of bones) {
    const a = p[names[i]],
      b = p[names[j]];
    if (!a || !b || a.visibility < 0.5 || b.visibility < 0.5) continue;
    c.beginPath();
    c.moveTo((a.x * w) / 1000, (a.y * w) / 1000);
    c.lineTo((b.x * w) / 1000, (b.y * w) / 1000);
    c.stroke();
  }
  for (const a of Object.values(p)) {
    if (a.visibility < 0.5) continue;
    c.beginPath();
    c.arc(
      (a.x * w) / 1000,
      (a.y * w) / 1000,
      Math.max(3, w / 140),
      0,
      Math.PI * 2,
    );
    c.fill();
  }
}
export async function jpeg(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("사진 변환 실패"))),
      "image/jpeg",
      0.9,
    ),
  );
}
export async function imageShot(file: File): Promise<Shot> {
  if (
    file.size > 20 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)
  )
    throw new Error("20MB 이하 JPG/PNG/WebP 사진을 선택해 주세요.");
  const url = URL.createObjectURL(file);
  let detector: Awaited<ReturnType<typeof tracker>> | undefined;
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1280 / image.width, 1280 / image.height),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas
      .getContext("2d")!
      .drawImage(image, 0, 0, canvas.width, canvas.height);
    detector = await tracker();
    const points = await detector.infer(canvas);
    if (!points) throw new Error("사람을 찾지 못했습니다.");
    return {
      points,
      image: await jpeg(canvas),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(url);
    await detector?.close();
  }
}
