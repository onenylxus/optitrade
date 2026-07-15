"""Portfolio query/response models."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class PortfolioBrokerId(StrEnum):
    IBKR = "ibkr"
    FUTU = "futu"
    BINANCE = "binance"
    MOCK = "mock"


class PortfolioBrokerStatus(StrEnum):
    CONNECTED = "connected"
    CONFIGURED = "configured"
    DISCONNECTED = "disconnected"


class PortfolioSnapshotPosition(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    symbol: str
    quantity: float
    avgPrice: float
    currentPrice: float
    sector: str
    marketValue: float | None = None
    costBasis: float | None = None
    unrealizedPnl: float | None = None
    unrealizedPnlPercent: float | None = None


class PortfolioBrokerSettings(BaseModel):
    model_config = ConfigDict(extra="allow")

    host: str | None = None
    port: int | None = None
    clientId: int | None = None
    market: str | None = None
    trdEnv: str | None = None
    testnet: bool | None = None
    apiKeyPreview: str | None = None
    hasSecret: bool | None = None


class PortfolioBroker(BaseModel):
    id: PortfolioBrokerId | None = None
    status: PortfolioBrokerStatus
    broker: str
    name: str | None = None
    settings: PortfolioBrokerSettings = Field(default_factory=PortfolioBrokerSettings)
    host: str | None = None
    port: int | None = None
    clientId: int | None = None
    market: str | None = None
    trdEnv: str | None = None
    testnet: bool | None = None
    accountId: str | None = None
    syncedAt: str | None = None
    lastError: str | None = None


class PortfolioSummary(BaseModel):
    totalValue: float
    totalCost: float | None = None
    pnl: float
    pnlPercent: float
    dailyPnl: float
    dailyPnlPercent: float
    marginUsage: float
    buyingPower: float | None = None


class PortfolioSectorValue(BaseModel):
    sector: str
    value: float
    percent: float


class PortfolioHistoryPoint(BaseModel):
    time: str
    value: float


class PortfolioSnapshotResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    asOf: str
    baseCurrency: str
    source: str
    broker: PortfolioBroker
    positions: list[PortfolioSnapshotPosition]
    summary: PortfolioSummary
    sectorValues: list[PortfolioSectorValue]
    history: list[PortfolioHistoryPoint]


class PortfolioConnectRequest(BaseModel):
    broker: PortfolioBrokerId = PortfolioBrokerId.IBKR
    host: str | None = None
    port: int | None = None
    clientId: int | None = None
    market: str | None = None
    trdEnv: str | None = None
    apiKey: str | None = None
    apiSecret: str | None = None
    testnet: bool | None = None


class PortfolioPaperRequest(BaseModel):
    name: str | None = None
    positions: list[dict[str, object]] | None = None


class PortfolioEditablePosition(BaseModel):
    id: str | None = None
    symbol: str
    quantity: float
    avgPrice: float
    currentPrice: float
    sector: str | None = None


class PortfolioEditableRequest(BaseModel):
    name: str | None = None
    positions: list[PortfolioEditablePosition] | None = None
    history: list[PortfolioHistoryPoint] | None = None


class PortfolioEditableResponse(BaseModel):
    name: str
    positions: list[PortfolioSnapshotPosition]
    history: list[PortfolioHistoryPoint]
    updatedAt: str


class PortfolioPaperResponse(BaseModel):
    id: str
    name: str
    status: str
    positions: list[dict[str, object]]
    createdAt: str


class PortfolioConnectionResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: PortfolioBrokerId
    status: PortfolioBrokerStatus
    broker: str
    name: str | None = None
    settings: PortfolioBrokerSettings = Field(default_factory=PortfolioBrokerSettings)
    accountId: str | None = None
    syncedAt: str | None = None
    lastError: str | None = None
