"""
Bolån Agent – Tools
====================
Tool functions for the single-agent mortgage pipeline.
Each tool returns structured JSON with a widget_type field
that the frontend knows how to render.
"""

from __future__ import annotations

import copy
import json

from google.adk.tools import BaseTool, ToolContext
from google.adk.events.event_actions import UiWidget

from .mock_data import (
    MOCK_BANKID_USERS,
    MOCK_UC_REPORTS,
    MOCK_PROPERTY_VALUATIONS,
    calculate_offered_rate,
    calculate_amortization_requirement,
    calculate_monthly_cost,
)


# ──────────────────────────────────────────────
#  Tool Functions
# ──────────────────────────────────────────────

def visa_bankid_verifiering() -> dict:
    """Shows the BankID login screen. Must be called first to verify identity."""
    return {"widget_type": "bankid", "status": "awaiting_verification"}


def verifiera_identitet(tool_context: ToolContext = None) -> dict:
    """Verifies the customer's identity via BankID. Returns customer name and masked SSN."""
    user_data = MOCK_BANKID_USERS['user_1']
    if tool_context:
        state = tool_context.state
        state['kyc_verified'] = True
        state['customer_name'] = user_data['full_name']
        state['personnummer'] = user_data['personnummer_masked']
    return {
        'widget_type': 'bankid_verified',
        'status': 'verified',
        'full_name': user_data['full_name'],
        'personnummer_masked': user_data['personnummer_masked'],
    }


def hamta_kreditupplysning(tool_context: ToolContext = None) -> dict:
    """Fetches credit report from UC. No visual widget — data stored for later use."""
    state = tool_context.state if tool_context else {}
    personnummer = state.get('personnummer', '199003XX-XXXX')
    report = MOCK_UC_REPORTS.get(personnummer)
    if not report:
        return {'error': 'Credit report not found'}
    if tool_context:
        state['uc_risk_pct'] = report.uc_risk_pct
        state['uc_risk_category'] = report.risk_category
        state['annual_income'] = report.declared_annual_income
        state['monthly_income'] = report.declared_annual_income // 12
        state['employer'] = report.employer
        state['employment_type'] = report.employment_type
        state['existing_loans'] = report.existing_loans
    return {
        'status': 'done',
        'uc_risk_pct': report.uc_risk_pct,
        'risk_category': report.risk_category,
    }


def visa_kontooversikt(tool_context: ToolContext = None) -> dict:
    """Shows the customer's account overview widget with balances, investments and quick actions.
    Also returns transaction insights for the agent to discuss conversationally."""
    return {
        'widget_type': 'financial_overview',
        'status': 'shown',
        'investment_summary': {
            'total_value_sek': 142_800,
            'performance': {
                '1m': '+2.9%',
                '3m': '+8.2%',
                'ytd': '+8.7%',
                '1y': '+12.4%',
            },
            'holdings': [
                {'name': 'Avanza Zero', 'value_sek': 89_400, 'change_1m': '+1.8%', 'change_ytd': '+12.4%'},
                {'name': 'Länsförsäkringar Global Index', 'value_sek': 34_200, 'change_1m': '+0.6%', 'change_ytd': '+5.1%'},
                {'name': 'Spiltan Aktiefond Investmentbolag', 'value_sek': 19_200, 'change_1m': '+3.1%', 'change_ytd': '+9.8%'},
            ],
        },
        'transaction_insights': {
            'recurring_transfer': {
                'recipient': 'Current Bank',
                'label': 'Bolån',
                'monthly_amount': 13683,
                'months_observed': 22,
                'note': 'Recurring monthly transfer marked as Bolån (Mortgage) for the last 22 months.',
            },
        },
    }


def visa_proaktiv_insikt(tool_context: ToolContext = None) -> dict:
    """Shows a proactive insight card highlighting potential savings from refinancing."""
    state = tool_context.state if tool_context else {}
    existing_loans = state.get('existing_loans', [])
    # Find current mortgage
    current_rate = 4.15
    current_bank = 'Current Bank'
    for loan in existing_loans:
        if loan.get('type') == 'Bolån':
            current_rate = loan.get('rate_pct', 4.15)
            current_bank = loan.get('bank', 'Current Bank')
            break
    our_rate = 3.89  # Our best variable rate
    loan_amount = 2800000
    for loan in existing_loans:
        if loan.get('type') == 'Bolån':
            loan_amount = loan.get('balance_sek', 2800000)
            break
    annual_savings = int(loan_amount * (current_rate - our_rate) / 100)
    if tool_context:
        state['current_rate'] = current_rate
        state['current_bank'] = current_bank
        state['our_rate'] = our_rate
        state['annual_savings'] = annual_savings
    return {
        'widget_type': 'proactive_insight',
        'annual_savings': annual_savings,
        'current_rate': current_rate,
        'our_rate': our_rate,
        'current_bank': current_bank,
    }


