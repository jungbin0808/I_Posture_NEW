import { tracker } from "./pose";
import { angles } from "./engine";
export type Frame = { time: number; angles: ReturnType<typeof angles> };
export async function analyzeVideo(file: File, progress: (n: number) => void) {
  if (!file.type.startsWith("video/") || file.size > 100 * 1024 * 1024)
    throw new Error("100MB 이하 동영상을 선택해 주세요.");
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  const url = URL.createObjectURL(file);
  let model: Awaited<ReturnType<typeof tracker>> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("영상 읽기 시간 초과")),
        15000,
      );
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(
          new Error("이 기기에서 재생 가능한 MP4/WebM 영상을 선택해 주세요."),
        );
      };
      video.src = url;
    });
    if (
      !Number.isFinite(video.duration) ||
      video.duration <= 0 ||
      video.duration > 60
    )
      throw new Error("1분 이내의 영상을 사용해 주세요.");
    model = await tracker();
    const frame = document.createElement("canvas"),
      scale = Math.min(1, 640 / video.videoWidth, 640 / video.videoHeight);
    frame.width = Math.round(video.videoWidth * scale);
    frame.height = Math.round(video.videoHeight * scale);
    const frames: Frame[] = [];
    for (let t = 0; t < video.duration; t++) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("영상 프레임 읽기 실패")),
          10000,
        );
        video.onseeked = () => {
          clearTimeout(timer);
          resolve();
        };
        video.currentTime = Math.min(t + 0.01, video.duration - 0.001);
      });
      frame.getContext("2d")!.drawImage(video, 0, 0, frame.width, frame.height);
      const points = await model.infer(frame);
      frames.push({ time: t, angles: angles(points || {}) });
      progress(Math.round(((t + 1) / Math.ceil(video.duration)) * 100));
    }
    if (!frames.some((f) => Object.values(f.angles).some((v) => v !== null)))
      throw new Error("영상에서 관절을 찾지 못했습니다.");
    return { duration: video.duration, frames };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
    await model?.close();
  }
}
