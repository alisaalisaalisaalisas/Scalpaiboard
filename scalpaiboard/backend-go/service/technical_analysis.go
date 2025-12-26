package service

import (
	"errors"
	"math"
)

type MACDResult struct {
	MACD         float64 `json:"macd"`
	Signal       float64 `json:"signal"`
	Histogram    float64 `json:"histogram"`
	FastPeriod   int     `json:"fastPeriod"`
	SlowPeriod   int     `json:"slowPeriod"`
	SignalPeriod int     `json:"signalPeriod"`
}

type BollingerBandsResult struct {
	Middle  float64 `json:"middle"`
	Upper   float64 `json:"upper"`
	Lower   float64 `json:"lower"`
	StdDev  float64 `json:"stdDev"`
	Period  int     `json:"period"`
	StdMult float64 `json:"stdMult"`
}

type PivotLevels struct {
	Pivot float64 `json:"pivot"`
	R1    float64 `json:"r1"`
	R2    float64 `json:"r2"`
	S1    float64 `json:"s1"`
	S2    float64 `json:"s2"`
}

type TechnicalAnalysis struct {
	Symbol    string  `json:"symbol"`
	Interval  string  `json:"interval"`
	Limit     int     `json:"limit"`
	LastClose float64 `json:"lastClose"`

	RSI struct {
		Value  float64 `json:"value"`
		Period int     `json:"period"`
	} `json:"rsi"`

	MACD      MACDResult           `json:"macd"`
	Bollinger BollingerBandsResult `json:"bollinger"`

	SMA map[string]float64 `json:"sma"`
	EMA map[string]float64 `json:"ema"`

	SupportResistance struct {
		RecentHigh float64     `json:"recentHigh"`
		RecentLow  float64     `json:"recentLow"`
		Pivots     PivotLevels `json:"pivots"`
		Lookback   int         `json:"lookback"`
	} `json:"supportResistance"`
}

func ComputeTechnicalAnalysis(symbol, interval string, closes, highs, lows []float64, limit int) (TechnicalAnalysis, error) {
	if len(closes) < 2 {
		return TechnicalAnalysis{}, errors.New("not enough candles")
	}

	analysis := TechnicalAnalysis{
		Symbol:    symbol,
		Interval:  interval,
		Limit:     limit,
		LastClose: closes[len(closes)-1],
		SMA:       make(map[string]float64),
		EMA:       make(map[string]float64),
	}

	rsiPeriod := 14
	rsi, err := RSI(closes, rsiPeriod)
	if err != nil {
		return TechnicalAnalysis{}, err
	}
	analysis.RSI.Value = rsi
	analysis.RSI.Period = rsiPeriod

	macd, err := MACD(closes, 12, 26, 9)
	if err != nil {
		return TechnicalAnalysis{}, err
	}
	analysis.MACD = macd

	bb, err := BollingerBands(closes, 20, 2.0)
	if err != nil {
		return TechnicalAnalysis{}, err
	}
	analysis.Bollinger = bb

	smaPeriods := []int{9, 21, 50, 200}
	for _, p := range smaPeriods {
		if v, err := SMA(closes, p); err == nil {
			analysis.SMA[intToKey(p)] = v
		}
	}

	emaPeriods := []int{9, 21, 50, 200}
	for _, p := range emaPeriods {
		if v, err := EMAValue(closes, p); err == nil {
			analysis.EMA[intToKey(p)] = v
		}
	}

	lookback := 100
	if len(highs) < lookback {
		lookback = len(highs)
	}
	if lookback < 2 {
		lookback = len(highs)
	}

	recentHigh := highs[len(highs)-lookback]
	recentLow := lows[len(lows)-lookback]
	for i := len(highs) - lookback; i < len(highs); i++ {
		if highs[i] > recentHigh {
			recentHigh = highs[i]
		}
		if lows[i] < recentLow {
			recentLow = lows[i]
		}
	}

	analysis.SupportResistance.RecentHigh = recentHigh
	analysis.SupportResistance.RecentLow = recentLow
	analysis.SupportResistance.Lookback = lookback

	// Classic pivot points from latest completed candle
	lastHigh := highs[len(highs)-1]
	lastLow := lows[len(lows)-1]
	lastClose := closes[len(closes)-1]
	pivot := (lastHigh + lastLow + lastClose) / 3.0

	analysis.SupportResistance.Pivots = PivotLevels{
		Pivot: pivot,
		R1:    2*pivot - lastLow,
		S1:    2*pivot - lastHigh,
		R2:    pivot + (lastHigh - lastLow),
		S2:    pivot - (lastHigh - lastLow),
	}

	return analysis, nil
}

func intToKey(p int) string {
	return "p" + strconvItoa(p)
}

func strconvItoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	buf := make([]byte, 0, 12)
	for n > 0 {
		d := n % 10
		buf = append(buf, byte('0'+d))
		n /= 10
	}
	// reverse
	for i, j := 0, len(buf)-1; i < j; i, j = i+1, j-1 {
		buf[i], buf[j] = buf[j], buf[i]
	}
	if neg {
		buf = append([]byte{'-'}, buf...)
	}
	return string(buf)
}

func SMA(values []float64, period int) (float64, error) {
	if period <= 0 {
		return 0, errors.New("invalid period")
	}
	if len(values) < period {
		return 0, errors.New("not enough data")
	}

	sum := 0.0
	for _, v := range values[len(values)-period:] {
		sum += v
	}
	return sum / float64(period), nil
}

func EMA(values []float64, period int) ([]float64, error) {
	if period <= 0 {
		return nil, errors.New("invalid period")
	}
	if len(values) < period {
		return nil, errors.New("not enough data")
	}

	k := 2.0 / float64(period+1)
	ema := make([]float64, 0, len(values)-period+1)

	// seed with SMA
	seed, _ := SMA(values[:period], period)
	prev := seed
	ema = append(ema, prev)

	for i := period; i < len(values); i++ {
		prev = values[i]*k + prev*(1-k)
		ema = append(ema, prev)
	}

	return ema, nil
}

func EMAValue(values []float64, period int) (float64, error) {
	series, err := EMA(values, period)
	if err != nil {
		return 0, err
	}
	return series[len(series)-1], nil
}

func RSI(closes []float64, period int) (float64, error) {
	if period <= 0 {
		return 0, errors.New("invalid period")
	}
	if len(closes) < period+1 {
		return 0, errors.New("not enough data")
	}

	gain := 0.0
	loss := 0.0
	for i := 1; i <= period; i++ {
		delta := closes[i] - closes[i-1]
		if delta >= 0 {
			gain += delta
		} else {
			loss -= delta
		}
	}

	avgGain := gain / float64(period)
	avgLoss := loss / float64(period)

	for i := period + 1; i < len(closes); i++ {
		delta := closes[i] - closes[i-1]
		g := 0.0
		l := 0.0
		if delta >= 0 {
			g = delta
		} else {
			l = -delta
		}
		avgGain = (avgGain*float64(period-1) + g) / float64(period)
		avgLoss = (avgLoss*float64(period-1) + l) / float64(period)
	}

	if avgLoss == 0 {
		return 100, nil
	}
	rs := avgGain / avgLoss
	rsi := 100 - (100 / (1 + rs))
	return rsi, nil
}

func MACD(closes []float64, fastPeriod, slowPeriod, signalPeriod int) (MACDResult, error) {
	if fastPeriod <= 0 || slowPeriod <= 0 || signalPeriod <= 0 {
		return MACDResult{}, errors.New("invalid period")
	}
	if fastPeriod >= slowPeriod {
		return MACDResult{}, errors.New("fast period must be < slow period")
	}
	if len(closes) < slowPeriod+signalPeriod {
		return MACDResult{}, errors.New("not enough data")
	}

	fastEMA, err := EMA(closes, fastPeriod)
	if err != nil {
		return MACDResult{}, err
	}
	slowEMA, err := EMA(closes, slowPeriod)
	if err != nil {
		return MACDResult{}, err
	}

	// align by the end: slowEMA starts later
	offset := len(fastEMA) - len(slowEMA)
	macdSeries := make([]float64, 0, len(slowEMA))
	for i := 0; i < len(slowEMA); i++ {
		macdSeries = append(macdSeries, fastEMA[i+offset]-slowEMA[i])
	}

	signalEMA, err := EMA(macdSeries, signalPeriod)
	if err != nil {
		return MACDResult{}, err
	}

	macdValue := macdSeries[len(macdSeries)-1]
	signalValue := signalEMA[len(signalEMA)-1]

	return MACDResult{
		MACD:         macdValue,
		Signal:       signalValue,
		Histogram:    macdValue - signalValue,
		FastPeriod:   fastPeriod,
		SlowPeriod:   slowPeriod,
		SignalPeriod: signalPeriod,
	}, nil
}

func BollingerBands(closes []float64, period int, stdMult float64) (BollingerBandsResult, error) {
	if period <= 0 {
		return BollingerBandsResult{}, errors.New("invalid period")
	}
	if len(closes) < period {
		return BollingerBandsResult{}, errors.New("not enough data")
	}

	window := closes[len(closes)-period:]
	mean, _ := SMA(closes, period)

	variance := 0.0
	for _, v := range window {
		d := v - mean
		variance += d * d
	}
	variance /= float64(period)
	stdDev := math.Sqrt(variance)

	return BollingerBandsResult{
		Middle:  mean,
		Upper:   mean + stdMult*stdDev,
		Lower:   mean - stdMult*stdDev,
		StdDev:  stdDev,
		Period:  period,
		StdMult: stdMult,
	}, nil
}
