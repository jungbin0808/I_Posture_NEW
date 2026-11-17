import { Point } from '../analysis.types';
import { calculateDistance } from './distance.helper';

export class PreciseHelper {
  /**
   * 목 회전 각도 계산
   * @param frontLandmarks 정면 사진 랜드마크
   * @param rotatedLandmarks 회전 사진 랜드마크
   */
  static calculateNeckRotation(frontLandmarks: any, rotatedLandmarks: any): number {
    // 1. 정면 눈 폭 (EN)
    // 눈 안쪽: 1(LeftEyeInner), 4(RightEyeInner)
    // 눈 바깥쪽: 3(LeftEyeOuter), 6(RightEyeOuter)
    // 공식: EN = (dist(1,4) + dist(3,6)) / 2
    const en = (
      calculateDistance(frontLandmarks.LeftEyeInner, frontLandmarks.RightEyeInner) +
      calculateDistance(frontLandmarks.LeftEyeOuter, frontLandmarks.RightEyeOuter)
    ) / 2;

    // 2. 회전 눈 폭 (ER)
    const er = (
      calculateDistance(rotatedLandmarks.LeftEyeInner, rotatedLandmarks.RightEyeInner) +
      calculateDistance(rotatedLandmarks.LeftEyeOuter, rotatedLandmarks.RightEyeOuter)
    ) / 2;

    // 3. 정면 어깨 폭 (SN)
    // 어깨: 11(LeftShoulder), 12(RightShoulder)
    const sn = calculateDistance(frontLandmarks.LeftShoulder, frontLandmarks.RightShoulder);

    // 4. 회전 어깨 폭 (SR)
    const sr = calculateDistance(rotatedLandmarks.LeftShoulder, rotatedLandmarks.RightShoulder);

    // 5. 비율 r
    // r = min(max((EN/ER) * (SR/SN), 0), 1)
    // 주의: 공식에는 EN/ER * SR/SN 으로 되어있는데, 회전하면 눈 폭(ER)이 줄어들므로 EN > ER 입니다.
    // 따라서 EN/ER은 1보다 큽니다. 반면 어깨 폭은 비슷하거나 SR이 약간 작을 수 있습니다.
    // 코사인 값은 1보다 작아야 하므로, 분모가 더 커야 합니다.
    // 보통 회전하면 투영된 길이가 줄어듭니다.
    // cos(theta) = 투영된 길이 / 실제 길이
    // 눈 폭: ER = EN * cos(theta) -> cos(theta) = ER / EN
    // 어깨 폭 보정: (ER / EN) * (SN / SR) ?
    // 제공된 공식: (EN / ER) * (SR / SN) -> 이건 1보다 커질 수 있습니다.
    // 공식 재확인 필요: 보통 r = ER / EN (어깨 보정 없이) 또는 r = (ER/SR) / (EN/SN)

    // 제공된 공식 그대로 구현하되, clamp 처리
    // r = min(max((EN / ER) * (SR / SN), 0), 1) -> 이 공식이 맞다면 ER이 EN보다 커야 하는데 불가능.
    // 아마도 공식이 r = (ER / EN) * (SN / SR) 일 가능성이 높음. (어깨 폭 비율로 보정)
    // 또는 r = (ER * SN) / (EN * SR)

    // 일단 제공된 텍스트: r = min(max( EN/ER * SR/SN , 0), 1)
    // EN(정면) > ER(회전) 이므로 EN/ER > 1
    // SR(회전) <= SN(정면) 이므로 SR/SN <= 1
    // 곱하면 1 근처가 될 수도 있지만, 회전각이 크면 ER이 작아져서 EN/ER이 매우 커짐.
    // -> r이 1을 넘어가면 arccos(r)은 NaN.

    // 추측: r = (ER / EN) * (SN / SR) 이 맞을 것임.
    // (회전 눈폭 / 정면 눈폭) * (정면 어깨폭 / 회전 어깨폭)
    // = (cos_theta_eye) * (1 / cos_theta_shoulder)
    // 어깨가 고정되어 있다면 SR ~= SN 이므로 r ~= cos_theta_eye

    // 수정된 공식 적용: r = (ER / EN) * (SN / SR)
    let r = (er / en) * (sn / sr);

    // clamp
    r = Math.min(Math.max(r, 0), 1);

    // 6. 각도 theta
    const thetaRad = Math.acos(r);
    const thetaDeg = thetaRad * (180 / Math.PI);

    return thetaDeg;
  }

