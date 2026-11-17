import { useState, type ReactNode } from "react";
import { bodyRequired, motions, missing } from "./engine";
import type { Entry } from "./store";
import {
  changeValue,
  formatValue,
  kindLabels,
  previousEntry,
  reportRows,
} from "./report-data";
export function Report({
  entries,
  initialId,
  media,
}: {
  entries: Entry[];
  initialId?: string;
  media: (e: Entry) => ReactNode;
}) {
  const [id, setId] = useState(initialId || entries[0]?.id || "");
  const current = entries.find((e) => e.id === id) || entries[0];
  const previous = current && previousEntry(current, entries);
  const rows = current ? reportRows(current) : [];
  const previousRows = previous ? reportRows(previous) : [];
  const available = rows.filter((r) => r.value !== null).length;
  const [printing, setPrinting] = useState(false);
  function print() {
    if (window.NativeHost?.printReport) window.NativeHost.printReport();
    else window.print();
  }
  async function preparePrint() {
    setPrinting(true);
    try {
      await document.fonts.ready;
      await Promise.all(
        Array.from(
          document.querySelectorAll<HTMLImageElement>(
            ".measurement-report img",
          ),
        ).map((img) => img.decode().catch(() => {})),
      );
      print();
    } finally {
      setPrinting(false);
    }
  }
  return (
    <section className="measurement-report">
      <div className="row">
        <div>
          <span className="eyebrow">MY MEASUREMENT REPORT</span>
          <h2>나의 측정 리포트</h2>
        </div>
        {current && (
          <button
            className="primary no-print"
            disabled={printing}
            onClick={() => void preparePrint()}
          >
            PDF 저장 / 인쇄
          </button>
        )}
      </div>
      <div className="report-overview">
        {Object.entries(kindLabels).map(([kind, label]) => (
          <div className="panel" key={kind}>
            <small>{label}</small>
            <strong>{entries.filter((e) => e.kind === kind).length}회</strong>
          </div>
        ))}
      </div>
      {!current ? (
        <div className="panel">
          <h3>아직 측정 기록이 없어요</h3>
          <p>
            측정을 저장하면 사진과 결과, 이전 측정 대비 변화를 리포트에서 확인할
            수 있어요.
          </p>
        </div>
      ) : (
        <>
          <label className="no-print report-picker">
            리포트에 표시할 기록
            <select value={current.id} onChange={(e) => setId(e.target.value)}>
              {entries.map((e) => (
                <option key={e.id} value={e.id}>
                  {new Date(e.date).toLocaleString("ko-KR")} · {e.title}
                </option>
              ))}
            </select>
          </label>
          <div className="panel report-heading">
            <small>{kindLabels[current.kind]} · 측정 기록</small>
            <h3>{current.title}</h3>
            <p>{new Date(current.date).toLocaleString("ko-KR")}</p>
            {current.kind === "inbody" && (
              <p>결과지 측정일: {current.data.measuredAt}</p>
            )}
            <p>
              계산 가능 {available}/{rows.length}항목 ·{" "}
              {rows.length - available}항목 측정 불가
            </p>
          </div>
          <h3>측정 결과와 변화</h3>
          <p className="muted">
            {previous
              ? `비교 기록: ${new Date(previous.date).toLocaleString("ko-KR")} · ${previous.title}`
              : "같은 종류의 이전 기록이 쌓이면 변화를 비교할 수 있어요."}
          </p>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>항목</th>
                  <th>이번 측정</th>
                  <th>이전 측정</th>
                  <th>변화</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const prev = previousRows.find((p) => p.key === row.key);
                  const delta = changeValue(row.value, prev?.value);
                  return (
                    <tr key={row.key}>
                      <th>
                        {row.label}
                        <small>{row.note}</small>
                      </th>
                      <td>{formatValue(row.value, row.unit)}</td>
                      <td>{prev ? formatValue(prev.value, prev.unit) : "—"}</td>
                      <td>
                        {delta === null
                          ? "—"
                          : `${delta > 0 ? "+" : ""}${delta}${row.unit}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {available < rows.length && (
            <p className="notice">
              미인식 관절이나 계산할 수 없는 항목은 ‘측정 불가’로 남겼습니다.
              사진과 영상은 저장되어 있으며 다시 촬영해 기록을 추가할 수 있어요.
            </p>
          )}
          {current.data.captures?.length > 0 && (
            <div className="panel report-quality">
              <h3>촬영별 관절 인식</h3>
              {current.data.captures.map((capture: any, i: number) => {
                const required =
                  current.kind === "body"
                    ? bodyRequired(i)
                    : motions.find((m) => m.key === current.data.key)
                        ?.required || [];
                const absent = missing(
                  capture.points || {},
                  required,
                  capture.height / capture.width,
                );
                const name =
                  current.kind === "body"
                    ? ["정면", "우측면", "후면"][i]
                    : ["시작 자세", "움직인 자세"][i];
                return (
                  <p key={i}>
                    {name}: 계산용 관절 {required.length - absent.length}/
                    {required.length}개 인식
                    {absent.length
                      ? " · 일부 항목의 계산에 제한이 있어요."
                      : ""}
                  </p>
                );
              })}
            </div>
          )}
          <div className="report-media">
            <h3>
              {current.kind === "motion"
                ? "촬영 영상과 관절 각도"
                : "측정 사진"}
            </h3>
            {media(current)}
            {!current.media.length && (
              <p className="muted">첨부 사진이 없습니다.</p>
            )}
          </div>
          <div className="panel report-notes">
            <h3>리포트 읽는 방법</h3>
            <p>
              변화는 이번 값에서 이전 값을 뺀 수치입니다. 촬영 방향·거리·자세와
              측정 동작을 같게 맞춰 비교해 주세요. 각도 변화의 크기만으로
              개선·악화를 판단하지 않습니다.
            </p>
            <p>
              {current.kind === "motion"
                ? "모션은 1초마다 관측한 팔꿈치·무릎의 2D 각도입니다. 변화 폭은 관측 최대값과 최소값의 차이이며 정밀측정의 가동범위와 다릅니다. 가려진 구간은 그래프에서 비워 둡니다."
                : current.kind === "inbody"
                  ? "인바디 수치는 사용자가 직접 입력한 결과지 값입니다."
                  : "각도는 제공된 아이포스처 계산 로직으로 산출했습니다. 정상 기준 데이터가 없어 정상·비정상 분류나 종합 점수는 표시하지 않습니다."}
            </p>
            <small>
              이 리포트는 개인 기록용이며 의료 진단이나 운동 처방이 아닙니다.
            </small>
          </div>
        </>
      )}
    </section>
  );
}
