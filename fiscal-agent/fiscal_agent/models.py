"""Format zlecenia paragonu — wspólny dla endpointu lokalnego i platformy.

Kwoty zawsze w groszach (int) — bez floatów. Ilość jako Decimal (np. "1", "0.5").
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

VatRate = Literal["23", "8", "5", "0", "zw"]
PaymentType = Literal["cash", "card", "transfer", "voucher", "credit", "other"]

# trpayment.ty wg DBC-I-DEV-45: 0 gotówka, 2 karta, 3 czek, 4 bon, 5 kredyt,
# 6 inna, 7 voucher, 8 konto klienta. Przelew/płatność online nie ma osobnego
# typu — idzie jako „inna” z nazwą.
PAYMENT_TY = {"cash": 0, "card": 2, "voucher": 7, "credit": 5, "transfer": 6, "other": 6}
PAYMENT_DEFAULT_NAME = {"transfer": "Przelew", "other": "Inna"}


class Item(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    quantity: Decimal = Field(default=Decimal(1), gt=0)
    unit_price: int = Field(gt=0, description="Cena jednostkowa brutto w groszach")
    vat: VatRate
    discount: int = Field(default=0, ge=0, description="Rabat kwotowy brutto do pozycji, grosze")
    description: str | None = Field(default=None, max_length=35)

    @field_validator("quantity")
    @classmethod
    def _qty(cls, v: Decimal) -> Decimal:
        if v.as_tuple().exponent < -3:  # type: ignore[operator]
            raise ValueError("ilość: maks. 3 miejsca po przecinku")
        return v

    @property
    def gross(self) -> int:
        return int((self.quantity * self.unit_price).quantize(Decimal(1), rounding=ROUND_HALF_UP))

    @property
    def total(self) -> int:
        return self.gross - self.discount

    @model_validator(mode="after")
    def _discount_le_value(self) -> "Item":
        if self.discount >= self.gross:
            raise ValueError("rabat nie może być większy lub równy wartości pozycji")
        return self


class Payment(BaseModel):
    type: PaymentType
    amount: int = Field(gt=0, description="Grosze")
    name: str | None = Field(default=None, max_length=25)


class ReceiptRequest(BaseModel):
    id: str = Field(min_length=1, max_length=64, description="Klucz idempotencji (np. id zamówienia)")
    items: list[Item] = Field(min_length=1, max_length=100)
    payments: list[Payment] = Field(min_length=1, max_length=10)
    reference: str | None = Field(default=None, max_length=40,
                                  description="Tekst informacyjny, np. numer zamówienia (nie drukowany fiskalnie)")

    @property
    def total(self) -> int:
        return sum(i.total for i in self.items)

    @property
    def paid(self) -> int:
        return sum(p.amount for p in self.payments)

    @model_validator(mode="after")
    def _payments_cover_total(self) -> "ReceiptRequest":
        if self.paid < self.total:
            raise ValueError(f"płatności ({self.paid}) nie pokrywają sumy ({self.total})")
        non_cash_overpay = sum(p.amount for p in self.payments if p.type != "cash")
        if non_cash_overpay > self.total:
            raise ValueError("nadpłata możliwa tylko gotówką (reszta)")
        return self


class ReceiptResult(BaseModel):
    id: str
    state: Literal["queued", "printing", "printed", "failed", "uncertain"]
    receipt_number: int | None = None
    error: str | None = None
    error_code: int | None = None
    category: str | None = None
    attempts: int = 0
