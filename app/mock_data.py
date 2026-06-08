"""
Bolån Agent – Mock Data Layer
==============================
Realistic Swedish mortgage and banking mock data for demo purposes.
All data is self-contained to guarantee 100% reliability during live presentations.
No external API calls are made.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
from typing import Optional


# ──────────────────────────────────────────────
#  Enumerations
# ──────────────────────────────────────────────

class EmploymentType(Enum):
    TILLSVIDAREANSTALLNING = "Tillsvidareanställning"
    VIKARIAT = "Vikariat"
    EGENFORETAGARE = "Egenföretagare"
    PENSIONAR = "Pensionär"
    STUDENT = "Student"


class PropertyType(Enum):
    BOSTADSRATT = "Bostadsrätt"
    VILLA = "Villa"
    RADHUS = "Radhus"
    FRITIDSHUS = "Fritidshus"


class LoanPurpose(Enum):
    KOPA_BOSTAD = "Köpa bostad"
    FLYTTA_LAN = "Flytta lån (bolånekarusellen)"
    UTOKA_LAN = "Utöka befintligt lån"


class ApplicationStatus(Enum):
    INITIATED = "Initierad"
    KYC_PENDING = "BankID-verifiering pågår"
    KYC_VERIFIED = "Identitet verifierad"
    CREDIT_CHECK = "Kreditupplysning pågår"
    CREDIT_DONE = "Kreditupplysning klar"
    VALUATION_PENDING = "Fastighetsvärdering pågår"
    VALUATION_DONE = "Fastighetsvärdering klar"
    UNDERWRITING = "Riskbedömning pågår"
    OFFER_READY = "Erbjudande redo"
    ACCEPTED = "Accepterat"
    REJECTED = "Avslaget"


# ──────────────────────────────────────────────
#  Data Models
# ──────────────────────────────────────────────

@dataclass
class UCCreditReport:
    """Simulated Upplysningscentralen (UC) credit report."""
    personnummer_masked: str  # e.g. "198507XX-XXXX"
    uc_risk_pct: float        # UC Riskprognos percentage (lower = better, e.g. 0.4%)
    risk_category: str        # "Very Low Risk", "Low Risk", "Medium Risk", "High Risk"
    existing_loans: list[dict] = field(default_factory=list)
    payment_remarks: int = 0
    monthly_debt_payments: int = 0
    declared_annual_income: int = 0
    employer: str = ""
    employment_type: str = ""
    employment_since: str = ""


@dataclass
class PropertyValuation:
    """Simulated property valuation (Bostadsvärdering)."""
    address: str
    municipality: str
    property_type: str
    estimated_value_sek: int
    booli_estimate_sek: int  # Second valuation source
    living_area_sqm: int
    rooms: int
    floor: int
    elevator: bool
    year_built: int
    monthly_fee_sek: int  # Månadsavgift (BRF)
    association_name: str  # BRF name
    association_debt_per_sqm: int  # Föreningens skuldsättning per kvm


@dataclass
class MortgageApplication:
    """Full mortgage application state."""
    application_id: str = ""
    status: ApplicationStatus = ApplicationStatus.INITIATED
    created_at: str = ""

    # Applicant
    full_name: str = ""
    personnummer_masked: str = ""
    email: str = ""
    phone: str = ""

    # Property
    property_address: str = ""
    property_type: str = ""
    asking_price_sek: int = 0
    estimated_value_sek: int = 0

    # Financials
    down_payment_sek: int = 0
    loan_amount_sek: int = 0
    loan_to_value_pct: float = 0.0
    monthly_income_sek: int = 0
    employment_type: str = ""
    existing_monthly_debts: int = 0

    # Credit
    uc_risk_pct: float = 0.0
    uc_risk_category: str = ""
    payment_remarks: int = 0

    # Competitor
    competitor_bank: str = ""
    competitor_rate_pct: float = 0.0

    # Offer
    offered_rate_pct: float = 0.0
    offered_monthly_cost_sek: int = 0
    annual_savings_sek: int = 0
    debt_to_income_ratio: float = 0.0
    amortization_pct: float = 0.0
    amortization_monthly_sek: int = 0
    binding_period_months: int = 0


# ──────────────────────────────────────────────
#  Mock Database
# ──────────────────────────────────────────────

MOCK_BANKID_USERS = {
    "user_1": {
        "full_name": "Erik Wallström",
        "personnummer_masked": "199003XX-XXXX",
        "email": "erik.wallstrom@email.se",
        "phone": "+46 70 123 45 67",
    }
}

MOCK_UC_REPORTS: dict[str, UCCreditReport] = {
    "199003XX-XXXX": UCCreditReport(
        personnummer_masked="199003XX-XXXX",
        uc_risk_pct=0.4,
        risk_category="Very Low Risk",
        existing_loans=[
            {"type": "Bolån", "bank": "Current Bank", "balance_sek": 2_800_000, "rate_pct": 4.15, "monthly_sek": 13_683},
            {"type": "CSN-lån", "bank": "CSN", "balance_sek": 120_000, "rate_pct": 0.6, "monthly_sek": 1_200},
        ],
        payment_remarks=0,
        monthly_debt_payments=15_450,
        declared_annual_income=684_000,
        employer="Ericsson AB",
        employment_type="Tillsvidareanställning",
        employment_since="2018-03",
    ),
}

MOCK_PROPERTY_VALUATIONS: dict[str, PropertyValuation] = {
    "storgatan 12": PropertyValuation(
        address="Storgatan 12, 114 51 Stockholm",
        municipality="Stockholms kommun",
        property_type="Bostadsrätt",
        estimated_value_sek=5_200_000,
        booli_estimate_sek=5_050_000,
        living_area_sqm=72,
        rooms=3,
        floor=4,
        elevator=True,
        year_built=1928,
        monthly_fee_sek=4_850,
        association_name="BRF Storgatan 12",
        association_debt_per_sqm=3_200,
    ),
    "vasagatan 8": PropertyValuation(
        address="Vasagatan 8, 111 20 Stockholm",
        municipality="Stockholms kommun",
        property_type="Bostadsrätt",
        estimated_value_sek=4_800_000,
        booli_estimate_sek=4_650_000,
        living_area_sqm=58,
        rooms=2,
        floor=2,
        elevator=False,
        year_built=1935,
        monthly_fee_sek=3_950,
        association_name="BRF Vasagatan 8",
        association_debt_per_sqm=4_100,
    ),
    "björkvägen 5": PropertyValuation(
        address="Björkvägen 5, 181 32 Lidingö",
        municipality="Lidingö kommun",
        property_type="Villa",
        estimated_value_sek=8_500_000,
        booli_estimate_sek=8_200_000,
        living_area_sqm=145,
        rooms=5,
        floor=0,
        elevator=False,
        year_built=1972,
        monthly_fee_sek=0,
        association_name="N/A",
        association_debt_per_sqm=0,
    ),
    # Default/fallback for demo
    "default": PropertyValuation(
        address="Kungsgatan 44, 111 35 Stockholm",
        municipality="Stockholms kommun",
        property_type="Bostadsrätt",
        estimated_value_sek=5_000_000,
        booli_estimate_sek=4_900_000,
        living_area_sqm=65,
        rooms=2,
        floor=3,
        elevator=True,
        year_built=1945,
        monthly_fee_sek=4_200,
        association_name="BRF Kungsgatan 44",
        association_debt_per_sqm=2_800,
    ),
}


# ──────────────────────────────────────────────
#  Risk Matrix & Rate Calculation
# ──────────────────────────────────────────────

# Base rates by binding period (months)
BASE_RATES = {
    3: 3.89,   # 3 months (rörlig)
    12: 3.65,  # 1 year
    24: 3.45,  # 2 years
    36: 3.29,  # 3 years
    60: 3.15,  # 5 years
}

# UC-Risk category adjustments
RISK_ADJUSTMENTS = {
    "Very Low Risk": -0.15,
    "Low Risk": 0.0,
    "Medium Risk": 0.25,
    "High Risk": 0.55,
    "Very High Risk": 1.10,
}

# LTV tier adjustments (Swedish regulation: max 90% LTV as of April 2026)
LTV_ADJUSTMENTS = {
    50: -0.10,   # Very low LTV
    60: -0.05,
    70: 0.0,
    75: 0.05,
    80: 0.15,
    85: 0.25,
    90: 0.35,
}

# Employment stability bonus
EMPLOYMENT_ADJUSTMENTS = {
    "Tillsvidareanställning": -0.05,
    "Vikariat": 0.10,
    "Egenföretagare": 0.15,
    "Pensionär": 0.0,
    "Student": 0.40,
}


def calculate_offered_rate(
    risk_category: str,
    ltv_pct: float,
    employment_type: str,
    binding_months: int = 3,
) -> float:
    """Calculate the offered interest rate based on risk factors."""
    base = BASE_RATES.get(binding_months, 3.89)
    risk_adj = RISK_ADJUSTMENTS.get(risk_category, 0.0)
    emp_adj = EMPLOYMENT_ADJUSTMENTS.get(employment_type, 0.0)

    # Find closest LTV tier
    ltv_adj = 0.0
    for threshold in sorted(LTV_ADJUSTMENTS.keys()):
        if ltv_pct <= threshold:
            ltv_adj = LTV_ADJUSTMENTS[threshold]
            break
    else:
        ltv_adj = 0.45  # Above 90% — should not happen in Sweden

    rate = base + risk_adj + ltv_adj + emp_adj
    return round(max(rate, 2.50), 2)  # Floor at 2.50%


def calculate_amortization_requirement(ltv_pct: float) -> float:
    """Swedish mandatory amortization rules (Finansinspektionen).

    - LTV > 70%: must amortize 2% of total loan per year
    - LTV 50-70%: must amortize 1% of total loan per year
    - LTV < 50%: no mandatory amortization
    - Additional 1% if debt-to-income > 4.5x
    """
    if ltv_pct > 70:
        return 2.0
    elif ltv_pct > 50:
        return 1.0
    else:
        return 0.0


def calculate_monthly_cost(
    loan_amount: int,
    rate_pct: float,
    amortization_pct: float,
) -> tuple[int, int]:
    """Return (interest_monthly, amortization_monthly)."""
    interest_monthly = int(loan_amount * (rate_pct / 100) / 12)
    amortization_monthly = int(loan_amount * (amortization_pct / 100) / 12)
    return interest_monthly, amortization_monthly

