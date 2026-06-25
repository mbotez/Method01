// Skin report generation logic based on questionnaire answers
// This replaces the AI-generated reports with deterministic rule-based sentence generation.

export interface UserProfileAnswers {
  skin_type?: string;
  breakout_type?: string | string[] | null;
  barrier_risk?: number;
  burn_risk?: string;
  sunscreen?: string;
  redness_score?: number | null;
  wrinkles_score?: number | null;
  redness_main_area?: string | null;
  wrinkels_main_area?: string | null;
  scan_acne_type?: string | null;
  [key: string]: any;
}

/**
 * Maps questionnaire answers into the structure saved in the `user_profile` table in Supabase.
 */
export function mapAnswersToProfile(answers: any): UserProfileAnswers {
  if (!answers) return {};

  const feelMap: Record<string, string> = {
    'Dry and tight': 'dry',
    'Oily all over': 'oily',
    'Comfortable': 'normal',
    'Oily forehead and nose, but dry cheeks': 'combination'
  };

  const sunMap: Record<string, string> = {
    'I burn like a lobster': 'high',
    'Burn then tan': 'medium',
    'Got no problems tanning': 'low'
  };

  const reactionMap: Record<string, number> = {
    'Very good, no problems': 0,
    'Sometimes sensitive': 1,
    'Often get redness, bumps, or burning': 2,
    'Almost everything irritates my skin': 3
  };

  const sensitivityList = answers.sensitivity || [];
  const symptomsScore = sensitivityList.length;
  const reactionScore = reactionMap[answers.reaction] || 0;

  return {
    skin_type: feelMap[answers.feel] || 'normal',
    breakout_type: answers.breakoutType || [],
    barrier_risk: symptomsScore + reactionScore,
    burn_risk: sunMap[answers.sun] || 'medium',
    sunscreen: answers.sunscreen || 'Sometimes',
    redness_score: answers.redness_score !== undefined ? Number(answers.redness_score) : null,
    wrinkles_score: answers.wrinkles_score !== undefined ? Number(answers.wrinkles_score) : null,
    redness_main_area: answers.redness_main_area || null,
    wrinkels_main_area: answers.wrinkels_main_area || null,
    scan_acne_type: answers.scan_acne_type || null,
    sex: answers.sex || null,
    pregnant: answers.pregnant || null,
    actives_used: answers.activesUsed || []
  };
}

/**
 * Generates the 3-sentence skin report from user profile attributes according to sentence rules.
 */
