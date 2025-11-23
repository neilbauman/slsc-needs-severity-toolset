// Aggregation Method Definitions and Guidance
// Provides method descriptions, use cases, examples, and recommendation logic

export interface AggregationMethod {
  id: string;
  name: string;
  description: string;
  whenToUse: string;
  example: {
    scores: number[];
    result: number;
    explanation: string;
  };
  bestFor: string;
  icon: string;
  recommended?: boolean;
  formula?: string;
}

export const AGGREGATION_METHODS: AggregationMethod[] = [
  {
    id: 'weighted_mean',
    name: 'Weighted Mean',
    description: 'Balanced average where each category contributes proportionally to its weight.',
    whenToUse: 'Use when factors are independent and you want balanced consideration of all dimensions.',
    example: {
      scores: [5, 3, 1], // Hazard, Poverty, Access
      result: 3.0,
      explanation: 'Each score is multiplied by its weight, then averaged. Balanced consideration.'
    },
    bestFor: 'General vulnerability assessment with equal consideration of all factors.',
    icon: '⚖️',
    formula: 'SUM(score × weight) / SUM(weight)'
  },
  {
    id: 'geometric_mean',
    name: 'Geometric Mean',
    description: 'Multiplicative aggregation where vulnerabilities compound. High hazard × high poverty = very high vulnerability.',
    whenToUse: 'Use when vulnerabilities compound multiplicatively and context matters. Low hazard reduces priority even if poverty is high.',
    example: {
      scores: [5, 3, 1], // Hazard, Poverty, Access
      result: 2.4,
      explanation: 'Scores are multiplied, then nth root taken. Low access (1) significantly reduces overall score.'
    },
    bestFor: 'Prioritization where high hazard × high poverty = very high vulnerability. Context matters.',
    icon: '🔢',
    recommended: true,
    formula: '(s₁^w₁ × s₂^w₂ × s₃^w₃)^(1/(w₁+w₂+w₃))'
  },
  {
    id: 'power_mean',
    name: 'Power Mean',
    description: 'Moderate emphasis on extremes while still considering all factors. Balances between weighted mean and maximum.',
    whenToUse: 'Use when you want to emphasize extremes but still consider all factors proportionally.',
    example: {
      scores: [5, 3, 1], // Hazard, Poverty, Access
      result: 3.2,
      explanation: 'Scores are raised to power (p=2), weighted, then nth root. Moderate emphasis on high scores.'
    },
    bestFor: 'Between balanced and extreme emphasis. Good compromise approach.',
    icon: '📊',
    formula: '(SUM(score^p × weight) / SUM(weight))^(1/p)'
  },
  {
    id: 'owa_optimistic',
    name: 'OWA Optimistic',
    description: 'Emphasizes the highest score regardless of which category it\'s in. "If it\'s bad in any dimension, prioritize it."',
    whenToUse: 'Use when any high score indicates priority, regardless of other factors.',
    example: {
      scores: [5, 1, 1], // Hazard, Poverty, Access
      result: 4.2,
      explanation: 'Highest score (hazard: 5) is weighted more heavily. Other factors matter less.'
    },
    bestFor: 'Situations where extreme scores in any category should drive prioritization.',
    icon: '⬆️',
    formula: 'Sort scores, weight highest positions more'
  },
  {
    id: 'owa_pessimistic',
    name: 'OWA Pessimistic',
    description: 'Emphasizes consistency. Requires consideration of all factors. Penalizes areas with inconsistent scores.',
    whenToUse: 'Use when you need consistency - all factors must be considered and balanced.',
    example: {
      scores: [5, 1, 1], // Hazard, Poverty, Access
      result: 2.8,
      explanation: 'Lowest scores are weighted more. Inconsistency (high hazard, low poverty) is penalized.'
    },
    bestFor: 'Requiring balanced vulnerability across all dimensions. Consistency is critical.',
    icon: '⬇️',
    formula: 'Sort scores, weight lowest positions more'
  },
  {
    id: 'ssc_decision_tree',
    name: 'SSC Decision Tree',
    description: 'Fixed tree system for compiling P1, P2, P3 framework pillar scores using predefined decision rules.',
    whenToUse: 'Use when following the standard SSC decision tree methodology for framework pillar aggregation.',
    example: {
      scores: [4, 3, 2], // P1, P2, P3
      result: 3.2,
      explanation: 'Decision tree applies fixed rules based on P1, P2, P3 combinations to determine framework score.'
    },
    bestFor: 'Standard SSC framework pillar aggregation following established decision tree methodology.',
    icon: '🌳',
    formula: 'Fixed decision tree rules based on P1, P2, P3 score combinations'
  }
];

/**
 * Recommends an aggregation method based on instance data characteristics
 */
export function recommendMethod(instanceData: {
  hasMultipleHazards?: boolean;
  hasExtremeScores?: boolean;
  isBalanced?: boolean;
  scoreVariance?: number;
}): string {
  // Multiple hazards → Geometric mean (compounding)
  if (instanceData.hasMultipleHazards) {
    return 'geometric_mean';
  }
  
  // Extreme scores in single category → OWA Optimistic
  if (instanceData.hasExtremeScores && !instanceData.isBalanced) {
    return 'owa_optimistic';
  }
  
  // Balanced scores → Weighted Mean
  if (instanceData.isBalanced) {
    return 'weighted_mean';
  }
  
  // High variance → Geometric Mean (context matters)
  if (instanceData.scoreVariance && instanceData.scoreVariance > 2.0) {
    return 'geometric_mean';
  }
  
  // Default: Geometric Mean for compounding vulnerabilities
  return 'geometric_mean';
}

/**
 * Get method by ID
 */
export function getMethodById(id: string): AggregationMethod | undefined {
  return AGGREGATION_METHODS.find(m => m.id === id);
}

/**
 * Get all method IDs
 */
export function getAllMethodIds(): string[] {
  return AGGREGATION_METHODS.map(m => m.id);
}

