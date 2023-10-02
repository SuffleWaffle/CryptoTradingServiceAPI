export function SMA(prices, period, startIndex = 0) {
  if (!prices || prices.length < period) {
    return [];
  }

  let index = startIndex + period - 1;
  const SMA = [];

  while (++index <= prices.length) {
    const windowSlice = prices.slice(index - period, index);
    const sum = windowSlice.reduce((prev, curr) => prev + curr, 0);
    SMA.push(sum / period);
  }

  return SMA;
}

// 1. Calculate the SMA
//    (Period Values / Number of Periods)
// 2. Calculate the Multiplier
//    (2 / (Number of Periods + 1) therefore (2 / (5+1) = 33.333%
// 3. Calculate the EMA
//    For the first EMA, we use the SMA(previous day) instead of EMA(previous day).
// EMA = {Close - EMA(previous day)} x multiplier + EMA(previous day)
export function EMA(prices: number[], period: number): number[] {
  if (!prices || prices.length - 1 < period) {
    return [];
  }

  let index = prices.length - period;
  let previousEmaIndex = 0;
  const smoothingFactor = 2 / (period + 1);

  const EMA = [];

  const windowSlice = prices.slice(index, index + period);
  const [sma] = SMA(windowSlice, period);
  EMA.push(sma);

  while (--index >= 0) {
    const price = prices[index];
    const previousEma = EMA[previousEmaIndex++];
    const currentEma = (price - previousEma) * smoothingFactor + previousEma;

    // console.log(
    //   prices.length,
    //   index,
    //   currentEma,
    //   price,
    //   previousEma,
    //   smoothingFactor,
    //   previousEma
    // );
    EMA.push(currentEma);
  }

  return EMA.reverse();
}

//+------------------------------------------------------------------+
//| Smoothed Moving Average                                          |
//+------------------------------------------------------------------+
// double SmoothedMA(const int position,const int period,const double prev_value,const double &price[])
// {
//   double result=0.0;
// //--- check period
//   if(period>0 && period<=(position+1))
//   {
//     if(position==period-1)
//     {
//       for(int i=0; i<period; i++)
//       result+=price[position-i];
//
//       result/=period;
//     }
//
//     result=(prev_value*(period-1)+price[position])/period;
//   }
//
//   return(result);
// }
export function SmoothedMA(position: number, period: number, prev_value: number, price: number[]): number {
  let result = 0.0;

  if (period > 0 && period <= position + 1) {
    if (position === period - 1) {
      for (let i = 0; i < period; i++) {
        result += price[position - i];
      }

      result /= period;
    }

    result = (prev_value * (period - 1) + price[position]) / period;
  }

  return result;
}

//+------------------------------------------------------------------+
//| Linear Weighted Moving Average                                   |
//+------------------------------------------------------------------+
// double LinearWeightedMA(const int position,const int period,const double &price[])
// {
//   double result=0.0;
// //--- check period
//   if(period>0 && period<=(position+1))
//   {
//     double sum =0.0;
//     int    wsum=0;
//
//     for(int i=period; i>0; i--)
//     {
//       wsum+=i;
//       sum +=price[position-i+1]*(period-i+1);
//     }
//
//     result=sum/wsum;
//   }
//
//   return(result);
// }
export function LWMA(prices: number[], period: number): number[] {
  if (!prices || prices.length < period) {
    return [];
  }

  let index = prices.length - period;
  const LWMA = [];

  while (--index >= 0) {
    const windowSlice = prices.slice(index, index + period).reverse();
    let sum = 0,
      wsum = 0;

    for (let i = 1; i <= windowSlice.length; i++) {
      wsum += i;
      sum += windowSlice[i - 1] * i;
    }

    LWMA.push(sum / wsum);
  }

  return LWMA.reverse();
}
