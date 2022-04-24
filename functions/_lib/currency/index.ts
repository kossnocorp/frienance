import fetch from "node-fetch";
import { ExchangeRate } from "../../db";
import * as functions from "firebase-functions";

const { key } = (functions.config().currency_converter || {}) as {
  key?: string;
};

export async function getExchangeRate(base: string): Promise<ExchangeRate> {
  if (base === "USD") {
    return {
      base: "USD",
      rate: 1,
      date: new Date(),
    };
  }

  const conversionKey = `${base}_USD`;

  const response = await fetch(
    `https://prepaid.currconv.com/api/v7/convert?q=${conversionKey}&compact=ultra&apiKey=${key}`
  );
  const json = await response.json();

  return {
    base,
    rate: json[conversionKey],
    date: new Date(),
  };
}