def vardera_fastighet(adress: str, tool_context: ToolContext = None) -> dict:
    """Runs an automated valuation model (AVM) on the given property address."""
    state = tool_context.state if tool_context else {}
    # Fuzzy lookup
    lookup_key = adress.lower().strip()
    valuation = None
    for key, val in MOCK_PROPERTY_VALUATIONS.items():
        if key in lookup_key or lookup_key in val.address.lower():
            valuation = val
            break
    if not valuation:
        valuation = copy.copy(MOCK_PROPERTY_VALUATIONS['default'])
        valuation.address = adress
    if tool_context:
        state['property_address'] = valuation.address
        state['property_value'] = valuation.estimated_value_sek
        state['living_area_sqm'] = valuation.living_area_sqm
        state['monthly_fee'] = valuation.monthly_fee_sek
    return {
        'widget_type': 'avm_valuation',
        'address': valuation.address,
        'estimated_value_sek': valuation.estimated_value_sek,
        'living_area_sqm': valuation.living_area_sqm,
        'rooms': valuation.rooms,
        'monthly_fee_sek': valuation.monthly_fee_sek,
        'year_built': valuation.year_built,
    }


def visa_rantejamforelse(tool_context: ToolContext = None) -> dict:
    """Shows a rate comparison widget displaying Swedish Bank's rates across all binding periods
    (3 months variable, 1 year fixed, 3 years fixed, 5 years fixed).
    """
    from .mock_data import BASE_RATES
    rates = [
        {'period_months': months, 'rate_pct': rate}
        for months, rate in sorted(BASE_RATES.items())
    ]
    return {'widget_type': 'rate_comparison', 'status': 'shown', 'rates': rates}


def visa_laneerbjudande(tool_context: ToolContext = None) -> dict:
    """Shows the final loan offer card with rate, monthly cost, and savings."""
    state = tool_context.state if tool_context else {}
    credit_grade = state.get('uc_risk_category', 'Very Low Risk')
    employment_type = state.get('employment_type', 'Tillsvidareanställning')
    loan_amount = 2800000
    for loan in state.get('existing_loans', []):
        if loan.get('type') == 'Bolån':
            loan_amount = loan.get('balance_sek', 2800000)
            break
    property_value = state.get('property_value', 5200000)
    ltv_pct = (loan_amount / property_value * 100) if property_value > 0 else 54.0
    offered_rate = calculate_offered_rate(
        risk_category=credit_grade,
        ltv_pct=ltv_pct,
        employment_type=employment_type,
        binding_months=3,
    )
    amort_pct = calculate_amortization_requirement(ltv_pct)
    interest_monthly, amort_monthly = calculate_monthly_cost(loan_amount, offered_rate, amort_pct)
    total_monthly = interest_monthly + amort_monthly
    current_rate = state.get('current_rate', 4.15)
    current_bank = state.get('current_bank', 'Current Bank')
    annual_savings = int(loan_amount * (current_rate - offered_rate) / 100)
    if tool_context:
        state['offered_rate'] = offered_rate
        state['loan_amount'] = loan_amount
        state['total_monthly'] = total_monthly
    return {
        'widget_type': 'loan_offer',
        'offered_rate': offered_rate,
        'loan_amount': loan_amount,
        'ltv_pct': round(ltv_pct, 1),
        'interest_monthly': interest_monthly,
        'amort_monthly': amort_monthly,
        'amort_pct': amort_pct,
        'total_monthly': total_monthly,
        'current_rate': current_rate,
        'current_bank': current_bank,
        'annual_savings': annual_savings,
    }


def visa_tillagg() -> dict:
    """Shows add-on options like home insurance and savings plans."""
    return {
        'widget_type': 'addons',
        'status': 'shown',
        'addons': [
            {'id': 'home_insurance', 'title_sv': 'Hemförsäkring', 'title_en': 'Home Insurance', 'price_sek': 199},
            {'id': 'mortgage_protection', 'title_sv': 'Bolåneskydd', 'title_en': 'Mortgage Protection', 'price_sek': 149},
            {'id': 'auto_save', 'title_sv': 'Autospar', 'title_en': 'Auto-Save', 'price_sek': 500},
        ],
    }


# ──────────────────────────────────────────────
#  A2UI Rendering Callback
# ──────────────────────────────────────────────

async def handle_a2ui_rendering(
    tool: BaseTool,
    args: dict,
    tool_context: ToolContext,
    tool_response: any,
) -> any:
    """Stores widget payload in session state for the after_agent_callback to flush."""
    if isinstance(tool_response, dict) and 'widget_type' in tool_response:
        # Store in state — the after_agent_callback will flush it via render_ui_widgets
        state = tool_context.state
        pending = state.get('pending_widgets', [])
        pending.append(tool_response)
        state['pending_widgets'] = pending
    if isinstance(tool_response, (dict, list)):
        return json.dumps(tool_response, ensure_ascii=False)
    return tool_response