export function generateSkinReportText(profile: UserProfileAnswers): string {
  if (!profile) return '';

  // --- Helpers for Semantic Matching & Defaults ---
  const skin_type = profile.skin_type || 'normal';
  let skinTypeWithSkin = skin_type;
  if (!skinTypeWithSkin.toLowerCase().includes('skin')) {
    skinTypeWithSkin += ' skin';
  }

  // Handle breakout_type null check
  const isBreakoutNull = (
    !profile.breakout_type ||
    (Array.isArray(profile.breakout_type) && profile.breakout_type.filter(t => t && t.toLowerCase() !== 'none').length === 0) ||
    (typeof profile.breakout_type === 'string' && (profile.breakout_type.trim() === '' || profile.breakout_type.toLowerCase() === 'none'))
  );

  const BREAKOUT_DISPLAY_MAP: Record<string, string> = {
    whiteheads: 'whiteheads',
    blackheads: 'blackheads',
    pie: 'pink/red acne marks (PIE)',
    pih: 'dark acne marks (PIH)',
    papules: 'papules',
    conglo: 'conglobate acne',
    pustules: 'pustules',
    nodules: 'nodules',
    cystic: 'cystic acne'
  };

  // Format breakout_type for display S1.a / S1.b
  let breakout_display = '';
  if (Array.isArray(profile.breakout_type)) {
    const validTypes = profile.breakout_type.filter(t => t && t.toLowerCase() !== 'none');
    if (validTypes.length > 0) {
      breakout_display = validTypes.map(t => {
        const val = t.toLowerCase();
        return BREAKOUT_DISPLAY_MAP[val] || val;
      }).join(', ');
      const lastComma = breakout_display.lastIndexOf(', ');
      if (lastComma !== -1) {
        breakout_display = breakout_display.substring(0, lastComma) + ' and ' + breakout_display.substring(lastComma + 2);
      }
    }
  } else if (typeof profile.breakout_type === 'string' && profile.breakout_type.trim() && profile.breakout_type.toLowerCase() !== 'none') {
    const val = profile.breakout_type.toLowerCase();
    breakout_display = BREAKOUT_DISPLAY_MAP[val] || val;
  }

  // Handle scan_acne_type null check
  const isScanAcneNull = (
    !profile.scan_acne_type || 
    profile.scan_acne_type.trim() === '' || 
    profile.scan_acne_type.toLowerCase() === 'none'
  );

  let scan_acne_display = '';
  if (profile.scan_acne_type && profile.scan_acne_type.toLowerCase() !== 'none') {
    scan_acne_display = profile.scan_acne_type.toLowerCase();
  }

  // Semantic matcher for breakout_type and scan_acne_type
  function breakoutMatchesScan(breakoutVal: string, scanVal: string): boolean {
    const b = breakoutVal.toLowerCase().trim();
    const s = scanVal.toLowerCase().trim();
    if (b === s) return true;
    if (b.includes(s) || s.includes(b)) return true;
    
    // Semantic equivalent matching:
    if (b.includes('cystic') && s.includes('cystic')) return true;
    if (b.includes('blackhead') && (s.includes('blackhead') || s.includes('open comedone') || s.includes('open_comedone'))) return true;
    if (b.includes('whitehead') && (s.includes('whitehead') || s.includes('closed comedone') || s.includes('closed_comedone'))) return true;
    if (b.includes('pimple') && (s.includes('papule') || s.includes('pustule') || s.includes('inflam'))) return true;
    if (b.includes('bump') && (s.includes('papule') || s.includes('comedone'))) return true;
    if (b.includes('mark') || b.includes('spot')) {
      if (s.includes('hyperpigmentation') || s.includes('erythema') || s.includes('pie') || s.includes('pih')) return true;
    }
    return false;
  }

  function doesBreakoutMatchScanAcne(breakoutType: string | string[] | null | undefined, scanAcneType: string | null | undefined): boolean {
    if (!breakoutType || !scanAcneType) return false;
    if (scanAcneType.toLowerCase() === 'none') return false;
    
    const scanVal = scanAcneType;
    if (Array.isArray(breakoutType)) {
      const validTypes = breakoutType.filter(t => t && t.toLowerCase() !== 'none');
      return validTypes.some(b => breakoutMatchesScan(b, scanVal));
    } else {
      return breakoutMatchesScan(breakoutType, scanVal);
    }
  }

  // --- First sentence: ---
  // 'You told us that you have [skin_type]' & 
  // S1.a. if user [breakout_type] not null AND [breakout_type] = [scan_acne_type], then 'with signs of [breakout_type].'.
  // S1.b. if user [breakout_type] not null AND [breakout_type] != [scan_acne_type], then 'with signs of [breakout_type], however your face scan shows it might actually be [scan_acne_type].'.
  // S1.c. if user [breakout_type] = null AND [scan_acne_type] = not null, then ' and your face scan shows signs of [scan_acne_type].'.
  // d. if user [breakout_type] = null AND [scan_acne_type] = null, then ' and your face is as clear as it gets'.
  let firstSentence = `You told us that you have ${skinTypeWithSkin}`;

  if (!isBreakoutNull) {
    const isAcneMatch = doesBreakoutMatchScanAcne(profile.breakout_type, profile.scan_acne_type);
    if (isAcneMatch) {
      // S1.a
      firstSentence += ` with signs of ${breakout_display}.`;
    } else {
      // S1.b
      firstSentence += ` with signs of ${breakout_display}, however your face scan shows it might actually be ${scan_acne_display}.`;
    }
  } else {
    if (!isScanAcneNull) {
      // S1.c
      firstSentence += ` and your face scan shows signs of ${scan_acne_display}.`;
    } else {
      // d (S1.d)
      firstSentence += ` and your face is as clear as it gets.`;
    }
  }

  // --- Second sentence: ---
  // 'Your skin barrier appears to be ' &
  // S2.I. if [barrier_risk] <=3 then 'healthy' 
  // S2.II. if [barrier_risk] >3 and <=7 then 'slightly compromised' 
  // S2.III. if [barrier_risk] >7 then 'highly compromised' 

  const barrier_risk = profile.barrier_risk != null ? Number(profile.barrier_risk) : 0;
  const burn_risk = (profile.burn_risk || 'medium').toLowerCase();
  const redness_score = profile.redness_score != null ? Number(profile.redness_score) : 0;
  
  const redness_area_raw = profile.redness_main_area;
  const redness_main_area = (redness_area_raw && redness_area_raw.toLowerCase() !== 'none') 
    ? redness_area_raw.toLowerCase() 
    : 'face';

  let secondSentence = 'Your skin barrier appears to be ';

  // --- S2.I: healthy ([barrier_risk] <=3) ---
  if (barrier_risk <= 3) {
    secondSentence += 'healthy';
    
    if (burn_risk === 'low' && redness_score < 30) {
      // S2.I.a
      secondSentence += `, you don't burn easily under the sun and show minimal signs of redness / irritation. Not much to worry about but continue taking good care of your barrier.`;
    } else if (burn_risk === 'low' && redness_score >= 30 && redness_score < 75) {
      // S2.I.b
      secondSentence += `, you don't burn easily under the sun but there's some signs of redness / irritation on your ${redness_main_area}. Make sure to continue taking good care of your barrier.`;
    } else if (burn_risk === 'low' && redness_score >= 75) {
      // S2.I.c
      secondSentence += `, you don't burn easily under the sun but your face scan shows quite a bit of redness / irritation on your ${redness_main_area}. You should be mindful of protecting your barrier while you focus on the rest of your goals.`;
    } else if (burn_risk === 'medium' && redness_score < 30) {
      // S2.I.d
      secondSentence += `, you don't do too badly under the sun and your face scan shows minimal signs of redness / irritation. Make sure to continue taking good care of your barrier.`;
    } else if (burn_risk === 'medium' && redness_score >= 30 && redness_score < 75) {
      // S2.I.e
      secondSentence += `, you don't do too badly under the sun but there's some signs of redness / irritation on your ${redness_main_area}. Make sure to continue taking good care of your barrier.`;
    } else if (burn_risk === 'medium' && redness_score >= 75) {
      // S2.I.f
      secondSentence += `, you don't do too badly under the sun but your face scan shows quite a bit of redness / irritation on your ${redness_main_area}. You should be mindful of protecting your barrier while you focus on the rest of your goals.`;
    } else if (burn_risk === 'high' && redness_score < 30) {
      // S2.I.g
      secondSentence += `, your face scan shows minimal signs of redness / irritation but you burn easily under the sun. You should be mindful of protecting your barrier while you focus on the rest of your goals.`;
    } else if (burn_risk === 'high' && redness_score >= 30 && redness_score < 75) {
      // S2.I.h
      secondSentence += `, but you burn easily under the sun and there's some signs of redness / irritation on your ${redness_main_area}. You should be mindful of protecting your barrier while you focus on the rest of your goals.`;
    } else if (burn_risk === 'high' && redness_score >= 75) {
      // S2.I.i
      secondSentence += `, but you burn easily under the sun and your face scan shows quite a bit of redness / irritation on your ${redness_main_area}. You should be mindful of protecting your barrier while you focus on the rest of your goals.`;
    } else {
      secondSentence += '.';
    }
  } 
  // --- S2.II: slightly compromised ([barrier_risk] >3 and <=7) ---
  else if (barrier_risk > 3 && barrier_risk <= 7) {
    secondSentence += 'slightly compromised';
    
    if (burn_risk === 'low' && redness_score < 30) {
      // S2.II.a
      secondSentence += `, but you don't burn easily under the sun and show minimal signs of redness / irritation. Make sure to continue taking good care of your barrier.`;
    } else if (burn_risk === 'low' && redness_score >= 30 && redness_score < 75) {
      // S2.II.b
      secondSentence += `, you don't burn easily under the sun but there's some signs of redness / irritation on your ${redness_main_area}. You should be mindful of protecting your barrier while you focus on the rest of your goals.`;
    } else if (burn_risk === 'low' && redness_score >= 75) {
      // S2.II.c
      secondSentence += `, you don't burn easily under the sun but your face scan shows quite a bit of redness / irritation on your ${redness_main_area}. You should be mindful of protecting your barrier while you focus on the rest of your goals.`;
    } else if (burn_risk === 'medium' && redness_score < 30) {
      // S2.II.d
      secondSentence += `, you don't do too badly under the sun and your face scan shows minimal signs of redness / irritation. Make sure to continue taking good care of your barrier.`;
    } else if (burn_risk === 'medium' && redness_score >= 30 && redness_score < 75) {
      // S2.II.e
      secondSentence += `, you don't do too badly under the sun but there's some signs of redness / irritation on your ${redness_main_area}. You should be mindful of protecting your barrier while you focus on the rest of your goals.`;
    } else if (burn_risk === 'medium' && redness_score >= 75) {
      // S2.II.f
      secondSentence += `, you don't do too badly under the sun but your face scan shows quite a bit of redness / irritation on your ${redness_main_area}. You should be mindful of protecting your barrier while you focus on the rest of your goals.`;
    } else if (burn_risk === 'high' && redness_score < 30) {
      // S2.II.g
      secondSentence += `, you burn easily under the sun but your face scan shows minimal signs of redness / irritation at the moment. Make sure to continue taking good care of your barrier.`;
    } else if (burn_risk === 'high' && redness_score >= 30 && redness_score < 75) {
      // S2.II.h
      secondSentence += `, you burn easily under the sun and there's some signs of redness / irritation on your ${redness_main_area}. You should be mindful of protecting your barrier while you focus on the rest of your goals.`;
    } else if (burn_risk === 'high' && redness_score >= 75) {
      // S2.II.i
      secondSentence += `, you burn easily under the sun and your face scan shows quite a bit of redness / irritation on your ${redness_main_area}. You should be mindful of protecting your barrier while you focus on the rest of your goals.`;
    } else {
      secondSentence += '.';
    }
  } 
  // --- S2.III: highly compromised ([barrier_risk] >7) ---
  else if (barrier_risk > 7) {
    secondSentence += 'highly compromised';
    
    if (burn_risk === 'low' && redness_score < 30) {
      // S2.III.a
      secondSentence += `, you don't burn easily under the sun and your face scan shows minimal signs of redness / irritation at the moment. However your focus should be on repairing your barrier for the next 2-4 weeks. Once your skin starts feeling less irritated, you can start working on your other goals.`;
    } else if (burn_risk === 'low' && redness_score >= 30 && redness_score < 75) {
      // S2.III.b
      secondSentence += `, you don't burn easily under the sun but there's some signs of redness / irritation on your ${redness_main_area}. Your focus should be on repairing your barrier for the next 2-4 weeks. Once your skin starts feeling less irritated, you can start working on your other goals.`;
    } else if (burn_risk === 'low' && redness_score >= 75) {
      // S2.III.c
      secondSentence += `, you don't burn easily under the sun but your face scan shows quite a bit of redness / irritation on your ${redness_main_area}. Your focus should be on repairing your barrier for the next 2-4 weeks. Once your skin starts feeling less irritated, you can start working on your other goals.`;
    } else if (burn_risk === 'medium' && redness_score < 30) {
      // S2.III.d
      secondSentence += `, you don't do too badly under the sun and your face scan shows minimal signs of redness / irritation. However, your focus should be on repairing your barrier for the next 2-4 weeks. Once your skin starts feeling less irritated, you can start working on your other goals.`;
    } else if (burn_risk === 'medium' && redness_score >= 30 && redness_score < 75) {
      // S2.III.e
      secondSentence += `, you don't do too badly under the sun but there's some signs of redness / irritation on your ${redness_main_area}. Your focus should be on repairing your barrier for the next 2-4 weeks. Once your skin starts feeling less irritated, you can start working on your other goals.`;
    } else if (burn_risk === 'medium' && redness_score >= 75) {
      // S2.III.f
      secondSentence += `, you don't do too badly under the sun but your face scan shows quite a bit of redness / irritation on your ${redness_main_area}. Your focus should be on repairing your barrier for the next 2-4 weeks. Once your skin starts feeling less irritated, you can start working on your other goals.`;
    } else if (burn_risk === 'high' && redness_score < 30) {
      // S2.III.g
      secondSentence += `, you burn easily under the sun but your face scan shows minimal signs of redness / irritation at the moment. Your focus should be on repairing your barrier for the next 2-4 weeks. Once your skin starts feeling less irritated, you can start working on your other goals.`;
    } else if (burn_risk === 'high' && redness_score >= 30 && redness_score < 75) {
      // S2.III.h
      secondSentence += `, you burn easily under the sun and there's some signs of redness / irritation on your ${redness_main_area}. Your focus should be on repairing your barrier for the next 2-4 weeks. Once your skin starts feeling less irritated, you can start working on your other goals.`;
    } else if (burn_risk === 'high' && redness_score >= 75) {
      // S2.III.i
      secondSentence += `, you burn easily under the sun and your face scan shows quite a bit of redness / irritation on your ${redness_main_area}. Your focus should be on repairing your barrier for the next 2-4 weeks. Once your skin starts feeling less irritated, you can start working on your other goals.`;
    } else {
      secondSentence += '.';
    }
  }

  // --- Sentence 3: ---
  // S3.a. if [sunscreen] = 'Every day' then 'Well done on wearing sunscreen every day, that's the single most important thing you can do for your skin.'
  // S3.b. if [sunscreen] = 'Sometimes' then 'Well done for wearing sunscreen, that's the single most important thing that you can do for your skin. Make sure not to skip any days even if it's cloudy outside.'
  // S3.c. if [sunscreen] = 'Never' then 'You mentioned that you never wear sunscreen - this has to change immediately. Wearing sunscreen is the single most important thing that you can do for your skin, even if it's cloudy outside.'
  const sunscreen = profile.sunscreen || 'Sometimes';
  let thirdSentence = '';

  if (sunscreen === 'Every day') {
    // S3.a
    thirdSentence = "Well done on wearing sunscreen every day, that's the single most important thing you can do for your skin.";
  } else if (sunscreen === 'Sometimes') {
    // S3.b
    thirdSentence = "Well done for wearing sunscreen, that's the single most important thing that you can do for your skin. Make sure not to skip any days even if it's cloudy outside.";
  } else if (sunscreen === 'Never' || sunscreen === 'Rarely') {
    // S3.c
    thirdSentence = "You mentioned that you never wear sunscreen - this has to change immediately. Wearing sunscreen is the single most important thing that you can do for your skin, even if it's cloudy outside.";
  } else {
    // Fallback if anything else
    thirdSentence = "Well done for wearing sunscreen, that's the single most important thing that you can do for your skin. Make sure not to skip any days even if it's cloudy outside.";
  }

  // Return the combined report text
  return `${firstSentence} ${secondSentence} ${thirdSentence}`.trim();
}
