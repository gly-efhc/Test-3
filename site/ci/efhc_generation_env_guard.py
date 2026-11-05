"""Server-only EFHC generation rate guard for integration into the separate backend.
Never import into a public client bundle. Call at backend process startup.
"""
from dataclasses import dataclass
from decimal import Decimal
from os import environ

_CANON = {
    "GEN_PER_SEC_BASE_KWH": "0.00000692",
    "GEN_PER_SEC_VIP_KWH": "0.00000741",
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
        base_kwh_per_second=values["GEN_PER_SEC_BASE_KWH"],
        vip_kwh_per_second=values["GEN_PER_SEC_VIP_KWH"],
    )
