"""Deterministic Pre-Retrieval Safety Guardrails Filter.

Evaluates user queries against pre-compiled regular expressions and rules to intercept:
1. Personalized Calorie Prescriptions (e.g. "how many calories should I eat", "cut to 1200 calories")
2. Target Body Weight & Weight Loss Prescriptions (e.g. "lose 15 pounds", "what should I weigh", "my BMI is")
3. Medical Diagnosis & Disease Treatment (e.g. "cure type 2 diabetes", "diet for hypertension", "reverse cancer")

Zero parametric LLM calls; 100% deterministic code-level interception prior to retrieval.
Permits objective, informational inquiries about dietary guidelines and public health thresholds.
"""

import re
from dataclasses import dataclass
from typing import Optional, List, Tuple


@dataclass
class SafetyViolation:
    """Telemetry describing an intercepted out-of-scope query."""
    category: str
    pattern_matched: str
    query: str
    message: str


# ==============================================================================
# Compiled Regular Expressions for Pre-Retrieval Deterministic Filtering
# ==============================================================================

# 1. Personalized Calorie Targets & Prescriptions
CALORIE_PATTERNS: List[Tuple[str, re.Pattern]] = [
    (
        "personal_calorie_intake",
        re.compile(r"\bhow\s+many\s+calories\s+(should|can|must|do)\s+i\s+(eat|consume|have|burn|need)\b", re.IGNORECASE)
    ),
    (
        "personal_calorie_amount_target",
        re.compile(r"\bi\s+(should|can|must|need\s+to|have\s+to)\s+(eat|consume|have)\s+(\d{3,4})\s*(calories|kcal|cal)\b", re.IGNORECASE)
    ),
    (
        "calorie_restriction_prescription",
        re.compile(r"\b(cut|limit|reduce|restrict)\s+(my\s+diet\s+to\s+|my\s+calories\s+to\s+|to\s+)?(\d{3,4})\s*(calories|kcal)\b", re.IGNORECASE)
    ),
    (
        "daily_calorie_target_for_user",
        re.compile(r"\b(\d{3,4})\s*(calories?|kcal)\s+(a|per)\s+day\s+(for\s+me|to\s+lose|diet)\b", re.IGNORECASE)
    ),
    (
        "personal_caloric_budget",
        re.compile(r"\bcalorie\s+(target|goal|prescription|deficit|budget|limit)\s+for\s+(me|myself|my\s+weight|my\s+body)\b", re.IGNORECASE)
    ),
    (
        "calculate_my_calories",
        re.compile(r"\bcalculate\s+(my\s+)?(bmi\s+)?(calories?|caloric\s+needs|maintenance\s+calories|calorie\s+plan)\b", re.IGNORECASE)
    ),
    (
        "adversarial_jailbreak_attempt",
        re.compile(r"\bignore\s+(all\s+|safety\s+|previous\s+)?instructions\b.*\b(calorie|diet|weight|bmi|loss)\b", re.IGNORECASE)
    ),
]

# 2. Target Body Weight & Weight Loss Prescriptions
WEIGHT_PATTERNS: List[Tuple[str, re.Pattern]] = [
    (
        "weight_loss_target_prescription",
        re.compile(r"\b(lose|drop|burn|shed)\s+\d+\s*(kg|lbs?|pounds?|kilos?)\b", re.IGNORECASE)
    ),
    (
        "weight_loss_timeline_prescription",
        re.compile(r"\bhow\s+(can|do|should)\s+i\s+lose\s+\d+\s*(kg|lbs?|pounds?|kilos?)\b", re.IGNORECASE)
    ),
    (
        "target_body_weight",
        re.compile(r"\bwhat\s+should\s+i\s+weigh\b", re.IGNORECASE)
    ),
    (
        "ideal_weight_for_user",
        re.compile(r"\bideal\s+(body\s+)?weight\s+for\s+(me|my\s+height|my\s+age)\b", re.IGNORECASE)
    ),
    (
        "bmi_assessment",
        re.compile(r"\b(my\s+bmi\s+is\s+\d+(\.\d+)?|bmi\s+calorie\s+plan)\b", re.IGNORECASE)
    ),
    (
        "overweight_underweight_diagnosis",
        re.compile(r"\bam\s+i\s+(overweight|underweight|obese|too\s+fat|too\s+skinny)\b", re.IGNORECASE)
    ),
    (
        "weight_loss_regimen_prescription",
        re.compile(r"\bweight\s+loss\s+(prescription|regimen|plan\s+for\s+me|diet\s+plan\s+for\s+me)\b", re.IGNORECASE)
    ),
]