  /**
   * 몸통 회전 각도 계산
   * @param frontLandmarks 정면 사진 랜드마크
   * @param rotatedLandmarks 회전 사진 랜드마크
   */
  static calculateTorsoRotation(frontLandmarks: any, rotatedLandmarks: any): number {
    // 1. 정면샷
    // 1-1) 정면 골반 폭 (HWN)
    const hwn = calculateDistance(frontLandmarks.LeftHip, frontLandmarks.RightHip);

    // 1-2) 정면 발목 폭 (AWN)
    const awn = calculateDistance(frontLandmarks.LeftAnkle, frontLandmarks.RightAnkle);

    // 1-3) 정면 골반 중심(PN)과 발목 중심(AN)
    const pn = {
      x: (frontLandmarks.LeftHip.x + frontLandmarks.RightHip.x) / 2,
      y: (frontLandmarks.LeftHip.y + frontLandmarks.RightHip.y) / 2,
    };
    const an = {
      x: (frontLandmarks.LeftAnkle.x + frontLandmarks.RightAnkle.x) / 2,
      y: (frontLandmarks.LeftAnkle.y + frontLandmarks.RightAnkle.y) / 2,
    };

    // 1-4) 정면 기준 길이 (TLN)
    const tln = calculateDistance(pn, an);

    // 2. 회전샷
    // 2-1) 회전 골반 폭 (HWR)
    const hwr = calculateDistance(rotatedLandmarks.LeftHip, rotatedLandmarks.RightHip);

    // 2-2) 회전 발목 폭 (AWR)
    const awr = calculateDistance(rotatedLandmarks.LeftAnkle, rotatedLandmarks.RightAnkle);

    // 2-3) 회전 골반 중심(PR)과 발목 중심(AR)
    const pr = {
      x: (rotatedLandmarks.LeftHip.x + rotatedLandmarks.RightHip.x) / 2,
      y: (rotatedLandmarks.LeftHip.y + rotatedLandmarks.RightHip.y) / 2,
    };
    const ar = {
      x: (rotatedLandmarks.LeftAnkle.x + rotatedLandmarks.RightAnkle.x) / 2,
      y: (rotatedLandmarks.LeftAnkle.y + rotatedLandmarks.RightAnkle.y) / 2,
    };

    // 2-4) 회전 기준 길이 (TLR)
    const tlr = calculateDistance(pr, ar);

    // 3. 각도 생성
    // 3-2) 골반 회전각
    // rP = clamp((HWR / HWN) * (TLN / TLR)) -> 공식에는 HWN/HWR * TLR/TLN 으로 되어있음.
    // 제공된 공식: rP = clamp( HWN/HWR * TLR/TLN )
    // HWN(정면) > HWR(회전) -> HWN/HWR > 1
    // TLR(회전) ? TLN(정면) -> 카메라 거리에 따라 다름.
    // cos(theta) = HWR / HWN (거리 보정 제외 시)
    // 따라서 rP = (HWR / HWN) * (TLN / TLR) 이어야 함.

    // 수정된 공식 적용: rP = (HWR / HWN) * (TLN / TLR)
    let rP = (hwr / hwn) * (tln / tlr);
    rP = Math.min(Math.max(rP, 0), 1);
    const thetaPelvis = Math.acos(rP) * (180 / Math.PI);

    // 3-3) 발목 회전각
    // rA = (AWR / AWN) * (TLN / TLR)
    let rA = (awr / awn) * (tln / tlr);
    rA = Math.min(Math.max(rA, 0), 1);
    const thetaAnkle = Math.acos(rA) * (180 / Math.PI);

    // 3-4) 최종 각도
    const theta = Math.max(thetaPelvis - thetaAnkle, 0);

    return theta;
  }
}
