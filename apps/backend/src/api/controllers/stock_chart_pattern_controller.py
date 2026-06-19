"""Chart-pattern analysis controller for the price chart widget."""

from datetime import date

from fastapi import HTTPException, status

from src.api.schemas.ai_stock_chart import (
    ChartPatternDetection,
    ChartPatternLine,
    ChartPatternPoint,
    StockChartPatternAnalysisResponse,
)
from src.api.schemas.stock_chart import ChartInterval, ChartRange
from src.services.stock_analytics import (
    build_momentum_snapshot,
    build_technical_snapshot,
)
from src.services.stock_chart_service import (
    StockChartService,
    resolve_stock_chart_params,
)
from src.services.stock_pattern_analysis_service import StockPatternAnalysisService
from src.services.stock_pattern_detection import (
    ChartPattern,
    PatternLine,
    PatternPoint,
    detect_chart_patterns,
)


def _schema_point(point: PatternPoint) -> ChartPatternPoint:
    return ChartPatternPoint(
        label=point.label,
        index=point.index,
        date=point.date,
        price=point.price,
    )


def _schema_line(line: PatternLine) -> ChartPatternLine:
    return ChartPatternLine(
        label=line.label,
        kind=line.kind,
        start=_schema_point(line.start),
        end=_schema_point(line.end),
    )


def _schema_pattern(pattern: ChartPattern) -> ChartPatternDetection:
    return ChartPatternDetection(
        pattern_type=pattern.pattern_type,
        display_name=pattern.display_name,
        direction=pattern.direction,
        status=pattern.status,
        confidence=pattern.confidence,
        points=[_schema_point(p) for p in pattern.points],
        lines=[_schema_line(line) for line in pattern.lines],
        breakout_level=pattern.breakout_level,
        invalidation_level=pattern.invalidation_level,
        rationale=pattern.rationale,
    )


class StockChartPatternController:
    """Loads OHLC series, detects chart patterns, and explains the result."""

    def __init__(
        self,
        charts: StockChartService,
        explanations: StockPatternAnalysisService,
    ) -> None:
        self._charts = charts
        self._explanations = explanations

    async def pattern_analysis(
        self,
        *,
        symbol: str,
        interval: ChartInterval,
        chart_range: ChartRange | None,
        from_date: date | None,
        to_date: date | None,
    ) -> StockChartPatternAnalysisResponse:
        try:
            params = resolve_stock_chart_params(
                symbol=symbol,
                interval=interval,
                chart_range=chart_range,
                from_date=from_date,
                to_date=to_date,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        try:
            chart = await self._charts.fetch_chart(params)
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            ) from exc

        patterns = detect_chart_patterns(chart.candles)
        momentum = build_momentum_snapshot(chart.candles)
        technical = build_technical_snapshot(chart.candles)
        analysis = await self._explanations.explain(
            symbol=chart.symbol,
            interval=chart.interval.value,
            from_date=str(chart.from_),
            to_date=str(chart.to),
            patterns=patterns,
            momentum=momentum,
            technical=technical,
        )
        return StockChartPatternAnalysisResponse(
            symbol=chart.symbol,
            interval=chart.interval,
            chart_range=chart.chart_range,
            from_=chart.from_,
            to=chart.to,
            patterns=[_schema_pattern(pattern) for pattern in patterns],
            analysis=analysis,
            model_id=self._explanations.model_id,
            method="pivot_geometry",
        )