# 3. Medical Diagnosis & Disease Treatment
MEDICAL_PATTERNS: List[Tuple[str, re.Pattern]] = [
    (
        "disease_cure_treatment",
        re.compile(
            r"\b(cures?|curing|treats?|treating|reverses?|reversing|heals?|healing)\s+(chronic\s+|acute\s+|severe\s+)?(type\s+[12]\s+)?(diabetes|cancer|hypertension|crohn'?s?|celiac|kidney\s+disease|heart\s+disease|cardiovascular\s+disease|tumor|ulcerative\s+colitis)\b",
            re.IGNORECASE
        )
    ),
    (
        "disease_treatment_diet",
        re.compile(
            r"\b(diet|meal\s+plan|eating\s+plan)\s+(that\s+|which\s+|will\s+)?(cures?|treats?|reverses?|heals?|to\s+cure|to\s+treat|to\s+reverse|against|for)\s+(chronic\s+|acute\s+|severe\s+)?(type\s+[12]\s+)?(diabetes|cancer|hypertension|crohn'?s?|celiac|kidney\s+disease|heart\s+disease|cardiovascular\s+disease)\b",
            re.IGNORECASE
        )
    ),
    (
        "diet_reverse_disease",
        re.compile(
            r"\b(can|will)\s+(this\s+diet|food|eating|diet|meal\s+plan)\s+(cures?|reverse|reverses?|treat|treats?)\s+(chronic\s+|acute\s+|severe\s+)?(type\s+[12]\s+)?(diabetes|hypertension|cancer|disease)\b",
            re.IGNORECASE
        )
    ),

    (
        "medical_advice_request",
        re.compile(r"\bmedical\s+(advice|diagnosis|prescription|treatment)\b", re.IGNORECASE)
    ),
    (
        "symptom_diagnosis_request",
        re.compile(r"\b(diagnose|treat)\s+my\s+(condition|illness|symptoms?|disease)\b", re.IGNORECASE)
    ),
]

# Combined list of all safety rules
ALL_SAFETY_PATTERNS: List[Tuple[str, str, re.Pattern]] = (
    [("calorie_prescription", name, pat) for name, pat in CALORIE_PATTERNS]
    + [("weight_prescription", name, pat) for name, pat in WEIGHT_PATTERNS]
    + [("medical_treatment", name, pat) for name, pat in MEDICAL_PATTERNS]
)


def check_safety_guardrail(query: str) -> Optional[SafetyViolation]:
    """Evaluate query against deterministic pre-retrieval safety rules.
    
    Args:
        query: User input prompt string.
        
    Returns:
        SafetyViolation if query violates out-of-scope boundaries (Refusal 2).
        None if query is safe and should proceed to retrieval.
    """
    if not query or not query.strip():
        return None

    clean_query = query.strip()

    for category, rule_name, pattern in ALL_SAFETY_PATTERNS:
        match = pattern.search(clean_query)
        if match:
            matched_str = match.group(0)
            message = (
                f"Declined out-of-scope inquiry ({category}: '{rule_name}'). "
                "Personalized medical advice, clinical disease treatments, calorie prescriptions, "
                "and target body weight recommendations are strictly excluded from this system."
            )
            return SafetyViolation(
                category=category,
                pattern_matched=matched_str,
                query=clean_query,
                message=message,
            )

    return None
