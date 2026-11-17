import { useEffect, useRef, useState } from "react";
import fixWebmDuration from "fix-webm-duration";
import { tracker, draw, jpeg } from "./pose";
import { missing, type Pose, type Shot } from "./engine";
type Props = {
  phase: string;
  label: string;
  required: string[];
  blocked: boolean;
  videoMode?: boolean;
  onPhoto?: (shot: Shot) => void;
  onVideo?: (file: File) => Promise<void>;
  onBusy: (busy: boolean) => void;
};
type Frame = {
  points: Pose;
  canvas: HTMLCanvasElement;
  time: number;
  phase: string;
  good: boolean;
};
export function Camera(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    media = useRef<MediaStream | null>(null),
    session = useRef<Awaited<ReturnType<typeof tracker>> | null>(null);
  const alive = useRef(true),
    generation = useRef(0),
    last = useRef<Frame | null>(null),
    stable = useRef(0),
    loopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    countTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined),
    recordTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined),
    recorder = useRef<MediaRecorder | null>(null);
  const [state, setState] = useState("starting"),
    [ready, setReady] = useState(false),
    [absent, setAbsent] = useState(props.required.length),
    [error, setError] = useState(""),
    [front, setFront] = useState(false),
    [delay, setDelay] = useState(5),
    [count, setCount] = useState<number | null>(null),
    [recording, setRecording] = useState(false),
    [seconds, setSeconds] = useState(0),
    [taking, setTaking] = useState(false);
  function cancel() {
    if (countTimer.current) clearInterval(countTimer.current);
    countTimer.current = undefined;
    if (alive.current) setCount(null);
  }
  function stop() {
    generation.current++;
    if (loopTimer.current) clearTimeout(loopTimer.current);
    media.current?.getTracks().forEach((t) => t.stop());
    media.current = null;
    if (video.current) video.current.srcObject = null;
    const old = session.current;
    session.current = null;
    void old?.close().catch(() => {});
    last.current = null;
    stable.current = 0;
    if (alive.current) {
      setState("off");
      setReady(false);
    }
  }
  function discard() {
    if (recordTimer.current) clearInterval(recordTimer.current);
    const r = recorder.current;
    recorder.current = null;
    if (r && r.state !== "inactive") {
      r.onstop = null;
      r.stop();
    }
    if (alive.current) setRecording(false);
    latest.current.onBusy(false);
  }
  async function start(selfie = front) {
    cancel();
    discard();
    stop();
    const token = generation.current;
    setState("starting");
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "카메라를 지원하는 앱 또는 HTTPS 환경에서 실행해 주세요.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: selfie ? "user" : "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (!alive.current || token !== generation.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      media.current = stream;
      video.current!.srcObject = stream;
      await video.current!.play();
      const engine = await tracker();
      if (!alive.current || token !== generation.current) {
        await engine.close();
        return;
      }
      session.current = engine;
      setState("live");
      const input = document.createElement("canvas"),
        preserved = document.createElement("canvas");
      const loop = async () => {
        if (!alive.current || token !== generation.current || !video.current)
          return;
        const v = video.current;
        if (v.readyState < 2 || !v.videoWidth) {
          loopTimer.current = setTimeout(() => void loop(), 100);
          return;
        }
        const scale = Math.min(1, 640 / v.videoWidth, 640 / v.videoHeight);
        input.width = Math.round(v.videoWidth * scale);
        input.height = Math.round(v.videoHeight * scale);
        input.getContext("2d")!.drawImage(v, 0, 0, input.width, input.height);
        const phase = latest.current.phase,
          time = performance.now();
        try {
          const points = await engine.infer(input);
          if (!alive.current || token !== generation.current) return;
          if (phase !== latest.current.phase) {
            loopTimer.current = setTimeout(() => void loop(), 100);
            return;
          }
          const needed = missing(
            points,
            latest.current.required,
            input.height / input.width,
          );
          stable.current = points && !needed.length ? stable.current + 1 : 0;
          const good =
            !!points &&
            !needed.length &&
            stable.current >= 3 &&
            performance.now() - time <= 1200;
          setReady(good);
          setAbsent(needed.length);
          if (canvas.current)
            draw(canvas.current, points || {}, input.width, input.height);
          if (points) {
            preserved.width = input.width;
            preserved.height = input.height;
            preserved.getContext("2d")!.drawImage(input, 0, 0);
            last.current = { points, canvas: preserved, time, phase, good };
          } else last.current = null;
          loopTimer.current = setTimeout(() => void loop(), 100);
        } catch (e) {
          if (alive.current && token === generation.current) {
            stop();
            setState("error");
            setError(
              e instanceof Error ? e.message : "관절 인식에 실패했습니다.",
            );
          }
        }
      };
      void loop();
    } catch (e) {
      if (alive.current && token === generation.current) {
        stop();
        setState("error");
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "카메라 권한을 허용하고 다시 켜 주세요."
            : e instanceof Error
              ? e.message
              : "카메라를 열지 못했습니다.",
        );
      }
    }
  }
  useEffect(() => {
    alive.current = true;
    void start();
    const background = () => {
      if (media.current) {
        cancel();
        discard();
        stop();
        setError("카메라가 일시 중지됐습니다. 다시 켜 주세요.");
      }
    };
    const visibility = () => {
      if (document.hidden) background();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("iposture:pause", background);
    return () => {
      alive.current = false;
      cancel();
      discard();
      stop();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("iposture:pause", background);
    };
  }, []);
  useEffect(() => {
    cancel();
    last.current = null;
    stable.current = 0;
    setReady(false);
    setAbsent(props.required.length);
    setError("");
    if (canvas.current)
      canvas.current
        .getContext("2d")
        ?.clearRect(0, 0, canvas.current.width, canvas.current.height);
  }, [props.phase]);
  function valid() {
    const frame = last.current;
    return (
      !!frame &&
      frame.good &&
      frame.phase === latest.current.phase &&
      performance.now() - frame.time <= 1200
    );
  }
  async function photo() {
    if (!valid()) {
      setError("필수 관절이 화면 안에 보이도록 맞춘 후 다시 촬영해 주세요.");
      return;
    }
    const f = last.current!,
      frozen = document.createElement("canvas");
    frozen.width = f.canvas.width;
    frozen.height = f.canvas.height;
    frozen.getContext("2d")!.drawImage(f.canvas, 0, 0);
    const callback = latest.current.onPhoto;
    setTaking(true);
    try {
      const image = await jpeg(frozen);
      if (alive.current && f.phase === latest.current.phase)
        callback?.({
          points: f.points,
          image,
          width: frozen.width,
          height: frozen.height,
        });
    } catch (e) {
      setError(String(e));
    } finally {
      if (alive.current) setTaking(false);
    }
  }
  function record() {
    if (!valid()) {
      setError("필수 관절을 화면 안에 맞춘 후 녹화해 주세요.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError(
        "이 기기에서는 영상 녹화를 지원하지 않습니다. 기존 영상을 선택해 주세요.",
      );
      return;
    }
    const mime = ["video/webm;codecs=vp8", "video/webm", "video/mp4"].find(
      (m) => MediaRecorder.isTypeSupported(m),
    );
    if (!mime || !media.current) {
      setError("지원되는 녹화 형식이 없습니다.");
      return;
    }
    try {
      const r = new MediaRecorder(media.current, {
        mimeType: mime,
        videoBitsPerSecond: 2_000_000,
      });
      recorder.current = r;
      const chunks: Blob[] = [];
      const began = performance.now();
      let bytes = 0;
      r.ondataavailable = (e) => {
        if (e.data.size) {
          chunks.push(e.data);
          bytes += e.data.size;
        }
        if (bytes > 95 * 1024 * 1024 && r.state === "recording") r.stop();
      };
      r.onerror = () => {
        discard();
        stop();
        setError("영상 녹화에 실패했습니다.");
      };
      r.onstop = () => {
        recorder.current = null;
        if (recordTimer.current) clearInterval(recordTimer.current);
        if (!alive.current) return;
        setRecording(false);
        setTaking(true);
        stop();
        void (async () => {
          try {
            const duration = performance.now() - began;
            if (duration < 500) throw new Error("1초 이상 녹화해 주세요.");
            let blob = new Blob(chunks, { type: mime.split(";")[0] });
            if (blob.type === "video/webm")
              blob = await fixWebmDuration(blob, duration, { logger: false });
            await latest.current.onVideo?.(
              new File(
                [blob],
                blob.type === "video/webm" ? "motion.webm" : "motion.mp4",
                { type: blob.type },
              ),
            );
          } catch (e) {
            if (alive.current)
              setError(e instanceof Error ? e.message : String(e));
          } finally {
            latest.current.onBusy(false);
            if (alive.current) setTaking(false);
          }
        })();
      };
      r.start(500);
      setRecording(true);
      setSeconds(0);
      latest.current.onBusy(true);
      recordTimer.current = setInterval(() => {
        const elapsed = Math.floor((performance.now() - began) / 1000);
        setSeconds(elapsed);
        if (elapsed >= 59 && r.state === "recording") r.stop();
      }, 200);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      latest.current.onBusy(false);
    }
  }
  function shutter() {
    setError("");
    if (!delay) {
      props.videoMode ? record() : void photo();
      return;
    }
    let n = delay;
    setCount(n);
    countTimer.current = setInterval(() => {
      n--;
      if (n <= 0) {
        cancel();
        latest.current.videoMode ? record() : void photo();
      } else setCount(n);
    }, 1000);
  }
  const locked = props.blocked || taking || count !== null;
  return (
    <div className="camera" data-ready={ready} data-state={state}>
      <div className={"camera-frame " + (front ? "mirror" : "")}>
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          aria-label="실시간 카메라"
        />
        <canvas ref={canvas} aria-label="실시간 관절점과 연결선" />
        <span className="camera-label">● {props.label}</span>
        {state !== "live" && (
          <div className="camera-message">
            {state === "starting"
              ? "카메라와 관절 추적 모델 준비 중…"
              : "카메라가 꺼져 있습니다."}
          </div>
        )}
        {count !== null && <strong className="countdown">{count}</strong>}
        {recording && <span className="record-clock">● {seconds} / 60초</span>}
      </div>
      <p className={"quality " + (ready ? "ready" : "")} aria-live="polite">
        {state === "live"
          ? ready
            ? "✓ 필수 관절이 인식됐어요. 촬영할 수 있습니다."
            : absent
              ? `필수 관절 ${absent}개가 더 보여야 합니다.`
              : "자세를 잠시 유지해 주세요."
          : "카메라 권한과 준비 상태를 확인해 주세요."}
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="camera-controls">
        {recording ? (
          <button
            className="danger"
            onClick={() => {
              if (recorder.current?.state === "recording")
                recorder.current.stop();
            }}
          >
            녹화 종료
          </button>
        ) : state === "off" || state === "error" ? (
          <button
            disabled={props.blocked || taking}
            onClick={() => void start()}
          >
            카메라 다시 켜기
          </button>
        ) : count !== null ? (
          <button onClick={cancel}>타이머 취소</button>
        ) : (
          <button
            className="primary"
            disabled={locked || state !== "live" || (!delay && !ready)}
            onClick={shutter}
          >
            {delay ? delay + "초 뒤 " : ""}
            {props.videoMode ? "녹화 시작" : props.label + " 촬영"}
          </button>
        )}
        <button
          aria-label="카메라 전환"
          disabled={locked || recording}
          onClick={() => {
            setFront(!front);
            void start(!front);
          }}
        >
          ↻
        </button>
        <select
          aria-label="촬영 타이머"
          disabled={locked || recording}
          value={delay}
          onChange={(e) => setDelay(Number(e.target.value))}
        >
          <option value={0}>즉시</option>
          <option value={3}>3초</option>
          <option value={5}>5초</option>
        </select>
      </div>
    </div>
  );
}
