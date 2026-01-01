import { useEffect, useRef } from "react";
import { createChart, type IChartApi, ColorType, LineStyle, CandlestickSeries, HistogramSeries, LineSeries } from "lightweight-charts";
import { useTheme } from "@/lib/theme-provider";

interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface PriceChartProps {
  data: CandleData[];
  ema9?: number[];
  ema21?: number[];
  resistanceLevel?: number;
  stopLevel?: number;
  ticker?: string;
  className?: string;
}

export function PriceChart({
  data,
  ema9,
  ema21,
  resistanceLevel,
  stopLevel,
  ticker,
  className,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = theme === "dark";

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: isDark ? "#a1a1aa" : "#71717a",
        fontFamily: "Inter, sans-serif",
      },
      grid: {
        vertLines: { color: isDark ? "#27272a" : "#e4e4e7" },
        horzLines: { color: isDark ? "#27272a" : "#e4e4e7" },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: isDark ? "#3f3f46" : "#d4d4d8",
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: isDark ? "#3f3f46" : "#d4d4d8",
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: isDark ? "#27272a" : "#e4e4e7",
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: isDark ? "#27272a" : "#e4e4e7",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: isDark ? "#3b82f680" : "#3b82f660",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    if (data.length > 0) {
      const candleData = data.map(d => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));
      candlestickSeries.setData(candleData as any);

      const volumeData = data.map(d => ({
        time: d.time,
        value: d.volume || 0,
        color: d.close >= d.open
          ? (isDark ? "#22c55e60" : "#22c55e40")
          : (isDark ? "#ef444460" : "#ef444440"),
      }));
      volumeSeries.setData(volumeData as any);
    }

    if (ema9 && data.length > 0) {
      const ema9Series = chart.addSeries(LineSeries, {
        color: "#f59e0b",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const ema9Data = ema9.map((value, i) => ({
        time: data[i]?.time,
        value,
      })).filter(d => d.time && d.value);
      ema9Series.setData(ema9Data as any);
    }

    if (ema21 && data.length > 0) {
      const ema21Series = chart.addSeries(LineSeries, {
        color: "#3b82f6",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const ema21Data = ema21.map((value, i) => ({
        time: data[i]?.time,
        value,
      })).filter(d => d.time && d.value);
      ema21Series.setData(ema21Data as any);
    }

    if (resistanceLevel) {
      const resistanceLine = chart.addSeries(LineSeries, {
        color: "#22c55e",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: true,
      });
      if (data.length > 0) {
        resistanceLine.setData([
          { time: data[0].time, value: resistanceLevel },
          { time: data[data.length - 1].time, value: resistanceLevel },
        ] as any);
      }
    }

    if (stopLevel) {
      const stopLine = chart.addSeries(LineSeries, {
        color: "#ef4444",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: true,
      });
      if (data.length > 0) {
        stopLine.setData([
          { time: data[0].time, value: stopLevel },
          { time: data[data.length - 1].time, value: stopLevel },
        ] as any);
      }
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, ema9, ema21, resistanceLevel, stopLevel, theme]);

  return (
    <div 
      ref={containerRef} 
      className={`w-full min-h-[400px] ${className || ""}`}
      data-testid="price-chart"
    />
  );
}

export function ChartPlaceholder() {
  return (
    <div className="flex items-center justify-center min-h-[400px] rounded-md border border-dashed bg-muted/20">
      <div className="text-center">
        <p className="text-muted-foreground">Select a symbol to view chart</p>
      </div>
    </div>
  );
}
