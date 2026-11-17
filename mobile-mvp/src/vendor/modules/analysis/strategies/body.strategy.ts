import { AnalyticResult } from './analytic.result';
import { AnalyticStrategy } from './analytic.strategy';
import { AnkleAnalysis } from './body/ankle.analysis';
import { BackAnalysis } from './body/back.analysis';
import { BalanceIndexAnalysis } from './body/balance-index.analysis';
import { HipJointAnalysis } from './body/hip-joint.analysis';
import { KneeAnalysis } from './body/knee.analysis';
import { LowerLimbAlignmentAnalysis } from './body/lower-limb-alignment.analysis';
import { NeckAnalysis } from './body/neck.analysis';
import { PelvisAnalysis } from './body/pelvis.analysis';
import { ShoulderAnalysis } from './body/shoulder.analysis';
import { TorsoAnalysis } from './body/torso.analysis';
import { UpperArmAnalysis } from './body/upper-arm.analysis';
import { DiseaseResult, Landmarks, ScoreDetail } from '../analysis.types';

export class BodyStrategy implements AnalyticStrategy {
  constructor(
    private readonly ankleAnalysis: AnkleAnalysis,
    private readonly backAnalysis: BackAnalysis,
    private readonly hipJointAnalysis: HipJointAnalysis,
    private readonly kneeAnalysis: KneeAnalysis,
    private readonly lowerLimbAlignmentAnalysis: LowerLimbAlignmentAnalysis,
    private readonly neckAnalysis: NeckAnalysis,
    private readonly pelvisAnalysis: PelvisAnalysis,
    private readonly shoulderAnalysis: ShoulderAnalysis,
    private readonly torsoAnalysis: TorsoAnalysis,
    private readonly upperArmAnalysis: UpperArmAnalysis,
    private readonly balanceIndexAnalysis: BalanceIndexAnalysis,
  ) {}

  async execute(landmarks: Landmarks): Promise<AnalyticResult> {
    //do analytic body
    let disease: DiseaseResult[] = [];
    const scoreDetail: ScoreDetail = {};

    scoreDetail.neck = this.neckAnalysis.execute(landmarks, scoreDetail);
    scoreDetail.back = this.backAnalysis.execute(landmarks, scoreDetail);
    scoreDetail.shoulder = this.shoulderAnalysis.execute(
      landmarks,
      scoreDetail,
    );
    scoreDetail.knee = this.kneeAnalysis.execute(landmarks, scoreDetail);
    scoreDetail.upperArm = this.upperArmAnalysis.execute(
      landmarks,
      scoreDetail,
    );
    scoreDetail.pelvis = this.pelvisAnalysis.execute(landmarks, scoreDetail);
    scoreDetail.lowerLimbAlignment = this.lowerLimbAlignmentAnalysis.execute(
      landmarks,
      scoreDetail,
    );
    scoreDetail.ankle = this.ankleAnalysis.execute(landmarks, scoreDetail);
    scoreDetail.torso = this.torsoAnalysis.execute(landmarks, scoreDetail);
    scoreDetail.hipJoint = this.hipJointAnalysis.execute(
      landmarks,
      scoreDetail,
    );
    scoreDetail.balanceIndex = this.balanceIndexAnalysis.execute(
      landmarks,
      scoreDetail,
    );
    disease = disease.concat(
      this.neckAnalysis.disease,
      this.backAnalysis.disease,
      this.shoulderAnalysis.disease,
      this.kneeAnalysis.disease,
      this.upperArmAnalysis.disease,
      this.pelvisAnalysis.disease,
      this.lowerLimbAlignmentAnalysis.disease,
      this.ankleAnalysis.disease,
      this.torsoAnalysis.disease,
      this.hipJointAnalysis.disease,
    );
    disease.sort((a, b) => b.score - a.score);

    const score =
      ((this.neckAnalysis.score +
        this.shoulderAnalysis.score +
        this.pelvisAnalysis.score +
        this.lowerLimbAlignmentAnalysis.score +
        this.kneeAnalysis.score +
        this.backAnalysis.score +
        this.upperArmAnalysis.score +
        this.torsoAnalysis.score +
        this.hipJointAnalysis.score +
        this.ankleAnalysis.score) /
        10 +
        this.balanceIndexAnalysis.score) /
      2;
    return new AnalyticResult(score, scoreDetail, disease);
  }
}
