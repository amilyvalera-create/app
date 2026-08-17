"""Approved workbook schema for worksheet "Precios Actual" (table _202606_Precios).

SINGLE SOURCE OF TRUTH for the column map, role -> allowed SELLING columns, and
labels. COST columns (E-H) are NEVER exposed to any role, including master.
Mapping is by column LETTER; BF Goodrich (col AM) is additionally resolved by its
header text at parse time for stability.
"""

# letter -> internal key. Order defines display order.
PRICE_COLUMNS = [
    {"letter": "E", "key": "COSTO"},
    {"letter": "F", "key": "COSTO_BS"},
    {"letter": "G", "key": "COSTO_DOLAR"},
    {"letter": "H", "key": "COSTO_ZELLE"},
    {"letter": "I", "key": "CARACAS_BS"},
    {"letter": "J", "key": "CARACAS_CASH"},
    {"letter": "K", "key": "CARACAS_ZELLE"},
    {"letter": "L", "key": "ORIENTE_SUR_BS"},
    {"letter": "M", "key": "ORIENTE_SUR_CASH"},
    {"letter": "N", "key": "ORIENTE_SUR_ZELLE"},
    {"letter": "O", "key": "ORIENTE_NORTE_BS"},
    {"letter": "P", "key": "ORIENTE_NORTE_CASH"},
    {"letter": "Q", "key": "ORIENTE_NORTE_ZELLE"},
    {"letter": "R", "key": "PANOFRE_BS"},
    {"letter": "S", "key": "PANOFRE_CASH"},
    {"letter": "AC", "key": "OTROS_CASH"},
    {"letter": "AD", "key": "OTROS_ZELLE"},
    {"letter": "AE", "key": "TCC_TTC_BS"},
    {"letter": "AF", "key": "TCC_TTC_CASH"},
    {"letter": "AG", "key": "TCC_TTC_ZELLE"},
    {"letter": "AM", "key": "BF_GOODRICH", "header_match": "BF"},
]

IDENTITY_COLUMNS = {"A": "sku", "B": "rin", "C": "marca", "D": "descripcion"}

# Cost fields — hidden from EVERY role, always.
COST_KEYS = ["COSTO", "COSTO_BS", "COSTO_DOLAR", "COSTO_ZELLE"]

# BF Goodrich (col AM) is a SELLING price visible to every authorized view.
BF_GOODRICH = "BF_GOODRICH"

_CARACAS = ["CARACAS_BS", "CARACAS_CASH", "CARACAS_ZELLE"]
_ORIENTE_SUR = ["ORIENTE_SUR_BS", "ORIENTE_SUR_CASH", "ORIENTE_SUR_ZELLE"]
_ORIENTE_NORTE = ["ORIENTE_NORTE_BS", "ORIENTE_NORTE_CASH", "ORIENTE_NORTE_ZELLE"]
_PANOFRE = ["PANOFRE_BS", "PANOFRE_CASH"]
_TIRES_CENTER = ["TCC_TTC_BS", "TCC_TTC_CASH", "TCC_TTC_ZELLE"]
_OTROS = ["OTROS_CASH", "OTROS_ZELLE"]

# Role -> authorized SELLING column keys (server-enforced). BF Goodrich appended
# to every view. Master (Gerencia) sees all selling blocks, never costs.
ROLE_COLUMN_MAP = {
    "caracas": _CARACAS + [BF_GOODRICH],
    "caracas_panofre": _CARACAS + _PANOFRE + [BF_GOODRICH],
    "caracas_tirescenter": _CARACAS + _TIRES_CENTER + [BF_GOODRICH],
    "oriente_sur": _ORIENTE_SUR + [BF_GOODRICH],
    "oriente_norte": _ORIENTE_NORTE + [BF_GOODRICH],
    # Legacy single-region roles kept for backward compatibility.
    "panofre": _PANOFRE + [BF_GOODRICH],
    "tires_center": _TIRES_CENTER + [BF_GOODRICH],
}

# Gerencia / master: every selling block (no costs).
MASTER_COLUMNS = (
    _CARACAS + _ORIENTE_SUR + _ORIENTE_NORTE + _PANOFRE + _OTROS + _TIRES_CENTER + [BF_GOODRICH]
)

ROLE_LABELS = {
    "master": "Gerencia",
    "caracas": "Caracas",
    "caracas_panofre": "Caracas + Panofre",
    "caracas_tirescenter": "Caracas + Tires Center",
    "oriente_sur": "Oriente Sur",
    "oriente_norte": "Oriente Norte",
    "panofre": "Panofre",
    "tires_center": "Tires Center",
}

_COLUMN_LABELS = {
    "CARACAS_BS": "Caracas Bs",
    "CARACAS_CASH": "Caracas Cash",
    "CARACAS_ZELLE": "Caracas Zelle",
    "ORIENTE_SUR_BS": "Oriente Sur Bs",
    "ORIENTE_SUR_CASH": "Oriente Sur Cash",
    "ORIENTE_SUR_ZELLE": "Oriente Sur Zelle",
    "ORIENTE_NORTE_BS": "Oriente Norte Bs",
    "ORIENTE_NORTE_CASH": "Oriente Norte Cash",
    "ORIENTE_NORTE_ZELLE": "Oriente Norte Zelle",
    "PANOFRE_BS": "Panofre Bs",
    "PANOFRE_CASH": "Panofre Cash",
    "OTROS_CASH": "Otros Cash",
    "OTROS_ZELLE": "Otros Zelle",
    "TCC_TTC_BS": "TCC/TTC Bs",
    "TCC_TTC_CASH": "TCC/TTC Cash",
    "TCC_TTC_ZELLE": "TCC/TTC Zelle",
    "BF_GOODRICH": "Precio BF Goodrich",
}


def column_label(key: str) -> str:
    return _COLUMN_LABELS.get(key, key)


def column_currency(key: str) -> str:
    if key.endswith("_BS"):
        return "Bs"
    return "$"


def col_letter_to_index(letter: str) -> int:
    letter = letter.strip().upper()
    idx = 0
    for ch in letter:
        idx = idx * 26 + (ord(ch) - ord("A") + 1)
    return idx - 1
