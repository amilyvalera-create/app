"""Approved workbook schema for worksheet "202607".

This is the SINGLE SOURCE OF TRUTH for the column map, the role -> allowed
columns authorization matrix, and display labels. Do not add columns, roles or
price rules that are not defined by the business specification.
"""

# Exact column map (letter -> internal key). Only price columns E..AF are
# consultable price fields; SKU/RIN/MARCA/DESCRIPCION are product identity.
PRICE_COLUMNS = [
    {"letter": "E", "key": "COSTO_A"},
    {"letter": "F", "key": "COSTO_B"},
    {"letter": "G", "key": "COSTOS"},
    {"letter": "H", "key": "COSTO_ZELLE"},
    {"letter": "I", "key": "VENTA_CARACAS"},
    {"letter": "J", "key": "VENTA_CARACAS_BS_18"},
    {"letter": "K", "key": "VENTA_CARACAS_CASH_21"},
    {"letter": "L", "key": "VENTA_CARACAS_ZELLE_24"},
    {"letter": "M", "key": "VENTA_ORIENTE_SUR_Y_BOLIVAR_BS_28"},
    {"letter": "N", "key": "VENTA_ORIENTE_SUR_Y_BOLIVAR_CASH_31"},
    {"letter": "O", "key": "VENTA_ORIENTE_SUR_Y_BOLIVAR_ZELLE_34"},
    {"letter": "P", "key": "VENTA_ORIENTE_NORTE_MONAGAS_Y_CUMANA_CASH"},
    {"letter": "Q", "key": "VENTA_ORIENTE_NORTE_MONAGAS_Y_CUMANA_ZELLE_44"},
    {"letter": "R", "key": "PANOFRE_BS_48"},
    {"letter": "S", "key": "PANOFRE_CASH_51"},
    {"letter": "AC", "key": "OTROS_CASH_95"},
    {"letter": "AD", "key": "OTROS_ZELLE_98"},
    {"letter": "AE", "key": "TCC_TTC_BS_102"},
    {"letter": "AF", "key": "TCC_TTC_CASH_105"},
]

# Role -> authorized column keys (server-enforced). Master gets everything.
ROLE_COLUMN_MAP = {
    "caracas": ["VENTA_CARACAS", "VENTA_CARACAS_BS_18", "VENTA_CARACAS_CASH_21", "VENTA_CARACAS_ZELLE_24"],
    "oriente_sur": [
        "VENTA_ORIENTE_SUR_Y_BOLIVAR_BS_28",
        "VENTA_ORIENTE_SUR_Y_BOLIVAR_CASH_31",
        "VENTA_ORIENTE_SUR_Y_BOLIVAR_ZELLE_34",
    ],
    "oriente_norte": [
        "VENTA_ORIENTE_NORTE_MONAGAS_Y_CUMANA_CASH",
        "VENTA_ORIENTE_NORTE_MONAGAS_Y_CUMANA_ZELLE_44",
    ],
    "panofre": ["PANOFRE_BS_48", "PANOFRE_CASH_51"],
    "tires_center": ["OTROS_CASH_95", "OTROS_ZELLE_98", "TCC_TTC_BS_102", "TCC_TTC_CASH_105"],
}

ROLE_LABELS = {
    "master": "Administrador",
    "caracas": "Ventas Caracas",
    "oriente_sur": "Ventas Oriente Sur",
    "oriente_norte": "Ventas Oriente Norte",
    "panofre": "Panofre",
    "tires_center": "Tires Center",
}

# Human-friendly Spanish labels for price cards.
_COLUMN_LABELS = {
    "COSTO_A": "Costo A",
    "COSTO_B": "Costo B",
    "COSTOS": "Costos",
    "COSTO_ZELLE": "Costo Zelle",
    "VENTA_CARACAS": "Venta Caracas",
    "VENTA_CARACAS_BS_18": "Caracas Bs",
    "VENTA_CARACAS_CASH_21": "Caracas Cash",
    "VENTA_CARACAS_ZELLE_24": "Caracas Zelle",
    "VENTA_ORIENTE_SUR_Y_BOLIVAR_BS_28": "Oriente Sur Bs",
    "VENTA_ORIENTE_SUR_Y_BOLIVAR_CASH_31": "Oriente Sur Cash",
    "VENTA_ORIENTE_SUR_Y_BOLIVAR_ZELLE_34": "Oriente Sur Zelle",
    "VENTA_ORIENTE_NORTE_MONAGAS_Y_CUMANA_CASH": "Oriente Norte Cash",
    "VENTA_ORIENTE_NORTE_MONAGAS_Y_CUMANA_ZELLE_44": "Oriente Norte Zelle",
    "PANOFRE_BS_48": "Panofre Bs",
    "PANOFRE_CASH_51": "Panofre Cash",
    "OTROS_CASH_95": "Otros Cash",
    "OTROS_ZELLE_98": "Otros Zelle",
    "TCC_TTC_BS_102": "TCC/TTC Bs",
    "TCC_TTC_CASH_105": "TCC/TTC Cash",
}


def column_label(key: str) -> str:
    return _COLUMN_LABELS.get(key, key)


def column_currency(key: str) -> str:
    """Currency presentation derived from the source column naming convention.
    Columns tagged _BS_ are Bolivares; CASH/ZELLE and USD sale columns are USD.
    """
    if "_BS_" in key or key.endswith("_BS"):
        return "Bs"
    return "$"
