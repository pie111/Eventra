// ─── Stock Price Tool ─────────────────────────────────────────

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export const stockPriceTool = new DynamicStructuredTool({
    name: "get_stock_price",
    description: "Get the current stock or cryptocurrency price. Supports tickers like AAPL, GOOGL, BTC-USD, ETH-USD.",
    schema: z.object({
        symbol: z.string().describe("Stock or crypto ticker symbol (e.g., AAPL, BTC-USD)"),
    }),
    func: async ({ symbol }) => {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
            const response = await fetch(url, {
                headers: { "User-Agent": "Eventra/0.1.0" },
            });

            if (!response.ok) {
                return JSON.stringify({ error: `Failed to fetch price for "${symbol}": ${response.statusText}` });
            }

            const data = (await response.json()) as {
                chart: {
                    result?: Array<{
                        meta: {
                            regularMarketPrice: number;
                            previousClose: number;
                            currency: string;
                            exchangeName: string;
                        };
                    }>;
                    error?: { description: string };
                };
            };

            if (data.chart.error) {
                return JSON.stringify({ error: data.chart.error.description });
            }

            const meta = data.chart.result?.[0]?.meta;
            if (!meta) {
                return JSON.stringify({ error: `No data found for symbol "${symbol}"` });
            }

            const change = meta.regularMarketPrice - meta.previousClose;
            const changePercent = (change / meta.previousClose) * 100;

            return JSON.stringify({
                symbol: symbol.toUpperCase(),
                price: meta.regularMarketPrice,
                previousClose: meta.previousClose,
                change: parseFloat(change.toFixed(2)),
                changePercent: parseFloat(changePercent.toFixed(2)),
                currency: meta.currency,
                exchange: meta.exchangeName,
            });
        } catch (err) {
            return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
        }
    },
});
