export function mapPrecisionInput(
    key: string,
    startLandmarks: any,
    endLandmarks: any,
    out: any,
  ): void {
    if (key === 'NeckLeftLateralFlexion') {
      out['start_bend_left'] = startLandmarks; out['end_bend_left'] = endLandmarks;
    } else if (key === 'NeckRightLateralFlexion') {
      out['start_bend_right'] = startLandmarks; out['end_bend_right'] = endLandmarks;
    } else if (key === 'NeckFlexion') {
      out['start_forward_right'] = startLandmarks; out['end_forward_right'] = endLandmarks;
    } else if (key === 'NeckExtension') {
      out['start_backward_left'] = startLandmarks; out['end_backward_left'] = endLandmarks;
    } else if (key === 'NeckLeftRotation') {
      out['start_rotation_left'] = startLandmarks; out['end_rotation_left'] = endLandmarks;
    } else if (key === 'NeckRightRotation') {
      out['start_rotation_right'] = startLandmarks; out['end_rotation_right'] = endLandmarks;
    } else if (key.includes('Shoulder') && key.includes('Abduction')) {
      if (key.includes('Left')) { out['start_left_arm_up'] = startLandmarks; out['end_left_arm_up'] = endLandmarks; }
      else { out['start_right_arm_up'] = startLandmarks; out['end_right_arm_up'] = endLandmarks; }
    } else if (key.includes('Shoulder') && key.includes('Flexion')) {
      if (key.includes('Left')) { out['start_bend_left'] = startLandmarks; out['end_bend_left'] = endLandmarks; }
      else { out['start_bend_right'] = startLandmarks; out['end_bend_right'] = endLandmarks; }
    } else if (key.includes('Shoulder') && key.includes('Extension')) {
      if (key.includes('Left')) { out['start_straighten_left'] = startLandmarks; out['end_straighten_left'] = endLandmarks; }
      else { out['start_straighten_right'] = startLandmarks; out['end_straighten_right'] = endLandmarks; }
    } else if (key.includes('Shoulder') && key.includes('InternalRotation')) {
      if (key.includes('Left')) { out['start_turn_in_left'] = startLandmarks; out['end_turn_in_left'] = endLandmarks; }
      else { out['start_turn_in_right'] = startLandmarks; out['end_turn_in_right'] = endLandmarks; }
    } else if (key.includes('Shoulder') && key.includes('ExternalRotation')) {
      if (key.includes('Left')) { out['start_turn_out_left'] = startLandmarks; out['end_turn_out_left'] = endLandmarks; }
      else { out['start_turn_out_right'] = startLandmarks; out['end_turn_out_right'] = endLandmarks; }
    } else if (key.includes('Shoulder') && key.includes('Adduction')) {
      if (key.includes('Left')) { out['start_adduction_left'] = startLandmarks; out['end_adduction_left'] = endLandmarks; }
      else { out['start_adduction_right'] = startLandmarks; out['end_adduction_right'] = endLandmarks; }
    } else if (key.includes('Elbow') && key.includes('Flexion')) {
      if (key.includes('Left')) { out['start_bend_left'] = startLandmarks; out['end_bend_left'] = endLandmarks; }
      else { out['start_bend_right'] = startLandmarks; out['end_bend_right'] = endLandmarks; }
    } else if (key.includes('Elbow') && key.includes('Extension')) {
      if (key.includes('Left')) { out['start_straighten_left'] = startLandmarks; out['end_straighten_left'] = endLandmarks; }
      else { out['start_straighten_right'] = startLandmarks; out['end_straighten_right'] = endLandmarks; }
    } else if (key.includes('Trunk') && key.includes('LateralFlexion')) {
      if (key.includes('Left')) { out['start_side_bend_left'] = startLandmarks; out['end_side_bend_left'] = endLandmarks; }
      else { out['start_side_bend_right'] = startLandmarks; out['end_side_bend_right'] = endLandmarks; }
    } else if (key.includes('Trunk') && key.includes('Rotation')) {
      if (key.includes('Left')) { out['start_rotation_left'] = startLandmarks; out['end_rotation_left'] = endLandmarks; }
      else { out['start_rotation_right'] = startLandmarks; out['end_rotation_right'] = endLandmarks; }
    } else if (key === 'TrunkFlexion') {
      out['start_bend_right'] = startLandmarks; out['end_bend_right'] = endLandmarks;
    } else if (key === 'TrunkExtension') {
      out['start_straighten_left'] = startLandmarks; out['end_straighten_left'] = endLandmarks;
    } else if (key.includes('Hip') && key.includes('Adduction')) {
      if (key.includes('Left')) { out['start_inward_left'] = startLandmarks; out['end_inward_left'] = endLandmarks; }
      else { out['start_inward_right'] = startLandmarks; out['end_inward_right'] = endLandmarks; }
    } else if (key.includes('Hip') && key.includes('Abduction')) {
      if (key.includes('Left')) { out['start_move_left'] = startLandmarks; out['end_move_left'] = endLandmarks; }
      else { out['start_move_right'] = startLandmarks; out['end_move_right'] = endLandmarks; }
    } else if (key.includes('Hip') && key.includes('Flexion')) {
      if (key.includes('Left')) { out['start_bend_left'] = startLandmarks; out['end_bend_left'] = endLandmarks; }
      else { out['start_bend_right'] = startLandmarks; out['end_bend_right'] = endLandmarks; }
    } else if (key.includes('Hip') && key.includes('Extension')) {
      if (key.includes('Left')) { out['start_straighten_left'] = startLandmarks; out['end_straighten_left'] = endLandmarks; }
      else { out['start_straighten_right'] = startLandmarks; out['end_straighten_right'] = endLandmarks; }
    } else if (key.includes('Hip') && key.includes('InternalRotation')) {
      if (key.includes('Left')) { out['start_turn_in_left'] = startLandmarks; out['end_turn_in_left'] = endLandmarks; }
      else { out['start_turn_in_right'] = startLandmarks; out['end_turn_in_right'] = endLandmarks; }
    } else if (key.includes('Hip') && key.includes('ExternalRotation')) {
      if (key.includes('Left')) { out['start_turn_out_left'] = startLandmarks; out['end_turn_out_left'] = endLandmarks; }
      else { out['start_turn_out_right'] = startLandmarks; out['end_turn_out_right'] = endLandmarks; }
    } else if (key.includes('Knee') && key.includes('Flexion')) {
      if (key.includes('Left')) { out['start_bend_left'] = startLandmarks; out['end_bend_left'] = endLandmarks; }
      else { out['start_bend_right'] = startLandmarks; out['end_bend_right'] = endLandmarks; }
    } else if (key.includes('Knee') && key.includes('Extension')) {
      if (key.includes('Left')) { out['start_straighten_left'] = startLandmarks; out['end_straighten_left'] = endLandmarks; }
      else { out['start_straighten_right'] = startLandmarks; out['end_straighten_right'] = endLandmarks; }
    } else if (key.includes('Ankle') && key.includes('Dorsiflexion')) {
      if (key.includes('Left')) { out['start_bend_left'] = startLandmarks; out['end_bend_left'] = endLandmarks; }
      else { out['start_bend_right'] = startLandmarks; out['end_bend_right'] = endLandmarks; }
    } else if (key.includes('Ankle') && key.includes('Plantarflexion')) {
      if (key.includes('Left')) { out['start_extension_left'] = startLandmarks; out['end_extension_left'] = endLandmarks; }
      else { out['start_extension_right'] = startLandmarks; out['end_extension_right'] = endLandmarks; }
    } else if (key.includes('Ankle') && key.includes('Inversion')) {
      if (key.includes('Left')) { out['start_inward_left'] = startLandmarks; out['end_inward_left'] = endLandmarks; }
      else { out['start_inward_right'] = startLandmarks; out['end_inward_right'] = endLandmarks; }
    } else if (key.includes('Ankle') && key.includes('Eversion')) {
      if (key.includes('Left')) { out['start_outward_left'] = startLandmarks; out['end_outward_left'] = endLandmarks; }
      else { out['start_outward_right'] = startLandmarks; out['end_outward_right'] = endLandmarks; }
    }
  }
