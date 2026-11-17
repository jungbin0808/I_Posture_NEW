import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Camera } from "./Camera";
import {
  motions,
  bodyRequired,
  bodyCore,
  assertPose,
  precision,
  type Shot,
} from "./engine";
import { body } from "./body";
import { draw, imageShot } from "./pose";
import { analyzeVideo, type Frame } from "./motion";
import { records, save, remove, type Entry } from "./store";
import "./style.css";
declare global {
  interface Window {
    NativeHost?: { exportJson: (json: string) => void; exitApp: () => void };
    onAppBack?: () => void;
  }
}
const labels = {
  body: "체형측정",
  precision: "정밀측정",
  motion: "모션 분석",
  inbody: "인바디",
};
const symbols = { body: "◎", precision: "⌁", motion: "▷", inbody: "▤" };
const desc = {
  body: "정면·우측면·후면으로 나의 균형 확인",
  precision: "7개 부위, 52개 움직임을 세밀하게",
  motion: "영상과 관절 각도로 움직임 기록",
  inbody: "수동 입력과 결과지 사진으로 몸의 변화 기록",
};
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
function useBlob(blob?: Blob) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
function Photo({ shot }: { shot: Shot }) {
  const url = useBlob(shot.image),
    canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvas.current)
      draw(canvas.current, shot.points, shot.width, shot.height);
  }, [shot]);
  return (
    <div className="pose-photo">
      <img src={url || undefined} alt="촬영 사진" />
      <canvas ref={canvas} aria-label="촬영된 관절점" />
    </div>
  );
}
function Still({ blob }: { blob: Blob }) {
  const url = useBlob(blob);
  return (
    <img className="saved-image" src={url || undefined} alt="등록한 결과지" />
  );
}
function Clip({ blob }: { blob: Blob }) {
  const url = useBlob(blob);
  return (
    <video className="player" src={url || undefined} playsInline controls />
  );
}
function Steps({ values, index }: { values: string[]; index: number }) {
  return (
    <ol className="steps" aria-label="측정 진행 순서">
      {values.map((s, i) => (
        <li
          className={i === index ? "current" : i < index ? "done" : ""}
          aria-current={i === index ? "step" : undefined}
          key={s}
        >
          <span>{i < index ? "✓" : i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}
function Chart({ frames }: { frames: Frame[] }) {
  const [joint, setJoint] = useState<keyof Frame["angles"]>("leftKnee");
  const values = frames
      .map((f) => f.angles[joint])
      .filter((n): n is number => n !== null),
    segments: string[] = [];
  let points: string[] = [];
  frames.forEach((f, i) => {
    const n = f.angles[joint];
    if (n === null) {
      if (points.length) segments.push(points.join(" "));
      points = [];
    } else
      points.push(
        `${30 + (i / Math.max(1, frames.length - 1)) * 540},${160 - (n / 180) * 130}`,
      );
  });
  if (points.length) segments.push(points.join(" "));
  return (
    <section className="panel chart">
      <div className="row">
        <h3>움직임 각도</h3>
        <select
          aria-label="그래프 관절"
          value={joint}
          onChange={(e) => setJoint(e.target.value as typeof joint)}
        >
          {Object.entries({
            leftKnee: "왼쪽 무릎",
            rightKnee: "오른쪽 무릎",
            leftElbow: "왼쪽 팔꿈치",
            rightElbow: "오른쪽 팔꿈치",
          }).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <p>
        {values.length
          ? `${Math.min(...values)}° – ${Math.max(...values)}°`
          : "관측되지 않은 관절입니다."}
      </p>
      <svg viewBox="0 0 600 190" role="img" aria-label="관절 각도 그래프">
        {[0, 90, 180].map((n) => (
          <g key={n}>
            <line
              x1="30"
              x2="570"
              y1={160 - (n / 180) * 130}
              y2={160 - (n / 180) * 130}
              stroke="#dce5d7"
            />
            <text x="0" y={164 - (n / 180) * 130} fill="#94a38c" fontSize="10">
              {n}
            </text>
          </g>
        ))}
        {segments.map((p, i) => (
          <polyline
            key={i}
            points={p}
            fill="none"
            stroke="#39734c"
            strokeWidth="3"
          />
        ))}
        {frames.map(
          (f, i) =>
            f.angles[joint] !== null && (
              <circle
                key={i}
                cx={30 + (i / Math.max(1, frames.length - 1)) * 540}
                cy={160 - (f.angles[joint]! / 180) * 130}
                r="3"
                fill="#39734c"
              />
            ),
        )}
      </svg>
      <small>
        1초 간격 · {values.length}/{frames.length} 프레임 · 가려진 구간은 비워
        둡니다.
      </small>
    </section>
  );
}
const inbodyFields = [
  ["weight", "체중", "kg", 1, 500],
  ["skeletalMuscleMass", "골격근량", "kg", 0, 200],
  ["percentBodyFat", "체지방률", "%", 0, 100],
  ["bodyFatMass", "체지방량", "kg", 0, 400],
  ["bmi", "BMI", "", 1, 100],
  ["visceralFatLevel", "내장지방 레벨", "", 0, 100],
  ["basalMetabolicRate", "기초대사량", "kcal", 100, 10000],
  ["bodyWater", "체수분", "L", 0, 300],
] as const;
function App() {
  const [route, setRoute] = useState("home"),
    [kind, setKind] = useState<"body" | "precision">("body"),
    [stage, setStage] = useState("capture"),
    [step, setStep] = useState(0),
    [retake, setRetake] = useState(false),
    [source, setSource] = useState("camera"),
    [group, setGroup] = useState("목"),
    [key, setKey] = useState(motions[0].key),
    [shots, setShots] = useState<Shot[]>([]),
    [entries, setEntries] = useState<Entry[]>([]),
    [selected, setSelected] = useState<Entry | null>(null),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("all");
  const [clip, setClip] = useState<{
      file: File;
      data: { duration: number; frames: Frame[] };
    } | null>(null),
    [progress, setProgress] = useState(0),
    [title, setTitle] = useState("나의 움직임");
  const [inbody, setInbody] = useState<Record<string, string>>({}),
    [date, setDate] = useState(
      new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10),
    ),
    [attachment, setAttachment] = useState<File>();
  const motion = motions.find((m) => m.key === key)!,
    names =
      kind === "body"
        ? ["정면", "우측면", "후면"]
        : ["시작 자세", "움직인 자세"];
  async function refresh() {
    try {
      setEntries(await records());
    } catch (e) {
      setError(errorText(e));
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  function navigate(next: string) {
    if (busy) return;
    setError("");
    setRoute(next);
    setSelected(null);
    window.scrollTo(0, 0);
  }
  function back() {
    if (busy) return;
    if (route === "photo") {
      if (stage === "review") {
        setStage("capture");
        setStep(names.length - 1);
        setRetake(false);
      } else if (retake) {
        setStage("review");
        setRetake(false);
      } else if (stage === "capture" && step > 0) setStep(step - 1);
      else if (stage === "capture" && kind === "precision") setStage("select");
      else navigate("choose");
    } else if (route === "motion" && stage !== "guide") {
      setStage(stage === "review" ? "capture" : "guide");
    } else if (
      route === "choose" ||
      route === "history" ||
      route === "inbody" ||
      route === "detail"
    )
      navigate("home");
    else window.NativeHost?.exitApp();
  }
  useEffect(() => {
    window.onAppBack = back;
    return () => {
      window.onAppBack = undefined;
    };
  });
  function choose(next: Entry["kind"]) {
    setError("");
    setSource("camera");
    setStep(0);
    setRetake(false);
    setShots([]);
    if (next === "body" || next === "precision") {
      setKind(next);
      setStage(next === "body" ? "capture" : "select");
      setRoute("photo");
    } else if (next === "motion") {
      setRoute("motion");
      setStage("guide");
      setClip(null);
      setTitle("나의 움직임");
    } else setRoute("inbody");
    window.scrollTo(0, 0);
  }
  function accept(shot: Shot) {
    try {
      assertPose(
        shot.points,
        kind === "body" ? bodyRequired(step) : motion.required,
      );
      if (
        kind === "precision" &&
        step === 1 &&
        shots[0] &&
        Math.abs(shots[0].height / shots[0].width - shot.height / shot.width) >
          0.03
      )
        throw new Error("시작 사진과 같은 방향과 비율로 촬영해 주세요.");
      const next = [...shots];
      next[step] = shot;
      setShots(next);
      setError("");
      if (retake || step === names.length - 1) {
        setStage("review");
        setRetake(false);
      } else setStep(step + 1);
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function upload(file: File) {
    setBusy(true);
    setStatus("사진에서 관절을 확인하고 있어요.");
    setError("");
    try {
      accept(await imageShot(file));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  }
  async function finish(entry: Omit<Entry, "id" | "date">) {
    const saved = await save(entry);
    await refresh();
    setSelected(saved);
    setRoute("detail");
    window.scrollTo(0, 0);
  }
  async function calculate() {
    setBusy(true);
    setStatus("측정 결과를 계산하고 저장하고 있어요.");
    setError("");
    try {
      const data =
        kind === "body"
          ? await body(shots[0].points, shots[1].points, shots[2].points)
          : await precision(key, shots[0].points, shots[1].points);
      await finish({
        kind,
        title:
          kind === "body" ? "나의 체형측정" : motion.group + " " + motion.label,
        data: {
          ...data,
          captures: shots.map(({ points, width, height }) => ({
            points,
            width,
            height,
          })),
        },
        media: shots.map((s) => s.image),
      });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  }
  async function videoFile(file: File) {
    setBusy(true);
    setStatus("영상에서 관절 각도를 분석하고 있어요.");
    setError("");
    setProgress(0);
    try {
      setClip({ file, data: await analyzeVideo(file, setProgress) });
      setStage("review");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      setStatus("");
    }
  }
  async function saveClip() {
    if (!clip) return;
    setBusy(true);
    try {
      await finish({
        kind: "motion",
        title: title.trim() || "나의 움직임",
        data: clip.data,
        media: [clip.file],
      });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveInbody(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data: Record<string, string | number> = { measuredAt: date };
      if (
        !date ||
        date >
          new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 10)
      )
        throw new Error("측정일을 확인해 주세요.");
      for (const [k, label, , min, max] of inbodyFields) {
        if (!inbody[k]?.trim()) continue;
        const n = Number(inbody[k]);
        if (!Number.isFinite(n) || n < min || n > max)
          throw new Error(label + " 수치를 확인해 주세요.");
        data[k] = n;
      }
      if (Object.keys(data).length < 2)
        throw new Error("수치를 한 가지 이상 입력해 주세요.");
      await finish({
        kind: "inbody",
        title: "나의 인바디 기록",
        data,
        media: attachment ? [attachment] : [],
      });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function exportData() {
    const json = JSON.stringify(
      {
        version: 1,
        records: entries.map(({ media, ...e }) => ({
          ...e,
          mediaCount: media.length,
        })),
      },
      null,
      2,
    );
    if (window.NativeHost) {
      window.NativeHost.exportJson(json);
      return;
    }
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "iposture-records.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const stepIndex =
    stage === "select"
      ? 0
      : stage === "review"
        ? names.length + (kind === "precision" ? 1 : 0)
        : step + (kind === "precision" ? 1 : 0);
  return (
    <div className="app">
      <header>
        <button
          className="brand"
          onClick={() => navigate("home")}
          disabled={busy}
        >
          <span>⌁</span> iPosture<span className="dot">.</span>
        </button>
        <small>내 기기에 저장되는 나의 기록</small>
      </header>
      <main>
        {route !== "home" && (
          <button className="back" disabled={busy} onClick={back}>
            ← 돌아가기
          </button>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {busy && status && (
          <p className="status" role="status">
            {status} {progress > 0 ? progress + "%" : ""}
          </p>
        )}
        {route === "home" && (
          <>
            <span className="eyebrow">MY BODY, MY BALANCE</span>
            <h1>오늘, 나의 몸을 알아가는 시간.</h1>
            <p className="muted">
              작은 기록이 모여, 더 균형 있는 나를 만듭니다.
            </p>
            <section className="hero">
              <span>나를 위한 첫 번째 체크인</span>
              <h2>
                몸의 균형을 알고,
                <br />
                움직임의 변화를 기록하세요.
              </h2>
              <p>
                실시간 카메라로 관절을 확인하고
                <br />
                나의 속도로 측정을 시작하세요.
              </p>
              <button className="lime" onClick={() => navigate("choose")}>
                측정 시작하기 →
              </button>
            </section>
            <div className="stats">
              <div>
                <small>전체 기록</small>
                <strong>{entries.length}회</strong>
              </div>
              <div>
                <small>정밀측정</small>
                <strong>
                  {entries.filter((e) => e.kind === "precision").length}회
                </strong>
              </div>
              <div>
                <small>최근 기록</small>
                <strong>
                  {entries[0]
                    ? new Date(entries[0].date).toLocaleDateString("ko-KR", {
                        month: "short",
                        day: "numeric",
                      })
                    : "아직 없어요"}
                </strong>
              </div>
            </div>
          </>
        )}
        {(route === "home" || route === "choose") && (
          <>
            <span className="eyebrow">CHECK IN WITH YOUR BODY</span>
            <h2>
              {route === "choose"
                ? "측정 방법을 선택해 주세요"
                : "어떤 변화를 기록할까요?"}
            </h2>
            <div className={"features " + (route === "choose" ? "choose" : "")}>
              {(route === "choose"
                ? ["body", "precision", "motion"]
                : Object.keys(labels)
              ).map((k) => {
                const kind = k as Entry["kind"];
                return (
                  <button
                    className={"feature feature-" + k}
                    key={k}
                    onClick={() => choose(kind)}
                  >
                    <span className="feature-icon">{symbols[kind]}</span>
                    <div>
                      <h3>{labels[kind]}</h3>
                      <p>{desc[kind]}</p>
                    </div>
                    <b>→</b>
                  </button>
                );
              })}
            </div>
            <p className="notice">
              사진·영상은 분석 서버로 전송하지 않습니다. 이 기기의 같은 앱에서
              기록을 확인해 주세요.
            </p>
          </>
        )}
        {route === "photo" && (
          <section className="flow">
            <Steps
              values={[
                ...(kind === "precision" ? ["동작 선택"] : []),
                ...names,
                "촬영 확인",
              ]}
              index={stepIndex}
            />
            {stage === "select" && (
              <>
                <h2>측정할 부위와 동작을 선택해 주세요</h2>
                <div className="tabs">
                  {[...new Set(motions.map((m) => m.group))].map((g) => (
                    <button
                      className={group === g ? "active" : ""}
                      key={g}
                      onClick={() => {
                        setGroup(g);
                        setKey(motions.find((m) => m.group === g)!.key);
                        setShots([]);
                      }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <label>
                  측정 동작
                  <select
                    value={key}
                    onChange={(e) => {
                      setKey(e.target.value);
                      setShots([]);
                    }}
                  >
                    {motions
                      .filter((m) => m.group === group)
                      .map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label} · {m.view}
                        </option>
                      ))}
                  </select>
                </label>
                <p className="notice">
                  카메라를 고정하고 {motion.view}에서 시작·종료 자세를
                  촬영합니다. 통증 없는 범위에서 움직여 주세요.
                </p>
                <button
                  className="primary full"
                  onClick={() => {
                    setStage("capture");
                    setStep(0);
                  }}
                >
                  정밀측정 촬영 시작 →
                </button>
              </>
            )}
            {stage === "capture" && (
              <>
                <span className="eyebrow">
                  {step + 1} / {names.length} · {labels[kind]}
                </span>
                <h2>{names[step]} 촬영</h2>
                <p className="muted">
                  {kind === "body"
                    ? step === 0
                      ? "카메라를 바라보고 편안하게 서 주세요."
                      : step === 1
                        ? "몸의 오른쪽이 카메라를 향하게 서 주세요."
                        : "카메라를 등지고 서 주세요."
                    : step === 0
                      ? "편안한 시작 자세를 취해 주세요."
                      : motion.label + "한 자세를 취해 주세요."}
                </p>
                <section className="panel capture-panel">
                  {source === "camera" ? (
                    <>
                      <Camera
                        phase={kind + ":" + key + ":" + step}
                        label={names[step]}
                        required={
                          kind === "body" ? bodyRequired(step) : motion.required
                        }
                        blocked={busy}
                        onPhoto={accept}
                        onBusy={setBusy}
                      />
                      <button
                        className="text"
                        disabled={busy}
                        onClick={() => {
                          setSource("upload");
                          setError("");
                        }}
                      >
                        사진에서 선택
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="notice">
                        전신이 보이는 원본 방향의 사진을 선택하세요.
                      </p>
                      {shots[step] && <Photo shot={shots[step]} />}
                      <label className="file-button primary">
                        {names[step]} 사진 선택
                        <input
                          aria-label={names[step] + " 사진"}
                          disabled={busy}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void upload(f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        className="text"
                        disabled={busy}
                        onClick={() => {
                          setSource("camera");
                          setError("");
                        }}
                      >
                        실시간 카메라로 돌아가기
                      </button>
                    </>
                  )}
                </section>
                <p className="hint">
                  촬영이 확인되면{" "}
                  {retake || step === names.length - 1
                    ? "촬영 확인"
                    : names[step + 1] + " 촬영"}{" "}
                  화면으로 자동 이동합니다.
                </p>
                {step > 0 && (
                  <button className="text" disabled={busy} onClick={back}>
                    ← 이전 자세
                  </button>
                )}
              </>
            )}
            {stage === "review" && (
              <>
                <h2>촬영 확인</h2>
                <p className="muted">사진을 확인하고 분석을 시작하세요.</p>
                <div className="photos">
                  {shots.map((shot, i) => (
                    <div className="panel" key={i}>
                      <h3>{names[i]}</h3>
                      <Photo shot={shot} />
                      <button
                        className="full"
                        disabled={busy}
                        onClick={() => {
                          setStep(i);
                          setRetake(true);
                          setStage("capture");
                        }}
                      >
                        {names[i]} 다시 촬영
                      </button>
                    </div>
                  ))}
                </div>
                <p className="notice">
                  계산 각도는 참고용입니다. 원본 정상 기준 DB가 없어 정밀측정의
                  점수·정상 판정은 제공하지 않습니다.
                </p>
                <button
                  className="primary full"
                  disabled={busy}
                  onClick={() => void calculate()}
                >
                  측정 결과 확인하고 저장 →
                </button>
              </>
            )}
          </section>
        )}
        {route === "motion" && (
          <section className="flow">
            <Steps
              values={["촬영 안내", "영상 촬영", "분석 확인"]}
              index={stage === "guide" ? 0 : stage === "capture" ? 1 : 2}
            />
            {stage === "guide" ? (
              <>
                <h2>나의 움직임을 담아보세요</h2>
                <div className="panel">
                  <h3>전신이 보이도록 카메라를 고정해 주세요</h3>
                  <p>
                    1분 이내의 영상을 무음으로 녹화합니다.
                    <br />
                    좌우 무릎·팔꿈치 각도를 1초마다 기록합니다.
                  </p>
                </div>
                <button
                  className="primary full"
                  onClick={() => setStage("capture")}
                >
                  모션 촬영 시작 →
                </button>
              </>
            ) : stage === "capture" ? (
              <>
                <h2>모션 영상 촬영</h2>
                <section className="panel">
                  {source === "camera" ? (
                    <>
                      <Camera
                        phase="motion"
                        label="모션"
                        required={bodyCore}
                        videoMode
                        blocked={busy}
                        onVideo={videoFile}
                        onBusy={setBusy}
                      />
                      <button
                        className="text"
                        disabled={busy}
                        onClick={() => {
                          setSource("upload");
                          setError("");
                        }}
                      >
                        기존 영상에서 선택
                      </button>
                    </>
                  ) : (
                    <>
                      <label className="file-button primary">
                        영상 선택
                        <input
                          aria-label="모션 영상"
                          disabled={busy}
                          type="file"
                          accept="video/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void videoFile(f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        className="text"
                        disabled={busy}
                        onClick={() => setSource("camera")}
                      >
                        실시간 카메라로 돌아가기
                      </button>
                    </>
                  )}
                </section>
              </>
            ) : (
              clip && (
                <>
                  <h2>모션 분석 확인</h2>
                  <Clip blob={clip.file} />
                  <Chart frames={clip.data.frames} />
                  <label>
                    기록 제목
                    <input
                      value={title}
                      maxLength={100}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                  <p className="notice">
                    2D 관절 내각의 참고 기록이며 정밀 ROM 각도와는 다릅니다.
                  </p>
                  <button
                    className="full"
                    disabled={busy}
                    onClick={() => setStage("capture")}
                  >
                    영상 다시 촬영
                  </button>
                  <button
                    className="primary full"
                    disabled={busy}
                    onClick={() => void saveClip()}
                  >
                    영상과 분석 기록 저장
                  </button>
                </>
              )
            )}
          </section>
        )}
        {route === "inbody" && (
          <>
            <span className="eyebrow">MY INBODY</span>
            <h2>인바디 등록</h2>
            <form className="panel" onSubmit={(e) => void saveInbody(e)}>
              <p className="notice">
                결과지 수치를 직접 입력하세요. 사진 첨부는 선택이며 OCR 자동
                인식은 제공하지 않습니다.
              </p>
              <label>
                측정일
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <div className="input-grid">
                {inbodyFields.map(([k, label, unit, min, max]) => (
                  <label key={k}>
                    {label} {unit && "(" + unit + ")"}
                    <input
                      type="number"
                      inputMode="decimal"
                      min={min}
                      max={max}
                      step="any"
                      placeholder="수치 입력"
                      value={inbody[k] || ""}
                      onChange={(e) =>
                        setInbody({ ...inbody, [k]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="file-button">
                결과지 사진 첨부
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.size <= 20 * 1024 * 1024) setAttachment(f);
                    else setError("20MB 이하 사진을 선택해 주세요.");
                  }}
                />
              </label>
              {attachment && <Still blob={attachment} />}
              <button type="submit" className="primary full" disabled={busy}>
                인바디 기록 저장
              </button>
            </form>
          </>
        )}
        {(route === "history" || route === "home") && (
          <section className="history">
            <div className="row">
              <h2>{route === "home" ? "최근 기록" : "나의 기록"}</h2>
              {route === "home" ? (
                <button className="text" onClick={() => navigate("history")}>
                  전체 보기 →
                </button>
              ) : (
                <button
                  className="text"
                  disabled={!entries.length}
                  onClick={exportData}
                >
                  수치 내보내기
                </button>
              )}
            </div>
            {route === "history" && (
              <div className="tabs">
                {[["all", "전체"], ...Object.entries(labels)].map(([k, v]) => (
                  <button
                    className={filter === k ? "active" : ""}
                    key={k}
                    onClick={() => setFilter(k)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
            {entries.length ? (
              <div className="history-list">
                {entries
                  .filter((e) => filter === "all" || e.kind === filter)
                  .slice(0, route === "home" ? 3 : undefined)
                  .map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        setSelected(e);
                        navigate("detail");
                        setSelected(e);
                      }}
                    >
                      <span>{symbols[e.kind]}</span>
                      <div>
                        <strong>{e.title}</strong>
                        <small>
                          {new Date(e.date).toLocaleDateString("ko-KR")}
                        </small>
                      </div>
                      <b>→</b>
                    </button>
                  ))}
              </div>
            ) : (
              <div className="empty">
                <strong>변화의 시작을 기록해 보세요</strong>
                <p>첫 측정을 마치면 나만의 기록이 쌓여요.</p>
                <button className="text" onClick={() => navigate("choose")}>
                  첫 기록 만들기 →
                </button>
              </div>
            )}
          </section>
        )}
        {route === "detail" && selected && (
          <Detail
            value={selected}
            onDelete={async () => {
              await remove(selected.id);
              setSelected(null);
              await refresh();
              setRoute("history");
            }}
          />
        )}
        <footer>
          iPosture · 나를 알아가는 건강한 습관
          <small>측정값은 참고용이며 의료 진단이 아닙니다.</small>
        </footer>
      </main>
      <nav aria-label="주 메뉴">
        {[
          ["home", "⌂", "홈"],
          ["choose", "◎", "측정"],
          ["history", "◷", "기록"],
        ].map(([r, s, l]) => (
          <button
            key={r}
            className={route === r ? "active" : ""}
            disabled={busy}
            onClick={() => navigate(r)}
          >
            <span>{s}</span>
            {l}
          </button>
        ))}
      </nav>
    </div>
  );
}
function Detail({
  value: e,
  onDelete,
}: {
  value: Entry;
  onDelete: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  return (
    <section>
      <span className="eyebrow">MY BODY RECORD</span>
      <h2>{e.title}</h2>
      <p className="muted">{new Date(e.date).toLocaleString("ko-KR")}</p>
      {e.kind === "precision" && (
        <>
          <div className="angle-result">
            <small>측정 각도</small>
            <strong>{e.data.angle}°</strong>
          </div>
          <p className="notice">
            기존 아이포스처 계산 코드 적용 · 정상 기준 데이터가 없어 정상/비정상
            판정은 표시하지 않습니다.
          </p>
        </>
      )}
      {e.kind === "body" && (
        <div className="metrics">
          {e.data.metrics.map((m: any) => (
            <div className="panel" key={m.label}>
              <small>{m.label}</small>
              <strong>{m.value}°</strong>
            </div>
          ))}
        </div>
      )}
      {e.kind === "inbody" && (
        <>
          <p>측정일: {e.data.measuredAt}</p>
          <div className="metrics">
            {inbodyFields
              .filter(([k]) => e.data[k] !== undefined)
              .map(([k, l, u]) => (
                <div className="panel" key={k}>
                  <small>{l}</small>
                  <strong>
                    {e.data[k]} <i>{u}</i>
                  </strong>
                </div>
              ))}
          </div>
        </>
      )}
      {e.kind === "motion" ? (
        <>
          <Clip blob={e.media[0]} />
          <Chart frames={e.data.frames} />
        </>
      ) : (
        <div className="photos">
          {e.media.map((blob, i) =>
            e.data.captures?.[i] ? (
              <Photo key={i} shot={{ ...e.data.captures[i], image: blob }} />
            ) : (
              <Still key={i} blob={blob} />
            ),
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="delete-row">
        {confirm ? (
          <>
            <p>기록을 삭제할까요? 복구할 수 없습니다.</p>
            <button
              className="danger"
              onClick={() =>
                void onDelete().catch((x) => setError(errorText(x)))
              }
            >
              삭제하기
            </button>
            <button onClick={() => setConfirm(false)}>취소</button>
          </>
        ) : (
          <button className="text" onClick={() => setConfirm(true)}>
            이 기록 삭제
          </button>
        )}
      </div>
    </section>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
