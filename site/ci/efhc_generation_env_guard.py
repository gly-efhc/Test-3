"""Server-only EFHC generation rate guard for integration into the separate backend.
Never import into a public client bundle. Call at backend process startup.
"""
from dataclasses import dataclass
from decimal import Decimal
from os import environ

_CANON = {
    "EFHC_GENERATION_BASE_KWH_PER_SEC": "0.00000692",
    "EFHC_GENERATION_VIP_KWH_PER_SEC": "0.00000741",
}

@dataclass(frozen=True)
class ProtectedGenerationRates:
    base_kwh_per_second: Decimal
    vip_kwh_per_second: Decimal

def load_protected_generation_rates() -> ProtectedGenerationRates:
    values: dict[str, Decimal] = {}
    for name, canonical in _CANON.items():
        supplied = environ.get(name)
        if supplied is None or supplied != canonical:
            raise RuntimeError(f"EFHC_GENERATION_ENV_REQUIRED_OR_NONCANONICAL:{name}")
        values[name] = Decimal(supplied)
    return ProtectedGenerationRates(
        base_kwh_per_second=values["EFHC_GENERATION_BASE_KWH_PER_SEC"],
        vip_kwh_per_second=values["EFHC_GENERATION_VIP_KWH_PER_SEC"],
    )
