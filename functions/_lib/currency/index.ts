import fetch from "node-fetch";
import { ExchangeRate } from "../../db";

export type ExchangeRateResponse = {
  rates: {
    USD: number;
  };
  base: string;
  date: string; // "2020-11-02"
};

export async function getExchangeRate(base: string): Promise<ExchangeRate> {
  if (base === "USD") {
    return {
      base: "USD",
      rate: 1,
      date: new Date(),
    };
  }

  const response = await fetch(
    `https://api.exchangeratesapi.io/latest?base=${base}&symbols=USD`
  );
  const json = (await response.json()) as ExchangeRateResponse;

  return {
    base,
    rate: json.rates.USD,
    date: new Date(),
  };
}
