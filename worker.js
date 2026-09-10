
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    try {
      const dabUrl = "https://www.dab.gov.af/exchange-rates";

      const response = await fetch(dabUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0"
        },
        cf: {
          cacheTtl: 1800,
          cacheEverything: true
        }
      });

      if (!response.ok) {
        throw new Error("DAB website could not be reached");
      }

      const html = await response.text();

      let updated = "";

      const dateMatch = html.match(
        /Last updated\s*:?\s*([^<\r\n]+)/i
      );

      if (dateMatch) {
        updated = dateMatch[1].trim();
      }

      const tableMatch = html.match(
        /<table[\s\S]*?<\/table>/i
      );

      if (!tableMatch) {
        throw new Error("Exchange rate table not found");
      }

      const table = tableMatch[0];

      const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) || [];

      const rates = [];

      for (const row of rows) {
        const cells = row.match(/<(td|th)[^>]*>[\s\S]*?<\/\1>/gi) || [];

        if (cells.length < 5) {
          continue;
        }

        const values = cells.map(cell => {
          return cell
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/gi, " ")
            .replace(/&amp;/gi, "&")
            .replace(/\s+/g, " ")
            .trim();
        });

        const currency = values[0];

        if (
          currency.toLowerCase().includes("currency") ||
          values[1].toLowerCase().includes("cash")
        ) {
          continue;
        }

        const numbers = values.slice(1, 5).map(v => {
          const n = parseFloat(v.replace(/,/g, ""));
          return Number.isFinite(n) ? n : null;
        });

        if (
          currency &&
          numbers.length === 4 &&
          numbers.every(n => n !== null)
        ) {
          rates.push({
            currency: currency,
            cash_sell: numbers[0],
            cash_buy: numbers[1],
            transfer_sell: numbers[2],
            transfer_buy: numbers[3]
          });
        }
      }

      if (rates.length === 0) {
        throw new Error("No exchange rates were found");
      }

      const result = {
        success: true,
        source: "Da Afghanistan Bank",
        source_url: dabUrl,
        updated: updated,
        rates: rates
      };

      return new Response(
        JSON.stringify(result, null, 2),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=UTF-8",
            "Cache-Control": "public, max-age=1800"
          }
        }
      );

    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=UTF-8"
          }
        }
      );
    }
  }
};
